-- ============================================================
-- APEX SECURITY — BUILD 2 FINALIZATION: DISCOVERY ENGINE & SECURITY HARDENING
-- Specification ID: APEX-B2-FINAL-001
-- Migration: 20260925000000_stage2_finalization_discovery_security_hardening.sql
-- ============================================================

-- 1. CANONICAL REBUILD SEARCH INDEX FUNCTION (LIFECYCLE & VOCABULARY & AUTHORITY HARDENING)
CREATE OR REPLACE FUNCTION public.rebuild_search_index(_product_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  p record;
  t_row record;
  c_row record;
  s_row record;
  f_row record;
  
  v_keywords text[];
  v_alt_names text[];
  v_customer_phrases text[];
  v_synonyms text[];
  v_related text[];
  v_misspellings text[];
  v_aliases text[];
  v_showroom_tokens text[];
  v_all_tokens text[];
  
  v_combined text;
  v_vector tsvector;
  v_master jsonb;
BEGIN
  SELECT * INTO p FROM public.products WHERE id = _product_id;
  IF NOT FOUND THEN
    -- Clean up orphaned index row if product no longer exists
    DELETE FROM public.search_index WHERE product_id = _product_id;
    RETURN;
  END IF;

  -- 1. STRICT PUBLIC LIFECYCLE ENFORCEMENT:
  -- If product is deleted, hidden, or unpublished, purge from public discovery index
  IF p.deleted_at IS NOT NULL OR COALESCE(p.hidden, false) = true OR COALESCE(p.status::text, 'published') != 'published' THEN
    DELETE FROM public.search_index WHERE product_id = _product_id;
    RETURN;
  END IF;

  -- 2. Load Taxonomy details
  SELECT name, slug INTO t_row FROM public.product_types WHERE id = p.type_id;
  SELECT name, slug INTO c_row FROM public.categories WHERE id = p.category_id;
  SELECT name, slug INTO s_row FROM public.subcategories WHERE id = p.subcategory_id;
  SELECT name, slug INTO f_row FROM public.family_groups WHERE id = p.family_id;

  -- 3. SEARCH INTELLIGENCE AUTHORITY (MANUAL APP_KEYWORDS + AI SEARCH_KEYWORDS MERGE)
  -- Manual terms remain authoritative; AI terms enrich them without either source erasing the other.
  v_keywords := ARRAY[]::text[];
  WITH combined_kws AS (
    -- Manual authoritative keywords
    SELECT lower(trim(val)) AS kw
    FROM unnest(COALESCE(p.app_keywords, ARRAY[]::text[])) val
    WHERE trim(val) != ''
    UNION
    -- AI-enriched search keywords
    SELECT lower(trim(val)) AS kw
    FROM jsonb_array_elements_text(
      CASE 
        WHEN p.ai_understanding IS NOT NULL AND jsonb_typeof(p.ai_understanding->'search_keywords') = 'array' 
        THEN p.ai_understanding->'search_keywords'
        ELSE '[]'::jsonb
      END
    ) val
    WHERE trim(val) != ''
  )
  SELECT COALESCE(array_agg(DISTINCT kw), ARRAY[]::text[])
  INTO v_keywords
  FROM combined_kws;

  -- Alternative names / terms
  v_alt_names := ARRAY[]::text[];
  IF p.ai_understanding IS NOT NULL AND jsonb_typeof(p.ai_understanding->'alternative_terms') = 'array' THEN
    SELECT COALESCE(array_agg(DISTINCT lower(trim(val))), ARRAY[]::text[])
    INTO v_alt_names
    FROM jsonb_array_elements_text(p.ai_understanding->'alternative_terms') val
    WHERE trim(val) != '';
  ELSIF p.ai_understanding IS NOT NULL AND jsonb_typeof(p.ai_understanding->'alternative_names') = 'array' THEN
    SELECT COALESCE(array_agg(DISTINCT lower(trim(val))), ARRAY[]::text[])
    INTO v_alt_names
    FROM jsonb_array_elements_text(p.ai_understanding->'alternative_names') val
    WHERE trim(val) != '';
  END IF;

  -- Customer search phrases
  v_customer_phrases := ARRAY[]::text[];
  IF p.ai_understanding IS NOT NULL AND jsonb_typeof(p.ai_understanding->'customer_phrases') = 'array' THEN
    SELECT COALESCE(array_agg(DISTINCT lower(trim(val))), ARRAY[]::text[])
    INTO v_customer_phrases
    FROM jsonb_array_elements_text(p.ai_understanding->'customer_phrases') val
    WHERE trim(val) != '';
  END IF;

  -- Synonyms
  v_synonyms := ARRAY[]::text[];
  IF p.ai_understanding IS NOT NULL AND jsonb_typeof(p.ai_understanding->'synonyms') = 'array' THEN
    SELECT COALESCE(array_agg(DISTINCT lower(trim(val))), ARRAY[]::text[])
    INTO v_synonyms
    FROM jsonb_array_elements_text(p.ai_understanding->'synonyms') val
    WHERE trim(val) != '';
  END IF;

  -- Related search terms
  v_related := ARRAY[]::text[];
  IF p.ai_understanding IS NOT NULL AND jsonb_typeof(p.ai_understanding->'related_terms') = 'array' THEN
    SELECT COALESCE(array_agg(DISTINCT lower(trim(val))), ARRAY[]::text[])
    INTO v_related
    FROM jsonb_array_elements_text(p.ai_understanding->'related_terms') val
    WHERE trim(val) != '';
  END IF;

  -- Common misspellings
  v_misspellings := ARRAY[]::text[];
  IF p.ai_understanding IS NOT NULL AND jsonb_typeof(p.ai_understanding->'misspellings') = 'array' THEN
    SELECT COALESCE(array_agg(DISTINCT lower(trim(val))), ARRAY[]::text[])
    INTO v_misspellings
    FROM jsonb_array_elements_text(p.ai_understanding->'misspellings') val
    WHERE trim(val) != '';
  END IF;

  -- Size Aliases
  v_aliases := ARRAY[]::text[];
  IF p.size IS NOT NULL AND trim(p.size) != '' THEN
    v_aliases := ARRAY[lower(trim(p.size)), replace(lower(trim(p.size)), ' ', ''), replace(lower(trim(p.size)), 'x', ' x ')];
  END IF;

  -- 4. CONTEXTUAL APEX SECURITY VOCABULARY
  -- (Purged generic geography 'nigeria', 'abuja' — only relevant security context preserved)
  v_showroom_tokens := ARRAY[
    'apex security',
    'security solution',
    'surveillance',
    'commercial security',
    'residential security'
  ];

  -- Combine all tokens for search aliases
  SELECT COALESCE(array_agg(DISTINCT lower(trim(val))), ARRAY[]::text[])
  INTO v_all_tokens
  FROM unnest(
    v_keywords || v_alt_names || v_customer_phrases || v_synonyms || v_related || v_misspellings || v_aliases || v_showroom_tokens
  ) val
  WHERE trim(val) != '';

  -- Master document JSONB projection
  v_master := jsonb_build_object(
    'id', p.id,
    'name', p.name,
    'code', p.code,
    'brand', COALESCE(p.brand, 'Apex Security Ltd'),
    'material', p.material,
    'finish', COALESCE(p.finish, p.finish_name),
    'color', p.color,
    'size', p.size,
    'price', p.price,
    'type_name', t_row.name,
    'type_slug', t_row.slug,
    'category_name', c_row.name,
    'category_slug', c_row.slug,
    'subcategory_name', s_row.name,
    'subcategory_slug', s_row.slug,
    'family_name', f_row.name,
    'family_slug', f_row.slug,
    'search_keywords', to_jsonb(v_keywords),
    'alternative_names', to_jsonb(v_alt_names),
    'customer_search_phrases', to_jsonb(v_customer_phrases),
    'search_synonyms', to_jsonb(v_synonyms),
    'related_search_terms', to_jsonb(v_related),
    'common_misspellings', to_jsonb(v_misspellings),
    'short_description', p.short_description,
    'generated_description', p.generated_description,
    'seo_title', p.seo_title,
    'seo_description', p.seo_description
  );

  -- Combined Search Text representation
  v_combined := concat_ws(' ',
    p.name,
    p.code,
    COALESCE(p.brand, 'Apex Security Ltd'),
    t_row.name,
    c_row.name,
    s_row.name,
    f_row.name,
    p.material,
    p.finish,
    p.finish_name,
    p.color,
    p.size,
    p.short_description,
    p.generated_description,
    p.seo_title,
    p.seo_description,
    array_to_string(v_all_tokens, ' ')
  );

  -- Weighted Full-Text Vector
  v_vector := 
    setweight(to_tsvector('english', concat_ws(' ', p.name, p.code, COALESCE(p.brand, 'Apex Security Ltd'))), 'A') ||
    setweight(to_tsvector('english', concat_ws(' ', t_row.name, c_row.name, s_row.name, f_row.name, array_to_string(v_alt_names, ' '))), 'B') ||
    setweight(to_tsvector('english', concat_ws(' ', p.material, p.finish, p.finish_name, p.color, p.size, array_to_string(v_synonyms, ' '), array_to_string(v_customer_phrases, ' '))), 'C') ||
    setweight(to_tsvector('english', concat_ws(' ', p.short_description, p.generated_description, array_to_string(v_related, ' '), array_to_string(v_misspellings, ' '))), 'D');

  -- Atomic Upsert into search_index
  INSERT INTO public.search_index (
    product_id,
    name,
    code,
    brand,
    type_id,
    type_name,
    type_slug,
    category_id,
    category_name,
    category_slug,
    subcategory_id,
    subcategory_name,
    subcategory_slug,
    family_id,
    family_name,
    family_slug,
    material,
    finish,
    color,
    size,
    price,
    status,
    hidden,
    deleted_at,
    search_keywords,
    alternative_names,
    customer_search_phrases,
    search_synonyms,
    related_search_terms,
    common_misspellings,
    showroom_tokens,
    search_aliases,
    combined_search_text,
    search_vector,
    master_document,
    updated_at
  ) VALUES (
    p.id,
    p.name,
    p.code,
    COALESCE(p.brand, 'Apex Security Ltd'),
    p.type_id,
    t_row.name,
    t_row.slug,
    p.category_id,
    c_row.name,
    c_row.slug,
    p.subcategory_id,
    s_row.name,
    s_row.slug,
    p.family_id,
    f_row.name,
    f_row.slug,
    p.material,
    COALESCE(p.finish, p.finish_name),
    p.color,
    p.size,
    p.price,
    COALESCE(p.status::text, 'published'),
    COALESCE(p.hidden, false),
    p.deleted_at,
    v_keywords,
    v_alt_names,
    v_customer_phrases,
    v_synonyms,
    v_related,
    v_misspellings,
    v_showroom_tokens,
    v_all_tokens,
    v_combined,
    v_vector,
    v_master,
    now()
  )
  ON CONFLICT (product_id) DO UPDATE SET
    name = EXCLUDED.name,
    code = EXCLUDED.code,
    brand = EXCLUDED.brand,
    type_id = EXCLUDED.type_id,
    type_name = EXCLUDED.type_name,
    type_slug = EXCLUDED.type_slug,
    category_id = EXCLUDED.category_id,
    category_name = EXCLUDED.category_name,
    category_slug = EXCLUDED.category_slug,
    subcategory_id = EXCLUDED.subcategory_id,
    subcategory_name = EXCLUDED.subcategory_name,
    subcategory_slug = EXCLUDED.subcategory_slug,
    family_id = EXCLUDED.family_id,
    family_name = EXCLUDED.family_name,
    family_slug = EXCLUDED.family_slug,
    material = EXCLUDED.material,
    finish = EXCLUDED.finish,
    color = EXCLUDED.color,
    size = EXCLUDED.size,
    price = EXCLUDED.price,
    status = EXCLUDED.status,
    hidden = EXCLUDED.hidden,
    deleted_at = EXCLUDED.deleted_at,
    search_keywords = EXCLUDED.search_keywords,
    alternative_names = EXCLUDED.alternative_names,
    customer_search_phrases = EXCLUDED.customer_search_phrases,
    search_synonyms = EXCLUDED.search_synonyms,
    related_search_terms = EXCLUDED.related_search_terms,
    common_misspellings = EXCLUDED.common_misspellings,
    showroom_tokens = EXCLUDED.showroom_tokens,
    search_aliases = EXCLUDED.search_aliases,
    combined_search_text = EXCLUDED.combined_search_text,
    search_vector = EXCLUDED.search_vector,
    master_document = EXCLUDED.master_document,
    updated_at = now();
END;
$$;


-- 2. HARDENED ADMIN DIAGNOSTIC RPC (get_search_index_diagnostics)
CREATE OR REPLACE FUNCTION public.get_search_index_diagnostics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_published_count bigint;
  v_indexed_count bigint;
  v_missing_index_count bigint;
  v_orphaned_index_count bigint;
  v_hidden_indexed_count bigint;
  v_deleted_indexed_count bigint;
  v_status text;
  v_missing_ids uuid[];
BEGIN
  -- Strict Authorization: Admin user or service_role only
  IF NOT (
    auth.role() = 'service_role' OR 
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      JOIN public.profiles pr ON pr.id = ur.user_id 
      WHERE pr.auth_id = auth.uid() AND ur.role = 'admin'
    )
  ) THEN
    RAISE EXCEPTION 'Access denied: Admin or service role privileges required'
      USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_published_count FROM public.products WHERE status = 'published' AND hidden = false AND deleted_at IS NULL;
  SELECT count(*) INTO v_indexed_count FROM public.search_index;
  
  -- Missing index for published active products
  SELECT count(*), array_agg(p.id) INTO v_missing_index_count, v_missing_ids
  FROM public.products p
  LEFT JOIN public.search_index si ON si.product_id = p.id
  WHERE p.status = 'published' AND p.hidden = false AND p.deleted_at IS NULL AND si.product_id IS NULL;

  -- Orphaned search index records (no matching active product)
  SELECT count(*) INTO v_orphaned_index_count
  FROM public.search_index si
  LEFT JOIN public.products p ON p.id = si.product_id
  WHERE p.id IS NULL;

  -- Deleted products inside search index
  SELECT count(*) INTO v_deleted_indexed_count
  FROM public.search_index si
  JOIN public.products p ON p.id = si.product_id
  WHERE p.deleted_at IS NOT NULL;

  -- Hidden or unpublished products inside search index
  SELECT count(*) INTO v_hidden_indexed_count
  FROM public.search_index si
  JOIN public.products p ON p.id = si.product_id
  WHERE p.hidden = true OR p.status != 'published';

  -- Status determination: Any lifecycle inconsistency is flagged
  IF COALESCE(v_missing_index_count, 0) = 0 
     AND COALESCE(v_orphaned_index_count, 0) = 0 
     AND COALESCE(v_deleted_indexed_count, 0) = 0 
     AND COALESCE(v_hidden_indexed_count, 0) = 0 THEN
    v_status := 'PASS';
  ELSIF COALESCE(v_missing_index_count, 0) > 0 OR COALESCE(v_orphaned_index_count, 0) > 0 THEN
    v_status := 'WARN';
  ELSE
    v_status := 'FAIL';
  END IF;

  RETURN jsonb_build_object(
    'status', v_status,
    'published_active_products', v_published_count,
    'indexed_products', v_indexed_count,
    'missing_index_count', COALESCE(v_missing_index_count, 0),
    'orphaned_index_count', COALESCE(v_orphaned_index_count, 0),
    'hidden_in_index_count', COALESCE(v_hidden_indexed_count, 0),
    'deleted_in_index_count', COALESCE(v_deleted_indexed_count, 0),
    'missing_product_sample_ids', to_jsonb(v_missing_ids[1:5])
  );
