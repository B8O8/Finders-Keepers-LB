import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { CurrentAdmin } from '../../common/decorators/current-admin.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateProductVariantDto } from './dto/create-product-variant.dto';
import { UpdateProductVariantDto } from './dto/update-product-variant.dto';
import { UpdateVariantPriceDto } from './dto/update-variant-price.dto';
import { UpdateVariantStockDto } from './dto/update-variant-stock.dto';
import { ProductVariantsService } from './product-variants.service';

@ApiTags('Product Variants')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('product-variants')
export class ProductVariantsController {
  constructor(
    private readonly productVariantsService: ProductVariantsService,
  ) {}

  @Post()
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  create(@Body() dto: CreateProductVariantDto, @CurrentAdmin() admin: any) {
    return this.productVariantsService.create(dto, admin.id);
  }

  @Get()
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.MANAGER)
  findAll() {
    return this.productVariantsService.findAll();
  }

  @Get('product/:productId')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.MANAGER)
  findByProduct(@Param('productId') productId: string) {
    return this.productVariantsService.findByProduct(productId);
  }

  @Get(':id')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.MANAGER)
  findOne(@Param('id') id: string) {
    return this.productVariantsService.findOne(id);
  }

  @Patch(':id')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProductVariantDto,
    @CurrentAdmin() admin: any,
  ) {
    return this.productVariantsService.update(id, dto, admin.id);
  }

  @Patch(':id/stock')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  updateStock(
    @Param('id') id: string,
    @Body() dto: UpdateVariantStockDto,
    @CurrentAdmin() admin: any,
  ) {
    return this.productVariantsService.updateStock(id, dto, admin.id);
  }

  @Patch(':id/price')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  updatePrice(
    @Param('id') id: string,
    @Body() dto: UpdateVariantPriceDto,
    @CurrentAdmin() admin: any,
  ) {
    return this.productVariantsService.updatePrice(id, dto, admin.id);
  }

  @Patch(':id/set-default')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  setDefault(@Param('id') id: string, @CurrentAdmin() admin: any) {
    return this.productVariantsService.setDefault(id, admin.id);
  }

  @Delete(':id')
  @Roles(AdminRole.SUPER_ADMIN)
  delete(@Param('id') id: string, @CurrentAdmin() admin: any) {
    return this.productVariantsService.delete(id, admin.id);
  }
}