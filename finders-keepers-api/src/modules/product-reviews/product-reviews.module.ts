import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { ActivityLogsModule } from '../activity-logs/activity-logs.module';

import { ProductReviewsController } from './product-reviews.controller';
import { ProductReviewsService } from './product-reviews.service';

@Module({
  imports: [JwtModule.register({}), ActivityLogsModule],
  controllers: [ProductReviewsController],
  providers: [ProductReviewsService],
})
export class ProductReviewsModule {}