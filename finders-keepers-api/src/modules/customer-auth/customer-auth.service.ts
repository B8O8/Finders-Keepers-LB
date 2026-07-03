import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';

import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

import { PrismaService } from '../../database/prisma.service';
import { MailService } from '../mail/mail.service';

import { ChangeCustomerPasswordDto } from './dto/change-customer-password.dto';
import { CustomerLoginDto } from './dto/customer-login.dto';
import { CustomerSignupDto } from './dto/customer-signup.dto';
import { ForgotCustomerPasswordDto } from './dto/forgot-customer-password.dto';
import { ResetCustomerPasswordDto } from './dto/reset-customer-password.dto';
import { UpdateCustomerProfileDto } from './dto/update-customer-profile.dto';

@Injectable()
export class CustomerAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  async signup(dto: CustomerSignupDto) {
    const email = dto.email.toLowerCase();

    const existingAccount = await this.prisma.customerAccount.findUnique({
      where: { email },
    });

    if (existingAccount) {
      throw new BadRequestException('Account with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const result = await this.prisma.$transaction(async (tx) => {
      let customer = await tx.customer.findUnique({
        where: { email },
      });

      if (!customer) {
        customer = await tx.customer.create({
          data: {
            email,
            firstName: dto.firstName,
            lastName: dto.lastName,
            phone: dto.phone,
          },
        });
      }

      const account = await tx.customerAccount.create({
        data: {
          customerId: customer.id,
          email,
          password: hashedPassword,
        },
      });

      return { customer, account };
    });

    const tokens = await this.generateTokens(
      result.account.id,
      result.customer.id,
      result.account.email,
    );

    await this.prisma.customerAccount.update({
      where: { id: result.account.id },
      data: {
        refreshToken: await bcrypt.hash(tokens.refreshToken, 10),
      },
    });

    return {
      customer: result.customer,
      account: {
        id: result.account.id,
        email: result.account.email,
        isVerified: result.account.isVerified,
      },
      ...tokens,
    };
  }

  async login(dto: CustomerLoginDto) {
    const email = dto.email.toLowerCase();

    const account = await this.prisma.customerAccount.findUnique({
      where: { email },
      include: {
        customer: {
          include: {
            addresses: true,
          },
        },
      },
    });

    if (!account || !account.customer.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, account.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(
      account.id,
      account.customerId,
      account.email,
    );

    await this.prisma.customerAccount.update({
      where: { id: account.id },
      data: {
        refreshToken: await bcrypt.hash(tokens.refreshToken, 10),
        lastLoginAt: new Date(),
      },
    });

    return {
      customer: account.customer,
      account: {
        id: account.id,
        email: account.email,
        isVerified: account.isVerified,
      },
      ...tokens,
    };
  }

  async forgotPassword(dto: ForgotCustomerPasswordDto) {
    const email = dto.email.toLowerCase();

    const account = await this.prisma.customerAccount.findUnique({
      where: { email },
      include: {
        customer: true,
      },
    });

    if (!account) {
      return {
        message: 'If an account exists, a reset email has been sent.',
      };
    }

    const rawToken = crypto.randomBytes(32).toString('hex');

    const hashedToken = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    const expiresAt = new Date(Date.now() + 1000 * 60 * 30);

    await this.prisma.customerAccount.update({
      where: { id: account.id },
      data: {
        passwordResetToken: hashedToken,
        passwordResetExpiresAt: expiresAt,
      },
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;

    const customerName =
      [account.customer.firstName, account.customer.lastName]
        .filter(Boolean)
        .join(' ') || undefined;

    await this.mailService.sendResetPasswordEmail(
      account.email,
      resetUrl,
      customerName,
    );

    return {
      message: 'If an account exists, a reset email has been sent.',
    };
  }

  async resetPassword(dto: ResetCustomerPasswordDto) {
    const hashedToken = crypto
      .createHash('sha256')
      .update(dto.token)
      .digest('hex');

    const account = await this.prisma.customerAccount.findFirst({
      where: {
        passwordResetToken: hashedToken,
        passwordResetExpiresAt: {
          gt: new Date(),
        },
      },
    });

    if (!account) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.customerAccount.update({
      where: { id: account.id },
      data: {
        password: hashedPassword,
        refreshToken: null,
        passwordResetToken: null,
        passwordResetExpiresAt: null,
      },
    });

    return {
      message: 'Password reset successfully. Please login.',
    };
  }

  async refresh(accountId: string, refreshToken: string) {
    const account = await this.prisma.customerAccount.findUnique({
      where: { id: accountId },
      include: {
        customer: true,
      },
    });

    if (!account || !account.refreshToken || !account.customer.isActive) {
      throw new UnauthorizedException('Access denied');
    }

    const isValid = await bcrypt.compare(refreshToken, account.refreshToken);

    if (!isValid) {
      throw new UnauthorizedException('Access denied');
    }

    const tokens = await this.generateTokens(
      account.id,
      account.customerId,
      account.email,
    );

    await this.prisma.customerAccount.update({
      where: { id: account.id },
      data: {
        refreshToken: await bcrypt.hash(tokens.refreshToken, 10),
      },
    });

    return tokens;
  }

  async logout(accountId: string) {
    await this.prisma.customerAccount.update({
      where: { id: accountId },
      data: {
        refreshToken: null,
      },
    });

    return {
      message: 'Logged out successfully',
    };
  }

  async updateProfile(customerId: string, dto: UpdateCustomerProfileDto) {
    const customer = await this.prisma.customer.update({
      where: { id: customerId },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
      },
      include: {
        addresses: true,
        account: {
          select: {
            id: true,
            email: true,
            isVerified: true,
            lastLoginAt: true,
          },
        },
      },
    });

    return { customer };
  }

  async changePassword(accountId: string, dto: ChangeCustomerPasswordDto) {
    const account = await this.prisma.customerAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new UnauthorizedException('Account not found');
    }

    const isPasswordValid = await bcrypt.compare(
      dto.currentPassword,
      account.password,
    );

    if (!isPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.customerAccount.update({
      where: { id: accountId },
      data: {
        password: hashedPassword,
        refreshToken: null,
        passwordResetToken: null,
        passwordResetExpiresAt: null,
      },
    });

    return {
      message: 'Password changed successfully. Please login again.',
    };
  }

  private async generateTokens(
    accountId: string,
    customerId: string,
    email: string,
  ) {
    const payload = {
      sub: accountId,
      customerId,
      email,
      type: 'customer',
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: process.env.CUSTOMER_JWT_SECRET || process.env.JWT_SECRET,
        expiresIn: '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret:
          process.env.CUSTOMER_JWT_REFRESH_SECRET ||
          process.env.JWT_REFRESH_SECRET,
        expiresIn: '30d',
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }
}