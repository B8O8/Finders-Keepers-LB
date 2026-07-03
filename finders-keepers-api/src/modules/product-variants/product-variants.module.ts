import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
import { ProductVariantsController } from './product-variants.controller';
import { ProductVariantsService } from './product-variants.service';

@Module({
  imports: [JwtModule.register({}), ActivityLogsModule],
  controllers: [ProductVariantsController],
  providers: [ProductVariantsService],
  exports: [ProductVariantsService],
})
export class ProductVariantsModule {}