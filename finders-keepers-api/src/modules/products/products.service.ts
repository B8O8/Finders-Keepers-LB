import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';

import { CreateProductDto } from './dto/create-product.dto';
import { GetProductsDto } from './dto/get-products.dto';
import { ReorderProductImagesDto } from './dto/reorder-product-images.dto';
import { UpdateProductDto } from './dto/update-product.dto';

/**
 * Shared read shape. `productCategories` replaces the old single `category`
 * relation; `category` is still returned (from the deprecated column) so any
 * client not yet updated keeps working during the transition.
 */
const PRODUCT_INCLUDE = {
  category: true,
  primaryCategory: true,
  productCategories: { include: { category: true } },
  variants: { orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] },
  images: { include: { file: true }, orderBy: { sortOrder: 'asc' } },
} satisfies Prisma.ProductInclude;

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogsService: ActivityLogsService,
  ) {}

  /**
   * Categories may arrive as the new `categoryIds` array or the deprecated
   * single `categoryId`. Normalising here keeps older API clients working.
   */
  private resolveCategoryIds(dto: {
    categoryIds?: string[];
    categoryId?: string;
  }): string[] | undefined {
    if (dto.categoryIds !== undefined) {
      return Array.from(new Set(dto.categoryIds));
    }
    if (dto.categoryId) {
      return [dto.categoryId];
    }
    return undefined;
  }

  private async assertCategoriesExist(categoryIds: string[]) {
    if (!categoryIds.length) return;

    const found = await this.prisma.category.count({
      where: { id: { in: categoryIds } },
    });

    if (found !== categoryIds.length) {
      throw new NotFoundException('One or more categories do not exist');
    }
  }

  /** The primary category must be one the product actually belongs to. */
  private resolvePrimaryCategoryId(
    primaryCategoryId: string | undefined,
    categoryIds: string[],
  ): string | null {
    if (!primaryCategoryId) {
      return categoryIds.length ? categoryIds[0] : null;
    }

    if (!categoryIds.includes(primaryCategoryId)) {
      throw new BadRequestException(
        'primaryCategoryId must be one of the product categories',
      );
    }

    return primaryCategoryId;
  }

  /** Rejects duplicate SKUs inside the payload and against other products. */
  private async assertSkusAreUnique(
    variants: { sku?: string }[],
    excludeProductId?: string,
  ) {
    const skus = variants
      .map((v) => v.sku)
      .filter((sku): sku is string => !!sku && sku.trim() !== '');

    const duplicatesInPayload = skus.filter(
      (sku, i) => skus.indexOf(sku) !== i,
    );

    if (duplicatesInPayload.length) {
      throw new BadRequestException(
        `Duplicate SKU in payload: ${Array.from(new Set(duplicatesInPayload)).join(', ')}`,
      );
    }

    if (!skus.length) return;

    const clashing = await this.prisma.productVariant.findMany({
      where: {
        sku: { in: skus },
        ...(excludeProductId ? { NOT: { productId: excludeProductId } } : {}),
      },
      select: { sku: true },
    });

    if (clashing.length) {
      throw new BadRequestException(
        `SKU already in use: ${clashing.map((c) => c.sku).join(', ')}`,
      );
    }
  }

  /** Exactly one default variant when variants exist. */
  private resolveDefaultFlags<T extends { isDefault?: boolean }>(variants: T[]) {
    const defaults = variants.filter((v) => v.isDefault);

    if (defaults.length > 1) {
      throw new BadRequestException('Only one default variant allowed');
    }

    return variants.map((variant, index) => ({
      ...variant,
      isDefault: variant.isDefault ?? (defaults.length === 0 && index === 0),
    }));
  }

  async create(dto: CreateProductDto, adminId?: string) {
    const existing = await this.prisma.product.findUnique({
      where: { slug: dto.slug },
    });

    if (existing) {
      throw new BadRequestException('Product slug already exists');
    }

    const categoryIds = this.resolveCategoryIds(dto) ?? [];
    await this.assertCategoriesExist(categoryIds);

    const primaryCategoryId = this.resolvePrimaryCategoryId(
      dto.primaryCategoryId,
      categoryIds,
    );

    if (!dto.variants || dto.variants.length === 0) {
      throw new BadRequestException('At least one product variant is required');
    }

    await this.assertSkusAreUnique(dto.variants);
    const variants = this.resolveDefaultFlags(dto.variants);

    const product = await this.prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          shortDescription: dto.shortDescription,
          description: dto.description,
          // Legacy column kept in sync for one release so the previous
          // application image can still read a product's category.
          categoryId: primaryCategoryId,
          primaryCategoryId,
          isActive: dto.isActive ?? true,
          isFeatured: dto.isFeatured ?? false,
          seoTitle: dto.seoTitle,
          seoDescription: dto.seoDescription,
          productCategories: categoryIds.length
            ? { create: categoryIds.map((categoryId) => ({ categoryId })) }
            : undefined,
          variants: {
            create: variants.map((variant) => ({
              name: variant.name,
              sku: variant.sku,
              plu: variant.plu,
              barcode: variant.barcode,
              posProductId: variant.posProductId,
              price: variant.price,
              compareAtPrice: variant.compareAtPrice,
              costPrice: variant.costPrice,
              weight: variant.weight,
              stock: variant.stock ?? 0,
              allowBackorder: variant.allowBackorder ?? false,
              backorderMessage: variant.backorderMessage,
              availabilityDate: variant.availabilityDate
                ? new Date(variant.availabilityDate)
                : null,
              isDefault: variant.isDefault,
              isActive: variant.isActive ?? true,
            })),
          },
          images: dto.imageIds?.length
            ? {
                create: dto.imageIds.map((fileId, index) => ({
                  fileId,
                  sortOrder: index,
                  isPrimary: index === 0,
                })),
              }
            : undefined,
        },
        include: { variants: true, images: true },
      });

      // Variant-specific images can only be linked once variants have ids.
      await this.linkVariantImages(tx, created.id, created.variants, variants);

      return created;
    });

    await this.activityLogsService.create({
      adminId,
      action: 'PRODUCT_CREATED',
      entity: 'Product',
      entityId: product.id,
      metadata: { categoryIds, primaryCategoryId },
    });

    return this.findOne(product.id);
  }

  /**
   * Attaches images that belong to a specific variant. Reuses ProductImage
   * (which already carries an optional variantId) rather than adding a table.
   */
  private async linkVariantImages(
    tx: Prisma.TransactionClient,
    productId: string,
    createdVariants: { id: string; name: string | null; sku: string | null }[],
    payloadVariants: { sku?: string; name?: string; imageIds?: string[] }[],
  ) {
    let sortOrder = await tx.productImage.count({ where: { productId } });

    for (let i = 0; i < payloadVariants.length; i++) {
      const payload = payloadVariants[i];
      if (!payload.imageIds?.length) continue;

      const created = createdVariants[i];
      if (!created) continue;

      for (const fileId of payload.imageIds) {
        const already = await tx.productImage.findFirst({
          where: { productId, fileId },
        });

        if (already) {
          await tx.productImage.update({
            where: { id: already.id },
            data: { variantId: created.id },
          });
          continue;
        }

        await tx.productImage.create({
          data: {
            productId,
            fileId,
            variantId: created.id,
            sortOrder: sortOrder++,
            isPrimary: false,
          },
        });
      }
    }
  }

  async findAll(query: GetProductsDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {};

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { slug: { contains: query.search, mode: 'insensitive' } },
        { shortDescription: { contains: query.search, mode: 'insensitive' } },
        {
          variants: {
            some: {
              OR: [
                { sku: { contains: query.search, mode: 'insensitive' } },
                { plu: { contains: query.search, mode: 'insensitive' } },
                { barcode: { contains: query.search, mode: 'insensitive' } },
              ],
            },
          },
        },
      ];
    }

    // Matches products linked to the category through the join table, so a
    // product filed under several categories is found under each of them.
    if (query.categoryId) {
      where.productCategories = { some: { categoryId: query.categoryId } };
    }
    if (typeof query.isActive === 'boolean') where.isActive = query.isActive;
    if (typeof query.isFeatured === 'boolean') where.isFeatured = query.isFeatured;

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: PRODUCT_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: products,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        ...PRODUCT_INCLUDE,
        reviews: {
          where: { isApproved: true },
          include: {
            customer: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!product) throw new NotFoundException('Product not found');

    const stats = await this.prisma.productReview.aggregate({
      where: { productId: id, isApproved: true },
      _avg: { rating: true },
      _count: true,
    });

    return {
      ...product,
      reviewStats: {
        averageRating: Number(stats._avg.rating || 0),
        totalReviews: stats._count,
      },
    };
  }

  async update(id: string, dto: UpdateProductDto, adminId?: string) {
    await this.findOne(id);

    if (dto.slug) {
      const existingSlug = await this.prisma.product.findFirst({
        where: { slug: dto.slug, NOT: { id } },
      });
      if (existingSlug) throw new BadRequestException('Product slug already exists');
    }

    // Categories are only touched when the caller actually sends them, so a
    // partial update cannot silently unlink a product from its categories.
    const categoryIds = this.resolveCategoryIds(dto);
    let primaryCategoryId: string | null | undefined;

    if (categoryIds !== undefined) {
      await this.assertCategoriesExist(categoryIds);
      primaryCategoryId = this.resolvePrimaryCategoryId(
        dto.primaryCategoryId,
        categoryIds,
      );
    } else if (dto.primaryCategoryId !== undefined) {
      const current = await this.prisma.productCategory.findMany({
        where: { productId: id },
        select: { categoryId: true },
      });
      primaryCategoryId = this.resolvePrimaryCategoryId(
        dto.primaryCategoryId,
        current.map((c) => c.categoryId),
      );
    }

    await this.prisma.$transaction(async (tx) => {
      if (categoryIds !== undefined) {
        await tx.productCategory.deleteMany({ where: { productId: id } });

        if (categoryIds.length) {
          await tx.productCategory.createMany({
            data: categoryIds.map((categoryId) => ({ productId: id, categoryId })),
            skipDuplicates: true,
          });
        }
      }

      await tx.product.update({
        where: { id },
        data: {
          name: dto.name,
          slug: dto.slug,
          shortDescription: dto.shortDescription,
          description: dto.description,
          isActive: dto.isActive,
          isFeatured: dto.isFeatured,
          seoTitle: dto.seoTitle,
          seoDescription: dto.seoDescription,
          ...(primaryCategoryId !== undefined
            ? { primaryCategoryId, categoryId: primaryCategoryId }
            : {}),
        },
      });
    });

    await this.activityLogsService.create({
      adminId,
      action: 'PRODUCT_UPDATED',
      entity: 'Product',
      entityId: id,
      metadata: { categoryIds, primaryCategoryId },
    });

    return this.findOne(id);
  }

  async addImage(productId: string, fileId: string, adminId?: string) {
    await this.findOne(productId);

    const file = await this.prisma.fileAsset.findUnique({ where: { id: fileId } });
    if (!file) throw new NotFoundException('File not found');

    const existing = await this.prisma.productImage.findFirst({
      where: { productId, fileId },
    });
    if (existing) throw new BadRequestException('Image already attached to product');

    const imagesCount = await this.prisma.productImage.count({ where: { productId } });

    const image = await this.prisma.productImage.create({
      data: {
        productId,
        fileId,
        sortOrder: imagesCount,
        isPrimary: imagesCount === 0,
      },
      include: { file: true },
    });

    await this.activityLogsService.create({
      adminId,
      action: 'PRODUCT_IMAGE_ADDED',
      entity: 'Product',
      entityId: productId,
      metadata: { fileId, imageId: image.id },
    });

    return image;
  }

  async setPrimaryImage(productId: string, imageId: string, adminId?: string) {
    const image = await this.prisma.productImage.findFirst({
      where: { id: imageId, productId },
    });
    if (!image) throw new NotFoundException('Product image not found');

    await this.prisma.productImage.updateMany({
      where: { productId },
      data: { isPrimary: false },
    });

    const updated = await this.prisma.productImage.update({
      where: { id: imageId },
      data: { isPrimary: true },
      include: { file: true },
    });

    await this.activityLogsService.create({
      adminId,
      action: 'PRODUCT_PRIMARY_IMAGE_UPDATED',
      entity: 'Product',
      entityId: productId,
      metadata: { imageId },
    });

    return updated;
  }

  async reorderImages(productId: string, dto: ReorderProductImagesDto, adminId?: string) {
    await this.findOne(productId);

    const productImages = await this.prisma.productImage.findMany({
      where: { productId },
      select: { id: true },
    });

    const validImageIds = new Set(productImages.map((img) => img.id));
    for (const image of dto.images) {
      if (!validImageIds.has(image.imageId)) {
        throw new BadRequestException(`Image ${image.imageId} does not belong to this product`);
      }
    }

    await Promise.all(
      dto.images.map((image) =>
        this.prisma.productImage.update({
          where: { id: image.imageId },
          data: { sortOrder: image.sortOrder },
        }),
      ),
    );

    await this.activityLogsService.create({
      adminId,
      action: 'PRODUCT_IMAGES_REORDERED',
      entity: 'Product',
      entityId: productId,
      metadata: dto,
    });

    return { message: 'Images reordered successfully' };
  }

  async removeImage(productId: string, imageId: string, adminId?: string) {
    const image = await this.prisma.productImage.findFirst({
      where: { id: imageId, productId },
    });
    if (!image) throw new NotFoundException('Product image not found');

    await this.prisma.productImage.delete({ where: { id: imageId } });

    if (image.isPrimary) {
      const nextImage = await this.prisma.productImage.findFirst({
        where: { productId },
        orderBy: { sortOrder: 'asc' },
      });
      if (nextImage) {
        await this.prisma.productImage.update({
          where: { id: nextImage.id },
          data: { isPrimary: true },
        });
      }
    }

    await this.activityLogsService.create({
      adminId,
      action: 'PRODUCT_IMAGE_REMOVED',
      entity: 'Product',
      entityId: productId,
      metadata: { imageId },
    });

    return { message: 'Image removed successfully' };
  }

  async assignImageToVariant(
    productId: string,
    imageId: string,
    variantId: string | null,
    adminId?: string,
  ) {
    const image = await this.prisma.productImage.findFirst({
      where: { id: imageId, productId },
    });
    if (!image) throw new NotFoundException('Product image not found');

    if (variantId) {
      const variant = await this.prisma.productVariant.findFirst({
        where: { id: variantId, productId },
      });
      if (!variant) throw new NotFoundException('Variant not found on this product');
    }

    const updated = await this.prisma.productImage.update({
      where: { id: imageId },
      data: { variantId: variantId ?? null },
    });

    await this.activityLogsService.create({
      adminId,
      action: 'PRODUCT_IMAGE_VARIANT_ASSIGNED',
      entity: 'Product',
      entityId: productId,
      metadata: { imageId, variantId },
    });

    return updated;
  }

  async delete(id: string, adminId?: string) {
    const product = await this.findOne(id);

    await this.prisma.product.delete({ where: { id } });

    await this.activityLogsService.create({
      adminId,
      action: 'PRODUCT_DELETED',
      entity: 'Product',
      entityId: id,
      metadata: { productName: product.name },
    });

    return { message: 'Product deleted successfully' };
  }
}
