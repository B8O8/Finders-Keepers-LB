import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [JwtModule.register({}), ActivityLogsModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}