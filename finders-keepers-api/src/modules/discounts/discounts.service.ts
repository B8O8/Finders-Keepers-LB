import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  DiscountTargetType,
  DiscountType,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';

import { CreateDiscountDto } from './dto/create-discount.dto';
import { GetDiscountsDto } from './dto/get-discounts.dto';
import { UpdateDiscountDto } from './dto/update-discount.dto';
import { DiscountsRepository } from './discounts.repository';
import { PricingService } from './pricing.service';

const discountInclude = {
  targets: {
    include: {
      product: { select: { id: true, name: true, slug: true } },
      variant: { select: { id: true, name: true, sku: true, productId: true } },
      category: { select: { id: true, name: true, slug: true } },
    },
  },
} satisfies Prisma.DiscountInclude;

@Injectable()
export class DiscountsService {
  private readonly logger = new Logger(DiscountsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogs: ActivityLogsService,
    private readonly pricing: PricingService,
    private readonly discountsRepository: DiscountsRepository,
  ) {}

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  /**
   * Rules that need the whole payload (class-validator can only see one field).
   */
  private validateRules(dto: {
    type?: DiscountType;
    value?: number;
    startsAt?: string;
    endsAt?: string;
    maxDiscountAmount?: number;
  }) {
    if (dto.type === DiscountType.PERCENTAGE && dto.value !== undefined) {
      if (dto.value <= 0 || dto.value > 100) {
        throw new BadRequestException(
          'A percentage discount must be greater than 0 and at most 100',
        );
      }
    }

    if (dto.type === DiscountType.FIXED && dto.value !== undefined && dto.value <= 0) {
      throw new BadRequestException('A fixed discount must be greater than 0');
    }

    if (dto.startsAt && dto.endsAt) {
      if (new Date(dto.endsAt) <= new Date(dto.startsAt)) {
        throw new BadRequestException('endsAt must be after startsAt');
      }
    }

    if (dto.maxDiscountAmount !== undefined && dto.maxDiscountAmount <= 0) {
      throw new BadRequestException(
        'maxDiscountAmount must be greater than 0 when provided',
      );
    }
  }

  /** Every targeted id must exist, so a discount can never point at nothing. */
  private async validateTargets(dto: {
    productIds?: string[];
    variantIds?: string[];
    categoryIds?: string[];
  }) {
    const { productIds = [], variantIds = [], categoryIds = [] } = dto;

    if (productIds.length) {
      const found = await this.prisma.product.count({
        where: { id: { in: productIds } },
      });
      if (found !== productIds.length) {
        throw new NotFoundException('One or more targeted products do not exist');
      }
    }

    if (variantIds.length) {
      const found = await this.prisma.productVariant.count({
        where: { id: { in: variantIds } },
      });
      if (found !== variantIds.length) {
        throw new NotFoundException('One or more targeted variants do not exist');
      }
    }

    if (categoryIds.length) {
      const found = await this.prisma.category.count({
        where: { id: { in: categoryIds } },
      });
      if (found !== categoryIds.length) {
        throw new NotFoundException('One or more targeted categories do not exist');
      }
    }
  }

  private buildTargetRows(dto: {
    productIds?: string[];
    variantIds?: string[];
    categoryIds?: string[];
  }) {
    const rows: {
      targetType: DiscountTargetType;
      targetId: string;
      productId?: string;
      variantId?: string;
      categoryId?: string;
    }[] = [];

    for (const id of dto.productIds ?? []) {
      rows.push({ targetType: DiscountTargetType.PRODUCT, targetId: id, productId: id });
    }
    for (const id of dto.variantIds ?? []) {
      rows.push({ targetType: DiscountTargetType.VARIANT, targetId: id, variantId: id });
    }
    for (const id of dto.categoryIds ?? []) {
      rows.push({ targetType: DiscountTargetType.CATEGORY, targetId: id, categoryId: id });
    }

    return rows;
  }

  private hasAnyTarget(dto: {
    productIds?: string[];
    variantIds?: string[];
    categoryIds?: string[];
  }) {
    return (
      (dto.productIds?.length ?? 0) +
        (dto.variantIds?.length ?? 0) +
        (dto.categoryIds?.length ?? 0) >
      0
    );
  }

  // ---------------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------------

