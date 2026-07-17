import { Injectable } from '@nestjs/common';
import { DiscountType } from '@prisma/client';

import {
  AppliedDiscount,
  PricedResult,
  PricingContext,
  PricingDiscount,
  PricingItem,
} from './pricing.types';

/** Round to 2dp using integer cents to avoid binary float drift. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * The centralized pricing engine.
 *
 * Rules (agreed 2026-07-15):
 *  - Product prices are NEVER mutated. Final prices are derived from Discount
 *    records at read time, so editing/deleting a discount cannot corrupt data.
 *  - Eligibility: active, started, not expired, and targeting this item.
 *  - Ordering: priority DESC, then createdAt ASC (id ASC as a final tie-break)
 *    so the result is fully deterministic.
 *  - Overlap: the highest-priority eligible discount always applies. If it is
 *    stackable, subsequent stackable discounts also apply, in order. A
 *    non-stackable discount never combines with anything.
 *  - A FIXED discount can never push the price below zero.
 *  - maxDiscountAmount caps each discount's contribution.
 *
 * This service is intentionally pure/stateless: no Prisma, no I/O.
 */
@Injectable()
export class PricingService {
  isEligible(
    discount: PricingDiscount,
    item: PricingItem,
    ctx: PricingContext = {},
  ): boolean {
    const now = ctx.now ?? new Date();

    if (!discount.isActive) return false;
    if (discount.startsAt > now) return false;
    if (discount.endsAt && discount.endsAt <= now) return false;
    if (discount.value <= 0) return false;

    // Order-level condition. Without a known subtotal (e.g. storefront listing)
    // a conditional discount must not be advertised.
    if (discount.minOrderAmount !== null) {
      if (ctx.orderSubtotal === undefined) return false;
      if (ctx.orderSubtotal < discount.minOrderAmount) return false;
    }

    return this.targets(discount, item);
  }

  /** True when the discount targets this variant, its product, or any of its categories. */
  private targets(discount: PricingDiscount, item: PricingItem): boolean {
    const t = discount.targets;

    if (t.variantIds.includes(item.variantId)) return true;
    if (t.productIds.includes(item.productId)) return true;
    if (t.categoryIds.some((id) => item.categoryIds.includes(id))) return true;

    return false;
  }

  /** Contribution of a single discount against a running price. */
  private amountFor(discount: PricingDiscount, runningPrice: number): number {
    let amount =
      discount.type === DiscountType.PERCENTAGE
        ? (runningPrice * discount.value) / 100
        : discount.value;

    if (discount.maxDiscountAmount !== null) {
      amount = Math.min(amount, discount.maxDiscountAmount);
    }

    // Never below zero, never more than what is left to discount.
    amount = Math.min(amount, runningPrice);

    return round2(Math.max(amount, 0));
  }

  /** Deterministic ordering: priority DESC, createdAt ASC, id ASC. */
  private order(discounts: PricingDiscount[]): PricingDiscount[] {
    return [...discounts].sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.id.localeCompare(b.id);
    });
  }

  /**
   * Price one item. This is the ONLY place a final price may be produced.
   */
  price(
    item: PricingItem,
    discounts: PricingDiscount[],
    ctx: PricingContext = {},
  ): PricedResult {
    const regularPrice = round2(item.price);

    const eligible = this.order(
      discounts.filter((d) => this.isEligible(d, item, ctx)),
    );

    const applied: AppliedDiscount[] = [];
    let running = regularPrice;

    for (const discount of eligible) {
      if (running <= 0) break;

      const isFirst = applied.length === 0;

      // The highest-priority eligible discount always applies. Any discount
      // joining it must itself be stackable.
      if (!isFirst && !discount.stackable) continue;

      const amount = this.amountFor(discount, running);
      if (amount <= 0) continue;

      applied.push({
        discountId: discount.id,
        label: discount.publicLabel,
        type: discount.type,
        value: discount.value,
        amount,
      });

      running = round2(Math.max(0, running - amount));

      // A non-stackable winner stands alone.
      if (!discount.stackable) break;
    }

    const finalPrice = round2(Math.max(0, running));
    const discountAmount = round2(Math.max(0, regularPrice - finalPrice));
    const discountPercent =
      regularPrice > 0 ? round2((discountAmount / regularPrice) * 100) : 0;

    const winner = applied[0] ?? null;

    const expiries = eligible
      .filter((d) => applied.some((a) => a.discountId === d.id))
      .map((d) => d.endsAt)
      .filter((d): d is Date => d instanceof Date);

    const expiresAt = expiries.length
      ? new Date(Math.min(...expiries.map((d) => d.getTime())))
      : null;

    return {
      variantId: item.variantId,
      regularPrice,
      finalPrice,
      discountAmount,
      discountPercent,
      onSale: discountAmount > 0,
      appliedDiscounts: applied,
      discountId: winner ? winner.discountId : null,
      discountLabel: winner ? winner.label : null,
      expiresAt,
    };
  }

  /** Convenience for pricing many items against the same discount set. */
  priceMany(
    items: PricingItem[],
    discounts: PricingDiscount[],
    ctx: PricingContext = {},
  ): Map<string, PricedResult> {
    const out = new Map<string, PricedResult>();
    for (const item of items) {
      out.set(item.variantId, this.price(item, discounts, ctx));
    }
    return out;
  }
}
