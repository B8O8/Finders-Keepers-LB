import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { GetStorefrontProductsDto } from './dto/get-storefront-products.dto';

@Injectable()
export class StorefrontService {
  constructor(private readonly prisma: PrismaService) {}

  async getCategories() {
    return this.prisma.category.findMany({
      where: {
        isActive: true,
      },
      include: {
        image: true,
        children: {
          where: {
            isActive: true,
          },
          include: {
            image: true,
          },
          orderBy: {
            sortOrder: 'asc',
          },
        },
      },
      orderBy: {
        sortOrder: 'asc',
      },
    });
  }

  async getCategoryTree() {
    return this.prisma.category.findMany({
      where: {
        isActive: true,
        parentId: null,
      },
      include: {
        image: true,
        children: {
          where: {
            isActive: true,
          },
          include: {
            image: true,
            children: true,
          },
          orderBy: {
            sortOrder: 'asc',
          },
        },
      },
      orderBy: {
        sortOrder: 'asc',
      },
    });
  }

  async getProducts(query: GetStorefrontProductsDto) {
    const page = query.page || 1;
    const limit = query.limit || 12;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {
      isActive: true,
    };

    if (query.search) {
      where.OR = [
        {
          name: {
            contains: query.search,
            mode: 'insensitive',
          },
        },
        {
          shortDescription: {
            contains: query.search,
            mode: 'insensitive',
          },
        },
      ];
    }

    if (query.categorySlug) {
      where.category = {
        slug: query.categorySlug,
      };
    }

    let orderBy: Prisma.ProductOrderByWithRelationInput = {
      createdAt: 'desc',
    };

    switch (query.sort) {
      case 'oldest':
        orderBy = {
          createdAt: 'asc',
        };
        break;

      case 'price_asc':
        orderBy = {
          variants: {
            _count: 'desc',
          },
        };
        break;

      case 'price_desc':
        orderBy = {
          variants: {
            _count: 'asc',
          },
        };
        break;
    }

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          category: true,
          variants: {
            where: {
              isActive: true,
            },
            orderBy: [
              { isDefault: 'desc' },
              { createdAt: 'asc' },
            ],
          },
          images: {
            include: {
              file: true,
            },
            orderBy: {
              sortOrder: 'asc',
            },
          },
        },
      }),

      this.prisma.product.count({
        where,
      }),
    ]);

    return {
      data: products,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getFeaturedProducts() {
    return this.prisma.product.findMany({
      where: {
        isActive: true,
        isFeatured: true,
      },
      include: {
        category: true,
        variants: {
          where: {
            isActive: true,
          },
          orderBy: [
            { isDefault: 'desc' },
            { createdAt: 'asc' },
          ],
        },
        images: {
          include: {
            file: true,
          },
          orderBy: {
            sortOrder: 'asc',
          },
        },
      },
      take: 12,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

async getProductBySlug(slug: string) {
  const product = await this.prisma.product.findFirst({
    where: {
      slug,
      isActive: true,
    },
    include: {
      category: true,
      variants: {
        where: {
          isActive: true,
        },
        orderBy: [
          { isDefault: 'desc' },
          { createdAt: 'asc' },
        ],
      },
      images: {
        include: {
          file: true,
        },
        orderBy: {
          sortOrder: 'asc',
        },
      },
      reviews: {
        where: {
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
        take: 10,
      },
    },
  });

  if (!product) {
    throw new NotFoundException('Product not found');
  }

  const stats = await this.prisma.productReview.aggregate({
    where: {
      productId: product.id,
      isApproved: true,
    },
    _avg: {
      rating: true,
    },
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

  async getProductsByCategorySlug(
    slug: string,
    query: GetStorefrontProductsDto,
  ) {
    return this.getProducts({
      ...query,
      categorySlug: slug,
    });
  }
}