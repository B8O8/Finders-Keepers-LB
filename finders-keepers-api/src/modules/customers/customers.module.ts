import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';

@Module({
  imports: [JwtModule.register({}), ActivityLogsModule],
  controllers: [CustomersController],
  providers: [CustomersService],
})
export class CustomersModule {}