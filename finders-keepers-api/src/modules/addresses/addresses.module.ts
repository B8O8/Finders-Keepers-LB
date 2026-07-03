import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
import { AddressesController } from './addresses.controller';
import { AddressesService } from './addresses.service';

@Module({
  imports: [JwtModule.register({}), ActivityLogsModule],
  controllers: [AddressesController],
  providers: [AddressesService],
})
export class AddressesModule {}