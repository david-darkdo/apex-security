// @ts-nocheck
import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import {
  addItemToUserCollection,
  addGuestItem,
  getGuestCollection,
  getUserCollectionItems,
  getCachedUserCollectionItems,
  detectProductUnit,
  getLiveProductDetailsBatch,
} from "@/lib/collection";
import { useAppSettings, waLink } from "@/lib/settings";
import { toast } from "sonner";
import { Bookmark, Sparkles, Check, Share2, Layers, ShieldCheck, Heart, Phone, Truck, Wrench, ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { publicImageUrl } from "@/components/ImageUploader";
import { useFavorites } from "@/hooks/useFavorites";

const productQuery = (slug: string) =>
  queryOptions({
    queryKey: ["product", slug],
    queryFn: async () => {
      // 1. Fetch Product
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("slug", slug)
        .eq("status", "published")
        .eq("hidden", false)
        .is("deleted_at", null)
        .maybeSingle();

      if (error || !data) throw new Error("Product not found");

      // 2. Fetch Taxonomy & Relations
      const [typeRes, catRes, subRes, famRes, crossRes] = await Promise.all([
        data.type_id ? supabase.from("product_types").select("id, name, slug").eq("id", data.type_id).maybeSingle() : Promise.resolve({ data: null }),
        data.category_id ? supabase.from("categories").select("id, name, slug").eq("id", data.category_id).maybeSingle() : Promise.resolve({ data: null }),
        data.subcategory_id ? supabase.from("subcategories").select("id, name, slug").eq("id", data.subcategory_id).maybeSingle() : Promise.resolve({ data: null }),
        data.family_id ? supabase.from("family_groups").select("id, name, slug").eq("id", data.family_id).maybeSingle() : Promise.resolve({ data: null }),
        data.category_id ? supabase.from("products").select("id, slug, name, code, price, image_url, generated_studio_image, brand").eq("category_id", data.category_id).neq("id", data.id).eq("status", "published").eq("hidden", false).is("deleted_at", null).limit(4) : Promise.resolve({ data: [] }),
      ]);

      return {
        product: data,
        taxonomy: {
          type: typeRes.data,
          category: catRes.data,
          subcategory: subRes.data,
          family: famRes.data,
        },
        crossSells: crossRes.data ?? [],
      };
    },
  });

export const Route = createFileRoute("/product/$slug")({
  loader: ({ context, params }) => {
    return context.queryClient.ensureQueryData(productQuery(params.slug));
  },
  head: ({ loaderData }: any): any => {
    if (!loaderData?.product) return {};
    const p = loaderData.product;
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://apex-security-ltd.vercel.app';
    const canonical = `${origin}/product/${p.slug}`;
    const mainImg = p.generated_studio_image || p.image_url || "";
    const metaImg = mainImg ? publicImageUrl(mainImg) : "";
    const title = `${p.name} (${p.code}) — Apex Security Ltd`;
    const desc = p.short_description || `${p.name} available at Apex Security Ltd. High quality CCTV, security doors, and smart locks in Abuja & nationwide.`;

    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:type", content: "product" },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:image", content: metaImg },
        { property: "og:url", content: canonical },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: desc },
        { name: "twitter:image", content: metaImg },
      ],
      links: [
        { rel: "canonical", href: canonical },
      ],
    };
  },
  component: ProductDetailsPage,
});

