import {
  Body,
  Controller,
  Get,
  Headers,
  Patch,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentCustomer } from '../../common/decorators/current-customer.decorator';
import { CustomerJwtAuthGuard } from '../../common/guards/customer-jwt-auth.guard';

import { CustomerAuthService } from './customer-auth.service';

import { ChangeCustomerPasswordDto } from './dto/change-customer-password.dto';
import { CustomerLoginDto } from './dto/customer-login.dto';
import { CustomerSignupDto } from './dto/customer-signup.dto';
import { ForgotCustomerPasswordDto } from './dto/forgot-customer-password.dto';
import { ResetCustomerPasswordDto } from './dto/reset-customer-password.dto';
import { UpdateCustomerProfileDto } from './dto/update-customer-profile.dto';

@ApiTags('Customer Auth')
@Controller('customer-auth')
export class CustomerAuthController {
  constructor(private readonly customerAuthService: CustomerAuthService) {}

  @Post('signup')
  signup(@Body() dto: CustomerSignupDto) {
    return this.customerAuthService.signup(dto);
  }

  @Post('login')
  login(@Body() dto: CustomerLoginDto) {
    return this.customerAuthService.login(dto);
  }

  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotCustomerPasswordDto) {
    return this.customerAuthService.forgotPassword(dto);
  }

  @Post('reset-password')
  resetPassword(@Body() dto: ResetCustomerPasswordDto) {
    return this.customerAuthService.resetPassword(dto);
  }

  @Post('refresh')
  refresh(@Headers('authorization') authorization: string) {
    if (!authorization || !authorization.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing refresh token');
    }

    const refreshToken = authorization.split(' ')[1];

    const decoded = JSON.parse(
      Buffer.from(refreshToken.split('.')[1], 'base64').toString(),
    );

    return this.customerAuthService.refresh(decoded.sub, refreshToken);
  }

  @ApiBearerAuth()
  @UseGuards(CustomerJwtAuthGuard)
  @Post('logout')
  logout(@CurrentCustomer() customer: any) {
    return this.customerAuthService.logout(customer.accountId);
  }

  @ApiBearerAuth()
  @UseGuards(CustomerJwtAuthGuard)
  @Get('me')
  me(@CurrentCustomer() customer: any) {
    return customer;
  }

  @ApiBearerAuth()
  @UseGuards(CustomerJwtAuthGuard)
  @Patch('me')
  updateProfile(
    @CurrentCustomer() customer: any,
    @Body() dto: UpdateCustomerProfileDto,
  ) {
    return this.customerAuthService.updateProfile(customer.customerId, dto);
  }

  @ApiBearerAuth()
  @UseGuards(CustomerJwtAuthGuard)
  @Patch('me/password')
  changePassword(
    @CurrentCustomer() customer: any,
    @Body() dto: ChangeCustomerPasswordDto,
  ) {
    return this.customerAuthService.changePassword(customer.accountId, dto);
  }
}