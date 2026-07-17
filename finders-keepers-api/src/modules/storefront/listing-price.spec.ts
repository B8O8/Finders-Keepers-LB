import { DiscountType } from '@prisma/client';

import { PricingService } from '../discounts/pricing.service';
import { PricingDiscount } from '../discounts/pricing.types';
import { compareByListingPrice, representativeListingPrice } from './listing-price';

/**
 * Price-sorting behaviour, driven through the REAL PricingService rather than
 * hard-coded prices - the point of these tests is that sorting reflects the
 * discounted selling price, not the stored base price.
 */
const NOW = new Date('2026-07-15T12:00:00.000Z');
const YESTERDAY = new Date('2026-07-14T12:00:00.000Z');
const TOMORROW = new Date('2026-07-16T12:00:00.000Z');

function discount(over: Partial<PricingDiscount> = {}): PricingDiscount {
  return {
    id: 'd1',
    type: DiscountType.PERCENTAGE,
    value: 50,
    publicLabel: null,
    priority: 0,
    stackable: false,
    isActive: true,
    startsAt: YESTERDAY,
    endsAt: TOMORROW,
    minOrderAmount: null,
    maxDiscountAmount: null,
    targets: { productIds: [], variantIds: [], categoryIds: [] },
    ...over,
  };
}

/** Builds a listing-shaped product by pricing its variants for real. */
function build(
  pricing: PricingService,
  id: string,
  productId: string,
  categoryIds: string[],
  variants: { id: string; price: number; purchasable?: boolean }[],
  discounts: PricingDiscount[],
) {
  return {
    id,
    variants: variants.map((v) => ({
      pricing: pricing.price(
        { variantId: v.id, productId, categoryIds, price: v.price },
        discounts,
        { now: NOW },
      ),
      purchasable: v.purchasable ?? true,
    })),
  };
}

