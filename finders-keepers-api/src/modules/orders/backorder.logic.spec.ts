/**
 * Inventory rules for backordering.
 *
 * Imports the real helpers used by CartService and OrdersService, so these
 * tests exercise the production code path rather than a copy of it.
 */
import { isPurchasable, restockQuantity, splitQuantity } from './backorder.util';

describe('backorder inventory rules', () => {
  describe('purchasability', () => {
    it('allows an in-stock item', () => {
      expect(isPurchasable(10, 2, false)).toBe(true);
    });

    it('blocks an out-of-stock item when backorder is disabled', () => {
      expect(isPurchasable(0, 1, false)).toBe(false);
    });

    it('allows an out-of-stock item when backorder is enabled', () => {
      expect(isPurchasable(0, 3, true)).toBe(true);
    });

    it('blocks a partially-stocked item when backorder is disabled', () => {
      expect(isPurchasable(2, 5, false)).toBe(false);
    });

    it('allows a partially-stocked item when backorder is enabled', () => {
      expect(isPurchasable(2, 5, true)).toBe(true);
    });
  });

  describe('checkout stock split', () => {
    it('deducts everything when fully in stock', () => {
      expect(splitQuantity(10, 3)).toEqual({
        deductable: 3,
        backorderQuantity: 0,
        isBackorder: false,
      });
    });

    it('deducts nothing and backorders all when stock is zero', () => {
      expect(splitQuantity(0, 4)).toEqual({
        deductable: 0,
        backorderQuantity: 4,
        isBackorder: true,
      });
    });

    it('splits a partially-stocked line', () => {
      expect(splitQuantity(2, 5)).toEqual({
        deductable: 2,
        backorderQuantity: 3,
        isBackorder: true,
      });
    });

    it('never produces negative stock', () => {
      const { deductable } = splitQuantity(2, 5);
      expect(2 - deductable).toBe(0);
      expect(2 - deductable).toBeGreaterThanOrEqual(0);
    });

    it('treats already-negative stock defensively as zero', () => {
      expect(splitQuantity(-3, 2)).toEqual({
        deductable: 0,
        backorderQuantity: 2,
        isBackorder: true,
      });
    });
  });

  describe('cancellation restock', () => {
    it('returns the full quantity for a normal order', () => {
      expect(restockQuantity(3, 0)).toBe(3);
    });

    it('returns nothing for a fully backordered line', () => {
      expect(restockQuantity(4, 4)).toBe(0);
    });

    it('returns only the deducted part of a split line', () => {
      expect(restockQuantity(5, 3)).toBe(2);
    });

    it('is symmetric with checkout: cancelling restores the original stock', () => {
      const startingStock = 2;
      const quantity = 5;

      const { deductable, backorderQuantity } = splitQuantity(startingStock, quantity);
      const afterCheckout = startingStock - deductable;
      const afterCancel = afterCheckout + restockQuantity(quantity, backorderQuantity);

      expect(afterCancel).toBe(startingStock);
    });
  });
});
