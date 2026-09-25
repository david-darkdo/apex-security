-- ============================================================
-- APEX SECURITY — BUILD 3 COMPLETION: PRODUCT INTELLIGENCE + SEO
-- Specification ID: APEX-B3-COMPLETE-001
-- Migration: 20260925120000_build3_product_intelligence_completion.sql
-- ============================================================

-- 1. ADD MISSING PRODUCT COLUMNS (PRICING, DIFFERENTIATOR, ASSETS)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS original_price NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS pricing_unit TEXT NOT NULL DEFAULT 'piece',
  ADD COLUMN IF NOT EXISTS differentiator_type TEXT NULL,
  ADD COLUMN IF NOT EXISTS differentiator_note TEXT NULL,
  ADD COLUMN IF NOT EXISTS product_assets JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 2. ENSURE AI_PROMPT_TEMPLATES HAS PRODUCT_DETAILS TEMPLATE
DELETE FROM public.ai_prompt_templates WHERE key = 'product_details';

INSERT INTO public.ai_prompt_templates (
  id,
  key,
  name,
  purpose,
  prompt_text,
  is_active,
  version
) VALUES (
  'a0000000-0000-0000-0000-000000000010',
  'product_details',
  'Product Details',
  'Universal Product Details AI Engine — generates complete canonical product intelligence, highlights, features, benefits, SEO, FAQ, and search intelligence.',
  'Analyze the product metadata, commercial positioning, and visual characteristics:

Product Name: {product_name}
Product Code: {code}
Brand: {brand}
Production Name: {production_name}
Product Type: {type}
Category: {category}
Subcategory: {subcategory}
Design / System Family: {family}
Differentiator Type: {differentiator_type}
Differentiator Note: {differentiator_note}
Finish / Enclosure: {finish}
Material: {material}
Color: {color}
Size / Dimensions: {size}
Price: {price}
Original Price: {original_price}
Pricing Unit: {pricing_unit}

INSTRUCTIONS & DOMAIN KNOWLEDGE:
You are the Apex Security Product Intelligence Engine. Apex Security specializes in CCTV surveillance systems, solar security cameras, biometric systems, smart security locks, digital locks, security doors, access control, intercoms, gate automation, alarm systems, and technical security infrastructure.

RULES:
1. MANUAL DATA IS AUTHORITATIVE: Use the provided name, code, brand, differentiator, and attributes as truth.
2. DO NOT FABRICATE non-evident technical specs (e.g. do not invent exact sensor sizes or battery hours unless stated in differentiator or metadata).
3. If differentiator note is provided, incorporate its distinct commercial advantages into the description, highlights, features, benefits, and search terms.
4. Separate short_description (1-2 crisp customer-facing sentences) from generated_description (detailed commercial overview).
5. Generate at least 2 structured highlights, 2 features, 2 benefits, and 2-3 realistic FAQs.
6. Generate high-intent search keywords, alternative names, customer phrases, synonyms, related terms, and common misspellings.

Return ONLY valid JSON matching this exact structure:
{
  "short_description": "Concise 1-2 sentence overview of the product.",
  "generated_description": "Comprehensive, commercially compelling, factual product description explaining capabilities, design, and ideal application.",
  "product_highlights": [
    "Key highlight 1",
    "Key highlight 2"
  ],
  "product_features": [
    "Concrete physical or functional feature 1",
    "Concrete physical or functional feature 2"
  ],
  "product_benefits": [
    "Direct operational or user benefit 1",
    "Direct operational or user benefit 2"
  ],
  "differentiator_type": "{differentiator_type}",
  "differentiator_note": "{differentiator_note}",
  "seo_title": "Concise SEO title (max 60 chars) | Apex Security Ltd",
  "seo_description": "High-intent meta description (under 160 chars) for search engines.",
  "seo_keywords": ["keyword 1", "keyword 2", "keyword 3"],
  "canonical_slug": "url-friendly-product-slug",
  "open_graph_title": "Social share title",
  "open_graph_description": "Social share description",
  "search_keywords": ["search keyword 1", "search keyword 2"],
  "alternative_names": ["alternative name 1", "alternative name 2"],
  "customer_search_phrases": ["how customers search phrase 1", "phrase 2"],
  "search_synonyms": ["synonym 1", "synonym 2"],
  "related_search_terms": ["related accessory/term 1", "term 2"],
  "common_misspellings": ["misspelling 1", "misspelling 2"],
  "location_keywords": [],
  "showroom_search_index": ["token 1", "token 2"],
  "google_search_tags": ["tag 1", "tag 2"],
  "google_local_search_terms": [],
  "faq": [
    {
      "question": "Realistic customer question about installation, connectivity, or maintenance?",
      "answer": "Helpful, accurate answer based on product characteristics."
    },
    {
      "question": "Second relevant customer query?",
      "answer": "Clear, practical answer."
    }
  ]
}',
  true,
  1
);

