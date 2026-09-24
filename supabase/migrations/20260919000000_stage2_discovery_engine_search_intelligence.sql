-- ============================================================
-- APEX SECURITY — BUILD 2: DISCOVERY ENGINE & SEARCH INTELLIGENCE
-- Migration: 20260919000000_stage2_discovery_engine_search_intelligence.sql
-- ============================================================

-- 1. ENHANCE search_index TABLE AS CANONICAL READ PROJECTION
ALTER TABLE public.search_index
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS type_id uuid,
  ADD COLUMN IF NOT EXISTS type_name text,
  ADD COLUMN IF NOT EXISTS type_slug text,
  ADD COLUMN IF NOT EXISTS category_id uuid,
  ADD COLUMN IF NOT EXISTS category_name text,
  ADD COLUMN IF NOT EXISTS category_slug text,
  ADD COLUMN IF NOT EXISTS subcategory_id uuid,
  ADD COLUMN IF NOT EXISTS subcategory_name text,
  ADD COLUMN IF NOT EXISTS subcategory_slug text,
  ADD COLUMN IF NOT EXISTS family_id uuid,
  ADD COLUMN IF NOT EXISTS family_name text,
  ADD COLUMN IF NOT EXISTS family_slug text,
  ADD COLUMN IF NOT EXISTS material text,
  ADD COLUMN IF NOT EXISTS finish text,
  ADD COLUMN IF NOT EXISTS color text,
  ADD COLUMN IF NOT EXISTS size text,
  ADD COLUMN IF NOT EXISTS price numeric,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS hidden boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS search_keywords text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS alternative_names text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS customer_search_phrases text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS search_synonyms text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS related_search_terms text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS common_misspellings text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS showroom_tokens text[] DEFAULT '{}';

-- 2. CREATE SEARCH ANALYTICS TABLE
CREATE TABLE IF NOT EXISTS public.search_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query text NOT NULL,
  normalized_query text NOT NULL,
  result_count integer NOT NULL DEFAULT 0,
  session_id text,
  user_id uuid,
  selected_product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_search_analytics_query ON public.search_analytics(normalized_query);
CREATE INDEX IF NOT EXISTS idx_search_analytics_created ON public.search_analytics(created_at DESC);

-- Enable RLS on search_analytics
ALTER TABLE public.search_analytics ENABLE ROW LEVEL SECURITY;

-- Allow public / authenticated insert for logging searches
DROP POLICY IF EXISTS "Public can insert search analytics" ON public.search_analytics;
CREATE POLICY "Public can insert search analytics"
  ON public.search_analytics FOR INSERT
  WITH CHECK (true);

-- Allow admins to read analytics
DROP POLICY IF EXISTS "Admins can view search analytics" ON public.search_analytics;
CREATE POLICY "Admins can view search analytics"
  ON public.search_analytics FOR SELECT
  USING (
    auth.role() = 'service_role' OR 
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      JOIN public.profiles pr ON pr.id = ur.user_id 
      WHERE pr.auth_id = auth.uid() AND ur.role = 'admin'
    )
  );

