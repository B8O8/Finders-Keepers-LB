import {
  Body,
  Controller,
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
import { CurrentCustomer } from '../../common/decorators/current-customer.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

import { CustomerJwtAuthGuard } from '../../common/guards/customer-jwt-auth.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

import { CheckoutDto } from './dto/checkout.dto';
import { GetOrdersDto } from './dto/get-orders.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto';

import { OrdersService } from './orders.service';

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('checkout/guest')
  guestCheckout(@Body() dto: CheckoutDto) {
    return this.ordersService.checkout(dto);
  }

  @ApiBearerAuth()
  @UseGuards(CustomerJwtAuthGuard)
  @Post('checkout/me')
  customerCheckout(
    @Body() dto: CheckoutDto,
    @CurrentCustomer() customer: any,
  ) {
    return this.ordersService.checkout(dto, customer.customerId);
  }

  @ApiBearerAuth()
  @UseGuards(CustomerJwtAuthGuard)
  @Get('me')
  myOrders(@CurrentCustomer() customer: any) {
    return this.ordersService.findByCustomer(customer.customerId);
  }

  @ApiBearerAuth()
  @UseGuards(CustomerJwtAuthGuard)
  @Get('me/:id')
  myOrder(
    @Param('id') id: string,
    @CurrentCustomer() customer: any,
  ) {
    return this.ordersService.findOneForCustomer(
      id,
      customer.customerId,
    );
  }

  @ApiBearerAuth()
  @UseGuards(CustomerJwtAuthGuard)
  @Patch('me/:id/cancel')
  cancelMyOrder(
    @Param('id') id: string,
    @CurrentCustomer() customer: any,
  ) {
    return this.ordersService.cancelOrderForCustomer(
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
  findAll(@Query() query: GetOrdersDto) {
    return this.ordersService.findAll(query);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    AdminRole.SUPER_ADMIN,
    AdminRole.ADMIN,
    AdminRole.MANAGER,
  )
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentAdmin() admin: any,
  ) {
    return this.ordersService.updateStatus(
      id,
      dto.status,
      admin.id,
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @Patch(':id/payment-status')
  updatePaymentStatus(
    @Param('id') id: string,
    @Body() dto: UpdatePaymentStatusDto,
    @CurrentAdmin() admin: any,
  ) {
    return this.ordersService.updatePaymentStatus(
      id,
      dto.paymentStatus,
      admin.id,
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @Patch(':id/cancel')
  cancelOrder(
    @Param('id') id: string,
    @CurrentAdmin() admin: any,
  ) {
    return this.ordersService.cancelOrder(
      id,
      admin.id,
    );
  }
}