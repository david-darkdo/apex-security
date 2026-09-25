import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { ProductCard, ProductCardSkeleton } from "@/components/ProductCard";
import { 
  searchProductsWithDiscovery, 
  fetchSearchFacets, 
  fetchSearchSuggestions, 
  logSearchAnalytics,
  FeedFilters 
} from "@/lib/catalog";
import { 
  Search as SearchIcon, 
  X, 
  SlidersHorizontal, 
  Sparkles, 
  ShieldCheck, 
  Camera, 
  Lock, 
  DoorOpen, 
  Cpu, 
  Layers, 
  Building2,
  ChevronDown,
  Loader2
} from "lucide-react";
import { useState, useEffect, useRef } from "react";

type SearchParams = {
  q: string;
  type?: string;
  category?: string;
  subcategory?: string;
  family?: string;
  brand?: string;
  material?: string;
  finish?: string;
  color?: string;
};

function validateSearch(s: Record<string, unknown>): SearchParams {
  const pick = (k: string) => {
    const v = s[k];
    return typeof v === "string" && v.length > 0 ? v : undefined;
  };
  return {
    q: typeof s.q === "string" ? s.q : "",
    type: pick("type"),
    category: pick("category"),
    subcategory: pick("subcategory"),
    family: pick("family"),
    brand: pick("brand"),
    material: pick("material"),
    finish: pick("finish"),
    color: pick("color"),
  };
}

export const Route = createFileRoute("/search")({
  validateSearch: validateSearch,
  head: () => ({
    meta: [
      { title: "Search Catalog — Apex Security Ltd" },
      { name: "description", content: "Search CCTV cameras, surveillance solutions, solar security systems, smart locks, digital access control, security doors, and architectural doors at Apex Security Ltd." },
    ],
  }),
  component: SearchPage,
});

const DISCOVERY_SHORTCUTS = [
  { label: "CCTV", icon: Camera, params: { q: "cctv" } },
  { label: "Models", icon: Layers, params: { q: "smart security" } },
  { label: "Doors", icon: DoorOpen, params: { type: "doors" } },
  { label: "Specifications", icon: ShieldCheck, params: { q: "steel" } },
  { label: "Brands", icon: Building2, params: { brand: "Apex Security Ltd" } },
  { label: "Security Locks", icon: Lock, params: { q: "smart lock" } },
  { label: "Technology", icon: Cpu, params: { q: "biometric" } },
];

const PAGE_SIZE = 24;

function SearchPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();

  const [inputVal, setInputVal] = useState(search.q);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<{ suggestion: string; suggestion_type: string; target_slug: string }[]>([]);
  const [displayLimit, setDisplayLimit] = useState(PAGE_SIZE);
  const [showAllFacets, setShowAllFacets] = useState(false);

  // Deterministic suppression ref to prevent autocomplete popup reopening on selection
  const isSelectingRef = useRef(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Sync input value with URL query
  useEffect(() => {
    setInputVal(search.q);
    setDisplayLimit(PAGE_SIZE);
  }, [search.q]);

  // Check if any search parameter or filter is active
  const isQueryActive = Boolean(
    search.q?.trim() ||
    search.type ||
    search.category ||
    search.subcategory ||
    search.family ||
    search.brand ||
    search.material ||
    search.finish ||
    search.color
  );

  // Fetch search results with continuation support
  const resultsQuery = useQuery(
    queryOptions({
      queryKey: ["discovery_search", search, displayLimit],
      queryFn: async () => {
        const res = await searchProductsWithDiscovery(search, displayLimit, 0);
        if (search.q.trim().length > 0) {
          void logSearchAnalytics(search.q, res.totalCount);
        }
        return res;
      },
      enabled: isQueryActive,
    })
  );

  // Fetch dynamic facets
  const facetsQuery = useQuery(
    queryOptions({
      queryKey: ["discovery_facets", search],
      queryFn: () => fetchSearchFacets(search),
      enabled: isQueryActive,
    })
  );

  // Live Autocomplete Suggestions with intentional selection suppression
  useEffect(() => {
    if (isSelectingRef.current) {
      isSelectingRef.current = false;
      return;
    }
    const timer = setTimeout(async () => {
      if (inputVal.trim().length >= 2) {
        const sugs = await fetchSearchSuggestions(inputVal, 6);
        setSuggestions(sugs);
        setShowSuggestions(true);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [inputVal]);

  // Handle clicking outside suggestions dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectSuggestion = (suggestionText: string) => {
    isSelectingRef.current = true;
    setShowSuggestions(false);
    setInputVal(suggestionText);
    navigate({
      to: "/search",
      search: { ...search, q: suggestionText },
    });
  };

  const handleFilterToggle = (key: keyof SearchParams, value?: string) => {
    const nextSearch = { ...search };
    if (nextSearch[key] === value || !value) {
      delete nextSearch[key];
    } else {
      nextSearch[key] = value;
    }
    navigate({ to: "/search", search: nextSearch });
  };

  const handleShortcutClick = (params: Partial<SearchParams>) => {
    isSelectingRef.current = true;
    setShowSuggestions(false);
    if (params.q !== undefined) {
      setInputVal(params.q);
    }
    navigate({
      to: "/search",
      search: { ...params, q: params.q ?? "" },
    });
  };

  const clearAllFilters = () => {
    navigate({ to: "/search", search: { q: search.q } });
  };

  const activeFiltersCount = [
    search.type,
    search.category,
    search.subcategory,
    search.family,
    search.brand,
    search.material,
    search.finish,
    search.color,
  ].filter(Boolean).length;

  const products = resultsQuery.data?.items ?? [];
  const totalCount = resultsQuery.data?.totalCount ?? 0;
  const facets = facetsQuery.data;
  const hasMore = products.length < totalCount;

  return (
    <AppShell>
      <div className="container-app pt-4 pb-16">
        {/* Header Title */}
        <div className="space-y-1">
          <h1 className="font-display text-xs uppercase tracking-[0.18em] text-primary font-bold">
            Apex Discovery Engine
          </h1>
          <p className="font-display text-2xl font-bold tracking-tight text-foreground uppercase">
            Search Security Systems, Smart Locks & Doors
          </p>
        </div>

        {/* Search Bar with Real-Time Suggestions */}
        <div className="relative mt-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              isSelectingRef.current = true;
              setShowSuggestions(false);
              navigate({
                to: "/search",
                search: { ...search, q: inputVal.trim() },
              });
            }}
            className="relative"
          >
            <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              name="q"
              value={inputVal}
              onChange={(e) => {
                isSelectingRef.current = false;
                setInputVal(e.target.value);
              }}
              onFocus={() => {
                if (suggestions.length > 0) setShowSuggestions(true);
              }}
              placeholder='Try "cctv", "smart lock", "exterior door", "steel", "biometric"…'
              className="w-full rounded-full border border-border bg-card py-3 pl-11 pr-10 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
            />
            {inputVal && (
              <button
                type="button"
                onClick={() => {
                  isSelectingRef.current = true;
                  setInputVal("");
                  setShowSuggestions(false);
                  navigate({ to: "/search", search: { ...search, q: "" } });
                }}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                aria-label="Clear search text"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </form>

          {/* Autocomplete Suggestions Popup */}
          {showSuggestions && suggestions.length > 0 && (
            <div
              ref={suggestionsRef}
              className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl border border-border bg-card shadow-lg"
            >
              <div className="p-1.5 space-y-0.5">
                {suggestions.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectSuggestion(s.suggestion)}
                    className="flex w-full items-center justify-between rounded-lg px-3.5 py-2 text-left text-xs transition hover:bg-muted/80"
                  >
                    <span className="font-medium text-foreground flex items-center gap-2">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      {s.suggestion}
                    </span>
                    <span className="rounded bg-muted px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                      {s.suggestion_type}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Search Discovery Shortcuts (When no search or active filters) */}
        {!isQueryActive && (
          <div className="mt-6 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Start Exploring Apex Security Catalog
            </p>
            <div className="flex flex-wrap gap-2">
              {DISCOVERY_SHORTCUTS.map((sc, idx) => {
                const Icon = sc.icon;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleShortcutClick(sc.params)}
                    className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-xs font-medium text-foreground shadow-xs transition hover:border-primary/50 hover:bg-muted/50"
                  >
                    <Icon className="h-3.5 w-3.5 text-primary" />
                    <span>{sc.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Dynamic Facet Filters Bar */}
        {facets && isQueryActive && (
          <div className="mt-4 space-y-2.5">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5 font-medium">
                <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
                Refine Results {totalCount > 0 && `(${totalCount} products)`}
              </span>
              {activeFiltersCount > 0 && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="text-primary hover:underline text-[11px] font-semibold"
                >
                  Reset all filters ({activeFiltersCount})
                </button>
              )}
            </div>

            {/* Primary Taxonomy Facets (Categories & Types & Subcategories) */}
            <div className="flex flex-wrap gap-1.5">
              {facets.types?.map((t) => {
                const isActive = search.type === t.slug;
                return (
                  <button
                    key={`type-${t.slug}`}
                    type="button"
                    onClick={() => handleFilterToggle("type", t.slug)}
                    className={`rounded-full px-3 py-1 text-xs transition border font-medium flex items-center gap-1.5 ${
                      isActive
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
                    }`}
                  >
                    <span>{t.name}</span>
                    <span className="font-mono text-[10px] opacity-75">({t.count})</span>
                  </button>
                );
              })}

              {facets.categories?.map((c) => {
                const isActive = search.category === c.slug;
                return (
                  <button
                    key={`cat-${c.slug}`}
                    type="button"
                    onClick={() => handleFilterToggle("category", c.slug)}
                    className={`rounded-full px-3 py-1 text-xs transition border font-medium flex items-center gap-1.5 ${
                      isActive
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
                    }`}
                  >
                    <span>{c.name}</span>
                    <span className="font-mono text-[10px] opacity-75">({c.count})</span>
                  </button>
                );
              })}

              {facets.subcategories?.map((sc) => {
                const isActive = search.subcategory === sc.slug;
                return (
                  <button
                    key={`subcat-${sc.slug}`}
                    type="button"
                    onClick={() => handleFilterToggle("subcategory", sc.slug)}
                    className={`rounded-full px-3 py-1 text-xs transition border font-medium flex items-center gap-1.5 ${
                      isActive
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
                    }`}
                  >
                    <span>{sc.name}</span>
                    <span className="font-mono text-[10px] opacity-75">({sc.count})</span>
                  </button>
                );
              })}

              {facets.brands?.map((b) => {
                const isActive = search.brand === b.name;
                return (
                  <button
                    key={`brand-${b.name}`}
                    type="button"
                    onClick={() => handleFilterToggle("brand", b.name)}
                    className={`rounded-full px-3 py-1 text-xs transition border font-medium flex items-center gap-1.5 ${
                      isActive
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
                    }`}
                  >
                    <span>{b.name}</span>
                    <span className="font-mono text-[10px] opacity-75">({b.count})</span>
                  </button>
                );
              })}
            </div>

            {/* Extended Attribute Facets Toggle (Material, Finish, Color) */}
            {(facets.materials?.length > 0 || facets.finishes?.length > 0 || facets.colors?.length > 0) && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowAllFacets((prev) => !prev)}
                  className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                >
                  <span>{showAllFacets ? "Hide additional specifications" : "More specifications"}</span>
                  <ChevronDown className={`h-3 w-3 transition-transform ${showAllFacets ? "rotate-180" : ""}`} />
                </button>

                {showAllFacets && (
                  <div className="mt-2 flex flex-wrap gap-1.5 pt-1 border-t border-border/50">
                    {facets.materials?.map((m) => {
                      const isActive = search.material === m.name;
                      return (
                        <button
                          key={`mat-${m.name}`}
                          type="button"
                          onClick={() => handleFilterToggle("material", m.name)}
                          className={`rounded-full px-2.5 py-0.5 text-[11px] transition border font-medium ${
                            isActive
                              ? "bg-primary text-primary-foreground border-primary shadow-xs"
                              : "bg-card border-border text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {m.name} ({m.count})
                        </button>
                      );
                    })}

                    {facets.finishes?.map((f) => {
                      const isActive = search.finish === f.name;
                      return (
                        <button
                          key={`fin-${f.name}`}
                          type="button"
                          onClick={() => handleFilterToggle("finish", f.name)}
                          className={`rounded-full px-2.5 py-0.5 text-[11px] transition border font-medium ${
                            isActive
                              ? "bg-primary text-primary-foreground border-primary shadow-xs"
                              : "bg-card border-border text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {f.name} ({f.count})
                        </button>
                      );
                    })}

                    {facets.colors?.map((cl) => {
                      const isActive = search.color === cl.name;
                      return (
                        <button
                          key={`col-${cl.name}`}
                          type="button"
                          onClick={() => handleFilterToggle("color", cl.name)}
                          className={`rounded-full px-2.5 py-0.5 text-[11px] transition border font-medium ${
                            isActive
                              ? "bg-primary text-primary-foreground border-primary shadow-xs"
                              : "bg-card border-border text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {cl.name} ({cl.count})
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Search Results Grid */}
        <div className="mt-6">
          {!isQueryActive ? (
            <div className="rounded-2xl border border-dashed border-border p-12 text-center">
              <SearchIcon className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-3 text-sm font-semibold text-foreground">Start exploring Apex Security catalog</p>
              <p className="mt-1 text-xs text-muted-foreground">Type CCTV model, door specifications, brand or security lock terminology above.</p>
            </div>
          ) : resultsQuery.isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-12 text-center shadow-sm">
              <p className="font-display text-base font-bold text-foreground uppercase">No exact matches found</p>
              <p className="mt-1 text-xs text-muted-foreground">
                We couldn&apos;t find any security solutions matching &ldquo;{search.q}&rdquo;.
              </p>
              <div className="mt-4 flex justify-center gap-2">
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90 transition"
                >
                  Clear all filters
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {products.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>

              {/* Continuation / Pagination Load More */}
              {hasMore ? (
                <div className="flex flex-col items-center justify-center pt-4">
                  <button
                    type="button"
                    onClick={() => setDisplayLimit((prev) => prev + PAGE_SIZE)}
                    disabled={resultsQuery.isFetching}
                    className="flex items-center gap-2 rounded-xl bg-card border border-border px-6 py-2.5 text-xs font-bold text-foreground shadow-sm hover:border-primary/50 hover:bg-muted transition disabled:opacity-50"
                  >
                    {resultsQuery.isFetching ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <span>Loading more solutions…</span>
                      </>
                    ) : (
                      <span>Load More Security Solutions ({products.length} of {totalCount})</span>
                    )}
                  </button>
                </div>
              ) : totalCount > 0 ? (
                <div className="pt-4 text-center text-xs text-muted-foreground">
                  Showing all {totalCount} security solutions
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