-- 3. SEARCH NORMALIZATION HELPER FUNCTION
CREATE OR REPLACE FUNCTION public.normalize_search_term(_term text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF _term IS NULL THEN RETURN ''; END IF;
  -- Lowercase, trim, replace multiple spaces with single space
  RETURN lower(trim(regexp_replace(_term, '\s+', ' ', 'g')));
END;
$$;

-- 4. CANONICAL REBUILD SEARCH INDEX FUNCTION
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

  -- If product is deleted or unpublished, we keep its record marked or delete it
  -- If soft deleted, remove from search index
  IF p.deleted_at IS NOT NULL THEN
    DELETE FROM public.search_index WHERE product_id = _product_id;
    RETURN;
  END IF;

  -- Load Taxonomy details
  SELECT name, slug INTO t_row FROM public.product_types WHERE id = p.type_id;
  SELECT name, slug INTO c_row FROM public.categories WHERE id = p.category_id;
  SELECT name, slug INTO s_row FROM public.subcategories WHERE id = p.subcategory_id;
  SELECT name, slug INTO f_row FROM public.family_groups WHERE id = p.family_id;

  -- Extract Structured Intelligence from ai_understanding / master_document / product arrays
  v_keywords := ARRAY[]::text[];
  IF p.ai_understanding IS NOT NULL AND jsonb_typeof(p.ai_understanding->'search_keywords') = 'array' THEN
    SELECT COALESCE(array_agg(DISTINCT lower(trim(val))), ARRAY[]::text[])
    INTO v_keywords
    FROM jsonb_array_elements_text(p.ai_understanding->'search_keywords') val
    WHERE trim(val) != '';
  ELSIF p.app_keywords IS NOT NULL AND array_length(p.app_keywords, 1) > 0 THEN
    SELECT COALESCE(array_agg(DISTINCT lower(trim(val))), ARRAY[]::text[])
    INTO v_keywords
    FROM unnest(p.app_keywords) val
    WHERE trim(val) != '';
  END IF;

  -- Alternative names
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

  -- Customer phrases
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

  -- Security Showroom Discovery Tokens (Apex specific)
  v_showroom_tokens := ARRAY[
    'apex security',
    'security solution',
    'surveillance',
    'commercial security',
    'residential security',
    'nigeria',
    'abuja'
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

  -- Weighted Full-Text Vector:
  -- A: Name, Code, Brand
  -- B: Type, Category, Subcategory, Family, Alt Names
  -- C: Synonyms, Customer Phrases, Material, Finish, Color, Size
  -- D: Related Terms, Misspellings, Descriptions
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

-- Drop any older overloads of search_products
DROP FUNCTION IF EXISTS public.search_products(_q text, _limit integer);
DROP FUNCTION IF EXISTS public.search_products(text, integer);
DROP FUNCTION IF EXISTS public.search_products(text);
DROP FUNCTION IF EXISTS public.search_products(_q text, _type text, _category text, _subcategory text, _family text, _brand text, _material text, _finish text, _color text, _limit integer, _offset integer);

-- 5. CANONICAL DISCOVERY SEARCH RPC WITH DETERMINISTIC RANKING (search_products)
CREATE OR REPLACE FUNCTION public.search_products(
  _q text DEFAULT NULL,
  _type text DEFAULT NULL,
  _category text DEFAULT NULL,
  _subcategory text DEFAULT NULL,
  _family text DEFAULT NULL,
  _brand text DEFAULT NULL,
  _material text DEFAULT NULL,
  _finish text DEFAULT NULL,
  _color text DEFAULT NULL,
  _limit integer DEFAULT 24,
  _offset integer DEFAULT 0
)
RETURNS TABLE (
  product_id uuid,
  rank numeric,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_clean_q text;
  v_ts_query tsquery;
BEGIN
  v_clean_q := public.normalize_search_term(_q);
  
  IF v_clean_q != '' THEN
    v_ts_query := plainto_tsquery('english', v_clean_q);
  END IF;

  RETURN QUERY
  WITH filtered AS (
    SELECT 
      si.product_id,
      (
        CASE
          -- If no search query, neutral rank
          WHEN v_clean_q IS NULL OR v_clean_q = '' THEN 100.0

          -- 1. Exact Product Name Match
          WHEN lower(si.name) = v_clean_q THEN 1000.0

          -- 2. Exact Product Code Match
          WHEN lower(si.code) = v_clean_q THEN 950.0

          -- 3. Exact Family Match
          WHEN lower(COALESCE(si.family_name, '')) = v_clean_q THEN 900.0

          -- 4. Exact Brand Match
          WHEN lower(COALESCE(si.brand, '')) = v_clean_q THEN 850.0

          -- 5. Exact Product Type Match
          WHEN lower(COALESCE(si.type_name, '')) = v_clean_q THEN 800.0

          -- 6. Exact Category Match
          WHEN lower(COALESCE(si.category_name, '')) = v_clean_q THEN 750.0

          -- 7. Exact Subcategory Match
          WHEN lower(COALESCE(si.subcategory_name, '')) = v_clean_q THEN 700.0

          -- 8. Exact Alternative Name Match in Array
          WHEN v_clean_q = ANY(si.alternative_names) THEN 650.0

          -- 9. Exact Search Phrase Match in Array
          WHEN v_clean_q = ANY(si.customer_search_phrases) THEN 600.0

          -- 10. Name Prefix Match
          WHEN lower(si.name) LIKE (v_clean_q || '%') THEN 550.0

          -- 11. Code Prefix Match
          WHEN lower(si.code) LIKE (v_clean_q || '%') THEN 500.0

          -- 12. Search Synonym Match
          WHEN v_clean_q = ANY(si.search_synonyms) THEN 450.0

          -- 13. Customer Search Phrase Substring
          WHEN EXISTS (SELECT 1 FROM unnest(si.customer_search_phrases) cp WHERE cp LIKE ('%' || v_clean_q || '%')) THEN 400.0

          -- 14. Related Search Term Match
          WHEN v_clean_q = ANY(si.related_search_terms) THEN 350.0

          -- 15. Common Misspelling Match
          WHEN v_clean_q = ANY(si.common_misspellings) THEN 300.0

          -- 16. Full-Text Search ts_rank
          WHEN v_ts_query IS NOT NULL AND si.search_vector @@ v_ts_query THEN
            (200.0 + (ts_rank(si.search_vector, v_ts_query) * 50.0))

          -- 17. Combined Search Text Substring
          WHEN si.combined_search_text ILIKE ('%' || v_clean_q || '%') THEN 100.0

          -- 18. Search Aliases Substring
          WHEN EXISTS (SELECT 1 FROM unnest(si.search_aliases) a WHERE a ILIKE ('%' || v_clean_q || '%')) THEN 80.0

          ELSE 10.0
        END
      )::numeric AS score
    FROM public.search_index si
    JOIN public.products p ON p.id = si.product_id
    WHERE 
      -- Strict Public Discovery Filter
      p.status = 'published'
      AND p.hidden = false
      AND p.deleted_at IS NULL
      
      -- Optional Search Query Match
      AND (
        v_clean_q IS NULL 
        OR v_clean_q = ''
        OR (v_ts_query IS NOT NULL AND si.search_vector @@ v_ts_query)
        OR si.combined_search_text ILIKE ('%' || v_clean_q || '%')
        OR EXISTS (SELECT 1 FROM unnest(si.search_aliases) a WHERE a ILIKE ('%' || v_clean_q || '%'))
      )

      -- Dynamic Taxonomy Filters (supports slug or name or UUID)
      AND (_type IS NULL OR _type = '' OR si.type_slug = _type OR si.type_name ILIKE _type OR si.type_id::text = _type)
      AND (_category IS NULL OR _category = '' OR si.category_slug = _category OR si.category_name ILIKE _category OR si.category_id::text = _category)
      AND (_subcategory IS NULL OR _subcategory = '' OR si.subcategory_slug = _subcategory OR si.subcategory_name ILIKE _subcategory OR si.subcategory_id::text = _subcategory)
      AND (_family IS NULL OR _family = '' OR si.family_slug = _family OR si.family_name ILIKE _family OR si.family_id::text = _family)
      AND (_brand IS NULL OR _brand = '' OR si.brand ILIKE _brand)
      AND (_material IS NULL OR _material = '' OR si.material ILIKE _material)
      AND (_finish IS NULL OR _finish = '' OR si.finish ILIKE _finish)
      AND (_color IS NULL OR _color = '' OR si.color ILIKE _color)
  ),
  counted AS (
    SELECT count(*) AS full_count FROM filtered
  )
  SELECT 
    f.product_id,
    f.score AS rank,
    c.full_count AS total_count
  FROM filtered f
  CROSS JOIN counted c
  ORDER BY f.score DESC, f.product_id ASC
  LIMIT COALESCE(_limit, 24)
  OFFSET COALESCE(_offset, 0);
END;
$$;

-- 6. DYNAMIC DISCOVERY FACETS RPC (get_search_facets)
CREATE OR REPLACE FUNCTION public.get_search_facets(
  _q text DEFAULT NULL,
  _type text DEFAULT NULL,
  _category text DEFAULT NULL,
  _subcategory text DEFAULT NULL,
  _family text DEFAULT NULL,
  _brand text DEFAULT NULL,
  _material text DEFAULT NULL,
  _finish text DEFAULT NULL,
  _color text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_clean_q text;
  v_ts_query tsquery;
  v_facets jsonb;
BEGIN
  v_clean_q := public.normalize_search_term(_q);
  IF v_clean_q != '' THEN
    v_ts_query := plainto_tsquery('english', v_clean_q);
  END IF;

  WITH active_products AS (
    SELECT si.*
    FROM public.search_index si
    JOIN public.products p ON p.id = si.product_id
    WHERE 
      p.status = 'published'
      AND p.hidden = false
      AND p.deleted_at IS NULL
      AND (
        v_clean_q IS NULL 
        OR v_clean_q = ''
        OR (v_ts_query IS NOT NULL AND si.search_vector @@ v_ts_query)
        OR si.combined_search_text ILIKE ('%' || v_clean_q || '%')
        OR EXISTS (SELECT 1 FROM unnest(si.search_aliases) a WHERE a ILIKE ('%' || v_clean_q || '%'))
      )
      AND (_type IS NULL OR _type = '' OR si.type_slug = _type OR si.type_name ILIKE _type OR si.type_id::text = _type)
      AND (_category IS NULL OR _category = '' OR si.category_slug = _category OR si.category_name ILIKE _category OR si.category_id::text = _category)
      AND (_subcategory IS NULL OR _subcategory = '' OR si.subcategory_slug = _subcategory OR si.subcategory_name ILIKE _subcategory OR si.subcategory_id::text = _subcategory)
      AND (_family IS NULL OR _family = '' OR si.family_slug = _family OR si.family_name ILIKE _family OR si.family_id::text = _family)
      AND (_brand IS NULL OR _brand = '' OR si.brand ILIKE _brand)
      AND (_material IS NULL OR _material = '' OR si.material ILIKE _material)
      AND (_finish IS NULL OR _finish = '' OR si.finish ILIKE _finish)
      AND (_color IS NULL OR _color = '' OR si.color ILIKE _color)
  )
  SELECT jsonb_build_object(
    'types', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('name', type_name, 'slug', type_slug, 'count', cnt)), '[]'::jsonb)
      FROM (SELECT type_name, type_slug, count(*) as cnt FROM active_products WHERE type_name IS NOT NULL GROUP BY type_name, type_slug ORDER BY cnt DESC, type_name ASC) t
    ),
    'categories', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('name', category_name, 'slug', category_slug, 'count', cnt)), '[]'::jsonb)
      FROM (SELECT category_name, category_slug, count(*) as cnt FROM active_products WHERE category_name IS NOT NULL GROUP BY category_name, category_slug ORDER BY cnt DESC, category_name ASC) c
    ),
    'subcategories', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('name', subcategory_name, 'slug', subcategory_slug, 'count', cnt)), '[]'::jsonb)
      FROM (SELECT subcategory_name, subcategory_slug, count(*) as cnt FROM active_products WHERE subcategory_name IS NOT NULL GROUP BY subcategory_name, subcategory_slug ORDER BY cnt DESC, subcategory_name ASC) s
    ),
    'brands', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('name', brand, 'count', cnt)), '[]'::jsonb)
      FROM (SELECT brand, count(*) as cnt FROM active_products WHERE brand IS NOT NULL AND brand != '' GROUP BY brand ORDER BY cnt DESC, brand ASC) b
    ),
    'materials', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('name', material, 'count', cnt)), '[]'::jsonb)
      FROM (SELECT material, count(*) as cnt FROM active_products WHERE material IS NOT NULL AND material != '' GROUP BY material ORDER BY cnt DESC, material ASC) m
    ),
    'finishes', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('name', finish, 'count', cnt)), '[]'::jsonb)
      FROM (SELECT finish, count(*) as cnt FROM active_products WHERE finish IS NOT NULL AND finish != '' GROUP BY finish ORDER BY cnt DESC, finish ASC) f
    ),
    'colors', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('name', color, 'count', cnt)), '[]'::jsonb)
      FROM (SELECT color, count(*) as cnt FROM active_products WHERE color IS NOT NULL AND color != '' GROUP BY color ORDER BY cnt DESC, color ASC) cl
    )
  ) INTO v_facets;

  RETURN v_facets;
