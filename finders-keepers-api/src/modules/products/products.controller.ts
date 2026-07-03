import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';

import { CurrentAdmin } from '../../common/decorators/current-admin.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

import { CreateProductDto } from './dto/create-product.dto';
import { GetProductsDto } from './dto/get-products.dto';
import { ReorderProductImagesDto } from './dto/reorder-product-images.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll(@Query() query: GetProductsDto) {
    return this.productsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @Post()
  create(@Body() dto: CreateProductDto, @CurrentAdmin() admin: any) {
    return this.productsService.create(dto, admin.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @CurrentAdmin() admin: any,
  ) {
    return this.productsService.update(id, dto, admin.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @Post(':id/images/:fileId')
  addImage(
    @Param('id') id: string,
    @Param('fileId') fileId: string,
    @CurrentAdmin() admin: any,
  ) {
    return this.productsService.addImage(id, fileId, admin.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @Patch(':id/images/:imageId/primary')
  setPrimaryImage(
    @Param('id') id: string,
    @Param('imageId') imageId: string,
    @CurrentAdmin() admin: any,
  ) {
    return this.productsService.setPrimaryImage(id, imageId, admin.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @Patch(':id/images/reorder')
  reorderImages(
    @Param('id') id: string,
    @Body() dto: ReorderProductImagesDto,
    @CurrentAdmin() admin: any,
  ) {
    return this.productsService.reorderImages(id, dto, admin.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @Delete(':id/images/:imageId')
  removeImage(
    @Param('id') id: string,
    @Param('imageId') imageId: string,
    @CurrentAdmin() admin: any,
  ) {
    return this.productsService.removeImage(id, imageId, admin.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @Patch(':id/images/:imageId/variant')
  assignImageToVariant(
    @Param('id') id: string,
    @Param('imageId') imageId: string,
    @Body() body: { variantId: string | null },
    @CurrentAdmin() admin: any,
  ) {
    return this.productsService.assignImageToVariant(id, imageId, body.variantId, admin.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN)
  @Delete(':id')
  delete(@Param('id') id: string, @CurrentAdmin() admin: any) {
    return this.productsService.delete(id, admin.id);
  }
}
