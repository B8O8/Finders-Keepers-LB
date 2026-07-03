import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ActivityLogsService } from './activity-logs.service';
import { GetActivityLogsDto } from './dto/get-activity-logs.dto';

@ApiTags('Activity Logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('activity-logs')
export class ActivityLogsController {
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  @Get()
  @Roles(AdminRole.SUPER_ADMIN)
  findAll(@Query() query: GetActivityLogsDto) {
    return this.activityLogsService.findAll(query);
  }

  @Get('meta/entities')
  @Roles(AdminRole.SUPER_ADMIN)
  getEntities() {
    return this.activityLogsService.getDistinctEntities();
  }

  @Get('meta/actions')
  @Roles(AdminRole.SUPER_ADMIN)
  getActions() {
    return this.activityLogsService.getDistinctActions();
  }
}
