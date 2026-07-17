import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
import { DiscountsController } from './discounts.controller';
import { DiscountsRepository } from './discounts.repository';
import { DiscountsService } from './discounts.service';
import { PricingService } from './pricing.service';

/**
 * Global because pricing is cross-cutting: cart, orders, storefront and the
 * notification processor must all price through the same engine. Exporting it
 * from one place prevents a second, divergent price calculation appearing.
 */
@Global()
@Module({
  imports: [JwtModule.register({}), ActivityLogsModule],
  controllers: [DiscountsController],
  providers: [DiscountsService, DiscountsRepository, PricingService],
  exports: [DiscountsService, DiscountsRepository, PricingService],
})
export class DiscountsModule {}
