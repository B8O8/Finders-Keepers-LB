import {
  Body,
  Controller,
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
import { AdminsService } from './admins.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';

@ApiTags('Admins')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admins')
export class AdminsController {
  constructor(private readonly adminsService: AdminsService) {}

  @Get()
  @Roles(AdminRole.SUPER_ADMIN)
  findAll() {
    return this.adminsService.findAll();
  }

  @Post()
  @Roles(AdminRole.SUPER_ADMIN)
  create(@Body() createAdminDto: CreateAdminDto, @CurrentAdmin() admin: any) {
    return this.adminsService.create(createAdminDto, admin.id);
  }

  @Patch(':id/deactivate')
  @Roles(AdminRole.SUPER_ADMIN)
  deactivate(@Param('id') id: string, @CurrentAdmin() admin: any) {
    return this.adminsService.deactivate(id, admin.id);
  }

  @Patch(':id/activate')
  @Roles(AdminRole.SUPER_ADMIN)
  activate(@Param('id') id: string, @CurrentAdmin() admin: any) {
    return this.adminsService.activate(id, admin.id);
  }

  @Patch(':id')
  @Roles(AdminRole.SUPER_ADMIN)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAdminDto,
    @CurrentAdmin() admin: any,
  ) {
    return this.adminsService.update(id, dto, admin.id);
  }

}