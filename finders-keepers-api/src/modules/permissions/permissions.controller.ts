import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsService } from './permissions.service';
import { PermissionKey } from './permission.constants';

class UpdatePermissionsDto {
  updates: { role: AdminRole; permission: PermissionKey; allowed: boolean }[];
}

@ApiTags('Permissions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  @Roles(AdminRole.SUPER_ADMIN)
  getAll() {
    return this.permissionsService.getAll();
  }

  @Get('keys')
  @Roles(AdminRole.SUPER_ADMIN)
  getKeys() {
    return this.permissionsService.getAllPermissionKeys();
  }

  @Put()
  @Roles(AdminRole.SUPER_ADMIN)
  update(@Body() dto: UpdatePermissionsDto) {
    return this.permissionsService.update(dto.updates);
  }
}
