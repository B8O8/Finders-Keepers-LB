import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}