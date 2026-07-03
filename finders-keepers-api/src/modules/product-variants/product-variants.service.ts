import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { CreateProductVariantDto } from './dto/create-product-variant.dto';
import { UpdateProductVariantDto } from './dto/update-product-variant.dto';
import { UpdateVariantPriceDto } from './dto/update-variant-price.dto';
import { UpdateVariantStockDto } from './dto/update-variant-stock.dto';

@Injectable()
export class ProductVariantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogsService: ActivityLogsService,
  ) {}

  async create(dto: CreateProductVariantDto, adminId?: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (dto.sku) {
      const existingSku = await this.prisma.productVariant.findUnique({
        where: { sku: dto.sku },
      });

      if (existingSku) {
        throw new BadRequestException('SKU already exists');
      }
    }

    if (dto.isDefault) {
      await this.prisma.productVariant.updateMany({
        where: { productId: dto.productId },
        data: { isDefault: false },
      });
    }

    const variant = await this.prisma.productVariant.create({
      data: {
        productId: dto.productId,
        name: dto.name,
        sku: dto.sku,
        plu: dto.plu,
        barcode: dto.barcode,
        price: dto.price,
        costPrice: dto.costPrice,
        stock: dto.stock ?? 0,
        isDefault: dto.isDefault ?? false,
        isActive: dto.isActive ?? true,
      },
      include: {
        product: true,
      },
    });

    await this.activityLogsService.create({
      adminId,
      action: 'PRODUCT_VARIANT_CREATED',
      entity: 'ProductVariant',
      entityId: variant.id,
      metadata: {
        productId: variant.productId,
        sku: variant.sku,
        plu: variant.plu,
        barcode: variant.barcode,
      },
    });

    return variant;
  }

  findAll() {
    return this.prisma.productVariant.findMany({
      include: {
        product: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  findByProduct(productId: string) {
    return this.prisma.productVariant.findMany({
      where: { productId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async findOne(id: string) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id },
      include: {
        product: true,
      },
    });

    if (!variant) {
      throw new NotFoundException('Product variant not found');
    }

    return variant;
  }

  async update(id: string, dto: UpdateProductVariantDto, adminId?: string) {
    const existing = await this.findOne(id);

    if (dto.sku) {
      const existingSku = await this.prisma.productVariant.findFirst({
        where: {
          sku: dto.sku,
          NOT: { id },
        },
      });

      if (existingSku) {
        throw new BadRequestException('SKU already exists');
      }
    }

    if (dto.productId && dto.productId !== existing.productId) {
      const product = await this.prisma.product.findUnique({
        where: { id: dto.productId },
      });

      if (!product) {
        throw new NotFoundException('Product not found');
      }
    }

    const productId = dto.productId ?? existing.productId;

    if (dto.isDefault) {
      await this.prisma.productVariant.updateMany({
        where: {
          productId,
          NOT: { id },
        },
        data: { isDefault: false },
      });
    }

    const variant = await this.prisma.productVariant.update({
      where: { id },
      data: {
        productId: dto.productId,
        name: dto.name,
        sku: dto.sku,
        plu: dto.plu,
        barcode: dto.barcode,
        price: dto.price,
        costPrice: dto.costPrice,
        stock: dto.stock,
        isDefault: dto.isDefault,
        isActive: dto.isActive,
      },
      include: {
        product: true,
      },
    });

    await this.activityLogsService.create({
      adminId,
      action: 'PRODUCT_VARIANT_UPDATED',
      entity: 'ProductVariant',
      entityId: id,
      metadata: {
        productId: variant.productId,
        sku: variant.sku,
      },
    });

    return variant;
  }

  async updateStock(id: string, dto: UpdateVariantStockDto, adminId?: string) {
    const existing = await this.findOne(id);

    const variant = await this.prisma.productVariant.update({
      where: { id },
      data: {
        stock: dto.stock,
      },
    });

    await this.activityLogsService.create({
      adminId,
      action: 'PRODUCT_VARIANT_STOCK_UPDATED',
      entity: 'ProductVariant',
      entityId: id,
      metadata: {
        oldStock: existing.stock,
        newStock: dto.stock,
      },
    });

    return variant;
  }

  async updatePrice(id: string, dto: UpdateVariantPriceDto, adminId?: string) {
    const existing = await this.findOne(id);

    const variant = await this.prisma.productVariant.update({
      where: { id },
      data: {
        price: dto.price,
        costPrice: dto.costPrice,
      },
    });

    await this.activityLogsService.create({
      adminId,
      action: 'PRODUCT_VARIANT_PRICE_UPDATED',
      entity: 'ProductVariant',
      entityId: id,
      metadata: {
        oldPrice: existing.price,
        newPrice: dto.price,
        oldCostPrice: existing.costPrice,
        newCostPrice: dto.costPrice,
      },
    });

    return variant;
  }

  async setDefault(id: string, adminId?: string) {
    const variant = await this.findOne(id);

    await this.prisma.productVariant.updateMany({
      where: {
        productId: variant.productId,
        NOT: { id },
      },
      data: {
        isDefault: false,
      },
    });

    const updated = await this.prisma.productVariant.update({
      where: { id },
      data: {
        isDefault: true,
      },
    });

    await this.activityLogsService.create({
      adminId,
      action: 'PRODUCT_VARIANT_SET_DEFAULT',
      entity: 'ProductVariant',
      entityId: id,
      metadata: {
        productId: variant.productId,
      },
    });

    return updated;
  }

  async delete(id: string, adminId?: string) {
    const variant = await this.findOne(id);

    const variantsCount = await this.prisma.productVariant.count({
      where: {
        productId: variant.productId,
      },
    });

    if (variantsCount <= 1) {
      throw new BadRequestException(
        'Cannot delete the last variant of a product',
      );
    }

    await this.prisma.productVariant.delete({
      where: { id },
    });

    if (variant.isDefault) {
      const nextVariant = await this.prisma.productVariant.findFirst({
        where: {
          productId: variant.productId,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      if (nextVariant) {
        await this.prisma.productVariant.update({
          where: { id: nextVariant.id },
          data: { isDefault: true },
        });
      }
    }

    await this.activityLogsService.create({
      adminId,
      action: 'PRODUCT_VARIANT_DELETED',
      entity: 'ProductVariant',
      entityId: id,
      metadata: {
        productId: variant.productId,
        sku: variant.sku,
      },
    });

    return {
      message: 'Product variant deleted successfully',
    };
  }
}