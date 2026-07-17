/**
 * Which price represents a product in listings and price sorting.
 *
 * RULE: the lowest FINAL (post-discount) price among variants the shopper could
 * actually buy - i.e. active, and either in stock or backorder-enabled.
 *
 * Why the lowest purchasable variant:
 *  - it matches the "from X" price the card shows, so sorting agrees with the
 *    number the shopper is looking at;
 *  - it uses the final price, so a discounted product sorts by what it actually
 *    costs, not by its pre-discount base price;
 *  - purchasable-only means an out-of-stock, non-backorderable variant cannot
 *    drag a product to the top of "price: low to high" with a price nobody can
 *    pay.
 *
 * Fallback: if NO variant is purchasable, the lowest active variant price is
 * used, so an entirely out-of-stock product still sorts sensibly (it stays
 * visible by design) instead of collapsing to zero.
 */
export interface ListingVariant {
  pricing: { finalPrice: number };
  purchasable: boolean;
}

export function representativeListingPrice(variants: ListingVariant[]): number {
  if (!variants.length) return 0;

  const purchasable = variants.filter((v) => v.purchasable);
  const pool = purchasable.length ? purchasable : variants;

  return Math.min(...pool.map((v) => v.pricing.finalPrice));
}

/** Deterministic comparator: price, then id, so paging never reshuffles. */
export function compareByListingPrice<T extends { id: string; variants: ListingVariant[] }>(
  a: T,
  b: T,
  direction: 'price_asc' | 'price_desc',
): number {
  const pa = representativeListingPrice(a.variants);
  const pb = representativeListingPrice(b.variants);

  if (pa !== pb) return direction === 'price_asc' ? pa - pb : pb - pa;

  return a.id.localeCompare(b.id);
}
