import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAIProvider } from "./ai-providers";

async function tryJSON<T = any>(
  provider: any,
  prompt: string,
  system: string,
  imageUrl?: string
): Promise<{ data: T | null; raw: string; error?: string }> {
  try {
    const raw = await provider.callLLM(prompt, system, imageUrl);
    if (!raw) return { data: null, raw: "", error: "AI model returned an empty text response." };

    const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) return { data: null, raw, error: "No JSON object found in AI response." };

    const data = JSON.parse(m[0]) as T;
    return { data, raw };
  } catch (err: any) {
    return { data: null, raw: "", error: err.message || "Failed to execute LLM call or parse JSON response." };
  }
}

/**
 * PRODUCT DETAILS ENGINE (APEX-B3-COMPLETE-001)
 * 
 * Generates canonical product intelligence, highlights, features, benefits, SEO, FAQ,
 * and search intelligence from active database prompt template.
 */
export const runProductDetailsEngine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { productId: string }) => {
    if (!data?.productId) throw new Error("productId required");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { productId } = data;

    // 1. Retrieve Product Record
    const { data: product, error: pErr } = await supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .maybeSingle();

    if (pErr || !product) {
      throw new Error(pErr?.message ?? `Product ID ${productId} not found`);
    }

    // 2. Resolve Taxonomy Names & Custom Directives
    let contextName = "Apex Security Showroom";
    let categoryName = "Security Hardware";
    let typeName = "Security System";
    let subcategoryName = "";
    let familyName = "";

    const [contextRes, categoryRes, typeRes, subRes, famRes, settingsRes] = await Promise.all([
      product.installation_context_id ? supabase.from("installation_contexts").select("name").eq("id", product.installation_context_id).maybeSingle() : Promise.resolve({ data: null }),
      product.category_id ? supabase.from("categories").select("name").eq("id", product.category_id).maybeSingle() : Promise.resolve({ data: null }),
      product.type_id ? supabase.from("product_types").select("name").eq("id", product.type_id).maybeSingle() : Promise.resolve({ data: null }),
      product.subcategory_id ? supabase.from("subcategories").select("name").eq("id", product.subcategory_id).maybeSingle() : Promise.resolve({ data: null }),
      product.family_id ? supabase.from("family_groups").select("name, custom_ai_prompt_override").eq("id", product.family_id).maybeSingle() : Promise.resolve({ data: null }),
      supabase.from("app_settings").select("*").limit(1).maybeSingle()
    ]);

    if (contextRes.data?.name) contextName = contextRes.data.name;
    if (categoryRes.data?.name) categoryName = categoryRes.data.name;
    if (typeRes.data?.name) typeName = typeRes.data.name;
    if (subRes.data?.name) subcategoryName = subRes.data.name;
    if (famRes.data?.name) familyName = famRes.data.name;

    const familyOverride = famRes.data?.custom_ai_prompt_override ?? null;

    // 3. Load Active AI Prompt Template (CRITICAL RULE: NO SILENT FALLBACK)
    const { data: activeTemplate, error: tErr } = await supabase
      .from("ai_prompt_templates")
      .select("prompt_text, version")
      .eq("key", "product_details")
      .eq("is_active", true)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (tErr || !activeTemplate?.prompt_text) {
      const failMessage = "Active AI prompt template for 'product_details' not found in database. Please configure and activate the 'product_details' prompt template in Admin > AI Templates.";
      await supabase.from("products").update({
        processing_state: "failed" as any,
        error_log: { error: failMessage, timestamp: new Date().toISOString() } as any
      }).eq("id", productId);
      throw new Error(failMessage);
    }

    const templateText = activeTemplate.prompt_text;

    const systemPrompt = `You are the Apex Security Product Intelligence Engine, an expert in commercial and residential security infrastructure, CCTV surveillance, solar security cameras, biometric systems, smart locks, digital access control, security doors, alarm systems, gate automation, intercoms, and technical SEO.

Your responsibility is to analyze the product metadata, commercial positioning, and original product image to generate accurate, structured, high-intent product intelligence.

Return ONLY valid JSON matching the specified schema keys. Never include markdown fences or text outside the JSON object.`;

    // 4. Build Product Metadata Payload
    let prompt = templateText
      .replace(/\{product_name\}/g, product.name || "")
      .replace(/\{code\}/g, product.code || "")
      .replace(/\{brand\}/g, product.brand ?? "Apex Security Ltd")
      .replace(/\{production_name\}/g, product.production_name ?? "")
      .replace(/\{finish\}/g, product.finish ?? product.finish_name ?? "Standard finish")
      .replace(/\{material\}/g, product.material ?? "Commercial grade material")
      .replace(/\{color\}/g, product.color ?? "")
      .replace(/\{size\}/g, product.size ?? "")
      .replace(/\{price\}/g, product.price ? `₦${Number(product.price).toLocaleString()}` : "")
      .replace(/\{original_price\}/g, product.original_price ? `₦${Number(product.original_price).toLocaleString()}` : "")
      .replace(/\{pricing_unit\}/g, product.pricing_unit || "piece")
      .replace(/\{differentiator_type\}/g, product.differentiator_type || "Standard")
      .replace(/\{differentiator_note\}/g, product.differentiator_note || "")
      .replace(/\{context\}/g, contextName)
      .replace(/\{type\}/g, typeName)
      .replace(/\{category\}/g, categoryName)
      .replace(/\{subcategory\}/g, subcategoryName)
      .replace(/\{family\}/g, familyName);

    if (familyOverride) {
      prompt += `\n\nAdditional Family Directives: ${familyOverride}`;
    }

    // 5. Call LLM Provider (Pass 1)
    const settings = settingsRes.data;
    const config = settings ? {
      activeProvider: settings.active_ai_provider || "openai",
      openaiLlmModel: settings.openai_llm_model,
      openaiImageModel: settings.openai_image_model,
      openaiImageSize: settings.openai_image_size || "1024x1024",
      geminiLlmModel: settings.gemini_llm_model,
      geminiImageModel: settings.gemini_image_model
    } : undefined;

    const provider = getAIProvider(config as any);
    const imageUrl = product.image_url || undefined;

    let { data: json, error: parseError } = await tryJSON<any>(
      provider,
      prompt,
      systemPrompt,
      imageUrl
    );

    if (!json) {
      const errMsg = `Engine 1 [${provider.name}]: ${parseError || "Failed to generate valid JSON intelligence payload"}`;
      await supabase.from("products").update({
        processing_state: "failed" as any,
        error_log: { error: errMsg, timestamp: new Date().toISOString() } as any
      }).eq("id", productId);
      throw new Error(errMsg);
    }

    // 6. Semantic Validation & Controlled Repair Pass
    const hasHighlights = Array.isArray(json.product_highlights) && json.product_highlights.length >= 2;
    const hasFeatures = Array.isArray(json.product_features) && json.product_features.length >= 2;
    const hasBenefits = Array.isArray(json.product_benefits) && json.product_benefits.length >= 2;
    const hasDescription = Boolean(json.generated_description || json.short_description);
    const hasFaq = Array.isArray(json.faq) && json.faq.length >= 2;
    const hasSearch = Array.isArray(json.search_keywords) && json.search_keywords.length > 0;

    if (!hasHighlights || !hasFeatures || !hasBenefits || !hasDescription || !hasFaq || !hasSearch) {
      // Controlled repair pass
      const repairPrompt = `The previous JSON response for ${product.name} was missing some required fields.
Please generate the missing fields and return a complete JSON object with:
- short_description
- generated_description
- product_highlights (array of min 2 items)
- product_features (array of min 2 items)
- product_benefits (array of min 2 items)
- differentiator_type
- differentiator_note
- seo_title
- seo_description
- seo_keywords (array)
- canonical_slug
- search_keywords (array)
- alternative_names (array)
- customer_search_phrases (array)
- search_synonyms (array)
- related_search_terms (array)
- common_misspellings (array)
- showroom_search_index (array)
- faq (array of { question, answer } min 2 items)

Existing context:
${prompt}`;

      const repairRes = await tryJSON<any>(provider, repairPrompt, systemPrompt, imageUrl);
      if (repairRes.data) {
        json = { ...json, ...repairRes.data };
      }
    }

    // 7. Assemble Canonical Master Document
    const altNames = Array.isArray(json.alternative_names) ? json.alternative_names : (Array.isArray(json.alternative_terms) ? json.alternative_terms : []);
    const customerPhrases = Array.isArray(json.customer_search_phrases) ? json.customer_search_phrases : (Array.isArray(json.customer_phrases) ? json.customer_phrases : []);
    const synonyms = Array.isArray(json.search_synonyms) ? json.search_synonyms : (Array.isArray(json.synonyms) ? json.synonyms : []);
    const relatedTerms = Array.isArray(json.related_search_terms) ? json.related_search_terms : (Array.isArray(json.related_terms) ? json.related_terms : []);
    const misspellings = Array.isArray(json.common_misspellings) ? json.common_misspellings : (Array.isArray(json.misspellings) ? json.misspellings : []);
    const searchKeywords = Array.isArray(json.search_keywords) ? json.search_keywords : [];
    const showroomTokens = Array.isArray(json.showroom_search_index) ? json.showroom_search_index : [];

    const masterDocument = {
      identity: {
        product_name: product.name,
        product_type: typeName,
        category: categoryName,
        subcategory: subcategoryName,
        family_group: familyName,
        brand: product.brand || "Apex Security Ltd",
        manufacturer: product.brand || "Apex Security Ltd",
        sku: product.code || product.id,
        product_code: product.code || product.id,
      },
      physical: {
        size: product.size || null,
        dimensions: product.size || null,
        material: product.material || null,
        finish: product.finish || product.finish_name || null,
        colour: product.color || null,
        style: json.style || typeName || null,
      },
      installation: {
        installation_type: json.installation_type || "Surface / Wall Mounted",
        installation_context: contextName,
        installation_area: json.installation_area || "Indoor / Outdoor Security Perimeter",
        indoor_outdoor: json.indoor_outdoor || "Indoor / Outdoor",
        surface_types: json.surface_types || ["Wall", "Door", "Post", "Ceiling"],
        architectural_use: json.architectural_use || "Security Surveillance & Access Control",
      },
      product_intelligence: {
        product_highlights: Array.isArray(json.product_highlights) ? json.product_highlights : [],
        product_features: Array.isArray(json.product_features) ? json.product_features : [],
        product_benefits: Array.isArray(json.product_benefits) ? json.product_benefits : [],
        visual_characteristics: Array.isArray(json.visual_characteristics) ? json.visual_characteristics : [],
        design_language: json.design_language || "Commercial Grade Security",
      },
      differentiator: {
        differentiator_type: product.differentiator_type || json.differentiator_type || null,
        differentiator_note: product.differentiator_note || json.differentiator_note || null,
      },
      seo: {
        generated_description: json.generated_description || json.short_description || "",
        seo_title: json.seo_title || `${product.name} | Apex Security Ltd`,
        seo_description: json.seo_description || json.short_description || "",
        seo_keywords: Array.isArray(json.seo_keywords) ? json.seo_keywords : [],
        canonical_slug: json.canonical_slug || product.slug,
        open_graph_title: json.open_graph_title || json.seo_title || product.name,
        open_graph_description: json.open_graph_description || json.seo_description || "",
      },
      search: {
        google_search_tags: Array.isArray(json.google_search_tags) ? json.google_search_tags : [],
        google_local_search_terms: Array.isArray(json.google_local_search_terms) ? json.google_local_search_terms : [],
        search_keywords: searchKeywords,
        alternative_names: altNames,
        customer_search_phrases: customerPhrases,
        search_synonyms: synonyms,
        related_search_terms: relatedTerms,
        common_misspellings: misspellings,
        location_keywords: Array.isArray(json.location_keywords) ? json.location_keywords : [],
        showroom_search_index: showroomTokens,
      },
      faq: Array.isArray(json.faq) ? json.faq : [],
    };

    // 8. Database Mapping & Authoritative Data Preservation
    const productPatch: Record<string, any> = {
      master_document: masterDocument,
      ai_understanding: masterDocument,
      generated_description: masterDocument.seo.generated_description,
      short_description: json.short_description || masterDocument.seo.generated_description,
      faq: masterDocument.faq,
      processing_state: "completed",
      is_published: true,
      last_processed_at: new Date().toISOString(),
      error_log: null,
    };

    // Manual SEO flags
    if (!product.seo_title_manual && masterDocument.seo.seo_title) {
      productPatch.seo_title = masterDocument.seo.seo_title;
    }
    if (!product.seo_description_manual && masterDocument.seo.seo_description) {
      productPatch.seo_description = masterDocument.seo.seo_description;
    }
    if (!product.seo_keywords_manual && masterDocument.seo.seo_keywords.length > 0) {
      productPatch.seo_keywords = masterDocument.seo.seo_keywords;
    }
    if (masterDocument.seo.canonical_slug) {
      productPatch.canonical_slug = masterDocument.seo.canonical_slug;
    }

    // Preserve existing manual keywords and union with newly generated search keywords
    const manualAppKeywords = Array.isArray(product.app_keywords) ? product.app_keywords : [];
    const allSearchTokens = Array.from(new Set([
      ...manualAppKeywords,
      ...searchKeywords,
      ...altNames,
      ...customerPhrases,
      ...synonyms,
      ...relatedTerms,
      ...misspellings,
      ...showroomTokens
    ])).filter(Boolean);

    if (allSearchTokens.length > 0) {
      productPatch.app_keywords = allSearchTokens;
      productPatch.app_search_keywords = allSearchTokens;
    }

    // 9. Save Product Updates to Supabase
    const { error: updateErr } = await supabase
      .from("products")
      .update(productPatch as any)
      .eq("id", productId);

    if (updateErr) {
      throw new Error(`Failed to update product record: ${updateErr.message}`);
    }

    // 10. Rebuild Canonical Search Index for this product
    try {
      await supabase.rpc("rebuild_search_index" as any, { _product_id: productId } as any);
    } catch (indexErr: any) {
      console.warn("Search index rebuild non-fatal warning:", indexErr?.message);
    }

    return {
      ok: true,
      details: json,
      master_document: masterDocument,
    };
  });
