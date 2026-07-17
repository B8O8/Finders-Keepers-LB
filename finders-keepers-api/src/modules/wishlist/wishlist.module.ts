import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { WishlistController } from './wishlist.controller';
import { WishlistService } from './wishlist.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [WishlistController],
  providers: [WishlistService],
  exports: [WishlistService],
})
export class WishlistModule {}
