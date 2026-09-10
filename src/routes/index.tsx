import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useInfiniteQuery, useSuspenseQuery, useQuery, queryOptions, infiniteQueryOptions } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ProductCard, ProductCardSkeleton } from "@/components/ProductCard";
import { fetchFeedProductsPaginated, fetchTaxonomy, type FeedFilters, type CursorParam } from "@/lib/catalog";
import { useAppSettings } from "@/lib/settings";
import { ChevronDown, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type FeedSearch = {
  type?: string;
  category?: string;
  subcategory?: string;
};

function validateFeedSearch(s: Record<string, unknown>): FeedSearch {
  const pick = (k: string) => {
    const v = s[k];
    return typeof v === "string" && v.length > 0 ? v : undefined;
  };
  return { type: pick("type"), category: pick("category"), subcategory: pick("subcategory") };
}

const taxonomyQuery = queryOptions({
  queryKey: ["taxonomy"],
  queryFn: fetchTaxonomy,
  staleTime: 5 * 60_000,
});

const heroVideosQuery = queryOptions({
  queryKey: ["feed_hero_videos"],
  queryFn: async () => {
    const { data } = await supabase
      .from("hero_videos")
      .select("*")
      .eq("is_active", true)
      .order("order_index", { ascending: true });
    return data || [];
  },
  staleTime: 5 * 60_000,
});

const feedInfiniteQuery = (f: FeedFilters) =>
  infiniteQueryOptions({
    queryKey: ["feed_infinite", f],
    queryFn: ({ pageParam }) => fetchFeedProductsPaginated(f, pageParam as CursorParam | null, 24),
    initialPageParam: null as CursorParam | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

export const Route = createFileRoute("/")({
  validateSearch: validateFeedSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => {
    context.queryClient.ensureQueryData(taxonomyQuery);
    context.queryClient.ensureInfiniteQueryData(feedInfiniteQuery(deps));
  },
  head: () => ({
    meta: [
      { title: "Discover — Apex Security Showroom" },
      {
        name: "description",
        content: "Apex Security Ltd provides CCTV systems, smart locks, security doors and modern door solutions for homes, businesses and building projects across Abuja and Nigeria.",
      },
    ],
  }),
  component: FeedPage,
  errorComponent: ({ error }) => {
    return (
      <div className="p-6 text-sm text-destructive font-mono">
        <div>Error: {error.message}</div>
      </div>
    );
  },
});

function FeedPage() {
  const { data: s } = useAppSettings();
  const companyName = s?.company_name || "Apex Security Ltd";
  const shortDesc = s?.short_description || "Apex Security Ltd provides CCTV systems, smart locks, security doors and modern door solutions for homes, businesses and building projects across Abuja and Nigeria.";

  const search = Route.useSearch();
  const navigate = useNavigate();
  const { data: tax } = useSuspenseQuery(taxonomyQuery);
  const { data: heroVideos = [] } = useQuery(heroVideosQuery);
  const feedQuery = useInfiniteQuery(feedInfiniteQuery(search));

  const [activeHeroIndex, setActiveHeroIndex] = useState(0);

  useEffect(() => {
    if (heroVideos.length <= 1) return;
    const timer = setInterval(() => {
      setActiveHeroIndex((prev) => (prev + 1) % heroVideos.length);
    }, 7000);
    return () => clearInterval(timer);
  }, [heroVideos.length]);

  const currentHero = heroVideos[activeHeroIndex] || (heroVideos.length > 0 ? heroVideos[0] : null);
  const currentVideoUrl = currentHero?.url || "https://assets.mixkit.co/videos/preview/mixkit-modern-apartment-interior-design-39908-large.mp4";

  const loadMoreRef = useRef<HTMLDivElement>(null);

  const activeType = tax.types.find((t) => t.slug === search.type);
  const categoriesForType = activeType
    ? tax.categories.filter((c: any) => c.type_id === activeType.id)
    : [];
  const activeCategory = categoriesForType.find((c) => c.slug === search.category);
  const subcategoriesForCat = activeCategory
    ? tax.subcategories.filter((s: any) => s.category_id === activeCategory.id)
    : [];
  const activeSub = subcategoriesForCat.find((s) => s.slug === search.subcategory);

  const setType = (slug?: string) =>
    navigate({ to: "/", search: { type: slug, category: undefined, subcategory: undefined } });
  const setCategory = (slug?: string) =>
    navigate({
      to: "/",
      search: { ...search, category: slug, subcategory: undefined },
    });
  const setSub = (slug?: string) =>
    navigate({ to: "/", search: { ...search, subcategory: slug } });

  const allProducts = feedQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const totalCount = feedQuery.data?.pages[0]?.totalCount ?? 0;
  const hasNextPage = feedQuery.hasNextPage;
  const isFetchingNextPage = feedQuery.isFetchingNextPage;

  // IntersectionObserver for Automatic Infinite Scroll
  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          void feedQuery.fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );
    const el = loadMoreRef.current;
    if (el) observer.observe(el);
    return () => {
      if (el) observer.unobserve(el);
    };
  }, [hasNextPage, isFetchingNextPage, feedQuery]);

  return (
    <AppShell>
      {/* FIX 1: Full-Bleed Cinematic Video Hero (edge-to-edge, zero margin) */}
      <div className="relative w-full overflow-hidden bg-canvas border-b border-border/50">
        <div className="relative w-full h-[190px] sm:h-[240px] md:h-[290px] lg:h-[330px] bg-canvas flex items-center justify-center overflow-hidden">
          <video
            key={currentVideoUrl}
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          >
            <source src={currentVideoUrl} type="video/mp4" />
          </video>

          {/* Carousel navigation dots if multiple hero videos exist */}
          {heroVideos.length > 1 && (
            <div className="absolute bottom-2.5 z-10 flex gap-1.5">
              {heroVideos.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveHeroIndex(idx)}
                  className={`h-1.5 rounded-full transition-all ${
                    activeHeroIndex === idx ? "w-5 bg-brand-orange" : "w-1.5 bg-white/40 hover:bg-white/70"
                  }`}
                  aria-label={`Slide ${idx + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="container-app pt-3 pb-12 space-y-3">
        {/* Type row */}
        <FilterRow>
          <Pill active={!search.type} onClick={() => setType(undefined)}>
            All
          </Pill>
          {tax.types.map((t) => (
            <Pill key={t.id} active={search.type === t.slug} onClick={() => setType(t.slug)}>
              {t.name}
            </Pill>
          ))}
        </FilterRow>

        {/* Category row */}
        {activeType && (
          <FilterRow tone="muted">
            <Pill active={!search.category} onClick={() => setCategory(undefined)}>
              All
            </Pill>
            {categoriesForType.map((c) => (
              <Pill
                key={c.id}
                active={search.category === c.slug}
                onClick={() => setCategory(c.slug)}
              >
                {c.name}
              </Pill>
            ))}
          </FilterRow>
        )}

        {/* Subcategory row */}
        {activeCategory && subcategoriesForCat.length > 0 && (
          <FilterRow tone="muted">
            <Pill active={!search.subcategory} onClick={() => setSub(undefined)}>
              All Sizes
            </Pill>
            {subcategoriesForCat.map((s) => (
              <Pill
                key={s.id}
                active={search.subcategory === s.slug}
                onClick={() => setSub(s.slug)}
              >
                {s.name}
              </Pill>
            ))}
          </FilterRow>
        )}

        {/* FIX 1B: Preserved for SEO & Screen Readers, visually hidden without gap */}
        <div className="sr-only">
          <h2>
            {activeSub
              ? `${activeCategory?.name} · ${activeSub.name}`
              : activeCategory
                ? activeCategory.name
                : activeType
                  ? activeType.name
                  : "Curated Showroom Feed"}
          </h2>
          <p>Discover the catalogue</p>
          {totalCount > 0 && <span>Showing {allProducts.length} of {totalCount} products</span>}
        </div>

        {/* Product Grid */}
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {feedQuery.isLoading
            ? Array.from({ length: 8 }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))
            : allProducts.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>

        {/* Empty state */}
        {!feedQuery.isLoading && allProducts.length === 0 && (
          <div className="mt-10 rounded-xl border border-dashed border-border p-10 text-center bg-card/40">
            <p className="text-sm text-muted-foreground">
              No products match these filters yet.
            </p>
            <Link
              to="/"
              search={{}}
              className="mt-3 inline-block text-xs font-semibold text-primary hover:underline"
            >
              Reset filters
            </Link>
          </div>
        )}

        {/* Infinite Scroll / Load More Trigger */}
        {hasNextPage && (
          <div ref={loadMoreRef} className="pt-8 text-center space-y-3">
            <button
              onClick={() => void feedQuery.fetchNextPage()}
              disabled={isFetchingNextPage}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-2.5 text-xs font-semibold uppercase tracking-wider text-foreground hover:border-primary hover:text-primary transition shadow-xs disabled:opacity-50"
            >
              {isFetchingNextPage ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  Loading more products…
                </>
              ) : (
                <>
                  Load More Products ({totalCount - allProducts.length} remaining)
                  <ChevronDown className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function FilterRow({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "muted";
}) {
  return (
    <div
      className={`-mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-none ${
        tone === "muted" ? "opacity-95" : ""
      }`}
    >
      {children}
    </div>
  );
}

function Pill({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium uppercase tracking-wider transition ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:border-primary hover:text-primary"
      }`}
    >
      {children}
    </button>
  );
}
