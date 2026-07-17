import type { Category, Product } from "@/types/product";

type CategorySource = Pick<
  Product,
  "category" | "primaryCategory" | "productCategories" | "categories"
>;

/**
 * Every category a product belongs to: de-duplicated and deterministically
 * ordered.
 *
 * Three sources are merged because the API surface spans one release of
 * transition:
 *   - `categories`        flattened multi-category list (current)
 *   - `productCategories` raw join rows (when the caller included them)
 *   - `category`          legacy single link, still returned for one release
 *
 * Merging rather than picking one source means this keeps working whichever
 * endpoint the caller used, including a cached payload served from before the
 * multi-category deploy.
 *
 * Ordering is by name, then id as a tiebreak — never insertion order. Two
 * requests for the same product must render its categories identically, or
 * breadcrumbs would shuffle between navigations.
 */
export function getProductCategories(product?: CategorySource | null): Category[] {
  if (!product) return [];

  const merged = [
    ...(product.categories ?? []),
    ...(product.productCategories ?? []).map((link) => link.category),
    ...(product.category ? [product.category] : []),
  ].filter((category): category is Category => Boolean(category?.id));

  const unique = new Map<string, Category>();
  for (const category of merged) {
    if (!unique.has(category.id)) unique.set(category.id, category);
  }

  return [...unique.values()].sort(
    (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
  );
}

/**
 * Flattens the nested tree from /storefront/categories/tree into one list,
 * depth-first with parents before their children.
 *
 * The tree endpoint only returns top-level categories at the root, so any
 * lookup that ignores `children` silently fails for subcategories. The `seen`
 * guard is cheap insurance against a malformed payload cycling forever rather
 * than an expected case.
 */
export function flattenCategories(categories?: Category[] | null): Category[] {
  const out: Category[] = [];
  const seen = new Set<string>();

  const walk = (nodes?: Category[] | null) => {
    for (const node of nodes ?? []) {
      if (!node?.id || seen.has(node.id)) continue;
      seen.add(node.id);
      out.push(node);
      walk(node.children);
    }
  };

  walk(categories);
  return out;
}

/**
 * Last-resort display title derived from a slug.
 *
 * Only for when the real category record isn't available (still loading, or the
 * slug matches nothing). De-slugging mangles anything with punctuation or
 * unusual casing — "mens-watches" becomes "Mens Watches", never "Men's
 * Watches" — so the API's `name` is always preferred.
 */
export function categoryTitleFromSlug(slug: string): string {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Finds a category anywhere in the tree by slug, not just at the top level. */
export function findCategoryBySlug(
  categories: Category[] | null | undefined,
  slug: string,
): Category | null {
  if (!slug) return null;
  return flattenCategories(categories).find((c) => c.slug === slug) ?? null;
}

/**
 * The single category used for the breadcrumb trail, the eyebrow label and the
 * related-products query.
 *
 * Resolution order, deliberately deterministic:
 *   1. `primaryCategory` — the admin's explicit choice
 *   2. the first linked category by the stable ordering above
 *   3. the legacy single `category`
 *   4. null
 *
 * A product linked to several categories with no primary set must still land on
 * the same breadcrumb every time, so step 2 never picks arbitrarily.
 */
export function getPrimaryCategory(
  product?: CategorySource | null,
): Category | null {
  if (!product) return null;
  if (product.primaryCategory?.id) return product.primaryCategory;

  const all = getProductCategories(product);
  return all[0] ?? product.category ?? null;
}
