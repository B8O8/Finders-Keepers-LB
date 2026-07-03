import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CustomerAddressesController } from './customer-addresses.controller';
import { CustomerAddressesService } from './customer-addresses.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [CustomerAddressesController],
  providers: [CustomerAddressesService],
})
export class CustomerAddressesModule {}