function ProductDetailsPage() {
  const params = Route.useParams();
  const { data } = useSuspenseQuery(productQuery(params.slug));
  const { product, taxonomy, crossSells } = data;
  const { user } = useAuth();
  const { data: settings } = useAppSettings();
  const { isFavorite, toggleFavorite } = useFavorites();

  const [inCollection, setInCollection] = useState(false);
  const [activeImageTab, setActiveImageTab] = useState<"studio" | "installed">("studio");
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Initialize and track Collection membership (< 16ms)
  useEffect(() => {
    if (user) {
      const cached = getCachedUserCollectionItems(user.id);
      const isSaved = cached.items.some((i: any) => i.product_id === product.id);
      setInCollection(isSaved);
    } else {
      const guest = getGuestCollection();
      setInCollection(guest.some((g) => g.product_id === product.id));
    }
  }, [user, product.id]);

  const handleCollectionToggle = async () => {
    if (inCollection) {
      toast.info("Item is already in your Active Workspace");
      return;
    }

    setInCollection(true);
    if (user) {
      await addItemToUserCollection(user.id, product.id);
    } else {
      addGuestItem(product.id);
    }
    toast.success("Added to Project Workspace");
  };

  const handleDirectWhatsAppInquiry = () => {
    const waPhone = settings?.sales_whatsapp || settings?.support_whatsapp || "07063492581";
    const company = settings?.company_name || "Apex Security Ltd";
    const currentUrl = window.location.href;
    const msg = `Hello ${company},\n\nI am inquiring about:\n*${product.name}* (Code: *${product.code}*)\nLink: ${currentUrl}\n\nPlease provide pricing, specs, and availability.`;
    window.open(waLink(waPhone, msg), "_blank", "noopener,noreferrer");
  };

  const shareProduct = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${product.name} — Apex Security Ltd`,
          url: window.location.href,
        });
        return;
      } catch {}
    }
    await navigator.clipboard.writeText(window.location.href);
    toast.success("Product link copied to clipboard");
  };

  // Image assets resolution
  const studioImg = product.generated_studio_image || product.image_url;
  const installedImg = product.generated_installed_image;
  const activeImgSrc = activeImageTab === "studio" ? studioImg : (installedImg || studioImg);
  const galleryImages = [studioImg, installedImg].filter(Boolean);

  const breadcrumbs = [
    { label: "Home", path: "/" },
    taxonomy.type && { label: taxonomy.type.name, path: `/${taxonomy.type.slug}` },
    taxonomy.category && { label: taxonomy.category.name, path: `/${taxonomy.type?.slug}/${taxonomy.category.slug}` },
    taxonomy.subcategory && { label: taxonomy.subcategory.name, path: `/${taxonomy.type?.slug}/${taxonomy.category?.slug}/${taxonomy.subcategory.slug}` },
  ].filter(Boolean) as { label: string; path: string }[];

  const schemaProduct = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": product.name,
    "image": publicImageUrl(studioImg),
    "description": product.short_description || `${product.name} security solutions by Apex Security Ltd`,
    "sku": product.code,
    "brand": {
      "@type": "Brand",
      "name": product.brand || "Apex Security Ltd"
    },
    "offers": {
      "@type": "Offer",
      "url": typeof window !== 'undefined' ? window.location.href : "",
      "priceCurrency": "NGN",
      "price": product.price || "0",
      "availability": "https://schema.org/InStock"
    }
  };

  return (
    <AppShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaProduct) }}
      />

      <div className="container-app pt-4 pb-16 space-y-8">
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center gap-1.5 overflow-x-auto pb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
          {breadcrumbs.map((b, idx) => (
            <span key={idx} className="flex items-center gap-1.5 shrink-0">
              {idx > 0 && <span className="text-muted-foreground/40">/</span>}
              <Link to={b.path} className="hover:text-primary transition">
                {b.label}
              </Link>
            </span>
          ))}
          <span className="text-muted-foreground/40">/</span>
          <span className="font-semibold text-foreground truncate">{product.name}</span>
        </nav>

        {/* Main Product Presentation */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Visual Presentation Area */}
          <div className="space-y-3">
            <div className="relative aspect-square rounded-2xl overflow-hidden bg-surface-2 border border-border group shadow-sm">
              <img
                src={publicImageUrl(activeImgSrc)}
                alt={product.alt_text || product.name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />

              {/* Watermark Overlay if enabled */}
              {settings?.watermark_enabled && (
                <div
                  className="pointer-events-none absolute inset-0 flex items-center justify-center select-none"
                  style={{ opacity: settings.watermark_opacity ?? 0.25 }}
                >
                  <span className="font-display font-black text-4xl sm:text-5xl uppercase tracking-[0.3em] text-white rotate-[-25deg] drop-shadow-md">
                    {settings.watermark_text || "Apex Security Ltd"}
                  </span>
                </div>
              )}

              {/* Favorite button overlay */}
              <button
                onClick={() => toggleFavorite(product.id)}
                className="absolute top-4 right-4 p-2.5 rounded-full bg-black/40 backdrop-blur-md text-white hover:bg-black/60 transition shadow-md"
                aria-label="Save to Favorites"
              >
                <Heart className={`h-5 w-5 ${isFavorite(product.id) ? "fill-red-500 text-red-500" : ""}`} />
              </button>

              {/* Lightbox Trigger */}
              <button
                onClick={() => {
                  setLightboxIndex(activeImageTab === "studio" ? 0 : 1);
                  setLightboxOpen(true);
                }}
                className="absolute bottom-4 right-4 p-2 rounded-lg bg-black/40 backdrop-blur-md text-white hover:bg-black/60 transition opacity-0 group-hover:opacity-100"
              >
                <Eye className="h-4 w-4" />
              </button>
            </div>

            {/* Studio / Installed Visual Toggle Tabs */}
            {installedImg && (
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveImageTab("studio")}
                  className={`flex-1 py-2 px-3 rounded-xl border text-xs font-semibold uppercase tracking-wider transition ${
                    activeImageTab === "studio"
                      ? "border-primary bg-primary text-primary-foreground shadow-xs"
                      : "border-border bg-card text-muted-foreground hover:bg-surface-2"
                  }`}
                >
                  Showroom Studio View
                </button>
                <button
                  onClick={() => setActiveImageTab("installed")}
                  className={`flex-1 py-2 px-3 rounded-xl border text-xs font-semibold uppercase tracking-wider transition ${
                    activeImageTab === "installed"
                      ? "border-primary bg-primary text-primary-foreground shadow-xs"
                      : "border-border bg-card text-muted-foreground hover:bg-surface-2"
                  }`}
                >
                  Live Installation Render
                </button>
              </div>
            )}
          </div>

          {/* Product Specifications & Commercial Actions */}
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-primary/10 text-primary text-xs font-mono font-bold px-2.5 py-0.5 border border-primary/20">
                  {product.code}
                </span>
                {product.brand && (
                  <span className="text-xs font-medium text-muted-foreground">
                    Brand: <strong className="text-foreground">{product.brand}</strong>
                  </span>
                )}
              </div>
              <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-foreground mt-2">
                {product.name}
              </h1>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                {product.short_description || `Premium ${product.name} engineered for superior security and refined aesthetics.`}
              </p>
            </div>

            {/* Price & Unit Display */}
            <div className="rounded-xl border border-border bg-surface-2/60 p-4 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Showroom Price / Specification
              </span>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-3xl font-extrabold text-foreground">
                  {product.price ? `₦${Number(product.price).toLocaleString()}` : "Price on Request"}
                </span>
                <span className="text-xs text-muted-foreground">
                  / {detectProductUnit(product)}
                </span>
              </div>
            </div>

            {/* Technical Specifications Matrix */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              {product.color && (
                <div className="rounded-lg border border-border bg-card p-3">
                  <span className="text-muted-foreground block text-[10px] uppercase">Color / Finish</span>
                  <span className="font-semibold text-foreground mt-0.5 block">{product.color}</span>
                </div>
              )}
              {product.material && (
                <div className="rounded-lg border border-border bg-card p-3">
                  <span className="text-muted-foreground block text-[10px] uppercase">Material</span>
                  <span className="font-semibold text-foreground mt-0.5 block">{product.material}</span>
                </div>
              )}
              {product.finish && (
                <div className="rounded-lg border border-border bg-card p-3">
                  <span className="text-muted-foreground block text-[10px] uppercase">Surface Finish</span>
                  <span className="font-semibold text-foreground mt-0.5 block">{product.finish}</span>
                </div>
              )}
              <div className="rounded-lg border border-border bg-card p-3">
                <span className="text-muted-foreground block text-[10px] uppercase">Availability</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5 block">In Stock (Abuja)</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 pt-2">
              <button
                onClick={handleCollectionToggle}
                className={`w-full inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-bold uppercase tracking-wider transition shadow-sm ${
                  inCollection
                    ? "border border-border bg-surface-2 text-foreground"
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                }`}
              >
                {inCollection ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-600" />
                    <span>Saved in Active Workspace</span>
                  </>
                ) : (
                  <>
                    <Bookmark className="h-4 w-4" />
                    <span>Add to Project Workspace</span>
                  </>
                )}
              </button>

              <button
                onClick={handleDirectWhatsAppInquiry}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3.5 text-sm font-bold uppercase tracking-wider text-white hover:bg-emerald-700 transition shadow-sm"
              >
                <Phone className="h-4 w-4" />
                <span>Instant WhatsApp Price Inquiry</span>
              </button>

              <button
                onClick={shareProduct}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition"
              >
                <Share2 className="h-3.5 w-3.5" />
                <span>Share Product Specifications</span>
              </button>
            </div>

            {/* Trust Assurance Strip */}
            <div className="border-t border-border pt-4 grid grid-cols-3 gap-2 text-center text-[10px] text-muted-foreground">
              <div className="space-y-1">
                <ShieldCheck className="h-4 w-4 text-primary mx-auto" />
                <span>Quality Assured</span>
              </div>
              <div className="space-y-1">
                <Truck className="h-4 w-4 text-primary mx-auto" />
                <span>Nationwide Delivery</span>
              </div>
              <div className="space-y-1">
                <Wrench className="h-4 w-4 text-primary mx-auto" />
                <span>Expert Installation</span>
              </div>
            </div>
          </div>
        </div>

        {/* Cross-sell & Related Products in Category */}
        {crossSells.length > 0 && (
          <div className="border-t border-border pt-10 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-accent">Related Solutions</span>
                <h2 className="font-display text-xl font-bold text-foreground">Complementary Products</h2>
              </div>
              {taxonomy.category && (
                <Link
                  to={`/${taxonomy.type?.slug}/${taxonomy.category?.slug}`}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  View Category →
                </Link>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {crossSells.map((cs: any) => (
                <Link
                  key={cs.id}
                  to="/product/$slug"
                  params={{ slug: cs.slug }}
                  className="rounded-xl border border-border bg-card p-3 space-y-2 hover:border-primary/50 transition group"
                >
                  <div className="aspect-square rounded-lg overflow-hidden bg-surface-2">
                    <img
                      src={publicImageUrl(cs.generated_studio_image || cs.image_url)}
                      alt={cs.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-foreground truncate">{cs.name}</p>
                    <p className="text-[11px] font-mono text-muted-foreground">{cs.code}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
