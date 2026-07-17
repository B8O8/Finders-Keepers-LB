import { DiscountType } from '@prisma/client';

import { PricingService } from './pricing.service';
import { PricingDiscount, PricingItem } from './pricing.types';

const NOW = new Date('2026-07-15T12:00:00.000Z');
const YESTERDAY = new Date('2026-07-14T12:00:00.000Z');
const TOMORROW = new Date('2026-07-16T12:00:00.000Z');
const LAST_WEEK = new Date('2026-07-08T12:00:00.000Z');

function makeDiscount(over: Partial<PricingDiscount> = {}): PricingDiscount {
  return {
    id: 'd1',
    type: DiscountType.PERCENTAGE,
    value: 10,
    publicLabel: 'Sale',
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

function makeItem(over: Partial<PricingItem> = {}): PricingItem {
  return {
    variantId: 'v1',
    productId: 'p1',
    categoryIds: ['c1'],
    price: 100,
    ...over,
  };
}

describe('PricingService', () => {
  let service: PricingService;

  beforeEach(() => {
    service = new PricingService();
  });

  describe('percentage discounts', () => {
    it('applies a percentage discount', () => {
      const d = makeDiscount({ value: 25, targets: { productIds: ['p1'], variantIds: [], categoryIds: [] } });
      const r = service.price(makeItem(), [d], { now: NOW });

      expect(r.regularPrice).toBe(100);
      expect(r.finalPrice).toBe(75);
      expect(r.discountAmount).toBe(25);
      expect(r.discountPercent).toBe(25);
      expect(r.onSale).toBe(true);
    });

    it('rounds to 2dp without float drift', () => {
      const d = makeDiscount({ value: 15, targets: { productIds: ['p1'], variantIds: [], categoryIds: [] } });
      const r = service.price(makeItem({ price: 19.99 }), [d], { now: NOW });

      expect(r.discountAmount).toBe(3);      // 2.9985 -> 3.00
      expect(r.finalPrice).toBe(16.99);
    });
  });

  describe('fixed discounts', () => {
    it('applies a fixed discount', () => {
      const d = makeDiscount({
        type: DiscountType.FIXED,
        value: 30,
        targets: { productIds: ['p1'], variantIds: [], categoryIds: [] },
      });
      const r = service.price(makeItem(), [d], { now: NOW });

      expect(r.finalPrice).toBe(70);
      expect(r.discountAmount).toBe(30);
    });

    it('never drives the price below zero', () => {
      const d = makeDiscount({
        type: DiscountType.FIXED,
        value: 500,
        targets: { productIds: ['p1'], variantIds: [], categoryIds: [] },
      });
      const r = service.price(makeItem({ price: 20 }), [d], { now: NOW });

      expect(r.finalPrice).toBe(0);
      expect(r.discountAmount).toBe(20);
      expect(r.finalPrice).toBeGreaterThanOrEqual(0);
    });
  });

  describe('expiry and activation', () => {
    it('ignores an expired discount', () => {
      const d = makeDiscount({
        endsAt: YESTERDAY,
        targets: { productIds: ['p1'], variantIds: [], categoryIds: [] },
      });
      const r = service.price(makeItem(), [d], { now: NOW });

      expect(r.finalPrice).toBe(100);
      expect(r.onSale).toBe(false);
    });

    it('ignores a not-yet-started discount', () => {
      const d = makeDiscount({
        startsAt: TOMORROW,
        targets: { productIds: ['p1'], variantIds: [], categoryIds: [] },
      });
      expect(service.price(makeItem(), [d], { now: NOW }).finalPrice).toBe(100);
    });

    it('ignores an inactive discount', () => {
      const d = makeDiscount({
        isActive: false,
        targets: { productIds: ['p1'], variantIds: [], categoryIds: [] },
      });
      expect(service.price(makeItem(), [d], { now: NOW }).finalPrice).toBe(100);
    });

    it('treats a null endsAt as open-ended', () => {
      const d = makeDiscount({
        endsAt: null,
        startsAt: LAST_WEEK,
        targets: { productIds: ['p1'], variantIds: [], categoryIds: [] },
      });
      expect(service.price(makeItem(), [d], { now: NOW }).onSale).toBe(true);
    });
  });

  describe('targeting', () => {
    it('matches a variant-level discount', () => {
      const d = makeDiscount({ targets: { productIds: [], variantIds: ['v1'], categoryIds: [] } });
      expect(service.price(makeItem(), [d], { now: NOW }).onSale).toBe(true);
    });

    it('matches a product-level discount', () => {
      const d = makeDiscount({ targets: { productIds: ['p1'], variantIds: [], categoryIds: [] } });
      expect(service.price(makeItem(), [d], { now: NOW }).onSale).toBe(true);
    });

    it('matches a category-level discount', () => {
      const d = makeDiscount({ targets: { productIds: [], variantIds: [], categoryIds: ['c1'] } });
      expect(service.price(makeItem(), [d], { now: NOW }).onSale).toBe(true);
    });

    it('matches a product belonging to ANY of its categories (multi-category)', () => {
      const d = makeDiscount({ targets: { productIds: [], variantIds: [], categoryIds: ['c9'] } });
      const item = makeItem({ categoryIds: ['c1', 'c5', 'c9'] });
      expect(service.price(item, [d], { now: NOW }).onSale).toBe(true);
    });

    it('does not apply to an untargeted item', () => {
      const d = makeDiscount({ targets: { productIds: ['other'], variantIds: [], categoryIds: ['other'] } });
      expect(service.price(makeItem(), [d], { now: NOW }).finalPrice).toBe(100);
    });

    it('applies only to the targeted variant, not its siblings', () => {
      const d = makeDiscount({ targets: { productIds: [], variantIds: ['v1'], categoryIds: [] } });
      expect(service.price(makeItem({ variantId: 'v2' }), [d], { now: NOW }).onSale).toBe(false);
    });
  });

  describe('overlapping discounts', () => {
    it('applies the highest-priority discount and ignores lower ones', () => {
      const low = makeDiscount({ id: 'low', value: 50, priority: 1, targets: { productIds: ['p1'], variantIds: [], categoryIds: [] } });
      const high = makeDiscount({ id: 'high', value: 10, priority: 99, targets: { productIds: ['p1'], variantIds: [], categoryIds: [] } });

      const r = service.price(makeItem(), [low, high], { now: NOW });

      // Priority wins even though it is the *worse* deal - deterministic by design.
      expect(r.finalPrice).toBe(90);
      expect(r.discountId).toBe('high');
      expect(r.appliedDiscounts).toHaveLength(1);
    });

    it('is deterministic regardless of input order', () => {
      const a = makeDiscount({ id: 'a', value: 10, priority: 5, targets: { productIds: ['p1'], variantIds: [], categoryIds: [] } });
      const b = makeDiscount({ id: 'b', value: 20, priority: 5, targets: { productIds: ['p1'], variantIds: [], categoryIds: [] } });

      const r1 = service.price(makeItem(), [a, b], { now: NOW });
      const r2 = service.price(makeItem(), [b, a], { now: NOW });

      expect(r1.discountId).toBe(r2.discountId);
      expect(r1.finalPrice).toBe(r2.finalPrice);
    });

    it('a non-stackable winner stands alone', () => {
      const winner = makeDiscount({ id: 'w', value: 10, priority: 10, stackable: false, targets: { productIds: ['p1'], variantIds: [], categoryIds: [] } });
      const other = makeDiscount({ id: 'o', value: 10, priority: 1, stackable: true, targets: { productIds: ['p1'], variantIds: [], categoryIds: [] } });

      const r = service.price(makeItem(), [winner, other], { now: NOW });

      expect(r.appliedDiscounts).toHaveLength(1);
      expect(r.finalPrice).toBe(90);
    });

    it('stacks sequentially when the winner is stackable', () => {
      const first = makeDiscount({ id: 'f', value: 10, priority: 10, stackable: true, targets: { productIds: ['p1'], variantIds: [], categoryIds: [] } });
      const second = makeDiscount({ id: 's', value: 10, priority: 5, stackable: true, targets: { productIds: ['p1'], variantIds: [], categoryIds: [] } });

      const r = service.price(makeItem(), [first, second], { now: NOW });

      // 100 -> 90 -> 81 (second applies to the running price, not the original)
      expect(r.appliedDiscounts).toHaveLength(2);
      expect(r.finalPrice).toBe(81);
    });

    it('skips a non-stackable follower when the winner is stackable', () => {
      const first = makeDiscount({ id: 'f', value: 10, priority: 10, stackable: true, targets: { productIds: ['p1'], variantIds: [], categoryIds: [] } });
      const solo = makeDiscount({ id: 's', value: 50, priority: 5, stackable: false, targets: { productIds: ['p1'], variantIds: [], categoryIds: [] } });

      const r = service.price(makeItem(), [first, solo], { now: NOW });

      expect(r.appliedDiscounts).toHaveLength(1);
      expect(r.finalPrice).toBe(90);
    });

    it('stacked fixed discounts still cannot go below zero', () => {
      const a = makeDiscount({ id: 'a', type: DiscountType.FIXED, value: 8, priority: 2, stackable: true, targets: { productIds: ['p1'], variantIds: [], categoryIds: [] } });
      const b = makeDiscount({ id: 'b', type: DiscountType.FIXED, value: 8, priority: 1, stackable: true, targets: { productIds: ['p1'], variantIds: [], categoryIds: [] } });

      const r = service.price(makeItem({ price: 10 }), [a, b], { now: NOW });

      expect(r.finalPrice).toBe(0);
      expect(r.discountAmount).toBe(10);
    });
  });

  describe('caps and conditions', () => {
    it('caps the discount at maxDiscountAmount', () => {
      const d = makeDiscount({ value: 50, maxDiscountAmount: 15, targets: { productIds: ['p1'], variantIds: [], categoryIds: [] } });
      const r = service.price(makeItem(), [d], { now: NOW });

      expect(r.discountAmount).toBe(15);
      expect(r.finalPrice).toBe(85);
    });

    it('does not advertise a minOrderAmount discount without cart context', () => {
      const d = makeDiscount({ minOrderAmount: 50, targets: { productIds: ['p1'], variantIds: [], categoryIds: [] } });
      expect(service.price(makeItem(), [d], { now: NOW }).onSale).toBe(false);
    });

    it('applies a minOrderAmount discount once the subtotal qualifies', () => {
      const d = makeDiscount({ minOrderAmount: 50, targets: { productIds: ['p1'], variantIds: [], categoryIds: [] } });
      const r = service.price(makeItem(), [d], { now: NOW, orderSubtotal: 120 });
      expect(r.onSale).toBe(true);
    });

    it('withholds a minOrderAmount discount when the subtotal is too low', () => {
      const d = makeDiscount({ minOrderAmount: 500, targets: { productIds: ['p1'], variantIds: [], categoryIds: [] } });
      const r = service.price(makeItem(), [d], { now: NOW, orderSubtotal: 120 });
      expect(r.onSale).toBe(false);
    });
  });

  describe('expiry reporting', () => {
    it('reports the soonest expiry among applied discounts', () => {
      const d = makeDiscount({ endsAt: TOMORROW, targets: { productIds: ['p1'], variantIds: [], categoryIds: [] } });
      const r = service.price(makeItem(), [d], { now: NOW });
      expect(r.expiresAt).toEqual(TOMORROW);
    });

    it('reports null expiry for open-ended discounts', () => {
      const d = makeDiscount({ endsAt: null, targets: { productIds: ['p1'], variantIds: [], categoryIds: [] } });
      expect(service.price(makeItem(), [d], { now: NOW }).expiresAt).toBeNull();
    });
  });

  describe('no discounts', () => {
    it('returns the regular price unchanged (regression guard)', () => {
      const r = service.price(makeItem({ price: 42.5 }), [], { now: NOW });

      expect(r.regularPrice).toBe(42.5);
      expect(r.finalPrice).toBe(42.5);
      expect(r.discountAmount).toBe(0);
      expect(r.discountPercent).toBe(0);
      expect(r.onSale).toBe(false);
      expect(r.discountId).toBeNull();
    });
  });
});
