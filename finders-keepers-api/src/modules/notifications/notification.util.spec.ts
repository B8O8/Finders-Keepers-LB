import { NotificationChannel } from '@prisma/client';

import {
  backoffMs,
  buildDedupeKey,
  canRetry,
  CLAIM_TIMEOUT_MS,
  MAX_NOTIFICATION_ATTEMPTS,
  nextAttemptAt,
} from './notification.util';

describe('notification idempotency', () => {
  const base = {
    customerId: 'c1',
    discountId: 'd1',
    productId: 'p1',
    channel: NotificationChannel.EMAIL,
  };

  describe('buildDedupeKey', () => {
    it('is stable for identical input', () => {
      expect(buildDedupeKey({ ...base, variantId: 'v1' })).toBe(
        buildDedupeKey({ ...base, variantId: 'v1' }),
      );
    });

    it('collapses null and undefined variant to the same key', () => {
      // Both mean "any variant"; they must not produce two emails.
      expect(buildDedupeKey({ ...base, variantId: null })).toBe(
        buildDedupeKey({ ...base, variantId: undefined }),
      );
    });

    it('uses ANY for a product-level entry', () => {
      expect(buildDedupeKey({ ...base, variantId: null })).toBe(
        'c1:d1:p1:ANY:EMAIL',
      );
    });

    it('distinguishes different variants of the same product', () => {
      expect(buildDedupeKey({ ...base, variantId: 'v1' })).not.toBe(
        buildDedupeKey({ ...base, variantId: 'v2' }),
      );
    });

    it('distinguishes different customers', () => {
      expect(buildDedupeKey({ ...base, customerId: 'c1', variantId: 'v1' })).not.toBe(
        buildDedupeKey({ ...base, customerId: 'c2', variantId: 'v1' }),
      );
    });

    it('distinguishes different discounts, so a NEW sale can notify again', () => {
      expect(buildDedupeKey({ ...base, discountId: 'd1', variantId: 'v1' })).not.toBe(
        buildDedupeKey({ ...base, discountId: 'd2', variantId: 'v1' }),
      );
    });

    it('distinguishes channels', () => {
      expect(
        buildDedupeKey({ ...base, variantId: 'v1', channel: NotificationChannel.EMAIL }),
      ).not.toBe(
        buildDedupeKey({ ...base, variantId: 'v1', channel: NotificationChannel.IN_APP }),
      );
    });

    it('a product-level key differs from a variant-level key', () => {
      expect(buildDedupeKey({ ...base, variantId: null })).not.toBe(
        buildDedupeKey({ ...base, variantId: 'v1' }),
      );
    });
  });

  describe('retry policy', () => {
    it('allows retries below the limit', () => {
      expect(canRetry(0)).toBe(true);
      expect(canRetry(MAX_NOTIFICATION_ATTEMPTS - 1)).toBe(true);
    });

    it('stops at the limit', () => {
      expect(canRetry(MAX_NOTIFICATION_ATTEMPTS)).toBe(false);
      expect(canRetry(MAX_NOTIFICATION_ATTEMPTS + 1)).toBe(false);
    });
  });

  describe('bounded exponential backoff', () => {
    it('grows with each attempt', () => {
      expect(backoffMs(2)).toBeGreaterThan(backoffMs(1));
      expect(backoffMs(3)).toBeGreaterThan(backoffMs(2));
    });

    it('starts at one minute', () => {
      expect(backoffMs(1)).toBe(60_000);
    });

    it('is bounded at one hour, however many attempts', () => {
      expect(backoffMs(100)).toBe(3_600_000);
      expect(backoffMs(10_000)).toBe(3_600_000);
    });

    it('never returns a negative or zero delay', () => {
      expect(backoffMs(0)).toBeGreaterThan(0);
    });

    it('nextAttemptAt is always in the future', () => {
      const from = new Date('2026-07-15T12:00:00.000Z');
      expect(nextAttemptAt(1, from).getTime()).toBeGreaterThan(from.getTime());
    });

    it('nextAttemptAt applies the backoff delay exactly', () => {
      const from = new Date('2026-07-15T12:00:00.000Z');
      expect(nextAttemptAt(2, from).getTime() - from.getTime()).toBe(backoffMs(2));
    });
  });

  describe('claim timeout', () => {
    it('is long enough to outlast a slow batch but short enough to recover', () => {
      expect(CLAIM_TIMEOUT_MS).toBeGreaterThanOrEqual(60_000);
      expect(CLAIM_TIMEOUT_MS).toBeLessThanOrEqual(15 * 60_000);
    });
  });
});
