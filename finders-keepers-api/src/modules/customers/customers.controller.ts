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
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

import { CreateCustomerDto } from './dto/create-customer.dto';
import { GetCustomersDto } from './dto/get-customers.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomersService } from './customers.service';

@ApiTags('Customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.MANAGER)
  create(@Body() dto: CreateCustomerDto, @CurrentAdmin() admin: any) {
    return this.customersService.create(dto, admin.id);
  }

  @Get()
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.MANAGER)
  findAll(@Query() query: GetCustomersDto) {
    return this.customersService.findAll(query);
  }

  @Get(':id')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.MANAGER)
  findOne(@Param('id') id: string) {
    return this.customersService.findOne(id);
  }

  @Patch(':id')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.MANAGER)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
    @CurrentAdmin() admin: any,
  ) {
    return this.customersService.update(id, dto, admin.id);
  }

  @Patch(':id/deactivate')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  deactivate(@Param('id') id: string, @CurrentAdmin() admin: any) {
    return this.customersService.deactivate(id, admin.id);
  }

  @Patch(':id/activate')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  activate(@Param('id') id: string, @CurrentAdmin() admin: any) {
    return this.customersService.activate(id, admin.id);
  }
}