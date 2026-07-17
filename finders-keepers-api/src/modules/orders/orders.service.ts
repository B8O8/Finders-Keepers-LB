import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { DiscountsRepository } from '../discounts/discounts.repository';
import { PricingService } from '../discounts/pricing.service';

import { restockQuantity, splitQuantity } from './backorder.util';
import { CheckoutDto } from './dto/checkout.dto';
import { GetOrdersDto } from './dto/get-orders.dto';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogsService: ActivityLogsService,
    private readonly pricing: PricingService,
    private readonly discountsRepository: DiscountsRepository,
  ) {}

  private async generateOrderNumber(tx: Prisma.TransactionClient) {
    const date = new Date();

    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');

    const count = await tx.order.count();

    return `FK-${y}${m}${d}-${String(count + 1).padStart(5, '0')}`;
  }

  async checkout(dto: CheckoutDto, customerId?: string) {
    if (!customerId && !dto.guestToken) {
      throw new BadRequestException('Customer or guest token is required');
    }

    const cart = await this.prisma.cart.findFirst({
      where: customerId ? { customerId } : { guestToken: dto.guestToken },
      include: {
        items: {
          include: {
            variant: {
              include: {
                product: {
                  include: {
                    productCategories: {
                      include: { category: { select: { id: true, name: true, slug: true } } },
                    },
                    images: {
                      include: { file: true },
                      orderBy: { sortOrder: 'asc' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    const settings = await this.prisma.storeSettings.findFirst();

    const currency = settings?.currency || 'USD';
    const defaultDeliveryFee = Number(settings?.defaultDeliveryFee || 0);
    const orderMinimumAmount = Number(settings?.orderMinimumAmount || 0);

    let addressSnapshot: Prisma.InputJsonValue | undefined;

    if (customerId && dto.addressId) {
      const address = await this.prisma.customerAddress.findFirst({
        where: {
          id: dto.addressId,
          customerId,
        },
      });

      if (!address) {
        throw new NotFoundException('Address not found');
      }

      addressSnapshot = {
        id: address.id,
        label: address.label,
        fullName: address.fullName,
        phone: address.phone,
        country: address.country,
        city: address.city,
        area: address.area,
        street: address.street,
        building: address.building,
        floor: address.floor,
        apartment: address.apartment,
        notes: address.notes,
      };
    }

    if (!customerId) {
      if (!dto.guestName || !dto.guestPhone) {
        throw new BadRequestException('Guest name and phone are required');
      }

      if (!dto.city || !dto.area || !dto.street) {
        throw new BadRequestException(
          'City, area, and street are required for delivery',
        );
      }

      addressSnapshot = {
        fullName: dto.guestName,
        phone: dto.guestPhone,
        email: dto.guestEmail,
        country: 'Lebanon',
        city: dto.city,
        area: dto.area,
        street: dto.street,
        building: dto.building,
        floor: dto.floor,
        apartment: dto.apartment,
        notes: dto.notes,
        latitude: dto.latitude,
        longitude: dto.longitude,
      };
    }

    // Prices are ALWAYS recalculated here from the database and the discount
    // engine. Nothing the client submits is trusted.
    const discounts = await this.discountsRepository.findActiveForPricing();

    const regularSubtotal = cart.items.reduce(
      (acc, item) => acc + Number(item.variant.price) * item.quantity,
      0,
    );

    return this.prisma.$transaction(async (tx) => {
      const lines: {
        item: (typeof cart.items)[number];
        priced: ReturnType<PricingService['price']>;
        deductable: number;
        backorderQuantity: number;
      }[] = [];

      let subtotal = 0;
      let discountAmount = 0;

      for (const item of cart.items) {
        if (!item.variant.isActive || !item.variant.product.isActive) {
          throw new BadRequestException(
            `${item.variant.product.name} is no longer available`,
          );
        }

        // Out-of-stock is only allowed through when the variant opts in.
        if (item.variant.stock < item.quantity && !item.variant.allowBackorder) {
          throw new BadRequestException(
            `Not enough stock for ${item.variant.product.name}`,
          );
        }

        const priced = this.pricing.price(
          {
            variantId: item.variant.id,
            productId: item.variant.productId,
            categoryIds: item.variant.product.productCategories.map(
              (pc) => pc.categoryId,
            ),
            price: Number(item.variant.price),
          },
          discounts,
          { orderSubtotal: regularSubtotal },
        );

        // Stock is floored at zero: only what exists is deducted and the
        // shortfall is recorded as a backorder. See backorder.util.ts.
        const { deductable, backorderQuantity } = splitQuantity(
          item.variant.stock,
          item.quantity,
        );

        subtotal += priced.finalPrice * item.quantity;
        discountAmount += priced.discountAmount * item.quantity;

        lines.push({ item, priced, deductable, backorderQuantity });
      }

      subtotal = Number(subtotal.toFixed(2));
      discountAmount = Number(discountAmount.toFixed(2));

      if (subtotal < orderMinimumAmount) {
        throw new BadRequestException(
          `Minimum order amount is ${orderMinimumAmount} ${currency}`,
        );
      }

      let deliveryFee = defaultDeliveryFee;

      if (
        settings?.freeDeliveryThreshold &&
        subtotal >= Number(settings.freeDeliveryThreshold)
      ) {
        deliveryFee = 0;
      }

      // subtotal already reflects discounts, so it is not subtracted twice.
      const totalAmount = Number((subtotal + deliveryFee).toFixed(2));

      const order = await tx.order.create({
        data: {
          orderNumber: await this.generateOrderNumber(tx),

          customerId,

          guestEmail: dto.guestEmail,
          guestPhone: dto.guestPhone,
          guestName: dto.guestName,

          paymentMethod: dto.paymentMethod || PaymentMethod.CASH_ON_DELIVERY,
          paymentStatus: PaymentStatus.PENDING,
          status: OrderStatus.PENDING,

          subtotal,
          deliveryFee,
          discountAmount,
          totalAmount,
          currency,

          notes: dto.notes,
          addressSnapshot,

          items: {
            create: lines.map(({ item, priced, backorderQuantity }) => ({
              productId: item.variant.productId,
              variantId: item.variant.id,
              productName: item.variant.product.name,
              variantName: item.variant.name,
              sku: item.variant.sku,
              plu: item.variant.plu,
              barcode: item.variant.barcode,
              quantity: item.quantity,

              // Immutable snapshot. discountId is stored as a plain value (not
              // a relation) so archiving or editing the discount later cannot
              // rewrite history.
              regularPrice: priced.regularPrice,
              unitPrice: priced.finalPrice,
              discountAmount: priced.discountAmount,
              discountId: priced.discountId,
              discountLabel: priced.discountLabel,
              totalPrice: Number((priced.finalPrice * item.quantity).toFixed(2)),

              isBackorder: backorderQuantity > 0,
              backorderQuantity,

              categorySnapshot: item.variant.product.productCategories.map(
                (pc) => ({
                  id: pc.category.id,
                  name: pc.category.name,
                  slug: pc.category.slug,
                }),
              ),
              imageUrl: item.variant.product.images[0]?.file?.url ?? null,
            })),
          },
        },
        include: {
          customer: true,
          items: {
            include: {
              product: true,
              variant: true,
            },
          },
        },
      });

      for (const { item, deductable } of lines) {
        if (deductable <= 0) continue;

        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { decrement: deductable } },
        });
      }

      await tx.cartItem.deleteMany({
        where: {
          cartId: cart.id,
        },
      });

      return order;
    });
  }

  async findAll(query: GetOrdersDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.OrderWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.paymentStatus) {
      where.paymentStatus = query.paymentStatus;
    }

    if (query.search) {
      where.OR = [
        {
          orderNumber: {
            contains: query.search,
            mode: 'insensitive',
          },
        },
        {
          guestName: {
            contains: query.search,
            mode: 'insensitive',
          },
        },
        {
          guestPhone: {
            contains: query.search,
            mode: 'insensitive',
          },
        },
        {
          customer: {
            firstName: {
              contains: query.search,
              mode: 'insensitive',
            },
          },
        },
        {
          customer: {
            lastName: {
              contains: query.search,
              mode: 'insensitive',
            },
          },
        },
        {
          customer: {
            email: {
              contains: query.search,
              mode: 'insensitive',
            },
          },
        },
      ];
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          customer: true,
          items: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.order.count({
        where,
      }),
    ]);

    return {
      data: orders,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
            variant: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async findOneForCustomer(id: string, customerId: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        id,
        customerId,
      },
      include: {
        items: {
          include: {
            product: true,
            variant: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  findByCustomer(customerId: string) {
    return this.prisma.order.findMany({
      where: {
        customerId,
      },
      include: {
        items: {
          include: {
            product: true,
            variant: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async updateStatus(id: string, status: OrderStatus, adminId?: string) {
    const order = await this.findOne(id);

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        status,
      },
      include: {
        customer: true,
        items: true,
      },
    });

    await this.activityLogsService.create({
      adminId,
      action: 'ORDER_STATUS_UPDATED',
      entity: 'Order',
      entityId: id,
      metadata: {
        oldStatus: order.status,
        newStatus: status,
      },
    });

    return updated;
  }

  async updatePaymentStatus(
    id: string,
    paymentStatus: PaymentStatus,
    adminId?: string,
  ) {
    const order = await this.findOne(id);

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        paymentStatus,
      },
      include: {
        customer: true,
        items: true,
      },
    });

    await this.activityLogsService.create({
      adminId,
      action: 'ORDER_PAYMENT_STATUS_UPDATED',
      entity: 'Order',
      entityId: id,
      metadata: {
        oldPaymentStatus: order.paymentStatus,
        newPaymentStatus: paymentStatus,
      },
    });

    return updated;
  }

  async cancelOrder(id: string, adminId?: string) {
    const order = await this.findOne(id);

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Order is already cancelled');
    }

    if (order.status === OrderStatus.DELIVERED) {
      throw new BadRequestException('Delivered orders cannot be cancelled');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        // Only return what was actually taken (see backorder.util.ts).
        const restock = restockQuantity(item.quantity, item.backorderQuantity);

        if (restock <= 0) continue;

        await tx.productVariant.update({
          where: {
            id: item.variantId,
          },
          data: {
            stock: {
              increment: restock,
            },
          },
        });
      }

      return tx.order.update({
        where: { id },
        data: {
          status: OrderStatus.CANCELLED,
        },
        include: {
          customer: true,
          items: true,
        },
      });
    });

    await this.activityLogsService.create({
      adminId,
      action: 'ORDER_CANCELLED',
      entity: 'Order',
      entityId: id,
      metadata: {
        orderNumber: order.orderNumber,
      },
    });

    return updated;
  }

  async cancelOrderForCustomer(id: string, customerId: string) {
    const order = await this.findOneForCustomer(id, customerId);

    if (
      order.status !== OrderStatus.PENDING &&
      order.status !== OrderStatus.CONFIRMED
    ) {
      throw new BadRequestException('Order can no longer be cancelled');
    }

    return this.cancelOrder(id);
  }
}