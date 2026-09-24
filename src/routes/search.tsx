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
import { Search as SearchIcon, X, SlidersHorizontal, Sparkles } from "lucide-react";
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

function SearchPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();

  const [inputVal, setInputVal] = useState(search.q);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<{ suggestion: string; suggestion_type: string; target_slug: string }[]>([]);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Sync input value with URL query
  useEffect(() => {
    setInputVal(search.q);
  }, [search.q]);

  // Fetch search results
  const resultsQuery = useQuery(
    queryOptions({
      queryKey: ["discovery_search", search],
      queryFn: async () => {
        const res = await searchProductsWithDiscovery(search, 48, 0);
        if (search.q.trim().length > 0) {
          void logSearchAnalytics(search.q, res.totalCount);
        }
        return res;
      },
      enabled: Boolean(search.q?.trim() || search.type || search.category || search.subcategory || search.brand || search.material || search.finish || search.color),
    })
  );

  // Fetch dynamic facets
  const facetsQuery = useQuery(
    queryOptions({
      queryKey: ["discovery_facets", search],
      queryFn: () => fetchSearchFacets(search),
      enabled: Boolean(search.q?.trim() || search.type || search.category || search.subcategory || search.brand || search.material || search.finish || search.color),
    })
  );

  // Live Autocomplete Suggestions
  useEffect(() => {
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

  const handleFilterToggle = (key: keyof SearchParams, value?: string) => {
    const nextSearch = { ...search };
    if (nextSearch[key] === value || !value) {
      delete nextSearch[key];
    } else {
      nextSearch[key] = value;
    }
    navigate({ to: "/search", search: nextSearch });
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

  return (
    <AppShell>
      <div className="container-app pt-4 pb-12">
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
              onChange={(e) => setInputVal(e.target.value)}
              onFocus={() => {
                if (suggestions.length > 0) setShowSuggestions(true);
              }}
              autoFocus
              placeholder='Try "cctv", "smart lock", "exterior door", "steel", "biometric"…'
              className="w-full rounded-full border border-border bg-card py-3 pl-11 pr-10 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
            />
            {inputVal && (
              <button
                type="button"
                onClick={() => {
                  setInputVal("");
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
                    onClick={() => {
                      setInputVal(s.suggestion);
                      setShowSuggestions(false);
                      navigate({
                        to: "/search",
                        search: { ...search, q: s.suggestion },
                      });
                    }}
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

        {/* Dynamic Facet Filters Bar */}
        {facets && (
          <div className="mt-4 space-y-2">
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

            {/* Category / Type Chips */}
            <div className="flex flex-wrap gap-1.5">
              {facets.categories.map((c) => {
                const isActive = search.category === c.slug;
                return (
                  <button
                    key={c.slug}
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

              {facets.subcategories.map((sc) => {
                const isActive = search.subcategory === sc.slug;
                return (
                  <button
                    key={sc.slug}
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
            </div>
          </div>
        )}

        {/* Search Results Grid */}
        <div className="mt-6">
          {!search.q.trim() && activeFiltersCount === 0 ? (
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
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
