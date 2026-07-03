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
import { CurrentCustomer } from '../../common/decorators/current-customer.decorator';
import { CustomerJwtAuthGuard } from '../../common/guards/customer-jwt-auth.guard';
import { CustomerAddressesService } from './customer-addresses.service';
import { CreateCustomerAddressDto } from './dto/create-customer-address.dto';
import { UpdateCustomerAddressDto } from './dto/update-customer-address.dto';

@ApiTags('Customer Addresses')
@ApiBearerAuth()
@UseGuards(CustomerJwtAuthGuard)
@Controller('customer-addresses')
export class CustomerAddressesController {
  constructor(
    private readonly customerAddressesService: CustomerAddressesService,
  ) {}

  @Post()
  create(
    @CurrentCustomer() customer: any,
    @Body() dto: CreateCustomerAddressDto,
  ) {
    return this.customerAddressesService.create(customer.customerId, dto);
  }

  @Get()
  findAll(@CurrentCustomer() customer: any) {
    return this.customerAddressesService.findAll(customer.customerId);
  }

  @Get(':id')
  findOne(@CurrentCustomer() customer: any, @Param('id') id: string) {
    return this.customerAddressesService.findOne(customer.customerId, id);
  }

  @Patch(':id')
  update(
    @CurrentCustomer() customer: any,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerAddressDto,
  ) {
    return this.customerAddressesService.update(customer.customerId, id, dto);
  }

  @Delete(':id')
  delete(@CurrentCustomer() customer: any, @Param('id') id: string) {
    return this.customerAddressesService.delete(customer.customerId, id);
  }
}