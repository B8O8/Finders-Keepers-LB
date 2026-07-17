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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';

import { CurrentAdmin } from '../../common/decorators/current-admin.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

import { DiscountsService } from './discounts.service';
import { CreateDiscountDto } from './dto/create-discount.dto';
import { GetDiscountsDto } from './dto/get-discounts.dto';
import { UpdateDiscountDto } from './dto/update-discount.dto';

/**
 * Admin-only. The storefront never reads discounts directly: it receives
 * already-computed prices from the storefront/cart endpoints, so promotional
 * configuration is never exposed publicly.
 */
@ApiTags('Discounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('discounts')
export class DiscountsController {
  constructor(private readonly discountsService: DiscountsService) {}

  @Get()
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.MANAGER)
  @ApiOperation({ summary: 'List discounts with search, status and date filters' })
  findAll(@Query() query: GetDiscountsDto) {
    return this.discountsService.findAll(query);
  }

  @Get(':id')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.MANAGER)
  findOne(@Param('id') id: string) {
    return this.discountsService.findOne(id);
  }

  @Get(':id/preview')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.MANAGER)
  @ApiOperation({
    summary:
      'Preview affected products/variants and estimated wishlist notifications',
  })
  preview(@Param('id') id: string) {
    return this.discountsService.preview(id);
  }

  @Post()
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  create(@Body() dto: CreateDiscountDto, @CurrentAdmin() admin: any) {
    return this.discountsService.create(dto, admin.id);
  }

  @Patch(':id')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDiscountDto,
    @CurrentAdmin() admin: any,
  ) {
    return this.discountsService.update(id, dto, admin.id);
  }

  @Patch(':id/activate')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  activate(@Param('id') id: string, @CurrentAdmin() admin: any) {
    return this.discountsService.setActive(id, true, admin.id);
  }

  @Patch(':id/deactivate')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  deactivate(@Param('id') id: string, @CurrentAdmin() admin: any) {
    return this.discountsService.setActive(id, false, admin.id);
  }

  @Patch(':id/restore')
  @Roles(AdminRole.SUPER_ADMIN)
  restore(@Param('id') id: string, @CurrentAdmin() admin: any) {
    return this.discountsService.restore(id, admin.id);
  }

  /** Archive (soft delete) - history is preserved for audit. */
  @Delete(':id')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  archive(@Param('id') id: string, @CurrentAdmin() admin: any) {
    return this.discountsService.archive(id, admin.id);
  }
}
