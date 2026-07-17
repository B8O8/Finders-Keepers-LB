import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { GetStorefrontProductsDto } from './dto/get-storefront-products.dto';
import { PriceCartDto } from './dto/price-cart.dto';
import { PriceProductsDto } from './dto/price-products.dto';
import { StorefrontService } from './storefront.service';

@ApiTags('Storefront')
@Controller('storefront')
export class StorefrontController {
  constructor(private readonly storefrontService: StorefrontService) {}

  /**
   * Public: prices a client-held cart. Read-only - it stores nothing and is a
   * POST purely because the cart is sent in the body.
   */
  @Post('price-cart')
  @HttpCode(200)
  @ApiOperation({ summary: 'Server-side pricing for the local cart / cart preview' })
  priceCart(@Body() dto: PriceCartDto) {
    return this.storefrontService.priceCart(dto);
  }

  /** Public: live prices for wishlist / recently-viewed lists. */
  @Post('price-products')
  @HttpCode(200)
  @ApiOperation({ summary: 'Server-side pricing for a known set of products' })
  priceProducts(@Body() dto: PriceProductsDto) {
    return this.storefrontService.priceProductsByIds(dto);
  }

  @Get('categories')
  getCategories() {
    return this.storefrontService.getCategories();
  }

  @Get('categories/tree')
  getCategoryTree() {
    return this.storefrontService.getCategoryTree();
  }

  @Get('products')
  getProducts(@Query() query: GetStorefrontProductsDto) {
    return this.storefrontService.getProducts(query);
  }

  @Get('products/featured')
  getFeaturedProducts() {
    return this.storefrontService.getFeaturedProducts();
  }

  @Get('products/:slug')
  getProductBySlug(@Param('slug') slug: string) {
    return this.storefrontService.getProductBySlug(slug);
  }

  @Get('categories/:slug/products')
  getProductsByCategory(
    @Param('slug') slug: string,
    @Query() query: GetStorefrontProductsDto,
  ) {
    return this.storefrontService.getProductsByCategorySlug(
      slug,
      query,
    );
  }
}