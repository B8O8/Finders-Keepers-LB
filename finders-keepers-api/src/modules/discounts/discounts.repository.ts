import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { PricingDiscount } from './pricing.types';

/** Discount rows joined with their targets, as PricingService expects them. */
const withTargets = {
  targets: true,
} satisfies Prisma.DiscountInclude;

type DiscountWithTargets = Prisma.DiscountGetPayload<{ include: typeof withTargets }>;

/**
 * Loads discounts and maps them into the plain shape the pricing engine needs.
 *
 * Kept separate from DiscountsService so that cart, orders, storefront and the
 * notification processor can all pull pricing data without importing admin CRUD.
 */
@Injectable()
export class DiscountsRepository {
  constructor(private readonly prisma: PrismaService) {}

  static toPricingDiscount(d: DiscountWithTargets): PricingDiscount {
    return {
      id: d.id,
      type: d.type,
      value: Number(d.value),
      publicLabel: d.publicLabel,
      priority: d.priority,
      stackable: d.stackable,
      isActive: d.isActive,
      startsAt: d.startsAt,
      endsAt: d.endsAt,
      minOrderAmount: d.minOrderAmount === null ? null : Number(d.minOrderAmount),
      maxDiscountAmount:
        d.maxDiscountAmount === null ? null : Number(d.maxDiscountAmount),
      targets: {
        productIds: d.targets
          .filter((t) => t.productId !== null)
          .map((t) => t.productId as string),
        variantIds: d.targets
          .filter((t) => t.variantId !== null)
          .map((t) => t.variantId as string),
        categoryIds: d.targets
          .filter((t) => t.categoryId !== null)
          .map((t) => t.categoryId as string),
      },
    };
  }

  /**
   * Every discount that could currently price something.
   *
   * Archived discounts are excluded at the database level so an archived promo
   * can never affect a price. Expiry/'not started yet' is still re-checked by
   * PricingService against its own `now`, keeping the engine authoritative.
   */
  async findActiveForPricing(now: Date = new Date()): Promise<PricingDiscount[]> {
    const rows = await this.prisma.discount.findMany({
      where: {
        archivedAt: null,
        isActive: true,
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      },
      include: withTargets,
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });

    return rows.map((r) => DiscountsRepository.toPricingDiscount(r));
  }

  async findOneForPricing(id: string): Promise<PricingDiscount | null> {
    const row = await this.prisma.discount.findFirst({
      where: { id, archivedAt: null },
      include: withTargets,
    });

    return row ? DiscountsRepository.toPricingDiscount(row) : null;
  }
}
