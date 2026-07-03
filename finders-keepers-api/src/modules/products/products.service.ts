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

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogsService: ActivityLogsService,
  ) {}

  async create(dto: CreateProductDto, adminId?: string) {
    const existing = await this.prisma.product.findUnique({
      where: { slug: dto.slug },
    });

    if (existing) {
      throw new BadRequestException('Product slug already exists');
    }

    if (dto.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: dto.categoryId },
      });
      if (!category) throw new NotFoundException('Category not found');
    }

    if (!dto.variants || dto.variants.length === 0) {
      throw new BadRequestException('At least one product variant is required');
    }

    const defaultVariants = dto.variants.filter((v) => v.isDefault);
    if (defaultVariants.length > 1) {
      throw new BadRequestException('Only one default variant allowed');
    }

    const product = await this.prisma.product.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        shortDescription: dto.shortDescription,
        description: dto.description,
        categoryId: dto.categoryId,
        isActive: dto.isActive ?? true,
        isFeatured: dto.isFeatured ?? false,
        seoTitle: dto.seoTitle,
        seoDescription: dto.seoDescription,
        variants: {
          create: dto.variants.map((variant, index) => ({
            name: variant.name,
            sku: variant.sku,
            plu: variant.plu,
            barcode: variant.barcode,
            price: variant.price,
            costPrice: variant.costPrice,
            stock: variant.stock ?? 0,
            isDefault: variant.isDefault ?? (dto.variants.length === 1 && index === 0),
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
      include: {
        category: true,
        variants: { orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] },
        images: { include: { file: true }, orderBy: { sortOrder: 'asc' } },
      },
    });

    await this.activityLogsService.create({
      adminId,
      action: 'PRODUCT_CREATED',
      entity: 'Product',
      entityId: product.id,
    });

    return product;
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

    if (query.categoryId) where.categoryId = query.categoryId;
    if (typeof query.isActive === 'boolean') where.isActive = query.isActive;
    if (typeof query.isFeatured === 'boolean') where.isFeatured = query.isFeatured;

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: {
          category: true,
          variants: { orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] },
          images: { include: { file: true }, orderBy: { sortOrder: 'asc' } },
        },
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
        category: true,
        variants: { orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] },
        images: { include: { file: true }, orderBy: { sortOrder: 'asc' } },
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

    if (dto.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: dto.categoryId },
      });
      if (!category) throw new NotFoundException('Category not found');
    }

    const product = await this.prisma.product.update({
      where: { id },
      data: {
        name: dto.name,
        slug: dto.slug,
        shortDescription: dto.shortDescription,
        description: dto.description,
        categoryId: dto.categoryId,
        isActive: dto.isActive,
        isFeatured: dto.isFeatured,
        seoTitle: dto.seoTitle,
        seoDescription: dto.seoDescription,
      },
      include: {
        category: true,
        variants: { orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] },
        images: { include: { file: true }, orderBy: { sortOrder: 'asc' } },
      },
    });

    await this.activityLogsService.create({
      adminId,
      action: 'PRODUCT_UPDATED',
      entity: 'Product',
      entityId: id,
    });

    return product;
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
