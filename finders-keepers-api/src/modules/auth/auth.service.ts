import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly activityLogsService: ActivityLogsService,
  ) {}

  async login(loginDto: LoginDto, req?: Request) {
    const admin = await this.prisma.admin.findUnique({
      where: { email: loginDto.email.toLowerCase() },
    });

    if (!admin || !admin.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      admin.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(admin.id, admin.email, admin.role);

    await this.prisma.admin.update({
      where: { id: admin.id },
      data: {
        refreshToken: await bcrypt.hash(tokens.refreshToken, 10),
      },
    });

    await this.activityLogsService.create({
      adminId: admin.id,
      action: 'ADMIN_LOGIN',
      entity: 'Admin',
      entityId: admin.id,
      ipAddress: req?.ip,
      userAgent: req?.headers['user-agent'],
    });

    return {
      admin: {
        id: admin.id,
        email: admin.email,
        fullName: admin.fullName,
        role: admin.role,
      },
      ...tokens,
    };
  }

  async refresh(adminId: string, refreshToken: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
    });

    if (!admin || !admin.refreshToken || !admin.isActive) {
      throw new UnauthorizedException('Access denied');
    }

    const isValid = await bcrypt.compare(refreshToken, admin.refreshToken);

    if (!isValid) {
      throw new UnauthorizedException('Access denied');
    }

    const tokens = await this.generateTokens(admin.id, admin.email, admin.role);

    await this.prisma.admin.update({
      where: { id: admin.id },
      data: {
        refreshToken: await bcrypt.hash(tokens.refreshToken, 10),
      },
    });

    return tokens;
  }

  async logout(adminId: string, req?: Request) {
    await this.prisma.admin.update({
      where: { id: adminId },
      data: { refreshToken: null },
    });

    await this.activityLogsService.create({
      adminId,
      action: 'ADMIN_LOGOUT',
      entity: 'Admin',
      entityId: adminId,
      ipAddress: req?.ip,
      userAgent: req?.headers['user-agent'],
    });

    return { message: 'Logged out successfully' };
  }

  private async generateTokens(adminId: string, email: string, role: string) {
    const payload = { sub: adminId, email, role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_SECRET,
        expiresIn: '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: '7d',
      }),
    ]);

    return { accessToken, refreshToken };
  }
}