import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useInfiniteQuery, useSuspenseQuery, queryOptions, infiniteQueryOptions } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { AppShell } from "@/components/AppShell";
import { ProductCard, ProductCardSkeleton } from "@/components/ProductCard";
import { fetchFeedProductsPaginated, fetchTaxonomy, type FeedFilters, type CursorParam } from "@/lib/catalog";
import { useAppSettings } from "@/lib/settings";
import { BrandLogo } from "@/components/BrandLogo";
import { Sparkles, ChevronDown, Loader2 } from "lucide-react";

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
  const feedQuery = useInfiniteQuery(feedInfiniteQuery(search));

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
      <div className="container-app pt-4 pb-12 space-y-4">
        {/* Apex Security Ltd Brand Intro Card */}
        <div className="rounded-2xl border border-border bg-gradient-to-r from-surface via-surface-elevated to-surface p-5 sm:p-7 text-foreground shadow-md relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="flex items-start sm:items-center gap-4">
              <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-white/5 backdrop-blur-md border border-white/15 p-2 shadow-lg shrink-0 flex items-center justify-center overflow-hidden ring-1 ring-white/10">
                <BrandLogo alt={`${companyName} Logo`} className="h-full w-full object-contain" />
              </div>
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-blue-soft border border-brand-blue/30 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-blue">
                  <Sparkles className="h-3 w-3" /> Official Showroom
                </div>
                <h1 className="font-display text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
                  {companyName}
                </h1>
                <p className="text-xs sm:text-sm text-text-secondary max-w-2xl leading-relaxed">
                  {shortDesc}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 shrink-0 pt-1 md:pt-0">
              <Link
                to="/home"
                className="rounded-lg bg-brand-orange px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-canvas hover:bg-brand-orange-hover transition shadow-sm"
              >
                About Showroom
              </Link>
              <Link
                to="/contact"
                className="rounded-lg border border-border bg-surface-elevated px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-foreground hover:bg-surface transition"
              >
                Contact & Location
              </Link>
            </div>
          </div>
        </div>

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

        <div className="mt-5 flex items-end justify-between border-b border-border pb-3">
          <div>
            <h1 className="font-display text-xs uppercase tracking-[0.18em] text-accent">
              {activeSub
                ? `${activeCategory?.name} · ${activeSub.name}`
                : activeCategory
                  ? activeCategory.name
                  : activeType
                    ? activeType.name
                    : "Curated Showroom Feed"}
            </h1>
            <p className="mt-1 font-display text-2xl font-semibold tracking-tight text-foreground">
              Discover the catalogue
            </p>
          </div>
          {totalCount > 0 && (
            <span className="text-xs font-mono text-muted-foreground">
              Showing {allProducts.length} of {totalCount} products
            </span>
          )}
        </div>

        {/* Product Grid */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
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
