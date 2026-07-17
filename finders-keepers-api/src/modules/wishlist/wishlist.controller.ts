import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentCustomer } from '../../common/decorators/current-customer.decorator';
import { CustomerJwtAuthGuard } from '../../common/guards/customer-jwt-auth.guard';
import { AddWishlistItemDto } from './dto/add-wishlist-item.dto';
import { MergeWishlistDto } from './dto/merge-wishlist.dto';
import { WishlistService } from './wishlist.service';

/**
 * Customer-scoped. Guests keep using the local (device) wishlist and merge it
 * into their account on login via POST /wishlist/merge.
 */
@ApiTags('Wishlist')
@ApiBearerAuth()
@UseGuards(CustomerJwtAuthGuard)
@Controller('wishlist')
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get()
  findAll(@CurrentCustomer() customer: any) {
    return this.wishlistService.findAll(customer.customerId);
  }

  @Post()
  add(@CurrentCustomer() customer: any, @Body() dto: AddWishlistItemDto) {
    return this.wishlistService.add(customer.customerId, dto);
  }

  @Post('merge')
  @ApiOperation({ summary: 'Merge a guest device wishlist into the account' })
  merge(@CurrentCustomer() customer: any, @Body() dto: MergeWishlistDto) {
    return this.wishlistService.merge(customer.customerId, dto);
  }

  @Delete('item/:id')
  removeById(@CurrentCustomer() customer: any, @Param('id') id: string) {
    return this.wishlistService.removeById(customer.customerId, id);
  }

  @Delete('product/:productId')
  remove(
    @CurrentCustomer() customer: any,
    @Param('productId') productId: string,
    @Query('variantId') variantId?: string,
  ) {
    return this.wishlistService.remove(customer.customerId, productId, variantId);
  }

  @Delete()
  clear(@CurrentCustomer() customer: any) {
    return this.wishlistService.clear(customer.customerId);
  }
}
