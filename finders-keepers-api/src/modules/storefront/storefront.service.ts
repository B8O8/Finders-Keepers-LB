import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { DiscountsRepository } from '../discounts/discounts.repository';
import { PricingService } from '../discounts/pricing.service';
import { PricedResult } from '../discounts/pricing.types';
import { GetStorefrontProductsDto } from './dto/get-storefront-products.dto';
import { compareByListingPrice, representativeListingPrice } from './listing-price';
import { PriceCartDto } from './dto/price-cart.dto';
import { PriceProductsDto } from './dto/price-products.dto';

/** Product shape the storefront reads, including everything pricing needs. */
const STOREFRONT_PRODUCT_INCLUDE = {
  primaryCategory: true,
  productCategories: { include: { category: true } },
  variants: {
    where: { isActive: true },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  },
  images: {
    include: { file: true },
    orderBy: { sortOrder: 'asc' },
  },
} satisfies Prisma.ProductInclude;

@Injectable()
export class StorefrontService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly discountsRepository: DiscountsRepository,
  ) {}

  /**
   * Decorates a product's variants with prices from the central engine.
   *
   * The storefront never computes money itself: every price shown here comes
   * from the same PricingService the cart, checkout and order snapshots use,
   * so a shopper can never see a price the cart disagrees with.
   */
  private decorate<T extends {
    id: string;
    productCategories: { categoryId: string }[];
    variants: { id: string; price: Prisma.Decimal; stock: number; allowBackorder: boolean }[];
  }>(product: T, priced: Map<string, PricedResult>) {
    const variants = product.variants.map((v) => {
      const p = priced.get(v.id);

      return {
        ...v,
        pricing: p ?? {
          variantId: v.id,
          regularPrice: Number(v.price),
          finalPrice: Number(v.price),
          discountAmount: 0,
          discountPercent: 0,
          onSale: false,
          appliedDiscounts: [],
          discountId: null,
          discountLabel: null,
          expiresAt: null,
        },
        // Out-of-stock products stay visible and, when backorder is enabled,
        // remain purchasable.
        inStock: v.stock > 0,
        isBackorder: v.stock <= 0 && v.allowBackorder,
        purchasable: v.stock > 0 || v.allowBackorder,
      };
    });

    const onSale = variants.some((v) => v.pricing.onSale);
    const prices = variants.map((v) => v.pricing.finalPrice);

    return {
      ...product,
      variants,
      categories: product.productCategories.map((pc: any) => pc.category),
      onSale,
      priceFrom: prices.length ? Math.min(...prices) : 0,
      priceTo: prices.length ? Math.max(...prices) : 0,
    };
  }

  private async priceProducts<T extends {
    id: string;
    productCategories: { categoryId: string }[];
    variants: { id: string; price: Prisma.Decimal; stock: number; allowBackorder: boolean }[];
  }>(products: T[]) {
    const discounts = await this.discountsRepository.findActiveForPricing();

    return products.map((product) => {
      const priced = this.pricing.priceMany(
        product.variants.map((v) => ({
          variantId: v.id,
          productId: product.id,
          categoryIds: product.productCategories.map((pc) => pc.categoryId),
          price: Number(v.price),
        })),
        discounts,
      );

      return this.decorate(product, priced);
    });
  }

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

    // A product filed under several categories must appear under every one
    // of them, so filtering goes through the join table.
    if (query.categorySlug) {
      where.productCategories = {
        some: { category: { slug: query.categorySlug } },
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

      // price_asc / price_desc are NOT sortable in SQL: the selling price is
      // derived from Discount records at read time, so the database has no
      // column to order by. They are handled by sortByPrice() below.
    }

    // Price sorting must reflect the DISCOUNTED price, which only exists after
    // PricingService runs - so it cannot be expressed as a SQL ORDER BY.
    if (query.sort === 'price_asc' || query.sort === 'price_desc') {
      return this.getProductsSortedByPrice(where, query.sort, page, limit);
    }

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: STOREFRONT_PRODUCT_INCLUDE,
      }),

      this.prisma.product.count({
        where,
      }),
    ]);

    return {
      data: await this.priceProducts(products),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Hard cap on how many products can participate in price sorting.
   *
   * Sorting by discounted price requires pricing every candidate before the page
   * can be selected, so the work is bounded deliberately. The catalogue is far
   * below this today; if it ever approaches it, denormalise a `minPrice` column
   * maintained on variant/discount writes and sort in SQL instead.
   */
  private static readonly PRICE_SORT_MAX_CANDIDATES = 1000;

  /**
   * The price that represents a product in listings.
   *
   * Defined as the LOWEST final price among variants a shopper could actually
   * buy (active, and either in stock or backorderable). This matches what the
   * card shows ("from X") and what the shopper expects when sorting low->high.
   *
   * Falls back to the lowest active variant price if nothing is purchasable, so
   * an entirely out-of-stock product still sorts sensibly instead of vanishing.
   */
  private representativePrice(product: {
    variants: { pricing: { finalPrice: number }; purchasable: boolean }[];
  }): number {
    return representativeListingPrice(product.variants);
  }

  private async getProductsSortedByPrice(
    where: Prisma.ProductWhereInput,
    sort: 'price_asc' | 'price_desc',
    page: number,
    limit: number,
  ) {
    const candidates = await this.prisma.product.findMany({
      where,
      include: STOREFRONT_PRODUCT_INCLUDE,
      take: StorefrontService.PRICE_SORT_MAX_CANDIDATES,
      orderBy: { createdAt: 'desc' },
    });

    const priced = await this.priceProducts(candidates);

    const sorted = priced.sort((a, b) => compareByListingPrice(a, b, sort));

    const total = sorted.length;
    const start = (page - 1) * limit;

    return {
      data: sorted.slice(start, start + limit),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getFeaturedProducts() {
    const products = await this.prisma.product.findMany({
      where: {
        isActive: true,
        isFeatured: true,
      },
      include: STOREFRONT_PRODUCT_INCLUDE,
      take: 12,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return this.priceProducts(products);
  }

async getProductBySlug(slug: string) {
  const product = await this.prisma.product.findFirst({
    where: {
      slug,
      isActive: true,
    },
    include: {
      ...STOREFRONT_PRODUCT_INCLUDE,
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

  const [priced] = await this.priceProducts([product]);

  return {
    ...priced,
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

  /**
   * Prices a client-held cart (the storefront keeps quantities locally for
   * instant UX, but never computes money itself).
   *
   * Returns the same numbers checkout will produce, so the cart preview can
   * never advertise a price the order won't honour. Unknown or inactive
   * variants are reported rather than silently dropped, so the UI can tell the
   * shopper why a line disappeared.
   */
  async priceCart(dto: PriceCartDto) {
    if (!dto.items.length) {
      return {
        items: [],
        unavailable: [],
        summary: {
          itemsCount: 0,
          regularSubtotal: 0,
          discountTotal: 0,
          subtotal: 0,
          hasBackorderedItems: false,
        },
      };
    }

    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: dto.items.map((i) => i.variantId) } },
      include: {
        product: {
          include: {
            productCategories: { select: { categoryId: true } },
            images: { include: { file: true }, orderBy: { sortOrder: 'asc' }, take: 1 },
          },
        },
      },
    });

    const byId = new Map(variants.map((v) => [v.id, v]));

    const unavailable = dto.items
      .filter((i) => {
        const v = byId.get(i.variantId);
        return !v || !v.isActive || !v.product.isActive;
      })
      .map((i) => i.variantId);

    const usable = dto.items.filter((i) => !unavailable.includes(i.variantId));

    // minOrderAmount is judged against the undiscounted subtotal, matching
    // CartService and checkout.
    const regularSubtotal = usable.reduce((acc, i) => {
      const v = byId.get(i.variantId)!;
      return acc + Number(v.price) * i.quantity;
    }, 0);

    const discounts = await this.discountsRepository.findActiveForPricing();

    const items = usable.map((line) => {
      const v = byId.get(line.variantId)!;

      const pricing = this.pricing.price(
        {
          variantId: v.id,
          productId: v.productId,
          categoryIds: v.product.productCategories.map((pc) => pc.categoryId),
          price: Number(v.price),
        },
        discounts,
        { orderSubtotal: regularSubtotal },
      );

      const available = Math.max(0, v.stock);
      const backorderQuantity = Math.max(0, line.quantity - available);

      return {
        variantId: v.id,
        productId: v.productId,
        quantity: line.quantity,

        productName: v.product.name,
        productSlug: v.product.slug,
        variantName: v.name,
        image: v.product.images[0]?.file ?? null,

        pricing,
        lineTotal: Number((pricing.finalPrice * line.quantity).toFixed(2)),

        stock: v.stock,
        inStock: v.stock > 0,
        allowBackorder: v.allowBackorder,
        isBackorder: backorderQuantity > 0,
        backorderQuantity,
        backorderMessage: backorderQuantity > 0 ? v.backorderMessage : null,
        availabilityDate: backorderQuantity > 0 ? v.availabilityDate : null,
        // False when stock is short AND backorder is off: the UI must block checkout.
        purchasable: v.stock >= line.quantity || v.allowBackorder,
      };
    });

    const subtotal = Number(items.reduce((a, i) => a + i.lineTotal, 0).toFixed(2));
    const discountTotal = Number(
      items.reduce((a, i) => a + i.pricing.discountAmount * i.quantity, 0).toFixed(2),
    );

    return {
      items,
      unavailable,
      summary: {
        itemsCount: items.length,
        regularSubtotal: Number(regularSubtotal.toFixed(2)),
        discountTotal,
        subtotal,
        hasBackorderedItems: items.some((i) => i.isBackorder),
      },
    };
  }

  /**
   * Prices a known set of products.
   *
   * Backs the wishlist and recently-viewed lists, which are stored client-side
   * with a cached price. Returning live pricing means a wishlisted item that
   * has gone on sale actually shows the sale price - which is the whole point
   * of the wishlist.
   *
   * Inactive/missing products are simply omitted; the client renders whatever
   * comes back rather than trusting its own copy.
   */
  async priceProductsByIds(dto: PriceProductsDto) {
    if (!dto.productIds.length) return [];

    const products = await this.prisma.product.findMany({
      where: { id: { in: dto.productIds }, isActive: true },
      include: STOREFRONT_PRODUCT_INCLUDE,
    });

    return this.priceProducts(products);
  }
}
