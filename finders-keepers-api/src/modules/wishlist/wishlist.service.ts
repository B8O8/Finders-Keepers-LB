import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { DiscountsRepository } from '../discounts/discounts.repository';
import { PricingService } from '../discounts/pricing.service';
import { AddWishlistItemDto } from './dto/add-wishlist-item.dto';
import { MergeWishlistDto } from './dto/merge-wishlist.dto';

/**
 * Server-side wishlist.
 *
 * Previously the storefront kept this in localStorage only, which meant nobody
 * could ever be told their saved item went on sale. Persisting it per customer
 * is what makes sale notifications possible.
 *
 * variantKey mirrors variantId ('' = "any variant") because a unique index over
 * a nullable column would not dedupe in Postgres.
 */
@Injectable()
export class WishlistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly discountsRepository: DiscountsRepository,
  ) {}

  private keyOf(variantId?: string | null) {
    return variantId ?? '';
  }

  private async assertTargetExists(dto: AddWishlistItemDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      select: { id: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (dto.variantId) {
      const variant = await this.prisma.productVariant.findFirst({
        where: { id: dto.variantId, productId: dto.productId },
        select: { id: true },
      });

      if (!variant) {
        throw new BadRequestException(
          'Variant does not belong to the given product',
        );
      }
    }
  }

  async add(customerId: string, dto: AddWishlistItemDto) {
    await this.assertTargetExists(dto);

    const variantKey = this.keyOf(dto.variantId);

    // Idempotent: adding twice is a no-op rather than an error.
    await this.prisma.wishlistItem.upsert({
      where: {
        customerId_productId_variantKey: {
          customerId,
          productId: dto.productId,
          variantKey,
        },
      },
      create: {
        customerId,
        productId: dto.productId,
        variantId: dto.variantId ?? null,
        variantKey,
      },
      update: {},
    });

    return this.findAll(customerId);
  }

  async remove(customerId: string, productId: string, variantId?: string) {
    const variantKey = this.keyOf(variantId);

    await this.prisma.wishlistItem.deleteMany({
      where: { customerId, productId, variantKey },
    });

    return this.findAll(customerId);
  }

  async removeById(customerId: string, id: string) {
    const item = await this.prisma.wishlistItem.findFirst({
      where: { id, customerId },
    });

    if (!item) {
      throw new NotFoundException('Wishlist item not found');
    }

    await this.prisma.wishlistItem.delete({ where: { id } });

    return this.findAll(customerId);
  }

  async clear(customerId: string) {
    await this.prisma.wishlistItem.deleteMany({ where: { customerId } });
    return { message: 'Wishlist cleared' };
  }

  /**
   * Merges a guest's local wishlist into the account on login.
   * Unknown products are skipped rather than failing the whole merge, because a
   * stale localStorage entry must not block a successful sign-in.
   */
  async merge(customerId: string, dto: MergeWishlistDto) {
    if (!dto.items.length) {
      return this.findAll(customerId);
    }

    const productIds = Array.from(new Set(dto.items.map((i) => i.productId)));

    const existing = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true },
    });

    const valid = new Set(existing.map((p) => p.id));

    const rows = dto.items
      .filter((i) => valid.has(i.productId))
      .map((i) => ({
        customerId,
        productId: i.productId,
        variantId: i.variantId ?? null,
        variantKey: this.keyOf(i.variantId),
      }));

    if (rows.length) {
      await this.prisma.wishlistItem.createMany({
        data: rows,
        skipDuplicates: true,
      });
    }

    return this.findAll(customerId);
  }

  /** The customer's wishlist, priced through the central engine. */
  async findAll(customerId: string) {
    const items = await this.prisma.wishlistItem.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      include: {
        product: {
          include: {
            productCategories: { select: { categoryId: true } },
            images: {
              include: { file: true },
              orderBy: { sortOrder: 'asc' },
              take: 1,
            },
            variants: {
              where: { isActive: true },
              orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
            },
          },
        },
        variant: true,
      },
    });

    const discounts = await this.discountsRepository.findActiveForPricing();

    return items.map((item) => {
      // A product-level wishlist entry is represented by its default variant.
      const variant = item.variant ?? item.product.variants[0] ?? null;

      const pricing = variant
        ? this.pricing.price(
            {
              variantId: variant.id,
              productId: item.productId,
              categoryIds: item.product.productCategories.map((pc) => pc.categoryId),
              price: Number(variant.price),
            },
            discounts,
          )
        : null;

      return {
        id: item.id,
        productId: item.productId,
        variantId: item.variantId,
        createdAt: item.createdAt,

        product: {
          id: item.product.id,
          name: item.product.name,
          slug: item.product.slug,
          image: item.product.images[0]?.file ?? null,
        },

        variant: variant
          ? {
              id: variant.id,
              name: variant.name,
              stock: variant.stock,
              allowBackorder: variant.allowBackorder,
            }
          : null,

        pricing,
        onSale: pricing?.onSale ?? false,
      };
    });
  }

  /**
   * Wishlist rows affected by a set of variants/products.
   * Used by the notification enqueuer and the admin discount preview.
   */
  findWatchers(params: { productIds: string[]; variantIds: string[] }) {
    const where: Prisma.WishlistItemWhereInput = {
      OR: [
        // Variant-specific entries for an affected variant.
        { variantId: { in: params.variantIds } },
        // Product-level entries ("any variant") for an affected product.
        { productId: { in: params.productIds }, variantKey: '' },
      ],
      customer: {
        isActive: true,
        // Only customers we can actually email.
        email: { not: null },
      },
    };

    return this.prisma.wishlistItem.findMany({
      where,
      include: {
        customer: { select: { id: true, email: true, firstName: true } },
        product: { select: { id: true, name: true, slug: true } },
        variant: { select: { id: true, name: true } },
      },
    });
  }
}