-- 3. ENSURE REBUILD SEARCH INDEX FUNCTION PICKS UP DIFFERENTIATOR AND MASTER DOCUMENT TOKENS
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
    DELETE FROM public.search_index WHERE product_id = _product_id;
    RETURN;
  END IF;

  -- 1. STRICT PUBLIC LIFECYCLE ENFORCEMENT:
  IF p.deleted_at IS NOT NULL OR COALESCE(p.hidden, false) = true OR COALESCE(p.status::text, 'published') != 'published' THEN
    DELETE FROM public.search_index WHERE product_id = _product_id;
    RETURN;
  END IF;

  -- 2. Load Taxonomy details
  SELECT name, slug INTO t_row FROM public.product_types WHERE id = p.type_id;
  SELECT name, slug INTO c_row FROM public.categories WHERE id = p.category_id;
  SELECT name, slug INTO s_row FROM public.subcategories WHERE id = p.subcategory_id;
  SELECT name, slug INTO f_row FROM public.family_groups WHERE id = p.family_id;

  -- 3. Extract tokens from product record and master_document / ai_understanding
  v_keywords := COALESCE(p.app_keywords, ARRAY[]::text[]);
  IF p.app_search_keywords IS NOT NULL AND array_length(p.app_search_keywords, 1) > 0 THEN
    v_keywords := ARRAY(SELECT DISTINCT unnest(v_keywords || p.app_search_keywords));
  END IF;

  v_alt_names := ARRAY[]::text[];
  v_customer_phrases := ARRAY[]::text[];
  v_synonyms := ARRAY[]::text[];
  v_related := ARRAY[]::text[];
  v_misspellings := ARRAY[]::text[];
  v_aliases := ARRAY[]::text[];
  v_showroom_tokens := ARRAY[]::text[];

  IF p.master_document IS NOT NULL THEN
    IF p.master_document ? 'search' THEN
      v_alt_names := ARRAY(SELECT jsonb_array_elements_text(COALESCE(p.master_document->'search'->'alternative_names', '[]'::jsonb)));
      v_customer_phrases := ARRAY(SELECT jsonb_array_elements_text(COALESCE(p.master_document->'search'->'customer_search_phrases', '[]'::jsonb)));
      v_synonyms := ARRAY(SELECT jsonb_array_elements_text(COALESCE(p.master_document->'search'->'search_synonyms', '[]'::jsonb)));
      v_related := ARRAY(SELECT jsonb_array_elements_text(COALESCE(p.master_document->'search'->'related_search_terms', '[]'::jsonb)));
      v_misspellings := ARRAY(SELECT jsonb_array_elements_text(COALESCE(p.master_document->'search'->'common_misspellings', '[]'::jsonb)));
      v_showroom_tokens := ARRAY(SELECT jsonb_array_elements_text(COALESCE(p.master_document->'search'->'showroom_search_index', '[]'::jsonb)));
    END IF;
  ELSIF p.ai_understanding IS NOT NULL THEN
    v_alt_names := ARRAY(SELECT jsonb_array_elements_text(COALESCE(p.ai_understanding->'alternative_terms', '[]'::jsonb)));
    v_customer_phrases := ARRAY(SELECT jsonb_array_elements_text(COALESCE(p.ai_understanding->'customer_phrases', '[]'::jsonb)));
    v_synonyms := ARRAY(SELECT jsonb_array_elements_text(COALESCE(p.ai_understanding->'synonyms', '[]'::jsonb)));
    v_related := ARRAY(SELECT jsonb_array_elements_text(COALESCE(p.ai_understanding->'related_terms', '[]'::jsonb)));
    v_misspellings := ARRAY(SELECT jsonb_array_elements_text(COALESCE(p.ai_understanding->'misspellings', '[]'::jsonb)));
  END IF;

  v_all_tokens := ARRAY(
    SELECT DISTINCT trim(lower(x))
    FROM unnest(
      v_keywords || v_alt_names || v_customer_phrases || v_synonyms || v_related || v_misspellings || v_showroom_tokens
    ) AS x
    WHERE length(trim(x)) > 1
  );

  v_aliases := ARRAY(
    SELECT DISTINCT trim(lower(x))
    FROM unnest(v_alt_names || v_synonyms || v_customer_phrases) AS x
    WHERE length(trim(x)) > 1
  );

  v_combined := concat_ws(' ',
    COALESCE(p.code, ''),
    COALESCE(p.name, ''),
    COALESCE(p.brand, ''),
    COALESCE(p.differentiator_type, ''),
    COALESCE(p.differentiator_note, ''),
    COALESCE(t_row.name, ''),
    COALESCE(c_row.name, ''),
    COALESCE(s_row.name, ''),
    COALESCE(f_row.name, ''),
    COALESCE(p.material, ''),
    COALESCE(p.finish, ''),
    COALESCE(p.finish_name, ''),
    COALESCE(p.color, ''),
    COALESCE(p.size, ''),
    COALESCE(p.pricing_unit, ''),
    COALESCE(p.short_description, ''),
    COALESCE(p.generated_description, ''),
    array_to_string(v_all_tokens, ' ')
  );

  v_vector := 
    setweight(to_tsvector('english', COALESCE(p.code, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(p.name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(p.brand, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(p.differentiator_type, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(p.differentiator_note, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(t_row.name, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(c_row.name, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(s_row.name, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(f_row.name, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(p.material, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(p.finish, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(p.color, '')), 'C') ||
    setweight(to_tsvector('english', array_to_string(v_all_tokens, ' ')), 'C') ||
    setweight(to_tsvector('english', COALESCE(p.short_description, '') || ' ' || COALESCE(p.generated_description, '')), 'D');

  v_master := jsonb_build_object(
    'product_id', p.id,
    'code', p.code,
    'name', p.name,
    'brand', p.brand,
    'differentiator_type', p.differentiator_type,
    'differentiator_note', p.differentiator_note,
    'type', t_row.name,
    'type_slug', t_row.slug,
    'category', c_row.name,
    'category_slug', c_row.slug,
    'subcategory', s_row.name,
    'subcategory_slug', s_row.slug,
    'family', f_row.name,
    'family_slug', f_row.slug,
    'material', p.material,
    'finish', COALESCE(p.finish, p.finish_name),
    'color', p.color,
    'size', p.size,
    'price', p.price,
    'original_price', p.original_price,
    'pricing_unit', p.pricing_unit,
    'keywords', v_all_tokens
  );

  INSERT INTO public.search_index (
    product_id,
    combined_search_text,
    search_vector,
    search_aliases,
    normalized_size,
    master_document,
    updated_at
  ) VALUES (
    _product_id,
    v_combined,
    v_vector,
    v_aliases,
    p.size,
    v_master,
    now()
  )
  ON CONFLICT (product_id) DO UPDATE SET
    combined_search_text = EXCLUDED.combined_search_text,
    search_vector = EXCLUDED.search_vector,
    search_aliases = EXCLUDED.search_aliases,
    normalized_size = EXCLUDED.normalized_size,
    master_document = EXCLUDED.master_document,
    updated_at = now();
END;
$$;
