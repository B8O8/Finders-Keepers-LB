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
import { AddressesService } from './addresses.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@ApiTags('Addresses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('addresses')
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Post()
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.MANAGER)
  create(@Body() dto: CreateAddressDto, @CurrentAdmin() admin: any) {
    return this.addressesService.create(dto, admin.id);
  }

  @Get()
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.MANAGER)
  findAll() {
    return this.addressesService.findAll();
  }

  @Get('customer/:customerId')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.MANAGER)
  findByCustomer(@Param('customerId') customerId: string) {
    return this.addressesService.findByCustomer(customerId);
  }

  @Get(':id')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.MANAGER)
  findOne(@Param('id') id: string) {
    return this.addressesService.findOne(id);
  }

  @Patch(':id')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.MANAGER)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAddressDto,
    @CurrentAdmin() admin: any,
  ) {
    return this.addressesService.update(id, dto, admin.id);
  }

  @Delete(':id')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  delete(@Param('id') id: string, @CurrentAdmin() admin: any) {
    return this.addressesService.delete(id, admin.id);
  }
}