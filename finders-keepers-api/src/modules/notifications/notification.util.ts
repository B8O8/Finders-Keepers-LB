import { NotificationChannel } from '@prisma/client';

/**
 * Builds the idempotency key for a wishlist sale notification.
 *
 * A single non-null unique column is used (rather than a composite unique over
 * nullable columns) because Postgres treats every NULL as distinct, which would
 * silently allow duplicate emails for product-level wishlist rows.
 *
 * 'ANY' represents "any variant of this product".
 */
export function buildDedupeKey(params: {
  customerId: string;
  discountId: string;
  productId: string;
  variantId?: string | null;
  channel: NotificationChannel;
}): string {
  const variant = params.variantId ?? 'ANY';

  return [
    params.customerId,
    params.discountId,
    params.productId,
    variant,
    params.channel,
  ].join(':');
}

/** Retry policy. */
export const MAX_NOTIFICATION_ATTEMPTS = 3;

/** A claim older than this is treated as abandoned (worker died mid-batch). */
export const CLAIM_TIMEOUT_MS = 5 * 60 * 1000;

export function canRetry(attempts: number): boolean {
  return attempts < MAX_NOTIFICATION_ATTEMPTS;
}

/**
 * Bounded exponential backoff: 1min, 4min, 9min... capped at 1 hour.
 *
 * Quadratic rather than doubling so a transient SMTP blip retries reasonably
 * soon, while a persistently failing address backs off without hammering the
 * mail server.
 */
export function backoffMs(attempts: number): number {
  const base = 60_000;
  const delay = base * Math.pow(Math.max(1, attempts), 2);
  return Math.min(delay, 60 * 60_000);
}

export function nextAttemptAt(attempts: number, from: Date = new Date()): Date {
  return new Date(from.getTime() + backoffMs(attempts));
}
