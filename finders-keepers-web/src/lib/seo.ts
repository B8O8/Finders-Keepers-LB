import type { Category, Product } from "@/types/product";

/**
 * Server-side data access for metadata and the sitemap.
 *
 * Deliberately plain `fetch` rather than the shared axios client: that client
 * carries a request interceptor that reads localStorage, which is meaningless
 * on the server, and axios bypasses Next's fetch cache.
 *
 * Every function here returns null/[] instead of throwing. Metadata and
 * sitemaps are decorative relative to the page itself — an API blip must
 * degrade the <title>, never 500 the route or fail a build.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export const SITE_NAME = process.env.NEXT_PUBLIC_STORE_NAME || "Finders Keepers";

/** Public origin of the storefront, used to build absolute canonical URLs. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://finderskeeperslb.com"
).replace(/\/$/, "");

async function fetchJson<T>(
  path: string,
  revalidateSeconds: number,
): Promise<T | null> {
  if (!API_URL) return null;

  try {
    const response = await fetch(`${API_URL}${path}`, {
      next: { revalidate: revalidateSeconds },
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export function getCategoryTree(): Promise<Category[] | null> {
  return fetchJson<Category[]>("/storefront/categories/tree", 300);
}

export function getProductForSeo(slug: string): Promise<Product | null> {
  return fetchJson<Product>(
    `/storefront/products/${encodeURIComponent(slug)}`,
    300,
  );
}

/**
 * Products for the sitemap. Paginates rather than trusting a single large
 * response, and stops at a hard ceiling so a catalogue that grows unexpectedly
 * can't hang the sitemap route.
 */
export async function getAllProductsForSitemap(): Promise<
  { slug: string; updatedAt?: string }[]
> {
  const PAGE_SIZE = 100;
  const MAX_PAGES = 50;
  const out: { slug: string; updatedAt?: string }[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const result = await fetchJson<{
      data: { slug: string; updatedAt?: string }[];
      meta: { totalPages: number };
    }>(`/storefront/products?page=${page}&limit=${PAGE_SIZE}`, 3600);

    if (!result?.data?.length) break;
    out.push(...result.data.map((p) => ({ slug: p.slug, updatedAt: p.updatedAt })));
    if (page >= (result.meta?.totalPages ?? 1)) break;
  }

  return out;
}
