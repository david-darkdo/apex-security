import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowLeft,
  Sparkles,
  Trash2,
  Globe,
  Search,
  ChevronDown,
  ChevronUp,
  Image,
  Layers,
  Cpu,
  ShieldCheck,
  Plus,
  Award,
  ListPlus,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { runProductPipeline } from "@/lib/ai-pipeline.functions";
import { generateStandaloneLifestyleImage } from "@/lib/lifestyle-image.functions";
import { runProductDetailsEngine } from "@/lib/product-details.functions";
import { ImageUploader, ImageTile, publicImageUrl } from "@/components/ImageUploader";
import { ImageEditorModal } from "@/components/ImageEditorModal";
import { triggerSitemapUpdate } from "@/lib/seo-publisher";

export const Route = createFileRoute("/_authenticated/admin/products/$id")({
  component: RebuiltEditProductPage,
});

type Tax = { id: string; name: string };
type Cat = Tax & { type_id: string };
type Sub = Tax & { category_id: string };
type Fam = Tax & { subcategory_id: string };

const PRICING_UNITS = [
  { value: "piece", label: "Piece (/ piece)" },
  { value: "set", label: "Set (/ set)" },
  { value: "unit", label: "Unit (/ unit)" },
  { value: "sqm", label: "Square Metre (/ sqm)" },
  { value: "carton", label: "Carton (/ carton)" },
  { value: "box", label: "Box (/ box)" },
  { value: "metre", label: "Metre (/ metre)" },
  { value: "roll", label: "Roll (/ roll)" },
];

const DIFFERENTIATOR_TYPES = [
  "Performance",
  "Optical",
  "Power & Solar",
  "Biometric & Access",
  "Connectivity & Smart",
  "Physical & Armour",
  "Design & Finish",
  "Custom Security",
];

function RebuiltEditProductPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const [p, setP] = useState<any>(null);
  const [types, setTypes] = useState<(Tax & { code_prefix?: string })[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [fams, setFams] = useState<Fam[]>([]);

  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [generatingDetails, setGeneratingDetails] = useState(false);
  const [generatingLifestyle, setGeneratingLifestyle] = useState(false);
  const [runningPipeline, setRunningPipeline] = useState(false);

  // Photo Editor Modal State
  const [editingImage, setEditingImage] = useState<{ url: string; target: "image_url" | "generated_installed_image" } | null>(null);

  // Collapsible section toggles
  const [showAdvancedAi, setShowAdvancedAi] = useState(false);
  const [showGeneratedContent, setShowGeneratedContent] = useState(true);
  const [showSeoSection, setShowSeoSection] = useState(true);
  const [showSearchSection, setShowSearchSection] = useState(false);

  // Structured Lists
  const [highlights, setHighlights] = useState<string[]>([]);
  const [features, setFeatures] = useState<string[]>([]);
  const [benefits, setBenefits] = useState<string[]>([]);
  const [faqs, setFaqs] = useState<{ question: string; answer: string }[]>([]);

  const runDetailsFn = useServerFn(runProductDetailsEngine);
  const generateLifestyleFn = useServerFn(generateStandaloneLifestyleImage);
  const runPipelineFn = useServerFn(runProductPipeline);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
    if (error) return toast.error(error.message);
    if (!data) return toast.error("Product not found");
    
    setP(data);

    // Extract structured lists from master_document or legacy columns
    const masterDoc = data.master_document as any;
    const prodIntel = masterDoc?.product_intelligence;

    if (Array.isArray(prodIntel?.product_highlights)) {
      setHighlights(prodIntel.product_highlights);
    } else if (Array.isArray((data as any).highlights)) {
      setHighlights((data as any).highlights);
    } else {
      setHighlights([]);
    }

    if (Array.isArray(prodIntel?.product_features)) {
      setFeatures(prodIntel.product_features);
    } else if (Array.isArray((data as any).features)) {
      setFeatures((data as any).features);
    } else {
      setFeatures([]);
    }

    if (Array.isArray(prodIntel?.product_benefits)) {
      setBenefits(prodIntel.product_benefits);
    } else if (Array.isArray((data as any).benefits)) {
      setBenefits((data as any).benefits);
    } else {
      setBenefits([]);
    }

    if (Array.isArray(masterDoc?.faq)) {
      setFaqs(masterDoc.faq);
    } else if (Array.isArray(data.faq)) {
      setFaqs(data.faq as any);
    } else {
      setFaqs([]);
    }
  }, [id]);

  useEffect(() => {
    load();
    (async () => {
      const [t, c, s, f] = await Promise.all([
        supabase.from("product_types").select("id,name").order("name"),
        supabase.from("categories").select("id,name,type_id").order("name"),
        supabase.from("subcategories").select("id,name,category_id").order("name"),
        supabase.from("family_groups").select("id,name,subcategory_id").order("name"),
      ]);
      setTypes((t.data ?? []) as any);
      setCats((c.data ?? []) as any);
      setSubs((s.data ?? []) as any);
      setFams((f.data ?? []) as any);
    })();
  }, [id, load]);

  const filteredCats = useMemo(() => cats.filter((c) => c.type_id === p?.type_id), [cats, p?.type_id]);
  const filteredSubs = useMemo(() => subs.filter((s) => s.category_id === p?.category_id), [subs, p?.category_id]);
  const filteredFams = useMemo(() => fams.filter((f) => f.subcategory_id === p?.subcategory_id), [fams, p?.subcategory_id]);

  if (!p) return <div className="container-app py-10 text-sm text-muted-foreground font-mono">Loading product data…</div>;

  const setField = (key: string, value: any) => {
    setP((prev: any) => {
      const next = { ...prev, [key]: value };
      // CRITICAL SYNC RULE: Product Description = SEO Description
      if (key === "short_description" || key === "generated_description") {
        next.short_description = value;
        next.generated_description = value;
        next.seo_description = value;
      } else if (key === "seo_description") {
        next.seo_description = value;
        next.short_description = value;
        next.generated_description = value;
      }
      return next;
    });
    setIsDirty(true);
  };

  // ENGINE 1 Execution
  const handleGenerateDetails = async () => {
    setGeneratingDetails(true);
    try {
      const res = await runDetailsFn({ data: { productId: id } });
      if (res.ok) {
        toast.success("Engine 1: Product details, highlights & SEO generated!");
        await load();
      } else {
        toast.error("Failed to generate product details.");
      }
    } catch (e: any) {
      toast.error(e.message ?? "Generation failed");
    } finally {
      setGeneratingDetails(false);
    }
  };

  // ENGINE 2 Execution
  const handleGenerateLifestyle = async () => {
    if (!p.image_url) {
      toast.error("Original product image is required before generating an installed image.");
      return;
    }
    setGeneratingLifestyle(true);
    try {
      const res = await generateLifestyleFn({ data: { productId: id } });
      if (res.ok) {
        toast.success("Engine 2: Installed lifestyle image generated!");
        await load();
      } else {
        toast.error("Failed to generate installed image.");
      }
    } catch (e: any) {
      toast.error(e.message ?? "Generation failed");
    } finally {
      setGeneratingLifestyle(false);
    }
  };

  // Full Pipeline Execution
  const handleRunFullPipeline = async () => {
    setRunningPipeline(true);
    try {
      const res = await runPipelineFn({ data: { productId: id } });
      if (res.ok) {
        toast.success("Full AI pipeline completed!");
        await load();
      } else {
        toast.error("Pipeline run failed.");
      }
    } catch (e: any) {
      toast.error(e.message ?? "Pipeline run failed");
    } finally {
      setRunningPipeline(false);
    }
  };

  // SAVE HANDLER
  const save = async () => {
    setSaving(true);
    const syncedDesc = p.seo_description || p.short_description || p.generated_description || null;

    const seoKeywordsArray = Array.isArray(p.seo_keywords)
      ? p.seo_keywords
      : typeof p.seo_keywords === "string"
      ? p.seo_keywords.split(",").map((k: string) => k.trim()).filter(Boolean)
      : [];

    const searchKeywordsArray = Array.isArray(p.app_keywords)
      ? p.app_keywords
      : typeof p.app_keywords === "string"
      ? p.app_keywords.split(",").map((k: string) => k.trim()).filter(Boolean)
      : [];

    // Assemble updated Master Document
    const existingDoc = p.master_document || {};
    const updatedMasterDoc = {
      ...existingDoc,
      identity: {
        product_name: p.name?.trim() || "",
        product_code: p.code?.trim() || null,
        brand: p.brand?.trim() || "Apex Security Ltd",
      },
      product_intelligence: {
        product_highlights: highlights,
        product_features: features,
        product_benefits: benefits,
      },
      differentiator: {
        differentiator_type: p.differentiator_type || null,
        differentiator_note: p.differentiator_note || null,
      },
      seo: {
        short_description: syncedDesc,
        generated_description: syncedDesc,
        seo_title: p.seo_title || null,
        seo_description: syncedDesc,
        seo_keywords: seoKeywordsArray,
        canonical_slug: p.canonical_slug || p.slug || null,
      },
      search: {
        search_keywords: searchKeywordsArray,
        alternative_names: existingDoc.search?.alternative_names || [],
        customer_search_phrases: existingDoc.search?.customer_search_phrases || [],
        search_synonyms: existingDoc.search?.search_synonyms || [],
        related_search_terms: existingDoc.search?.related_search_terms || [],
        common_misspellings: existingDoc.search?.common_misspellings || [],
        showroom_search_index: existingDoc.search?.showroom_search_index || [],
      },
      faq: faqs,
    };

    const payload = {
      ...p,
      pricing_unit: p.pricing_unit || "piece",
      original_price: p.original_price ? Number(p.original_price) : null,
      differentiator_type: p.differentiator_type || null,
      differentiator_note: p.differentiator_note || null,
      short_description: syncedDesc,
      generated_description: syncedDesc,
      seo_description: syncedDesc,
      seo_keywords: seoKeywordsArray,
      app_keywords: searchKeywordsArray,
      app_search_keywords: searchKeywordsArray,
      faq: faqs.length > 0 ? faqs : null,
      master_document: updatedMasterDoc,
      ai_understanding: updatedMasterDoc,
      is_published: p.status === "published",
      price: Number(p.price) || 0,
      processing_state: "completed",
    };

    delete payload.id;
    delete payload.created_at;
    delete payload.updated_at;
    delete payload.similar_product_ids;

    const { error } = await supabase.from("products").update(payload as any).eq("id", id);
    if (error) {
      setSaving(false);
      return toast.error(error.message);
    }

    // Rebuild search index & trigger SEO discovery sitemap update
    await supabase.rpc("rebuild_search_index" as any, { _product_id: id } as any);
    await triggerSitemapUpdate(id);

    setSaving(false);
    setIsDirty(false);
    toast.success("Product changes saved, search index & sitemaps updated!");
    await load();
  };

  return (
    <div className="container-app py-6 max-w-5xl space-y-6">
      {/* Header Navigation & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <Link to="/admin/products" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to library
          </Link>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground uppercase">{p.name || "Edit Product"}</h1>
          <p className="text-xs text-muted-foreground mt-0.5 font-mono">ID: {id} · Code: {p.code}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={save}
            disabled={saving}
            className="rounded bg-primary px-5 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground hover:bg-primary/95 transition shadow-sm"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>

      {/* SECTION 1: Product Information */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <Layers className="h-4 w-4 text-primary" />
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-foreground">Section 1 — Product Information & Classification</h2>
        </div>

        {/* Classification Hierarchy */}
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Product Type *</label>
            <select
              value={p.type_id || ""}
              onChange={(e) => setField("type_id", e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs"
            >
              <option value="">Select Type…</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Category *</label>
            <select
              value={p.category_id || ""}
              onChange={(e) => setField("category_id", e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs"
            >
              <option value="">Select Category…</option>
              {filteredCats.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Subcategory *</label>
            <select
              value={p.subcategory_id || ""}
              onChange={(e) => setField("subcategory_id", e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs"
            >
              <option value="">Select Subcategory…</option>
              {filteredSubs.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Family Group *</label>
            <select
              value={p.family_id || ""}
              onChange={(e) => setField("family_id", e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs"
            >
              <option value="">Select Family…</option>
              {filteredFams.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Product Fields */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Product Name *</label>
            <input
              type="text"
              value={p.name || ""}
              onChange={(e) => setField("name", e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs font-semibold"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Product Code</label>
            <input
              type="text"
              value={p.code || ""}
              onChange={(e) => setField("code", e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs font-mono"
            />
          </div>
        </div>

        {/* Brand, Pricing & Unit */}
        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Brand</label>
            <input
              type="text"
              value={p.brand || ""}
              onChange={(e) => setField("brand", e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Current Price (NGN) *</label>
            <input
              type="number"
              value={p.price || 0}
              onChange={(e) => setField("price", e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs font-semibold"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Original Price (NGN)</label>
            <input
              type="number"
              placeholder="Optional crossed-out price"
              value={p.original_price ?? ""}
              onChange={(e) => setField("original_price", e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pricing Unit *</label>
            <select
              value={p.pricing_unit || "piece"}
              onChange={(e) => setField("pricing_unit", e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs"
            >
              {PRICING_UNITS.map((u) => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Differentiator Architecture */}
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3.5 space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
            <Award className="h-3.5 w-3.5" />
            <span>Product Differentiator</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Differentiator Type</label>
              <select
                value={p.differentiator_type || "Performance"}
                onChange={(e) => setField("differentiator_type", e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs"
              >
                {DIFFERENTIATOR_TYPES.map((dt) => (
                  <option key={dt} value={dt}>{dt}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Differentiator Note</label>
              <input
                type="text"
                placeholder="e.g. 4K Ultra-HD night vision with AI human detection & solar continuous power"
                value={p.differentiator_note || ""}
                onChange={(e) => setField("differentiator_note", e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs"
              />
            </div>
          </div>
        </div>

        {/* Physical Attributes */}
        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Material / Housing</label>
            <input
              type="text"
              value={p.material || ""}
              onChange={(e) => setField("material", e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Finish / Enclosure</label>
            <input
              type="text"
              value={p.finish_name || p.finish || ""}
              onChange={(e) => setField("finish_name", e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Color</label>
            <input
              type="text"
              value={p.color || ""}
              onChange={(e) => setField("color", e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Size / Dimensions</label>
            <input
              type="text"
              value={p.size || ""}
              onChange={(e) => setField("size", e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs"
            />
          </div>
        </div>

        {/* Descriptions */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Short Description (1–2 Sentences)</label>
            <textarea
              rows={3}
              value={p.short_description || p.generated_description || ""}
              onChange={(e) => setField("short_description", e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Full Commercial Description</label>
            <textarea
              rows={3}
              value={p.generated_description || p.short_description || ""}
              onChange={(e) => setField("generated_description", e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs"
            />
          </div>
        </div>
      </section>

      {/* SECTION 2: Images */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <Image className="h-4 w-4 text-primary" />
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-foreground">Section 2 — Media Assets</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Original Image */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground">1. Original Manufacturer Image *</label>
              <span className="text-[10px] text-muted-foreground uppercase font-mono">Source of Truth</span>
            </div>
            {p.image_url ? (
              <ImageTile
                url={publicImageUrl(p.image_url) || p.image_url}
                onDelete={() => setField("image_url", null)}
                onEdit={() => setEditingImage({ url: publicImageUrl(p.image_url) || p.image_url, target: "image_url" })}
                badge="Original"
              />
            ) : (
              <ImageUploader multiple={false} onUploaded={(paths) => setField("image_url", paths[0])} label="Upload Original Product Image" />
            )}
          </div>

          {/* Installed Images Gallery */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground">
                2. Installation & Lifestyle Images ({((p.installation_images as string[]) || (p.generated_installed_image ? [p.generated_installed_image] : [])).length})
              </label>
              <span className="text-[10px] text-muted-foreground uppercase font-mono">Multi-Image Gallery</span>
            </div>

            {(() => {
              const list: string[] = Array.isArray(p.installation_images) && p.installation_images.length > 0
                ? p.installation_images
                : (p.generated_installed_image ? [p.generated_installed_image] : []);

              return (
                <div className="space-y-2">
                  {list.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {list.map((url, idx) => (
                        <div key={idx} className="relative group rounded-lg border border-border overflow-hidden bg-card aspect-square">
                          <img src={publicImageUrl(url) || url} alt={`Installation ${idx + 1}`} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 p-1">
                            <button
                              type="button"
                              onClick={() => {
                                const updated = list.filter((_, i) => i !== idx);
                                setField("installation_images", updated);
                                setField("generated_installed_image", updated[0] || null);
                              }}
                              className="rounded bg-destructive/90 hover:bg-destructive text-white p-1 text-[10px] font-bold"
                              title="Delete this installation image"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <span className="absolute bottom-1 left-1 bg-black/70 text-white text-[8px] font-mono px-1.5 py-0.5 rounded">
                            #{idx + 1}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <ImageUploader
                    multiple={true}
                    onUploaded={(paths) => {
                      const updated = [...list, ...paths];
                      setField("installation_images", updated);
                      setField("generated_installed_image", updated[0] || null);
                    }}
                    label={list.length > 0 ? "+ Add More Installation Images" : "Upload Installation Images (Multi-Image)"}
                  />
                </div>
              );
            })()}

            <div className="pt-1">
              <button
                type="button"
                onClick={handleGenerateLifestyle}
                disabled={generatingLifestyle || !p.image_url}
                className="w-full flex items-center justify-center gap-2 rounded border border-primary/30 bg-primary/10 px-4 py-2.5 text-xs font-bold text-primary hover:bg-primary/20 transition disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                {generatingLifestyle ? "Engine 2 Generating Installed Image…" : "Generate Installed Image (Engine 2)"}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: Publishing Settings */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-foreground">Section 3 — Publishing Settings</h2>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <select
              value={p.status || "published"}
              onChange={(e) => setField("status", e.target.value)}
              className="rounded-md border border-input bg-background p-2 text-xs font-semibold"
            >
              <option value="published">Status: Published</option>
              <option value="draft">Status: Draft</option>
              <option value="review">Status: Review</option>
              <option value="archived">Status: Archived</option>
            </select>
          </div>

          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded bg-primary px-5 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground hover:bg-primary/95 transition shadow-sm"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </section>

      {/* SECTION 4: Product Highlights, Features, Benefits & FAQs */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
        <button
          type="button"
          onClick={() => setShowGeneratedContent(!showGeneratedContent)}
          className="flex w-full items-center justify-between border-b border-border pb-3"
        >
          <div className="flex items-center gap-2">
            <ListPlus className="h-4 w-4 text-primary" />
            <h2 className="font-display text-sm font-bold uppercase tracking-wider text-foreground">
              Section 4 — Product Highlights, Features, Benefits & FAQs
            </h2>
          </div>
          {showGeneratedContent ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {showGeneratedContent && (
          <div className="space-y-6 pt-2">
            {/* Highlights */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-foreground">Product Highlights ({highlights.length})</label>
                <button
                  type="button"
                  onClick={() => { setHighlights((h) => [...h, ""]); setIsDirty(true); }}
                  className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" /> Add Highlight
                </button>
              </div>
              <div className="space-y-2">
                {highlights.map((hl, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      type="text"
                      value={hl}
                      onChange={(e) => {
                        const val = e.target.value;
                        setHighlights((arr) => arr.map((x, i) => (i === idx ? val : x)));
                        setIsDirty(true);
                      }}
                      placeholder="e.g. 4K Ultra-HD surveillance resolution with true optical zoom"
                      className="flex-1 rounded-md border border-input bg-background p-2 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => { setHighlights((arr) => arr.filter((_, i) => i !== idx)); setIsDirty(true); }}
                      className="rounded p-2 text-muted-foreground hover:text-destructive transition"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Features */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-foreground">Product Features ({features.length})</label>
                <button
                  type="button"
                  onClick={() => { setFeatures((f) => [...f, ""]); setIsDirty(true); }}
                  className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" /> Add Feature
                </button>
              </div>
              <div className="space-y-2">
                {features.map((ft, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      type="text"
                      value={ft}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFeatures((arr) => arr.map((x, i) => (i === idx ? val : x)));
                        setIsDirty(true);
                      }}
                      placeholder="e.g. Integrated solar panel with 12,000mAh rechargeable lithium battery"
                      className="flex-1 rounded-md border border-input bg-background p-2 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => { setFeatures((arr) => arr.filter((_, i) => i !== idx)); setIsDirty(true); }}
                      className="rounded p-2 text-muted-foreground hover:text-destructive transition"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Benefits */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-foreground">Product Benefits ({benefits.length})</label>
                <button
                  type="button"
                  onClick={() => { setBenefits((b) => [...b, ""]); setIsDirty(true); }}
                  className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" /> Add Benefit
                </button>
              </div>
              <div className="space-y-2">
                {benefits.map((bn, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      type="text"
                      value={bn}
                      onChange={(e) => {
                        const val = e.target.value;
                        setBenefits((arr) => arr.map((x, i) => (i === idx ? val : x)));
                        setIsDirty(true);
                      }}
                      placeholder="e.g. Complete 24/7 security perimeter protection without mains electricity"
                      className="flex-1 rounded-md border border-input bg-background p-2 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => { setBenefits((arr) => arr.filter((_, i) => i !== idx)); setIsDirty(true); }}
                      className="rounded p-2 text-muted-foreground hover:text-destructive transition"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* FAQs */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-foreground">Frequently Asked Questions ({faqs.length})</label>
                <button
                  type="button"
                  onClick={() => { setFaqs((f) => [...f, { question: "", answer: "" }]); setIsDirty(true); }}
                  className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" /> Add FAQ
                </button>
              </div>
              <div className="space-y-3">
                {faqs.map((faq, idx) => (
                  <div key={idx} className="rounded-lg border border-border/70 bg-surface/40 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        value={faq.question}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFaqs((arr) => arr.map((x, i) => (i === idx ? { ...x, question: val } : x)));
                          setIsDirty(true);
                        }}
                        placeholder="Question: e.g. Does this camera work during power outages?"
                        className="flex-1 rounded-md border border-input bg-background p-2 text-xs font-semibold"
                      />
                      <button
                        type="button"
                        onClick={() => { setFaqs((arr) => arr.filter((_, i) => i !== idx)); setIsDirty(true); }}
                        className="rounded p-1 text-muted-foreground hover:text-destructive transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <textarea
                      rows={2}
                      value={faq.answer}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFaqs((arr) => arr.map((x, i) => (i === idx ? { ...x, answer: val } : x)));
                        setIsDirty(true);
                      }}
                      placeholder="Answer: e.g. Yes, the built-in solar battery system powers continuous recording independently."
                      className="w-full rounded-md border border-input bg-background p-2 text-xs"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Photo Editor Modal */}
      {editingImage && (
        <ImageEditorModal
          isOpen={true}
          imageUrl={editingImage.url}
          onClose={() => setEditingImage(null)}
          onSave={async (blob: Blob) => {
            try {
              const filename = `edited_${Date.now()}.png`;
              const { error: uploadError } = await supabase.storage
                .from("product-images")
                .upload(filename, blob, { contentType: "image/png", upsert: true });

              if (uploadError) throw uploadError;

              if (editingImage.target === "image_url") {
                setField("image_url", filename);
              }
              setEditingImage(null);
              toast.success("Image edited and replaced successfully!");
            } catch (err: any) {
              toast.error(err.message || "Failed to save edited image");
            }
          }}
        />
      )}
    </div>
  );
}