  async create(dto: CreateDiscountDto, adminId?: string) {
    this.validateRules(dto);

    if (!this.hasAnyTarget(dto)) {
      throw new BadRequestException(
        'A discount must target at least one product, variant or category',
      );
    }

    await this.validateTargets(dto);

    const discount = await this.prisma.discount.create({
      data: {
        name: dto.name,
        description: dto.description,
        publicLabel: dto.publicLabel,
        type: dto.type,
        value: dto.value,
        startsAt: new Date(dto.startsAt),
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        isActive: dto.isActive ?? true,
        minOrderAmount: dto.minOrderAmount,
        maxDiscountAmount: dto.maxDiscountAmount,
        priority: dto.priority ?? 0,
        stackable: dto.stackable ?? false,
        createdByAdminId: adminId,
        targets: { create: this.buildTargetRows(dto) },
      },
      include: discountInclude,
    });

    await this.activityLogs.create({
      adminId,
      action: 'DISCOUNT_CREATED',
      entity: 'Discount',
      entityId: discount.id,
      metadata: { name: discount.name, type: discount.type, value: dto.value },
    });

    return discount;
  }

  async findAll(query: GetDiscountsDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;
    const now = new Date();

    const where: Prisma.DiscountWhereInput = {};

    if (query.includeArchived !== 'true') {
      where.archivedAt = null;
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { publicLabel: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    switch (query.status) {
      case 'active':
        where.isActive = true;
        where.startsAt = { lte: now };
        where.AND = [{ OR: [{ endsAt: null }, { endsAt: { gt: now } }] }];
        break;
      case 'scheduled':
        where.isActive = true;
        where.startsAt = { gt: now };
        break;
      case 'expired':
        where.endsAt = { lte: now };
        break;
      case 'inactive':
        where.isActive = false;
        break;
    }

    if (query.startsFrom || query.startsTo) {
      where.startsAt = {
        ...(typeof where.startsAt === 'object' && where.startsAt !== null
          ? where.startsAt
          : {}),
        ...(query.startsFrom ? { gte: new Date(query.startsFrom) } : {}),
        ...(query.startsTo ? { lte: new Date(query.startsTo) } : {}),
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.discount.findMany({
        where,
        include: discountInclude,
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.discount.count({ where }),
    ]);

    return {
      data: data.map((d) => ({ ...d, status: this.statusOf(d, now) })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  private statusOf(
    d: { isActive: boolean; startsAt: Date; endsAt: Date | null; archivedAt: Date | null },
    now: Date,
  ) {
    if (d.archivedAt) return 'archived';
    if (!d.isActive) return 'inactive';
    if (d.startsAt > now) return 'scheduled';
    if (d.endsAt && d.endsAt <= now) return 'expired';
    return 'active';
  }

  async findOne(id: string) {
    const discount = await this.prisma.discount.findUnique({
      where: { id },
      include: discountInclude,
    });

    if (!discount) {
      throw new NotFoundException('Discount not found');
    }

    return { ...discount, status: this.statusOf(discount, new Date()) };
  }

  async update(id: string, dto: UpdateDiscountDto, adminId?: string) {
    const existing = await this.prisma.discount.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException('Discount not found');
    }

    // Merge with the stored row so cross-field rules are checked against the
    // resulting state, not just the fields that happen to be in this request.
    this.validateRules({
      type: dto.type ?? existing.type,
      value: dto.value ?? Number(existing.value),
      startsAt: dto.startsAt ?? existing.startsAt.toISOString(),
      endsAt:
        dto.endsAt ?? (existing.endsAt ? existing.endsAt.toISOString() : undefined),
      maxDiscountAmount: dto.maxDiscountAmount,
    });

    const replacingTargets =
      dto.productIds !== undefined ||
      dto.variantIds !== undefined ||
      dto.categoryIds !== undefined;

    if (replacingTargets) {
      await this.validateTargets(dto);

      if (!this.hasAnyTarget(dto)) {
        throw new BadRequestException(
          'A discount must target at least one product, variant or category',
        );
      }
    }

    const discount = await this.prisma.$transaction(async (tx) => {
      if (replacingTargets) {
        await tx.discountTarget.deleteMany({ where: { discountId: id } });
      }

      return tx.discount.update({
        where: { id },
        data: {
          name: dto.name,
          description: dto.description,
          publicLabel: dto.publicLabel,
          type: dto.type,
          value: dto.value,
          startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
          endsAt: dto.endsAt === undefined ? undefined : dto.endsAt ? new Date(dto.endsAt) : null,
          isActive: dto.isActive,
          minOrderAmount: dto.minOrderAmount,
          maxDiscountAmount: dto.maxDiscountAmount,
          priority: dto.priority,
          stackable: dto.stackable,
          ...(replacingTargets
            ? { targets: { create: this.buildTargetRows(dto) } }
            : {}),
        },
        include: discountInclude,
      });
    });

    await this.activityLogs.create({
      adminId,
      action: 'DISCOUNT_UPDATED',
      entity: 'Discount',
      entityId: id,
      metadata: { name: discount.name, targetsReplaced: replacingTargets },
    });

    return discount;
  }

  /** Activate / deactivate without touching anything else. */
  async setActive(id: string, isActive: boolean, adminId?: string) {
    const existing = await this.prisma.discount.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException('Discount not found');
    }

    if (existing.archivedAt) {
      throw new BadRequestException('An archived discount cannot be activated');
    }

    const discount = await this.prisma.discount.update({
      where: { id },
      data: {
        isActive,
        // Re-activating re-opens notification queueing. Customers still cannot
        // be emailed twice for the same discount: the Notification dedupeKey
        // unique index makes the enqueue idempotent.
        ...(isActive ? { notificationsEnqueuedAt: null } : {}),
      },
      include: discountInclude,
    });

    await this.activityLogs.create({
      adminId,
      action: isActive ? 'DISCOUNT_ACTIVATED' : 'DISCOUNT_DEACTIVATED',
      entity: 'Discount',
      entityId: id,
      metadata: { name: discount.name },
    });

    return discount;
  }

  /**
   * Archive (soft delete).
   *
   * Preferred over a hard delete: notifications reference the discount and
   * order snapshots quote its label, so the row is kept for auditability.
   * An archived discount is excluded from pricing at the query level.
   */
  async archive(id: string, adminId?: string) {
    const existing = await this.prisma.discount.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException('Discount not found');
    }

    if (existing.archivedAt) {
      return { message: 'Discount is already archived' };
    }

    await this.prisma.discount.update({
      where: { id },
      data: { archivedAt: new Date(), isActive: false },
    });

    await this.activityLogs.create({
      adminId,
      action: 'DISCOUNT_ARCHIVED',
      entity: 'Discount',
      entityId: id,
      metadata: { name: existing.name },
    });

    return { message: 'Discount archived successfully' };
  }

  async restore(id: string, adminId?: string) {
    const existing = await this.prisma.discount.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException('Discount not found');
    }

    await this.prisma.discount.update({
      where: { id },
      data: { archivedAt: null },
    });

    await this.activityLogs.create({
      adminId,
      action: 'DISCOUNT_RESTORED',
      entity: 'Discount',
      entityId: id,
    });

    return { message: 'Discount restored successfully' };
  }

  // ---------------------------------------------------------------------------
  // Admin preview
  // ---------------------------------------------------------------------------

  /**
   * Shows exactly which variants a discount hits and what they would cost,
   * computed through the same PricingService the storefront uses - so the
   * preview can never disagree with the shop.
   */
  async preview(id: string, limit = 50) {
    const discount = await this.prisma.discount.findUnique({
      where: { id },
      include: { targets: true },
    });

    if (!discount) {
      throw new NotFoundException('Discount not found');
    }

    const productIds = discount.targets
      .filter((t) => t.productId)
      .map((t) => t.productId as string);
    const variantIds = discount.targets
      .filter((t) => t.variantId)
      .map((t) => t.variantId as string);
    const categoryIds = discount.targets
      .filter((t) => t.categoryId)
      .map((t) => t.categoryId as string);

    const variants = await this.prisma.productVariant.findMany({
      where: {
        OR: [
          { id: { in: variantIds } },
          { productId: { in: productIds } },
          {
            product: {
              productCategories: { some: { categoryId: { in: categoryIds } } },
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
      take: limit,
    });

    const pricingDiscount = DiscountsRepository.toPricingDiscount(
      discount as never,
    );

    const items = variants.map((v) => {
      const priced = this.pricing.price(
        {
          variantId: v.id,
          productId: v.productId,
          categoryIds: v.product.productCategories.map((pc) => pc.categoryId),
          price: Number(v.price),
        },
        [pricingDiscount],
        // Preview ignores the schedule so admins can see the effect of a
        // discount that has not started yet.
        { now: discount.startsAt, orderSubtotal: Number.MAX_SAFE_INTEGER },
      );

      return {
        variantId: v.id,
        variantName: v.name,
        sku: v.sku,
        productId: v.product.id,
        productName: v.product.name,
        productSlug: v.product.slug,
        regularPrice: priced.regularPrice,
        finalPrice: priced.finalPrice,
        discountAmount: priced.discountAmount,
        discountPercent: priced.discountPercent,
      };
    });

    const affected = items.filter((i) => i.discountAmount > 0);

    // How many wishlist rows would be notified if this discount activated now.
    const wishlistCount = await this.prisma.wishlistItem.count({
      where: {
        OR: [
          { variantId: { in: affected.map((a) => a.variantId) } },
          { productId: { in: affected.map((a) => a.productId) } },
        ],
      },
    });

    return {
      discountId: discount.id,
      totalAffectedVariants: affected.length,
      truncated: variants.length === limit,
      estimatedWishlistNotifications: wishlistCount,
      items: affected,
    };
  }

  /** Used by the storefront/cart/orders to price against live discounts. */
  loadActiveForPricing(now?: Date) {
    return this.discountsRepository.findActiveForPricing(now);
  }
}
