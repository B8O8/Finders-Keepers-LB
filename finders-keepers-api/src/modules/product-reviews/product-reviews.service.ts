import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';

import { CreateProductReviewDto } from './dto/create-product-review.dto';
import { ModerateProductReviewDto } from './dto/moderate-product-review.dto';
import { UpdateProductReviewDto } from './dto/update-product-review.dto';

@Injectable()
export class ProductReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogsService: ActivityLogsService,
  ) {}

  async create(
    customerId: string,
    dto: CreateProductReviewDto,
  ) {
    const product = await this.prisma.product.findUnique({
      where: {
        id: dto.productId,
      },
    });

    if (!product || !product.isActive) {
      throw new NotFoundException('Product not found');
    }

    const existing = await this.prisma.productReview.findUnique({
      where: {
        productId_customerId: {
          productId: dto.productId,
          customerId,
        },
      },
    });

    if (existing) {
      throw new BadRequestException(
        'You already reviewed this product',
      );
    }

    const review = await this.prisma.productReview.create({
      data: {
        productId: dto.productId,
        customerId,
        rating: dto.rating,
        title: dto.title,
        comment: dto.comment,
      },

      include: {
        customer: true,
        product: true,
      },
    });

    return review;
  }

  async findProductReviews(productId: string) {
    const reviews = await this.prisma.productReview.findMany({
      where: {
        productId,
        isApproved: true,
      },

      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },

      orderBy: {
        createdAt: 'desc',
      },
    });

    const stats = await this.prisma.productReview.aggregate({
      where: {
        productId,
        isApproved: true,
      },

      _avg: {
        rating: true,
      },

      _count: true,
    });

    return {
      reviews,

      stats: {
        averageRating: Number(
          stats._avg.rating || 0,
        ),

        totalReviews: stats._count,
      },
    };
  }

  async findMyReviews(customerId: string) {
    return this.prisma.productReview.findMany({
      where: {
        customerId,
      },

      include: {
        product: true,
      },

      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async update(
    id: string,
    customerId: string,
    dto: UpdateProductReviewDto,
  ) {
    const review =
      await this.prisma.productReview.findFirst({
        where: {
          id,
          customerId,
        },
      });

    if (!review) {
      throw new NotFoundException(
        'Review not found',
      );
    }

    return this.prisma.productReview.update({
      where: {
        id,
      },

      data: {
        rating: dto.rating,
        title: dto.title,
        comment: dto.comment,
      },

      include: {
        product: true,
      },
    });
  }

  async delete(
    id: string,
    customerId: string,
  ) {
    const review =
      await this.prisma.productReview.findFirst({
        where: {
          id,
          customerId,
        },
      });

    if (!review) {
      throw new NotFoundException(
        'Review not found',
      );
    }

    await this.prisma.productReview.delete({
      where: {
        id,
      },
    });

    return {
      message: 'Review deleted successfully',
    };
  }

  async adminFindAll() {
    return this.prisma.productReview.findMany({
      include: {
        customer: true,
        product: true,
      },

      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async moderate(
    id: string,
    dto: ModerateProductReviewDto,
    adminId?: string,
  ) {
    const review =
      await this.prisma.productReview.findUnique({
        where: {
          id,
        },
      });

    if (!review) {
      throw new NotFoundException(
        'Review not found',
      );
    }

    const updated =
      await this.prisma.productReview.update({
        where: {
          id,
        },

        data: {
          isApproved: dto.isApproved,
        },

        include: {
          customer: true,
          product: true,
        },
      });

    await this.activityLogsService.create({
      adminId,

      action: 'PRODUCT_REVIEW_MODERATED',

      entity: 'ProductReview',

      entityId: id,

      metadata: {
        isApproved: dto.isApproved,
      },
    });

    return updated;
  }
}