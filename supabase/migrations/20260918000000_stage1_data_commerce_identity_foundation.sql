-- BUILD 1 — FOUNDATION + PRODUCT IDENTITY PARITY
-- Migration: 20260918000000_stage1_data_commerce_identity_foundation.sql

-- 1. Clean taxonomy whitespace
UPDATE public.product_types 
SET name = trim(name), 
    code_prefix = upper(trim(code_prefix))
WHERE name != trim(name) OR code_prefix != upper(trim(code_prefix));

-- 2. Apex Product Code Generator RPC with Advisory Locking
CREATE OR REPLACE FUNCTION public.generate_product_code(_type_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_prefix text;
  v_next_num bigint;
  v_code text;
  v_lock_key bigint;
BEGIN
  -- Obtain advisory transaction lock per type to guarantee concurrency safety
  IF _type_id IS NOT NULL THEN
    v_lock_key := ('x' || substr(md5(_type_id::text), 1, 8))::bit(32)::int;
  ELSE
    v_lock_key := 888888;
  END IF;
  
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Determine prefix from product_types
  IF _type_id IS NOT NULL THEN
    SELECT upper(trim(code_prefix)) INTO v_prefix
    FROM public.product_types
    WHERE id = _type_id;
  END IF;

  IF v_prefix IS NULL OR trim(v_prefix) = '' THEN
    v_prefix := 'GEN';
  END IF;

  -- Find highest sequence number for this prefix across APX- and legacy formats
  SELECT COALESCE(
    MAX(
      SUBSTRING(code FROM '([0-9]{1,10})$')::bigint
    ), 0
  ) + 1
  INTO v_next_num
  FROM public.products
  WHERE code ~ ('^APX-' || v_prefix || '-[0-9]+$')
     OR code ~ ('^EC-' || v_prefix || '-[0-9]+$')
     OR code ~ ('^[A-Z0-9]+-' || v_prefix || '-[0-9]+$');

  v_code := 'APX-' || v_prefix || '-' || lpad(v_next_num::text, 6, '0');

  RETURN v_code;
END;
$$;

-- 3. Auto-code Trigger on Products (BEFORE INSERT)
CREATE OR REPLACE FUNCTION public.products_autocode()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.code IS NULL OR trim(NEW.code) = '' THEN
    NEW.code := public.generate_product_code(NEW.type_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_autocode ON public.products;
CREATE TRIGGER trg_products_autocode
  BEFORE INSERT ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.products_autocode();

-- 4. Partial Unique Indexes on Active Products
DROP INDEX IF EXISTS idx_products_code_active;
CREATE UNIQUE INDEX idx_products_code_active ON public.products (code) WHERE deleted_at IS NULL;

DROP INDEX IF EXISTS idx_products_slug_active;
CREATE UNIQUE INDEX idx_products_slug_active ON public.products (slug) WHERE deleted_at IS NULL;

-- 5. Redirects Table Enhancements
ALTER TABLE public.redirects 
  ADD COLUMN IF NOT EXISTS source_slug text,
  ADD COLUMN IF NOT EXISTS target_slug text,
  ADD COLUMN IF NOT EXISTS entity_type text DEFAULT 'product';

CREATE INDEX IF NOT EXISTS idx_redirects_source_slug ON public.redirects(source_slug);
CREATE INDEX IF NOT EXISTS idx_redirects_old_path ON public.redirects(old_path);

-- Drop duplicate/legacy trigger if present
DROP TRIGGER IF EXISTS trg_product_slug_change ON public.products;
DROP FUNCTION IF EXISTS public.handle_product_slug_change();

-- 6. Canonical Slug History & Redirect Trigger (AFTER UPDATE)
CREATE OR REPLACE FUNCTION public.products_slug_redirect_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.slug IS DISTINCT FROM NEW.slug AND OLD.slug IS NOT NULL AND trim(OLD.slug) != '' THEN
    INSERT INTO public.redirects (
      old_path,
      new_path,
      source_slug,
      target_slug,
      entity_type,
      status_code,
      created_at
    ) VALUES (
      '/product/' || OLD.slug,
      '/product/' || NEW.slug,
      OLD.slug,
      NEW.slug,
      'product',
      301,
      now()
    )
    ON CONFLICT (old_path) 
    DO UPDATE SET 
      new_path = EXCLUDED.new_path,
      source_slug = EXCLUDED.source_slug,
      target_slug = EXCLUDED.target_slug,
      entity_type = EXCLUDED.entity_type,
      status_code = EXCLUDED.status_code,
      created_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_slug_redirect ON public.products;
CREATE TRIGGER trg_products_slug_redirect
  AFTER UPDATE OF slug ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.products_slug_redirect_trigger();
