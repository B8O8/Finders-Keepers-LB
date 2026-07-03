import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogsService: ActivityLogsService,
  ) {}

  async getSettings() {
    const existing = await this.prisma.storeSettings.findFirst();

    if (existing) {
      return existing;
    }

    return this.prisma.storeSettings.create({
      data: {},
    });
  }

  async update(dto: UpdateSettingsDto, adminId?: string) {
    const settings = await this.getSettings();

    const updated = await this.prisma.storeSettings.update({
      where: { id: settings.id },
      data: dto,
    });

    await this.activityLogsService.create({
      adminId,
      action: 'STORE_SETTINGS_UPDATED',
      entity: 'StoreSettings',
      entityId: settings.id,
      metadata: dto,
    });

    return updated;
  }

  async getPublicSettings() {
    const settings = await this.getSettings();

    return {
      storeName: settings.storeName,
      currency: settings.currency,
      deliveryEnabled: settings.deliveryEnabled,
      defaultDeliveryFee: settings.defaultDeliveryFee,
      freeDeliveryThreshold: settings.freeDeliveryThreshold,
      whatsappNumber: settings.whatsappNumber,
      orderMinimumAmount: settings.orderMinimumAmount,
      maintenanceMode: settings.maintenanceMode,
    };
  }
}