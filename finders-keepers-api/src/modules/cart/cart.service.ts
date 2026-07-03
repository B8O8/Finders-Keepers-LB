import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

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

    const items = cart.items.map((item) => {
      const price = Number(item.variant.price);
      const total = price * item.quantity;

      return {
        id: item.id,
        quantity: item.quantity,
        total,

        variant: {
          id: item.variant.id,
          name: item.variant.name,
          sku: item.variant.sku,
          price,
          stock: item.variant.stock,
        },

        product: {
          id: item.variant.product.id,
          name: item.variant.product.name,
          slug: item.variant.product.slug,
          images: item.variant.product.images,
        },
      };
    });

    const subtotal = items.reduce(
      (acc, item) => acc + item.total,
      0,
    );

    return {
      id: cart.id,
      customerId: cart.customerId,
      guestToken: cart.guestToken,

      items,

      summary: {
        itemsCount: items.length,
        subtotal,
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

    if (variant.stock < dto.quantity) {
      throw new BadRequestException(
        'Not enough stock available',
      );
    }

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

      if (variant.stock < newQuantity) {
        throw new BadRequestException(
          'Not enough stock available',
        );
      }

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

    if (item.variant.stock < dto.quantity) {
      throw new BadRequestException(
        'Not enough stock available',
      );
    }

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