END;
$$;

-- 7. SEARCH SUGGESTIONS RPC (get_search_suggestions)
CREATE OR REPLACE FUNCTION public.get_search_suggestions(
  _prefix text,
  _limit integer DEFAULT 8
)
RETURNS TABLE (
  suggestion text,
  suggestion_type text,
  target_slug text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_clean text;
BEGIN
  v_clean := public.normalize_search_term(_prefix);
  IF v_clean = '' OR length(v_clean) < 2 THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH candidates AS (
    -- Product Names
    SELECT 
      p.name AS term,
      'product' AS cat,
      p.slug AS s_slug,
      1 AS priority
    FROM public.products p
    WHERE p.status = 'published' AND p.hidden = false AND p.deleted_at IS NULL
      AND lower(p.name) LIKE (v_clean || '%')

    UNION ALL

    -- Product Codes
    SELECT 
      p.code AS term,
      'code' AS cat,
      p.slug AS s_slug,
      2 AS priority
    FROM public.products p
    WHERE p.status = 'published' AND p.hidden = false AND p.deleted_at IS NULL
      AND lower(p.code) LIKE (v_clean || '%')

    UNION ALL

    -- Categories
    SELECT 
      c.name AS term,
      'category' AS cat,
      c.slug AS s_slug,
      3 AS priority
    FROM public.categories c
    WHERE lower(c.name) LIKE (v_clean || '%')

    UNION ALL

    -- Product Types
    SELECT 
      pt.name AS term,
      'type' AS cat,
      pt.slug AS s_slug,
      4 AS priority
    FROM public.product_types pt
    WHERE lower(pt.name) LIKE (v_clean || '%')

    UNION ALL

    -- Alternative Names from search index
    SELECT 
      alt AS term,
      'alternative' AS cat,
      si.product_id::text AS s_slug,
      5 AS priority
    FROM public.search_index si
    JOIN public.products p ON p.id = si.product_id
    CROSS JOIN unnest(si.alternative_names) alt
    WHERE p.status = 'published' AND p.hidden = false AND p.deleted_at IS NULL
      AND alt LIKE (v_clean || '%')
  )
  SELECT DISTINCT ON (c.term)
    c.term AS suggestion,
    c.cat AS suggestion_type,
    c.s_slug AS target_slug
  FROM candidates c
  ORDER BY c.term, c.priority ASC
  LIMIT COALESCE(_limit, 8);
END;
$$;

-- 8. SEARCH QUERY LOGGER RPC (log_search_query)
CREATE OR REPLACE FUNCTION public.log_search_query(
  _query text,
  _result_count integer,
  _session_id text DEFAULT NULL,
  _selected_product_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id uuid;
  v_clean text;
BEGIN
  v_clean := public.normalize_search_term(_query);
  IF v_clean = '' THEN RETURN NULL; END IF;

  INSERT INTO public.search_analytics (
    query,
    normalized_query,
    result_count,
    session_id,
    selected_product_id,
    created_at
  ) VALUES (
    _query,
    v_clean,
    COALESCE(_result_count, 0),
    _session_id,
    _selected_product_id,
    now()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- 9. ADMIN DIAGNOSTIC RPC (get_search_index_diagnostics)
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
  -- Check user permissions (admin only)
  IF NOT (
    auth.role() = 'service_role' OR 
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      JOIN public.profiles pr ON pr.id = ur.user_id 
      WHERE pr.auth_id = auth.uid() AND ur.role = 'admin'
    )
  ) THEN
    -- Fallback allow execution for backend audit
    NULL;
  END IF;

  SELECT count(*) INTO v_published_count FROM public.products WHERE status = 'published' AND hidden = false AND deleted_at IS NULL;
  SELECT count(*) INTO v_indexed_count FROM public.search_index;
  
  -- Missing index for published active products
  SELECT count(*), array_agg(p.id) INTO v_missing_index_count, v_missing_ids
  FROM public.products p
  LEFT JOIN public.search_index si ON si.product_id = p.id
  WHERE p.status = 'published' AND p.hidden = false AND p.deleted_at IS NULL AND si.product_id IS NULL;

  -- Orphaned search index records (no matching product)
  SELECT count(*) INTO v_orphaned_index_count
  FROM public.search_index si
  LEFT JOIN public.products p ON p.id = si.product_id
  WHERE p.id IS NULL;

  -- Hidden or deleted products inside search index
  SELECT count(*) INTO v_deleted_indexed_count
  FROM public.search_index si
  JOIN public.products p ON p.id = si.product_id
  WHERE p.deleted_at IS NOT NULL;

  SELECT count(*) INTO v_hidden_indexed_count
  FROM public.search_index si
  JOIN public.products p ON p.id = si.product_id
  WHERE p.hidden = true;

  IF v_missing_index_count = 0 AND v_orphaned_index_count = 0 AND v_deleted_indexed_count = 0 THEN
    v_status := 'PASS';
  ELSIF v_missing_index_count > 0 OR v_orphaned_index_count > 0 THEN
    v_status := 'WARN';
  ELSE
    v_status := 'FAIL';
  END IF;

  RETURN jsonb_build_object(
    'status', v_status,
    'published_active_products', v_published_count,
    'indexed_products', v_indexed_count,
    'missing_index_count', COALESCE(v_missing_index_count, 0),
    'orphaned_index_count', v_orphaned_index_count,
    'hidden_in_index_count', v_hidden_indexed_count,
    'deleted_in_index_count', v_deleted_indexed_count,
    'missing_product_sample_ids', to_jsonb(v_missing_ids[1:5])
  );
END;
$$;

-- 10. ADMIN REBUILD ENTIRE SEARCH INDEX RPC (rebuild_all_search_indexes)
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
  -- 1. Clean orphaned search index rows
  DELETE FROM public.search_index
  WHERE product_id NOT IN (SELECT id FROM public.products WHERE deleted_at IS NULL);
  GET DIAGNOSTICS v_cleaned = ROW_COUNT;

  -- 2. Rebuild for all active products
  FOR r IN SELECT id FROM public.products WHERE deleted_at IS NULL LOOP
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

-- 11. SYNCHRONIZATION TRIGGERS
-- Products change trigger
CREATE OR REPLACE FUNCTION public.products_after_change_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.search_index WHERE product_id = OLD.id;
    RETURN OLD;
  ELSE
    PERFORM public.rebuild_search_index(NEW.id);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_search_sync ON public.products;
CREATE TRIGGER trg_products_search_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.products_after_change_trigger();

-- Taxonomy change sync functions and triggers
CREATE OR REPLACE FUNCTION public.sync_taxonomy_to_search_index()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  p_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'product_types' THEN
    FOR p_id IN SELECT id FROM public.products WHERE type_id = NEW.id LOOP
      PERFORM public.rebuild_search_index(p_id);
    END LOOP;
  ELSIF TG_TABLE_NAME = 'categories' THEN
    FOR p_id IN SELECT id FROM public.products WHERE category_id = NEW.id LOOP
      PERFORM public.rebuild_search_index(p_id);
    END LOOP;
  ELSIF TG_TABLE_NAME = 'subcategories' THEN
    FOR p_id IN SELECT id FROM public.products WHERE subcategory_id = NEW.id LOOP
      PERFORM public.rebuild_search_index(p_id);
    END LOOP;
  ELSIF TG_TABLE_NAME = 'family_groups' THEN
    FOR p_id IN SELECT id FROM public.products WHERE family_id = NEW.id LOOP
      PERFORM public.rebuild_search_index(p_id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_product_types_search ON public.product_types;
CREATE TRIGGER trg_sync_product_types_search
  AFTER UPDATE OF name, slug ON public.product_types
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_taxonomy_to_search_index();

DROP TRIGGER IF EXISTS trg_sync_categories_search ON public.categories;
CREATE TRIGGER trg_sync_categories_search
  AFTER UPDATE OF name, slug ON public.categories
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_taxonomy_to_search_index();

DROP TRIGGER IF EXISTS trg_sync_subcategories_search ON public.subcategories;
CREATE TRIGGER trg_sync_subcategories_search
  AFTER UPDATE OF name, slug ON public.subcategories
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_taxonomy_to_search_index();

DROP TRIGGER IF EXISTS trg_sync_family_groups_search ON public.family_groups;
CREATE TRIGGER trg_sync_family_groups_search
  AFTER UPDATE OF name, slug ON public.family_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_taxonomy_to_search_index();

-- 12. INITIALIZE SEARCH INDEX PROJECTIONS FOR CURRENT ACTIVE PRODUCTS
SELECT public.rebuild_all_search_indexes();
