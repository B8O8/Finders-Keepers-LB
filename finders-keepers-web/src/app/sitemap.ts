import type { MetadataRoute } from "next";

import { flattenCategories } from "@/lib/category";
import {
  SITE_URL,
  getAllProductsForSitemap,
  getCategoryTree,
} from "@/lib/seo";

/**
 * Generated per-request, not at build time.
 *
 * The web image is built without the API running (and on a machine that can't
 * reach it), so a statically generated sitemap would be baked empty and stay
 * empty for the life of the deploy. The underlying fetches still set their own
 * `revalidate`, so this costs at most one API round-trip per hour, and the
 * route is hit by crawlers rather than customers.
 */
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/products`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/contact`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  // Both lists degrade to empty on an API failure rather than throwing, so a
  // blip yields a smaller sitemap instead of a 500 to the crawler.
  const [categoryTree, products] = await Promise.all([
    getCategoryTree(),
    getAllProductsForSitemap(),
  ]);

  // Every category is listed, including subcategories — each is an
  // independently browsable page now that products can belong to many.
  const categoryRoutes: MetadataRoute.Sitemap = flattenCategories(
    categoryTree,
  ).map((category) => ({
    url: `${SITE_URL}/category/${category.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  // One entry per product, at its single canonical URL — never repeated under
  // each of its categories, which would be duplicate content.
  const productRoutes: MetadataRoute.Sitemap = products.map((product) => ({
    url: `${SITE_URL}/products/${product.slug}`,
    lastModified: product.updatedAt ? new Date(product.updatedAt) : now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticRoutes, ...categoryRoutes, ...productRoutes];
}
