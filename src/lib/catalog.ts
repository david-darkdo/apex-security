import { supabase } from "@/integrations/supabase/client";

export type ProductRow = {
  id: string;
  slug: string;
  name: string;
  code: string;
  price: number;
  brand: string | null;
  image_url: string | null;
  generated_studio_image: string | null;
  generated_installed_image: string | null;
  short_description: string | null;
  family_id: string | null;
  type_id: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  installation_images?: string[] | null;
  color: string | null;
  material: string | null;
  finish: string | null;
  app_keywords: string[] | null;
  featured_feed?: boolean | null;
  featured_homepage?: boolean | null;
  created_at?: string | null;
  distribution_rank?: number;
};

export type TaxonomyNode = { id: string; name: string; slug: string };

const PRODUCT_FIELDS =
  "id,slug,name,code,price,brand,image_url,generated_studio_image,generated_installed_image,installation_images,short_description,family_id,type_id,category_id,subcategory_id,color,material,finish,app_keywords,featured_feed,featured_homepage,created_at";

/** Customer-facing visibility: published, not hidden, not soft-deleted. */
export function applyPublicFilters<T extends { eq: Function; is: Function }>(q: T): T {
  return (q as any)
    .eq("status", "published")
    .eq("hidden", false)
    .is("deleted_at", null);
}

export async function fetchTaxonomy() {
  const [types, categories, subcategories] = await Promise.all([
    supabase.from("product_types").select("id,name,slug").order("name"),
    supabase.from("categories").select("id,name,slug,type_id").order("name"),
    supabase.from("subcategories").select("id,name,slug,category_id").order("name"),
  ]);
  if (types.error) throw types.error;
  if (categories.error) throw categories.error;
  if (subcategories.error) throw subcategories.error;
  return {
    types: types.data ?? [],
    categories: categories.data ?? [],
    subcategories: subcategories.data ?? [],
  };
}

export type FeedFilters = {
  type?: string;
  category?: string;
  subcategory?: string;
  family?: string;
  brand?: string;
  material?: string;
  finish?: string;
  color?: string;
  q?: string;
};

export type CursorParam = {
  rank?: number;
  id?: string;
  created_at?: string;
};

export type PaginatedFeedResult = {
  items: ProductRow[];
  nextCursor: CursorParam | null;
  hasMore: boolean;
  totalCount: number;
};

/**
 * CANONICAL DISCOVERY SEARCH RPC CONSUMER
 * Executes server-side 17-tier deterministic search ranking and filtering via search_products RPC.
 */
export async function searchProductsWithDiscovery(
  filters: FeedFilters,
  limit: number = 24,
  offset: number = 0
): Promise<{ items: ProductRow[]; totalCount: number }> {
  const { data: ranked, error: rpcError } = await supabase.rpc("search_products" as any, {
    _q: filters.q || null,
    _type: filters.type || null,
    _category: filters.category || null,
    _subcategory: filters.subcategory || null,
    _family: filters.family || null,
    _brand: filters.brand || null,
    _material: filters.material || null,
    _finish: filters.finish || null,
    _color: filters.color || null,
    _limit: limit,
    _offset: offset,
  } as any);

  if (rpcError) throw rpcError;
  if (!ranked || !Array.isArray(ranked) || ranked.length === 0) {
    return { items: [], totalCount: 0 };
  }

  const ids = ranked.map((r: any) => r.product_id);
  const totalCount = Number(ranked[0]?.total_count || ranked.length);

  const { data: products, error: pError } = await applyPublicFilters(
    supabase.from("products").select(PRODUCT_FIELDS)
  ).in("id", ids);

  if (pError) throw pError;

  const idOrder = new Map(ids.map((id: string, idx: number) => [id, idx]));
  const sorted = ((products || []) as ProductRow[]).sort(
    (a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0)
  );

  return { items: sorted, totalCount };
}

/**
 * PRODUCTION FEED & DISCOVERY CURSOR PAGINATION
 * Seamlessly integrates Discovery Engine for search queries and Intelligent Distribution for browsing.
 */
