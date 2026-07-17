import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  NotificationChannel,
  NotificationStatus,
  NotificationType,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { DiscountsRepository } from '../discounts/discounts.repository';
import { PricingService } from '../discounts/pricing.service';
import { WishlistService } from '../wishlist/wishlist.service';
import { GetNotificationsDto } from './dto/get-notifications.dto';
import { buildDedupeKey } from './notification.util';

/** Snapshot of what a customer is told, frozen at enqueue time. */
export interface WishlistSalePayload {
  productName: string;
  variantName: string | null;
  oldPrice: number;
  newPrice: number;
  discountAmount: number;
  discountPercent: number;
  discountLabel: string | null;
  productUrl: string;
  expiresAt: string | null;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly discountsRepository: DiscountsRepository,
    private readonly wishlist: WishlistService,
  ) {}

  private get storefrontUrl() {
    return (process.env.FRONTEND_URL || '').replace(/\/+$/, '');
  }

  /**
   * Queues "your wishlisted item is on sale" notifications for one discount.
   *
   * Called when a discount becomes live. Only writes rows - it never sends -
   * so a mail outage can never roll back or block a discount. Delivery is done
   * later by processPending().
   *
   * Idempotent: createMany + skipDuplicates against the dedupeKey unique index
   * means running this repeatedly (re-activation, retries, overlapping cron
   * ticks) can never produce a second email for the same discount and item.
   */
  async enqueueForDiscount(discountId: string): Promise<{ queued: number; skipped: number }> {
    const discount = await this.discountsRepository.findOneForPricing(discountId);

    if (!discount) {
      throw new NotFoundException('Discount not found');
    }

    // Which variants does this discount actually reduce?
    const variants = await this.prisma.productVariant.findMany({
      where: {
        isActive: true,
        product: { isActive: true },
        OR: [
          { id: { in: discount.targets.variantIds } },
          { productId: { in: discount.targets.productIds } },
          {
            product: {
              productCategories: {
                some: { categoryId: { in: discount.targets.categoryIds } },
              },
            },
          },
        ],
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            productCategories: { select: { categoryId: true } },
          },
        },
      },
    });

    // Price through the central engine, at the discount's own start time so a
    // scheduled promo can be queued before it goes live.
    const priced = new Map<string, ReturnType<PricingService['price']>>();

    for (const v of variants) {
      const result = this.pricing.price(
        {
          variantId: v.id,
          productId: v.productId,
          categoryIds: v.product.productCategories.map((pc) => pc.categoryId),
          price: Number(v.price),
        },
        [discount],
        { now: discount.startsAt, orderSubtotal: Number.MAX_SAFE_INTEGER },
      );

      // "On sale" means the active price is genuinely lower than before.
      if (result.onSale) priced.set(v.id, result);
    }

    if (priced.size === 0) {
      return { queued: 0, skipped: 0 };
    }

    const affectedVariantIds = Array.from(priced.keys());
    const affectedProductIds = Array.from(
      new Set(variants.filter((v) => priced.has(v.id)).map((v) => v.productId)),
    );

    const watchers = await this.wishlist.findWatchers({
      productIds: affectedProductIds,
      variantIds: affectedVariantIds,
    });

    const variantById = new Map(variants.map((v) => [v.id, v]));

    const rows: Prisma.NotificationCreateManyInput[] = [];

    for (const watcher of watchers) {
      // A product-level wishlist entry is represented by whichever of its
      // variants is on sale (the cheapest wins, that's the best news).
      const candidates = watcher.variantId
        ? [watcher.variantId]
        : affectedVariantIds.filter(
            (id) => variantById.get(id)?.productId === watcher.productId,
          );

      const best = candidates
        .map((id) => ({ id, p: priced.get(id) }))
        .filter((c) => c.p)
        .sort((a, b) => a.p!.finalPrice - b.p!.finalPrice)[0];

      if (!best?.p) continue;

      const variant = variantById.get(best.id);
      if (!variant) continue;

      const payload: WishlistSalePayload = {
        productName: watcher.product.name,
        variantName: variant.name,
        oldPrice: best.p.regularPrice,
        newPrice: best.p.finalPrice,
        discountAmount: best.p.discountAmount,
        discountPercent: best.p.discountPercent,
        discountLabel: best.p.discountLabel,
        productUrl: `${this.storefrontUrl}/products/${watcher.product.slug}`,
        expiresAt: best.p.expiresAt ? best.p.expiresAt.toISOString() : null,
      };

      rows.push({
        customerId: watcher.customerId,
        channel: NotificationChannel.EMAIL,
        type: NotificationType.WISHLIST_SALE,
        status: NotificationStatus.PENDING,
        discountId,
        productId: watcher.productId,
        variantId: watcher.variantId,
        payload: payload as unknown as Prisma.InputJsonValue,
        dedupeKey: buildDedupeKey({
          customerId: watcher.customerId,
          discountId,
          productId: watcher.productId,
          variantId: watcher.variantId,
          channel: NotificationChannel.EMAIL,
        }),
      });
    }

    if (!rows.length) {
      return { queued: 0, skipped: 0 };
    }

    // skipDuplicates is the idempotency guarantee.
    const result = await this.prisma.notification.createMany({
      data: rows,
      skipDuplicates: true,
    });

    this.logger.log(
      `Discount ${discountId}: queued ${result.count} notification(s), ` +
        `${rows.length - result.count} already existed`,
    );

    return { queued: result.count, skipped: rows.length - result.count };
  }

  // ---------------------------------------------------------------------------
  // Admin visibility
  // ---------------------------------------------------------------------------

  async findAll(query: GetNotificationsDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.NotificationWhereInput = {};

    if (query.status) where.status = query.status;
    if (query.discountId) where.discountId = query.discountId;
    if (query.search) {
      where.customer = {
        email: { contains: query.search, mode: 'insensitive' },
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        include: {
          customer: { select: { id: true, email: true, firstName: true, lastName: true } },
          discount: { select: { id: true, name: true, publicLabel: true } },
          product: { select: { id: true, name: true, slug: true } },
          variant: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /** Counts for the admin dashboard cards. */
  async stats(discountId?: string) {
    const where: Prisma.NotificationWhereInput = discountId ? { discountId } : {};

    const [pending, sent, failed, customersNotified] = await Promise.all([
      this.prisma.notification.count({ where: { ...where, status: NotificationStatus.PENDING } }),
      this.prisma.notification.count({ where: { ...where, status: NotificationStatus.SENT } }),
      this.prisma.notification.count({ where: { ...where, status: NotificationStatus.FAILED } }),
      this.prisma.notification
        .findMany({
          where: { ...where, status: NotificationStatus.SENT },
          distinct: ['customerId'],
          select: { customerId: true },
        })
        .then((r) => r.length),
    ]);

    return { pending, sent, failed, customersNotified, total: pending + sent + failed };
  }

  /** Re-queue a failed notification. Resets attempts so it is picked up again. */
  async retry(id: string) {
    const notification = await this.prisma.notification.findUnique({ where: { id } });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.status === NotificationStatus.SENT) {
      return { message: 'Notification was already sent' };
    }

    await this.prisma.notification.update({
      where: { id },
      data: { status: NotificationStatus.PENDING, attempts: 0, error: null },
    });

    return { message: 'Notification queued for retry' };
  }

  async retryAllFailed(discountId?: string) {
    const result = await this.prisma.notification.updateMany({
      where: {
        status: NotificationStatus.FAILED,
        ...(discountId ? { discountId } : {}),
      },
      data: { status: NotificationStatus.PENDING, attempts: 0, error: null },
    });

    return { message: `${result.count} notification(s) queued for retry` };
  }
}
