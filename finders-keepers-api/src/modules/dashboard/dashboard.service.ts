import { Injectable } from '@nestjs/common';
import {
  OrderStatus,
  PaymentStatus,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats() {
    const today = new Date();

    today.setHours(0, 0, 0, 0);

    const [
      totalOrders,
      pendingOrders,
      totalCustomers,
      totalProducts,
      totalRevenue,
      todayRevenue,
      lowStockProducts,
      recentOrders,
    ] = await Promise.all([
      this.prisma.order.count(),

      this.prisma.order.count({
        where: {
          status: OrderStatus.PENDING,
        },
      }),

      this.prisma.customer.count(),

      this.prisma.product.count(),

      this.prisma.order.aggregate({
        _sum: {
          totalAmount: true,
        },
        where: {
          paymentStatus: PaymentStatus.PAID,
        },
      }),

      this.prisma.order.aggregate({
        _sum: {
          totalAmount: true,
        },
        where: {
          paymentStatus: PaymentStatus.PAID,
          createdAt: {
            gte: today,
          },
        },
      }),

      this.prisma.productVariant.findMany({
        where: {
          stock: {
            lte: 5,
          },
          isActive: true,
        },
        include: {
          product: true,
        },
        orderBy: {
          stock: 'asc',
        },
        take: 10,
      }),

      this.prisma.order.findMany({
        include: {
          customer: true,
          items: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 10,
      }),
    ]);

    return {
      stats: {
        totalOrders,
        pendingOrders,
        totalCustomers,
        totalProducts,

        totalRevenue:
          Number(totalRevenue._sum.totalAmount || 0),

        todayRevenue:
          Number(todayRevenue._sum.totalAmount || 0),
      },

      lowStockProducts,

      recentOrders,
    };
  }
}