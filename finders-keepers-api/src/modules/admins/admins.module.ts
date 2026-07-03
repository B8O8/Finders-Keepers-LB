import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
import { AdminsController } from './admins.controller';
import { AdminsService } from './admins.service';

@Module({
  imports: [JwtModule.register({}), ActivityLogsModule],
  controllers: [AdminsController],
  providers: [AdminsService],
})
export class AdminsModule {}