export async function fetchFeedProductsPaginated(
  filters: FeedFilters,
  cursor: CursorParam | null = null,
  limit: number = 24
): Promise<PaginatedFeedResult> {
  // 1. Discovery Search Query Path
  if (filters.q && filters.q.trim()) {
    const offset = cursor?.rank ?? 0;
    const { items: rawItems, totalCount } = await searchProductsWithDiscovery(
      filters,
      limit + 1,
      offset
    );

    const items = rawItems.slice(0, limit);
    const hasMore = rawItems.length > limit;
    const nextCursor = hasMore ? { rank: offset + limit } : null;

    return { items, nextCursor, hasMore, totalCount };
  }

  // 2. Intelligent Distribution & Browsing Path (Non-search Feed)
  let query = applyPublicFilters(
    supabase.from("products").select(PRODUCT_FIELDS)
  ).order("created_at", { ascending: false });

  if (filters.type) {
    const { data } = await supabase
      .from("product_types")
      .select("id")
      .eq("slug", filters.type)
      .maybeSingle();
    if (data?.id) query = query.eq("type_id", data.id);
  }
  if (filters.category) {
    const { data } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", filters.category)
      .maybeSingle();
    if (data?.id) query = query.eq("category_id", data.id);
  }
  if (filters.subcategory) {
    const { data } = await supabase
      .from("subcategories")
      .select("id")
      .eq("slug", filters.subcategory)
      .maybeSingle();
    if (data?.id) query = query.eq("subcategory_id", data.id);
  }

  const { data: rawProducts, error } = await query;
  if (error) throw error;
  if (!rawProducts || rawProducts.length === 0) {
    return { items: [], nextCursor: null, hasMore: false, totalCount: 0 };
  }

  // Assign Partition Rank for Intelligent Distribution
  const partitionCounts = new Map<string, number>();
  const ranked = (rawProducts as any[]).map((p) => {
    const partitionKey = filters.category
      ? (p.subcategory_id || p.category_id || "default")
      : (p.category_id || p.type_id || "default");
    const currentRank = (partitionCounts.get(partitionKey) || 0) + 1;
    partitionCounts.set(partitionKey, currentRank);
    return {
      ...p,
      distribution_rank: currentRank,
    } as ProductRow;
  });

  // Sort by (distribution_rank ASC, featured_feed DESC, created_at DESC, id ASC)
  ranked.sort((a, b) => {
    const rA = a.distribution_rank ?? 0;
    const rB = b.distribution_rank ?? 0;
    if (rA !== rB) return rA - rB;
    if (a.featured_feed !== b.featured_feed) return a.featured_feed ? -1 : 1;
    const cA = a.created_at || "";
    const cB = b.created_at || "";
    if (cA !== cB) return cB > cA ? 1 : -1;
    return a.id.localeCompare(b.id);
  });

  // Apply Cursor Filter
  let cursorFiltered = ranked;
  if (cursor?.rank) {
    const targetRank = cursor.rank;
    const targetId = cursor.id;
    cursorFiltered = ranked.filter((item) => {
      const itemRank = item.distribution_rank ?? 0;
      if (itemRank > targetRank) return true;
      if (itemRank === targetRank && targetId && item.id > targetId) return true;
      return false;
    });
  }

  const items = cursorFiltered.slice(0, limit);
  const hasMore = cursorFiltered.length > limit;
  const lastItem = items[items.length - 1];

  const nextCursor = (hasMore && lastItem)
    ? {
        rank: lastItem.distribution_rank,
        id: lastItem.id,
        created_at: lastItem.created_at || undefined,
      }
    : null;

  return {
    items,
    nextCursor,
    hasMore,
    totalCount: ranked.length,
  };
}

export async function fetchFeedProducts(filters: FeedFilters): Promise<ProductRow[]> {
  const result = await fetchFeedProductsPaginated(filters, null, 1000);
  return result.items;
}

export async function fetchHomepageFeatured(): Promise<ProductRow[]> {
  const { data, error } = await applyPublicFilters(
    supabase.from("products").select(PRODUCT_FIELDS),
  )
    .eq("featured_homepage", true)
    .order("created_at", { ascending: false })
    .limit(12);
  if (error) throw error;
  return (data ?? []) as ProductRow[];
}

export async function fetchProductBySlug(slug: string) {
  const { data, error } = await applyPublicFilters(
    supabase.from("products").select("*"),
  )
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchRelatedProducts(
  familyId: string | null,
  excludeId: string,
  similarIds?: string[] | null,
) {
  if (similarIds && similarIds.length) {
    const { data, error } = await applyPublicFilters(
      supabase.from("products").select(PRODUCT_FIELDS),
    )
      .in("id", similarIds)
      .neq("id", excludeId)
      .limit(8);
    if (error) throw error;
    if ((data ?? []).length) return data as ProductRow[];
  }
  if (!familyId) return [];
  const { data, error } = await applyPublicFilters(
    supabase.from("products").select(PRODUCT_FIELDS),
  )
    .eq("family_id", familyId)
    .neq("id", excludeId)
    .limit(8);
  if (error) throw error;
  return (data ?? []) as ProductRow[];
}

/**
 * FETCH DYNAMIC DISCOVERY FACETS
 */
export async function fetchSearchFacets(filters: FeedFilters) {
  const { data, error } = await supabase.rpc("get_search_facets" as any, {
    _q: filters.q || null,
    _type: filters.type || null,
    _category: filters.category || null,
    _subcategory: filters.subcategory || null,
    _family: filters.family || null,
    _brand: filters.brand || null,
    _material: filters.material || null,
    _finish: filters.finish || null,
    _color: filters.color || null,
  } as any);
  if (error) throw error;
  return (data || {
    types: [],
    categories: [],
    subcategories: [],
    brands: [],
    materials: [],
    finishes: [],
    colors: [],
  }) as {
    types: { name: string; slug: string; count: number }[];
    categories: { name: string; slug: string; count: number }[];
    subcategories: { name: string; slug: string; count: number }[];
    brands: { name: string; count: number }[];
    materials: { name: string; count: number }[];
    finishes: { name: string; count: number }[];
    colors: { name: string; count: number }[];
  };
}

/**
 * FETCH REAL-TIME SEARCH SUGGESTIONS
 */
export async function fetchSearchSuggestions(prefix: string, limit: number = 8) {
  if (!prefix || prefix.trim().length < 2) return [];
  const { data, error } = await supabase.rpc("get_search_suggestions" as any, {
    _prefix: prefix.trim(),
    _limit: limit,
  } as any);
  if (error) throw error;
  return (data || []) as { suggestion: string; suggestion_type: string; target_slug: string }[];
}

/**
 * ASYNCHRONOUS SEARCH ANALYTICS LOGGER
 */
export async function logSearchAnalytics(
  query: string,
  resultCount: number,
  sessionId?: string,
  selectedProductId?: string
) {
  if (!query || !query.trim()) return;
  try {
    await supabase.rpc("log_search_query" as any, {
      _query: query.trim(),
      _result_count: resultCount,
      _session_id: sessionId || null,
      _selected_product_id: selectedProductId || null,
    } as any);
  } catch {}
}