describe('listing price + sorting', () => {
  let pricing: PricingService;
  beforeEach(() => { pricing = new PricingService(); });

  describe('representative price', () => {
    it('uses the lowest purchasable variant price', () => {
      const p = build(pricing, 'p', 'p', ['c'], [
        { id: 'v1', price: 100 },
        { id: 'v2', price: 40 },
        { id: 'v3', price: 70 },
      ], []);
      expect(representativeListingPrice(p.variants)).toBe(40);
    });

    it('ignores a cheaper variant nobody can buy', () => {
      // The 10.00 variant is out of stock and not backorderable.
      const p = build(pricing, 'p', 'p', ['c'], [
        { id: 'v1', price: 10, purchasable: false },
        { id: 'v2', price: 60 },
      ], []);
      expect(representativeListingPrice(p.variants)).toBe(60);
    });

    it('falls back to the lowest price when nothing is purchasable', () => {
      const p = build(pricing, 'p', 'p', ['c'], [
        { id: 'v1', price: 30, purchasable: false },
        { id: 'v2', price: 80, purchasable: false },
      ], []);
      expect(representativeListingPrice(p.variants)).toBe(30);
    });

    it('returns 0 for a product with no variants', () => {
      expect(representativeListingPrice([])).toBe(0);
    });
  });

  describe('sorting reflects the DISCOUNTED price, not the base price', () => {
    it('product-level discount reorders the list', () => {
      const d = discount({ targets: { productIds: ['pB'], variantIds: [], categoryIds: [] } });
      // B is dearer at base (100 vs 80) but 50% off -> 50, so it must sort first.
      const A = build(pricing, 'A', 'pA', ['c1'], [{ id: 'a1', price: 80 }], [d]);
      const B = build(pricing, 'B', 'pB', ['c1'], [{ id: 'b1', price: 100 }], [d]);

      const sorted = [A, B].sort((x, y) => compareByListingPrice(x, y, 'price_asc'));
      expect(sorted.map((p) => p.id)).toEqual(['B', 'A']);
      expect(representativeListingPrice(B.variants)).toBe(50);
    });

    it('variant-level discount is respected', () => {
      const d = discount({ value: 90, targets: { productIds: [], variantIds: ['b2'], categoryIds: [] } });
      const A = build(pricing, 'A', 'pA', ['c1'], [{ id: 'a1', price: 20 }], [d]);
      const B = build(pricing, 'B', 'pB', ['c1'], [
        { id: 'b1', price: 100 },
        { id: 'b2', price: 100 },
      ], [d]);

      // Only b2 is discounted -> 10, which becomes B's representative price.
      expect(representativeListingPrice(B.variants)).toBe(10);
      expect([A, B].sort((x, y) => compareByListingPrice(x, y, 'price_asc')).map((p) => p.id))
        .toEqual(['B', 'A']);
    });

    it('category-level discount is respected', () => {
      const d = discount({ targets: { productIds: [], variantIds: [], categoryIds: ['sale'] } });
      const A = build(pricing, 'A', 'pA', ['sale'], [{ id: 'a1', price: 100 }], [d]);
      const B = build(pricing, 'B', 'pB', ['other'], [{ id: 'b1', price: 60 }], [d]);

      expect(representativeListingPrice(A.variants)).toBe(50);
      expect([B, A].sort((x, y) => compareByListingPrice(x, y, 'price_asc')).map((p) => p.id))
        .toEqual(['A', 'B']);
    });

    it('stacked discounts compound into the sort key', () => {
      const d1 = discount({ id: 'd1', value: 50, priority: 10, stackable: true, targets: { productIds: ['pA'], variantIds: [], categoryIds: [] } });
      const d2 = discount({ id: 'd2', value: 50, priority: 5, stackable: true, targets: { productIds: ['pA'], variantIds: [], categoryIds: [] } });
      const A = build(pricing, 'A', 'pA', ['c'], [{ id: 'a1', price: 100 }], [d1, d2]);

      // 100 -> 50 -> 25
      expect(representativeListingPrice(A.variants)).toBe(25);
    });

    it('undiscounted products sort by their base price', () => {
      const A = build(pricing, 'A', 'pA', ['c'], [{ id: 'a1', price: 30 }], []);
      const B = build(pricing, 'B', 'pB', ['c'], [{ id: 'b1', price: 10 }], []);
      const C = build(pricing, 'C', 'pC', ['c'], [{ id: 'c1', price: 20 }], []);

      expect([A, B, C].sort((x, y) => compareByListingPrice(x, y, 'price_asc')).map((p) => p.id))
        .toEqual(['B', 'C', 'A']);
    });

    it('price_desc is the exact reverse', () => {
      const A = build(pricing, 'A', 'pA', ['c'], [{ id: 'a1', price: 30 }], []);
      const B = build(pricing, 'B', 'pB', ['c'], [{ id: 'b1', price: 10 }], []);

      expect([A, B].sort((x, y) => compareByListingPrice(x, y, 'price_desc')).map((p) => p.id))
        .toEqual(['A', 'B']);
    });

    it('expired discounts do not affect sorting', () => {
      const expired = discount({ endsAt: YESTERDAY, targets: { productIds: ['pA'], variantIds: [], categoryIds: [] } });
      const A = build(pricing, 'A', 'pA', ['c'], [{ id: 'a1', price: 100 }], [expired]);
      expect(representativeListingPrice(A.variants)).toBe(100);
    });

    it('is deterministic for equal prices (stable paging)', () => {
      const A = build(pricing, 'aaa', 'pA', ['c'], [{ id: 'a1', price: 50 }], []);
      const B = build(pricing, 'bbb', 'pB', ['c'], [{ id: 'b1', price: 50 }], []);

      expect([A, B].sort((x, y) => compareByListingPrice(x, y, 'price_asc')).map((p) => p.id))
        .toEqual([B, A].sort((x, y) => compareByListingPrice(x, y, 'price_asc')).map((p) => p.id));
    });
  });
});
