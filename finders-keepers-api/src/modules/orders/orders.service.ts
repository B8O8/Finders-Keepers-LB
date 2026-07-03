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

import { CheckoutDto } from './dto/checkout.dto';
import { GetOrdersDto } from './dto/get-orders.dto';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogsService: ActivityLogsService,
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
                product: true,
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

    return this.prisma.$transaction(async (tx) => {
      let subtotal = 0;

      for (const item of cart.items) {
        if (!item.variant.isActive || !item.variant.product.isActive) {
          throw new BadRequestException(
            `${item.variant.product.name} is no longer available`,
          );
        }

        if (item.variant.stock < item.quantity) {
          throw new BadRequestException(
            `Not enough stock for ${item.variant.product.name}`,
          );
        }

        subtotal += Number(item.variant.price) * item.quantity;
      }

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

      const discountAmount = 0;
      const totalAmount = subtotal + deliveryFee - discountAmount;

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
            create: cart.items.map((item) => ({
              productId: item.variant.productId,
              variantId: item.variant.id,
              productName: item.variant.product.name,
              variantName: item.variant.name,
              sku: item.variant.sku,
              plu: item.variant.plu,
              barcode: item.variant.barcode,
              quantity: item.quantity,
              unitPrice: item.variant.price,
              totalPrice: Number(item.variant.price) * item.quantity,
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

      for (const item of cart.items) {
        await tx.productVariant.update({
          where: {
            id: item.variantId,
          },
          data: {
            stock: {
              decrement: item.quantity,
            },
          },
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
        await tx.productVariant.update({
          where: {
            id: item.variantId,
          },
          data: {
            stock: {
              increment: item.quantity,
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