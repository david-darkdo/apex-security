import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Check,
  Sparkles,
  Upload,
  FileText,
  Globe,
  Search,
  ChevronDown,
  ChevronUp,
  Image,
  Layers,
  Cpu,
  ShieldCheck,
  Trash2,
  Plus,
  HelpCircle,
  Award,
  ListPlus
} from "lucide-react";
import { runProductPipeline } from "@/lib/ai-pipeline.functions";
import { runProductDetailsEngine } from "@/lib/product-details.functions";
import { generateStandaloneLifestyleImage } from "@/lib/lifestyle-image.functions";
import { ImageUploader, ImageTile, publicImageUrl } from "@/components/ImageUploader";
import { ImageEditorModal } from "@/components/ImageEditorModal";
import { triggerSitemapUpdate } from "@/lib/seo-publisher";

export const Route = createFileRoute("/_authenticated/admin/products/new")({
  head: () => ({ meta: [{ title: "Upload Security Product — Admin Panel" }] }),
  component: RebuiltNewProductPage,
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

function RebuiltNewProductPage() {
  const navigate = useNavigate();
  const [types, setTypes] = useState<(Tax & { code_prefix: string })[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [fams, setFams] = useState<Fam[]>([]);

  // Selected hierarchy IDs
  const [type_id, setType] = useState("");
  const [category_id, setCat] = useState("");
  const [subcategory_id, setSub] = useState("");
  const [family_id, setFam] = useState("");

  const [previewCode, setPreviewCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [isAiMode, setIsAiMode] = useState(true);
  const [generatingDetails, setGeneratingDetails] = useState(false);
  const [generatingLifestyle, setGeneratingLifestyle] = useState(false);
  const [runningPipeline, setRunningPipeline] = useState(false);

  // Photo Editor Modal State
  const [editingImage, setEditingImage] = useState<{ url: string; target: "original" | "installed" } | null>(null);

  // Collapsible section toggles
  const [showAdvancedAi, setShowAdvancedAi] = useState(false);
  const [showSeoSection, setShowSeoSection] = useState(true);
  const [showSearchSection, setShowSearchSection] = useState(false);
  const [showGeneratedContent, setShowGeneratedContent] = useState(true);

  // Uploaded media paths
  const [originalPath, setOriginalPath] = useState<string | null>(null);
  const [installedPaths, setInstalledPaths] = useState<string[]>([]);

  // Extracted AI Intelligence Object / Lists
  const [highlights, setHighlights] = useState<string[]>([]);
  const [features, setFeatures] = useState<string[]>([]);
  const [benefits, setBenefits] = useState<string[]>([]);
  const [faqs, setFaqs] = useState<{ question: string; answer: string }[]>([]);

  const [form, setForm] = useState({
    name: "",
    code: "",
    production_name: "",
    finish_name: "",
    brand: "Apex Security Ltd",
    color: "",
    material: "",
    size: "",
    price: "0",
    original_price: "",
    pricing_unit: "piece",
    differentiator_type: "Performance",
    differentiator_note: "",
    status: "published",
    featured_homepage: false,
    featured_feed: false,
    hidden: false,
    short_description: "",
    generated_description: "",
    seo_title: "",
    seo_description: "",
    seo_keywords: "",
    canonical_slug: "",
    search_keywords: "",
    alternative_terms: "",
    customer_phrases: "",
    synonyms: "",
    related_terms: "",
    misspellings: "",
    showroom_search_index: "",
    seo_title_manual: false,
    seo_description_manual: false,
    seo_keywords_manual: false,
  });

  useEffect(() => {
    (async () => {
      const [t, c, s, f] = await Promise.all([
        supabase.from("product_types").select("id,name,code_prefix").order("name"),
        supabase.from("categories").select("id,name,type_id").order("name"),
        supabase.from("subcategories").select("id,name,category_id").order("name"),
        supabase.from("family_groups").select("id,name,subcategory_id").order("name"),
      ]);
      setTypes((t.data ?? []) as any);
      setCats((c.data ?? []) as any);
      setSubs((s.data ?? []) as any);
      setFams((f.data ?? []) as any);
    })();
  }, []);

  useEffect(() => {
    if (!type_id) return setPreviewCode("");
    (async () => {
      const { data } = await supabase.rpc("generate_product_code", { _type_id: type_id } as any);
      if (typeof data === "string") {
        setPreviewCode(data);
        setForm((f) => ({ ...f, code: f.code || data }));
      }
    })();
  }, [type_id]);

  const filteredCats = useMemo(() => cats.filter((c) => c.type_id === type_id), [cats, type_id]);
  const filteredSubs = useMemo(() => subs.filter((s) => s.category_id === category_id), [subs, category_id]);
  const filteredFams = useMemo(() => fams.filter((f) => f.subcategory_id === subcategory_id), [fams, subcategory_id]);

  const runDetailsFn = useServerFn(runProductDetailsEngine);

  // PRODUCT DETAILS AI ENGINE (ENGINE 1)
  const handleGenerateDetailsOnNew = async () => {
    if (!form.name.trim()) {
      toast.error("Please enter a Product Name first before generating details.");
      return;
    }
    setGeneratingDetails(true);
    try {
      const slugBase = form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const tempSlug = `draft-${slugBase}-${Math.random().toString(36).slice(2, 6)}`;

      const { data: tempProduct, error: tempErr } = await supabase.from("products").insert({
        name: form.name.trim(),
        code: form.code || previewCode || "TEMP-001",
        type_id: type_id || null,
        category_id: category_id || null,
        subcategory_id: subcategory_id || null,
        family_id: family_id || null,
        production_name: form.production_name || null,
        finish_name: form.finish_name || null,
        brand: form.brand || null,
        color: form.color || null,
        material: form.material || null,
        size: form.size || null,
        price: Number(form.price) || 0,
        original_price: form.original_price ? Number(form.original_price) : null,
        pricing_unit: form.pricing_unit || "piece",
        differentiator_type: form.differentiator_type || null,
        differentiator_note: form.differentiator_note || null,
        status: "draft",
        processing_state: "pending",
        slug: tempSlug,
        image_url: originalPath || null,
      } as any).select("id").single();

      if (tempErr || !tempProduct?.id) {
        throw new Error(tempErr?.message || "Failed to initialize temporary draft");
      }

      const res = await runDetailsFn({ data: { productId: tempProduct.id } });
      if (res.ok && res.master_document) {
        const doc = res.master_document;
        const details = res.details;

        if (Array.isArray(doc.product_intelligence?.product_highlights)) {
          setHighlights(doc.product_intelligence.product_highlights);
        }
        if (Array.isArray(doc.product_intelligence?.product_features)) {
          setFeatures(doc.product_intelligence.product_features);
        }
        if (Array.isArray(doc.product_intelligence?.product_benefits)) {
          setBenefits(doc.product_intelligence.product_benefits);
        }
        if (Array.isArray(doc.faq)) {
          setFaqs(doc.faq);
        }

        const seoKw = Array.isArray(doc.seo?.seo_keywords) ? doc.seo.seo_keywords.join(", ") : (doc.seo?.seo_keywords || "");
        const searchKw = Array.isArray(doc.search?.search_keywords) ? doc.search.search_keywords.join(", ") : (doc.search?.search_keywords || "");

        setForm((prev) => ({
          ...prev,
          short_description: details.short_description || doc.seo?.generated_description || prev.short_description,
          generated_description: doc.seo?.generated_description || details.generated_description || prev.generated_description,
          seo_title: doc.seo?.seo_title || prev.seo_title,
          seo_description: doc.seo?.seo_description || prev.seo_description,
          seo_keywords: seoKw || prev.seo_keywords,
          canonical_slug: doc.seo?.canonical_slug || prev.canonical_slug,
          search_keywords: searchKw || prev.search_keywords,
          alternative_terms: Array.isArray(doc.search?.alternative_names) ? doc.search.alternative_names.join(", ") : prev.alternative_terms,
          customer_phrases: Array.isArray(doc.search?.customer_search_phrases) ? doc.search.customer_search_phrases.join(", ") : prev.customer_phrases,
          synonyms: Array.isArray(doc.search?.search_synonyms) ? doc.search.search_synonyms.join(", ") : prev.synonyms,
          related_terms: Array.isArray(doc.search?.related_search_terms) ? doc.search.related_search_terms.join(", ") : prev.related_terms,
          misspellings: Array.isArray(doc.search?.common_misspellings) ? doc.search.common_misspellings.join(", ") : prev.misspellings,
          showroom_search_index: Array.isArray(doc.search?.showroom_search_index) ? doc.search.showroom_search_index.join(", ") : prev.showroom_search_index,
        }));

        toast.success("Product Intelligence generated! Highlights, Features, SEO & FAQs populated.");
      }
      await supabase.from("products").delete().eq("id", tempProduct.id);
    } catch (e: any) {
      toast.error(e.message || "Failed to generate product details");
    } finally {
      setGeneratingDetails(false);
    }
  };

  // LIFESTYLE GENERATION (ENGINE 2)
  const handleGenerateLifestyleOnNew = async () => {
    if (!originalPath) {
      toast.error("Please upload an Original Product Image first.");
      return;
    }
    setGeneratingLifestyle(true);
    try {
      const slugBase = (form.name || "installed").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const tempSlug = `draft-img-${slugBase}-${Math.random().toString(36).slice(2, 6)}`;

      const { data: tempProduct, error: tempErr } = await supabase.from("products").insert({
        name: form.name.trim() || "Sample Security Product",
        code: form.code || previewCode || "TEMP-002",
        type_id: type_id || null,
        category_id: category_id || null,
        subcategory_id: subcategory_id || null,
        family_id: family_id || null,
        production_name: form.production_name || null,
        finish_name: form.finish_name || null,
        brand: form.brand || null,
        size: form.size || null,
        price: Number(form.price) || 0,
        status: "draft",
        processing_state: "pending",
        slug: tempSlug,
        image_url: originalPath,
      } as any).select("id").single();

      if (tempErr || !tempProduct?.id) {
        throw new Error(tempErr?.message || "Failed to create draft for lifestyle generation");
      }

      const res = await generateStandaloneLifestyleImage({ data: { productId: tempProduct.id } });
      if (res.ok && res.imageUrl) {
        setInstalledPaths((prev) => [...prev, res.imageUrl]);
        toast.success("Installed scene image generated successfully!");
      } else {
        toast.error("Failed to generate installed image");
      }
      await supabase.from("products").delete().eq("id", tempProduct.id);
    } catch (e: any) {
      toast.error(e.message || "Failed to generate installed image");
    } finally {
      setGeneratingLifestyle(false);
    }
  };

  // Full Pipeline Runner
  const handleRunFullPipelineOnNew = async () => {
    if (!form.name.trim()) return toast.error("Product name required");
    setRunningPipeline(true);
    await handleGenerateDetailsOnNew();
    if (originalPath) {
      await handleGenerateLifestyleOnNew();
    }
    setRunningPipeline(false);
    toast.success("Full AI pipeline completed!");
  };

  // CREATE PRODUCT HANDLER
  const create = async (targetStatus?: string) => {
    if (!type_id || !category_id || !subcategory_id || !family_id) {
      toast.error("Please complete the classification hierarchy (Type, Category, Subcategory, Family Group).");
      return;
    }
    if (!form.name.trim()) return toast.error("Product name is required.");
    if (!originalPath) return toast.error("Original Product Image is required.");

    setSaving(true);
    const slugBase = (form.canonical_slug || form.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const slug = `${slugBase}-${Math.random().toString(36).slice(2, 6)}`;

    const seoKeywordsArray = form.seo_keywords
      ? form.seo_keywords.split(",").map((k) => k.trim()).filter(Boolean)
      : [];

    const searchKeywordsArray = Array.from(new Set([
      ...(form.search_keywords ? form.search_keywords.split(",").map((k) => k.trim()) : []),
      ...(form.alternative_terms ? form.alternative_terms.split(",").map((k) => k.trim()) : []),
      ...(form.customer_phrases ? form.customer_phrases.split(",").map((k) => k.trim()) : []),
      ...(form.synonyms ? form.synonyms.split(",").map((k) => k.trim()) : []),
      ...(form.related_terms ? form.related_terms.split(",").map((k) => k.trim()) : []),
      ...(form.misspellings ? form.misspellings.split(",").map((k) => k.trim()) : []),
      ...(form.showroom_search_index ? form.showroom_search_index.split(",").map((k) => k.trim()) : []),
    ])).filter(Boolean);

    const finalStatus = targetStatus || form.status;

    // Build Master Document
    const masterDoc = {
      identity: {
        product_name: form.name.trim(),
        product_code: form.code.trim() || null,
        brand: form.brand.trim() || "Apex Security Ltd",
      },
      product_intelligence: {
        product_highlights: highlights,
        product_features: features,
        product_benefits: benefits,
      },
      differentiator: {
        differentiator_type: form.differentiator_type || null,
        differentiator_note: form.differentiator_note || null,
      },
      seo: {
        short_description: form.short_description || null,
        generated_description: form.generated_description || null,
        seo_title: form.seo_title || null,
        seo_description: form.seo_description || null,
        seo_keywords: seoKeywordsArray,
        canonical_slug: form.canonical_slug || null,
      },
      search: {
        search_keywords: form.search_keywords ? form.search_keywords.split(",").map((k) => k.trim()).filter(Boolean) : [],
        alternative_names: form.alternative_terms ? form.alternative_terms.split(",").map((k) => k.trim()).filter(Boolean) : [],
        customer_search_phrases: form.customer_phrases ? form.customer_phrases.split(",").map((k) => k.trim()).filter(Boolean) : [],
        search_synonyms: form.synonyms ? form.synonyms.split(",").map((k) => k.trim()).filter(Boolean) : [],
        related_search_terms: form.related_terms ? form.related_terms.split(",").map((k) => k.trim()).filter(Boolean) : [],
        common_misspellings: form.misspellings ? form.misspellings.split(",").map((k) => k.trim()).filter(Boolean) : [],
        showroom_search_index: form.showroom_search_index ? form.showroom_search_index.split(",").map((k) => k.trim()).filter(Boolean) : [],
      },
      faq: faqs,
    };

    const payload = {
      type_id,
      category_id,
      subcategory_id,
      family_id,
      name: form.name.trim(),
      code: form.code.trim() || null,
      production_name: form.production_name.trim() || null,
      finish_name: form.finish_name.trim() || null,
      brand: form.brand.trim() || "Apex Security Ltd",
      color: form.color.trim() || null,
      material: form.material.trim() || null,
      size: form.size.trim() || null,
      price: Number(form.price) || 0,
      original_price: form.original_price ? Number(form.original_price) : null,
      pricing_unit: form.pricing_unit || "piece",
      differentiator_type: form.differentiator_type || null,
      differentiator_note: form.differentiator_note || null,
      image_url: originalPath,
      image_mode: isAiMode ? "ai" : "manual",
      status: finalStatus,
      processing_state: "completed",
      featured_homepage: form.featured_homepage,
      featured_feed: form.featured_feed,
      hidden: form.hidden,
      short_description: form.short_description.trim() || form.generated_description.trim() || null,
      generated_description: form.generated_description.trim() || form.short_description.trim() || null,
      seo_title: form.seo_title.trim() || null,
      seo_description: form.seo_description.trim() || form.short_description.trim() || null,
      seo_keywords: seoKeywordsArray,
      canonical_slug: form.canonical_slug.trim() || null,
      faq: faqs.length > 0 ? faqs : null,
      master_document: masterDoc,
      ai_understanding: masterDoc,
      app_keywords: searchKeywordsArray,
      app_search_keywords: searchKeywordsArray,
      seo_title_manual: form.seo_title_manual,
      seo_description_manual: form.seo_description_manual,
      seo_keywords_manual: form.seo_keywords_manual,
      slug,
      is_published: finalStatus === "published",
      installation_images: installedPaths,
      generated_installed_image: installedPaths[0] || null,
    };

    const { data, error } = await supabase.from("products").insert(payload as any).select("id").single();

    if (error) {
      setSaving(false);
      return toast.error(error.message);
    }

    if (data?.id) {
      await supabase.rpc("rebuild_search_index" as any, { _product_id: data.id } as any);
      await triggerSitemapUpdate(data.id);
    }

    setSaving(false);
    toast.success("Product published & search index rebuilt!");
    navigate({ to: "/admin/products" });
  };

  return (
    <div className="container-app py-6 max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground uppercase">Upload Security Product</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Build 3 — Canonical Product Intelligence & Experience Layer</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => create("draft")}
            disabled={saving}
            className="rounded border border-border px-4 py-2 text-xs font-semibold hover:bg-muted transition"
          >
            Save Draft
          </button>
          <button
            type="button"
            onClick={() => create("published")}
            disabled={saving}
            className="rounded bg-primary px-5 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground hover:bg-primary/95 transition shadow-sm"
          >
            {saving ? "Publishing…" : "Publish Product"}
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
              value={type_id}
              onChange={(e) => { setType(e.target.value); setCat(""); setSub(""); setFam(""); }}
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
              value={category_id}
              onChange={(e) => { setCat(e.target.value); setSub(""); setFam(""); }}
              disabled={!type_id}
              className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs disabled:opacity-50"
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
              value={subcategory_id}
              onChange={(e) => { setSub(e.target.value); setFam(""); }}
              disabled={!category_id}
              className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs disabled:opacity-50"
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
              value={family_id}
              onChange={(e) => setFam(e.target.value)}
              disabled={!subcategory_id}
              className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs disabled:opacity-50"
            >
              <option value="">Select Family…</option>
              {filteredFams.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Essential Product Fields */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Product Name *</label>
            <input
              type="text"
              placeholder="e.g. Solar 4K PTZ Dual-Lens Security Camera"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs font-semibold"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Product Code</label>
            <input
              type="text"
              placeholder={previewCode ? `Auto: ${previewCode}` : "Code"}
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
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
              placeholder="e.g. Apex Security Ltd"
              value={form.brand}
              onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
              className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Current Price (NGN) *</label>
            <input
              type="number"
              value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs font-semibold"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Original Price (NGN)</label>
            <input
              type="number"
              placeholder="Optional crossed-out price"
              value={form.original_price}
              onChange={(e) => setForm((f) => ({ ...f, original_price: e.target.value }))}
              className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pricing Unit *</label>
            <select
              value={form.pricing_unit}
              onChange={(e) => setForm((f) => ({ ...f, pricing_unit: e.target.value }))}
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
                value={form.differentiator_type}
                onChange={(e) => setForm((f) => ({ ...f, differentiator_type: e.target.value }))}
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
                value={form.differentiator_note}
                onChange={(e) => setForm((f) => ({ ...f, differentiator_note: e.target.value }))}
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
              placeholder="e.g. Metal Alloy / Weatherproof IP67"
              value={form.material}
              onChange={(e) => setForm((f) => ({ ...f, material: e.target.value }))}
              className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Finish / Enclosure</label>
            <input
              type="text"
              placeholder="e.g. Matte Black / Powder Coated"
              value={form.finish_name}
              onChange={(e) => setForm((f) => ({ ...f, finish_name: e.target.value }))}
              className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Color</label>
            <input
              type="text"
              placeholder="e.g. Obsidian Black / White"
              value={form.color}
              onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
              className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Size / Dimensions</label>
            <input
              type="text"
              placeholder="e.g. 210mm x 140mm x 85mm"
              value={form.size}
              onChange={(e) => setForm((f) => ({ ...f, size: e.target.value }))}
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
              placeholder="Concise customer-facing summary..."
              value={form.short_description}
              onChange={(e) => setForm((f) => ({ ...f, short_description: e.target.value }))}
              className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Full Commercial Description</label>
            <textarea
              rows={3}
              placeholder="Detailed commercial description..."
              value={form.generated_description}
              onChange={(e) => setForm((f) => ({ ...f, generated_description: e.target.value }))}
              className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs"
            />
          </div>
        </div>
      </section>

      {/* SECTION 2: Media Assets */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <Image className="h-4 w-4 text-primary" />
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-foreground">Section 2 — Media Assets</h2>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Original Product Image */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground">1. Original Product Image *</label>
              <span className="text-[9px] text-muted-foreground uppercase font-mono">Source of Truth</span>
            </div>
            {originalPath ? (
              <ImageTile
                url={publicImageUrl(originalPath) || originalPath}
                onDelete={() => setOriginalPath(null)}
                onEdit={() => setEditingImage({ url: publicImageUrl(originalPath) || originalPath, target: "original" })}
                badge="Original"
              />
            ) : (
              <ImageUploader
                multiple={false}
                onUploaded={(paths: string[]) => setOriginalPath(paths[0])}
                label="Upload Original Product Image"
              />
            )}
          </div>

          {/* Installation Images */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground">2. Installation Scene Images</label>
              <span className="text-[9px] text-muted-foreground uppercase font-mono">{installedPaths.length} uploaded</span>
            </div>
            <div className="space-y-2">
              {installedPaths.length > 0 && (
                <div className="grid grid-cols-4 gap-2 pt-2">
                  {installedPaths.map((p, idx) => (
                    <div key={idx} className="group relative aspect-square rounded-lg border border-border overflow-hidden bg-muted">
                      <img src={publicImageUrl(p) || p} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setInstalledPaths((prev) => prev.filter((_, i) => i !== idx))}
                        className="absolute top-1 right-1 rounded bg-black/70 p-1 text-white hover:bg-destructive transition opacity-0 group-hover:opacity-100"
                        title="Remove image"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <ImageUploader
                multiple={true}
                onUploaded={(paths: string[]) => setInstalledPaths((prev) => [...prev, ...paths])}
                label={installedPaths.length > 0 ? "+ Add More Installation Images" : "Upload Installation Images (Multi-Image)"}
              />
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: AI Generation Controls */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="font-display text-sm font-bold uppercase tracking-wider text-foreground">Section 3 — AI Intelligence Engine</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsAiMode(!isAiMode)}
              className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition ${
                isAiMode ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {isAiMode ? "AI Mode: Active" : "Manual Mode"}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={handleGenerateDetailsOnNew}
            disabled={generatingDetails || saving}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90 transition disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>{generatingDetails ? "Generating Details…" : "Generate Product Details"}</span>
          </button>

          <button
            type="button"
            onClick={handleGenerateLifestyleOnNew}
            disabled={generatingLifestyle || saving || !originalPath}
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-xs font-bold text-foreground shadow-sm hover:bg-muted transition disabled:opacity-50"
          >
            <Image className="h-3.5 w-3.5 text-primary" />
            <span>{generatingLifestyle ? "Generating Scene…" : "Generate Installed Image"}</span>
          </button>

          <button
            type="button"
            onClick={handleRunFullPipelineOnNew}
            disabled={runningPipeline || saving}
            className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2.5 text-xs font-bold text-primary shadow-sm hover:bg-primary/20 transition disabled:opacity-50"
          >
            <Cpu className="h-3.5 w-3.5" />
            <span>{runningPipeline ? "Running Full Pipeline…" : "Run Full Pipeline"}</span>
          </button>
        </div>
      </section>

      {/* SECTION 4: Generated Content & Structured Lists (Highlights, Features, Benefits, FAQs) */}
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
                  onClick={() => setHighlights((h) => [...h, ""])}
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
                      }}
                      placeholder="e.g. 4K Ultra-HD surveillance resolution with true optical zoom"
                      className="flex-1 rounded-md border border-input bg-background p-2 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setHighlights((arr) => arr.filter((_, i) => i !== idx))}
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
                  onClick={() => setFeatures((f) => [...f, ""])}
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
                      }}
                      placeholder="e.g. Integrated solar panel with 12,000mAh rechargeable lithium battery"
                      className="flex-1 rounded-md border border-input bg-background p-2 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setFeatures((arr) => arr.filter((_, i) => i !== idx))}
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
                  onClick={() => setBenefits((b) => [...b, ""])}
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
                      }}
                      placeholder="e.g. Complete 24/7 security perimeter protection without mains electricity"
                      className="flex-1 rounded-md border border-input bg-background p-2 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setBenefits((arr) => arr.filter((_, i) => i !== idx))}
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
                  onClick={() => setFaqs((f) => [...f, { question: "", answer: "" }])}
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
                        }}
                        placeholder="Question: e.g. Does this camera operate during grid outages?"
                        className="flex-1 rounded-md border border-input bg-background p-2 text-xs font-semibold"
                      />
                      <button
                        type="button"
                        onClick={() => setFaqs((arr) => arr.filter((_, i) => i !== idx))}
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
                      }}
                      placeholder="Answer: e.g. Yes, the integrated solar panel and high-capacity battery maintain 24/7 independent recording."
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

              if (editingImage.target === "original") {
                setOriginalPath(filename);
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