END;
$$;


-- 3. HARDENED ADMIN REBUILD ENTIRE SEARCH INDEX RPC (rebuild_all_search_indexes)
CREATE OR REPLACE FUNCTION public.rebuild_all_search_indexes()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r record;
  v_processed bigint := 0;
  v_cleaned bigint := 0;
BEGIN
  -- Strict Authorization: Admin user or service_role only
  IF NOT (
    auth.role() = 'service_role' OR 
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      JOIN public.profiles pr ON pr.id = ur.user_id 
      WHERE pr.auth_id = auth.uid() AND ur.role = 'admin'
    )
  ) THEN
    RAISE EXCEPTION 'Access denied: Admin or service role privileges required'
      USING ERRCODE = '42501';
  END IF;

  -- 1. Purge all orphaned, deleted, hidden, or unpublished products from search index
  DELETE FROM public.search_index
  WHERE product_id NOT IN (
    SELECT id FROM public.products 
    WHERE status = 'published' AND hidden = false AND deleted_at IS NULL
  );
  GET DIAGNOSTICS v_cleaned = ROW_COUNT;

  -- 2. Rebuild search index for all active public products
  FOR r IN SELECT id FROM public.products WHERE status = 'published' AND hidden = false AND deleted_at IS NULL LOOP
    PERFORM public.rebuild_search_index(r.id);
    v_processed := v_processed + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'status', 'success',
    'rebuilt_count', v_processed,
    'cleaned_orphans_count', v_cleaned
  );
END;
$$;


-- 4. REVOKE ANONYMOUS EXECUTE ON ADMIN RPCs
REVOKE EXECUTE ON FUNCTION public.get_search_index_diagnostics() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_search_index_diagnostics() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.rebuild_all_search_indexes() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rebuild_all_search_indexes() TO authenticated, service_role;


-- 5. RE-SYNC AND PURGE EXISTING INCONSISTENCIES
DELETE FROM public.search_index
WHERE product_id NOT IN (
  SELECT id FROM public.products 
  WHERE status = 'published' AND hidden = false AND deleted_at IS NULL
);

DO $$
DECLARE
  prod_row record;
BEGIN
  FOR prod_row IN SELECT id FROM public.products WHERE status = 'published' AND hidden = false AND deleted_at IS NULL LOOP
    PERFORM public.rebuild_search_index(prod_row.id);
  END LOOP;
END;
$$;
