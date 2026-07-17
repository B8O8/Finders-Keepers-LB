import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { DiscountsRepository } from '../discounts/discounts.repository';
import { PricingService } from '../discounts/pricing.service';
import { isPurchasable } from '../orders/backorder.util';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly discountsRepository: DiscountsRepository,
  ) {}

  /**
   * Availability rule shared by add/update.
   *
   * Out-of-stock items stay orderable only when the variant explicitly opts in
   * via allowBackorder. Without it, the original strict stock check applies
   * unchanged, so existing in-stock behaviour is untouched.
   */
  private assertAvailable(
    variant: { stock: number; allowBackorder: boolean },
    productName: string,
    quantity: number,
  ) {
    if (isPurchasable(variant.stock, quantity, variant.allowBackorder)) return;

    throw new BadRequestException(
      `Not enough stock available for ${productName}`,
    );
  }

  private async getOrCreateCart(
    customerId?: string,
    guestToken?: string,
  ) {
    if (!customerId && !guestToken) {
      throw new BadRequestException(
        'Customer or guest token is required',
      );
    }

    let cart = await this.prisma.cart.findFirst({
      where: customerId
        ? { customerId }
        : { guestToken },
    });

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: {
          customerId,
          guestToken,
        },
      });
    }

    return cart;
  }

  private async buildCartResponse(cartId: string) {
    const cart = await this.prisma.cart.findUnique({
      where: { id: cartId },
      include: {
        items: {
          include: {
            variant: {
              include: {
                product: {
                  include: {
                    productCategories: { select: { categoryId: true } },
                    images: {
                      include: {
                        file: true,
                      },
                      orderBy: {
                        sortOrder: 'asc',
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    // Discounts carrying a minOrderAmount are judged against the undiscounted
    // subtotal, so eligibility cannot depend on its own outcome.
    const regularSubtotal = cart.items.reduce(
      (acc, item) => acc + Number(item.variant.price) * item.quantity,
      0,
    );

    const discounts = await this.discountsRepository.findActiveForPricing();

    const items = cart.items.map((item) => {
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

      const availableStock = Math.max(0, item.variant.stock);
      const backorderQuantity = Math.max(0, item.quantity - availableStock);
      const isBackorder = backorderQuantity > 0;

      return {
        id: item.id,
        quantity: item.quantity,
        total: Number((priced.finalPrice * item.quantity).toFixed(2)),

        pricing: priced,

        // Backorder context so the cart and checkout can say so plainly.
        isBackorder,
        backorderQuantity,
        backorderMessage: isBackorder ? item.variant.backorderMessage : null,
        availabilityDate: isBackorder ? item.variant.availabilityDate : null,

        variant: {
          id: item.variant.id,
          name: item.variant.name,
          sku: item.variant.sku,
          price: priced.regularPrice,
          finalPrice: priced.finalPrice,
          stock: item.variant.stock,
          allowBackorder: item.variant.allowBackorder,
        },

        product: {
          id: item.variant.product.id,
          name: item.variant.product.name,
          slug: item.variant.product.slug,
          images: item.variant.product.images,
        },
      };
    });

    const subtotal = Number(
      items.reduce((acc, item) => acc + item.total, 0).toFixed(2),
    );

    const discountTotal = Number(
      items
        .reduce(
          (acc, item) => acc + item.pricing.discountAmount * item.quantity,
          0,
        )
        .toFixed(2),
    );

    return {
      id: cart.id,
      customerId: cart.customerId,
      guestToken: cart.guestToken,

      items,

      summary: {
        itemsCount: items.length,
        regularSubtotal: Number(regularSubtotal.toFixed(2)),
        discountTotal,
        subtotal,
        hasBackorderedItems: items.some((i) => i.isBackorder),
      },

      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt,
    };
  }

  async getCart(customerId?: string, guestToken?: string) {
    const cart = await this.getOrCreateCart(
      customerId,
      guestToken,
    );

    return this.buildCartResponse(cart.id);
  }

  async addItem(
    dto: AddCartItemDto,
    customerId?: string,
  ) {
    const variant = await this.prisma.productVariant.findUnique({
      where: {
        id: dto.variantId,
      },
      include: {
        product: true,
      },
    });

    if (!variant || !variant.isActive) {
      throw new NotFoundException('Product variant not found');
    }

    if (!variant.product.isActive) {
      throw new BadRequestException(
        'Product is inactive',
      );
    }

    this.assertAvailable(variant, variant.product.name, dto.quantity);

    const cart = await this.getOrCreateCart(
      customerId,
      dto.guestToken,
    );

    const existingItem = await this.prisma.cartItem.findFirst({
      where: {
        cartId: cart.id,
        variantId: dto.variantId,
      },
    });

    if (existingItem) {
      const newQuantity =
        existingItem.quantity + dto.quantity;

      this.assertAvailable(variant, variant.product.name, newQuantity);

      await this.prisma.cartItem.update({
        where: {
          id: existingItem.id,
        },
        data: {
          quantity: newQuantity,
        },
      });
    } else {
      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          variantId: dto.variantId,
          quantity: dto.quantity,
        },
      });
    }

    return this.buildCartResponse(cart.id);
  }

  async updateItem(
    itemId: string,
    dto: UpdateCartItemDto,
    customerId?: string,
    guestToken?: string,
  ) {
    const item = await this.prisma.cartItem.findUnique({
      where: {
        id: itemId,
      },
      include: {
        cart: true,
        variant: true,
      },
    });

    if (!item) {
      throw new NotFoundException('Cart item not found');
    }

    const hasAccess =
      (customerId &&
        item.cart.customerId === customerId) ||
      (guestToken &&
        item.cart.guestToken === guestToken);

    if (!hasAccess) {
      throw new BadRequestException(
        'Cart item does not belong to you',
      );
    }

    this.assertAvailable(item.variant, 'this item', dto.quantity);

    await this.prisma.cartItem.update({
      where: {
        id: itemId,
      },
      data: {
        quantity: dto.quantity,
      },
    });

    return this.buildCartResponse(item.cartId);
  }

  async removeItem(
    itemId: string,
    customerId?: string,
    guestToken?: string,
  ) {
    const item = await this.prisma.cartItem.findUnique({
      where: {
        id: itemId,
      },
      include: {
        cart: true,
      },
    });

    if (!item) {
      throw new NotFoundException('Cart item not found');
    }

    const hasAccess =
      (customerId &&
        item.cart.customerId === customerId) ||
      (guestToken &&
        item.cart.guestToken === guestToken);

    if (!hasAccess) {
      throw new BadRequestException(
        'Cart item does not belong to you',
      );
    }

    await this.prisma.cartItem.delete({
      where: {
        id: itemId,
      },
    });

    return this.buildCartResponse(item.cartId);
  }

  async clearCart(
    customerId?: string,
    guestToken?: string,
  ) {
    const cart = await this.getOrCreateCart(
      customerId,
      guestToken,
    );

    await this.prisma.cartItem.deleteMany({
      where: {
        cartId: cart.id,
      },
    });

    return {
      message: 'Cart cleared successfully',
    };
  }
}