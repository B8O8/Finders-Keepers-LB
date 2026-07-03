import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentCustomer } from '../../common/decorators/current-customer.decorator';
import { CustomerJwtAuthGuard } from '../../common/guards/customer-jwt-auth.guard';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { CartService } from './cart.service';

@ApiTags('Cart')
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  getCart(@Headers('x-guest-token') guestToken?: string) {
    return this.cartService.getCart(undefined, guestToken);
  }

  @ApiBearerAuth()
  @UseGuards(CustomerJwtAuthGuard)
  @Get('me')
  getCustomerCart(@CurrentCustomer() customer: any) {
    return this.cartService.getCart(customer.customerId);
  }

  @Post('items')
  addItem(@Body() dto: AddCartItemDto) {
    return this.cartService.addItem(dto);
  }

  @ApiBearerAuth()
  @UseGuards(CustomerJwtAuthGuard)
  @Post('me/items')
  addCustomerItem(
    @Body() dto: AddCartItemDto,
    @CurrentCustomer() customer: any,
  ) {
    return this.cartService.addItem(
      dto,
      customer.customerId,
    );
  }

  @Patch('items/:id')
  updateItem(
    @Param('id') id: string,
    @Body() dto: UpdateCartItemDto,
    @Headers('x-guest-token') guestToken?: string,
  ) {
    return this.cartService.updateItem(
      id,
      dto,
      undefined,
      guestToken,
    );
  }

  @ApiBearerAuth()
  @UseGuards(CustomerJwtAuthGuard)
  @Patch('me/items/:id')
  updateCustomerItem(
    @Param('id') id: string,
    @Body() dto: UpdateCartItemDto,
    @CurrentCustomer() customer: any,
  ) {
    return this.cartService.updateItem(
      id,
      dto,
      customer.customerId,
    );
  }

  @Delete('items/:id')
  removeItem(
    @Param('id') id: string,
    @Headers('x-guest-token') guestToken?: string,
  ) {
    return this.cartService.removeItem(
      id,
      undefined,
      guestToken,
    );
  }

  @ApiBearerAuth()
  @UseGuards(CustomerJwtAuthGuard)
  @Delete('me/items/:id')
  removeCustomerItem(
    @Param('id') id: string,
    @CurrentCustomer() customer: any,
  ) {
    return this.cartService.removeItem(
      id,
      customer.customerId,
    );
  }

  @Delete('clear')
  clearCart(
    @Headers('x-guest-token') guestToken?: string,
  ) {
    return this.cartService.clearCart(
      undefined,
      guestToken,
    );
  }

  @ApiBearerAuth()
  @UseGuards(CustomerJwtAuthGuard)
  @Delete('me/clear')
  clearCustomerCart(
    @CurrentCustomer() customer: any,
  ) {
    return this.cartService.clearCart(
      customer.customerId,
    );
  }
}