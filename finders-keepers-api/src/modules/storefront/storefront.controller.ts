import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GetStorefrontProductsDto } from './dto/get-storefront-products.dto';
import { StorefrontService } from './storefront.service';

@ApiTags('Storefront')
@Controller('storefront')
export class StorefrontController {
  constructor(private readonly storefrontService: StorefrontService) {}

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