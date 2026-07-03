import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [JwtModule.register({}), ActivityLogsModule],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}