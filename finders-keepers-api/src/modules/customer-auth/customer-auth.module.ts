import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { CustomerAuthController } from './customer-auth.controller';
import { CustomerAuthService } from './customer-auth.service';

import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    JwtModule.register({}),
    MailModule,
  ],

  controllers: [CustomerAuthController],

  providers: [CustomerAuthService],
})
export class CustomerAuthModule {}