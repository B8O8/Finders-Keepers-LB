import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';

import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { GetNotificationsDto } from './dto/get-notifications.dto';
import { NotificationsProcessor } from './notifications.processor';
import { NotificationsService } from './notifications.service';

/** Admin visibility into the wishlist-sale notification outbox. */
@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly processor: NotificationsProcessor,
  ) {}

  @Get()
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.MANAGER)
  @ApiOperation({ summary: 'List notifications (customers notified / pending / failed)' })
  findAll(@Query() query: GetNotificationsDto) {
    return this.notificationsService.findAll(query);
  }

  @Get('stats')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.MANAGER)
  stats(@Query('discountId') discountId?: string) {
    return this.notificationsService.stats(discountId);
  }

  @Post(':id/retry')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  retry(@Param('id') id: string) {
    return this.notificationsService.retry(id);
  }

  @Post('retry-failed')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @ApiOperation({ summary: 'Re-queue every failed notification (optionally per discount)' })
  retryAllFailed(@Body('discountId') discountId?: string) {
    return this.notificationsService.retryAllFailed(discountId);
  }

  /** Manual drain, useful for testing without waiting for the cron tick. */
  @Post('process')
  @Roles(AdminRole.SUPER_ADMIN)
  process() {
    return this.processor.processPending();
  }

  @Post('enqueue/:discountId')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @ApiOperation({ summary: 'Queue wishlist-sale notifications for a discount (idempotent)' })
  enqueue(@Param('discountId') discountId: string) {
    return this.notificationsService.enqueueForDiscount(discountId);
  }
}
