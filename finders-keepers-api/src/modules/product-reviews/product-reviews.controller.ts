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
import { CurrentCustomer } from '../../common/decorators/current-customer.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

import { CustomerJwtAuthGuard } from '../../common/guards/customer-jwt-auth.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

import { CreateProductReviewDto } from './dto/create-product-review.dto';
import { ModerateProductReviewDto } from './dto/moderate-product-review.dto';
import { UpdateProductReviewDto } from './dto/update-product-review.dto';

import { ProductReviewsService } from './product-reviews.service';

@ApiTags('Product Reviews')
@Controller('product-reviews')
export class ProductReviewsController {
  constructor(
    private readonly productReviewsService: ProductReviewsService,
  ) {}

  @Get('product/:productId')
  findProductReviews(
    @Param('productId') productId: string,
  ) {
    return this.productReviewsService.findProductReviews(
      productId,
    );
  }

  @ApiBearerAuth()
  @UseGuards(CustomerJwtAuthGuard)
  @Get('me')
  myReviews(
    @CurrentCustomer() customer: any,
  ) {
    return this.productReviewsService.findMyReviews(
      customer.customerId,
    );
  }

  @ApiBearerAuth()
  @UseGuards(CustomerJwtAuthGuard)
  @Post()
  create(
    @CurrentCustomer() customer: any,
    @Body() dto: CreateProductReviewDto,
  ) {
    return this.productReviewsService.create(
      customer.customerId,
      dto,
    );
  }

  @ApiBearerAuth()
  @UseGuards(CustomerJwtAuthGuard)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentCustomer() customer: any,
    @Body() dto: UpdateProductReviewDto,
  ) {
    return this.productReviewsService.update(
      id,
      customer.customerId,
      dto,
    );
  }

  @ApiBearerAuth()
  @UseGuards(CustomerJwtAuthGuard)
  @Delete(':id')
  delete(
    @Param('id') id: string,
    @CurrentCustomer() customer: any,
  ) {
    return this.productReviewsService.delete(
      id,
      customer.customerId,
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    AdminRole.SUPER_ADMIN,
    AdminRole.ADMIN,
    AdminRole.MANAGER,
  )
  @Get()
  adminFindAll() {
    return this.productReviewsService.adminFindAll();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    AdminRole.SUPER_ADMIN,
    AdminRole.ADMIN,
  )
  @Patch(':id/moderate')
  moderate(
    @Param('id') id: string,
    @Body() dto: ModerateProductReviewDto,
    @CurrentAdmin() admin: any,
  ) {
    return this.productReviewsService.moderate(
      id,
      dto,
      admin.id,
    );
  }
}