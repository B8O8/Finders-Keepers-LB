import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentAdmin } from '../../common/decorators/current-admin.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('admin/login')
  login(@Body() loginDto: LoginDto, @Req() req: Request) {
    return this.authService.login(loginDto, req);
  }

  @Post('admin/refresh')
  refresh(@Headers('authorization') authorization: string) {
    if (!authorization || !authorization.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing refresh token');
    }

    const refreshToken = authorization.split(' ')[1];

    const decoded = JSON.parse(
      Buffer.from(refreshToken.split('.')[1], 'base64').toString(),
    );

    return this.authService.refresh(decoded.sub, refreshToken);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('admin/logout')
  logout(@CurrentAdmin() admin: any, @Req() req: Request) {
    return this.authService.logout(admin.id, req);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('admin/me')
  me(@CurrentAdmin() admin: any) {
    return admin;
  }
}