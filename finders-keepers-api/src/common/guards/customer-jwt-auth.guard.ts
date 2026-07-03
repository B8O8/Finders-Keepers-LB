import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class CustomerJwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing access token');
    }

    const token = authHeader.split(' ')[1];

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.CUSTOMER_JWT_SECRET || process.env.JWT_SECRET,
      });

      const account = await this.prisma.customerAccount.findUnique({
        where: { id: payload.sub },
        include: {
          customer: {
            include: {
              addresses: true,
            },
          },
        },
      });

      if (!account || !account.customer.isActive) {
        throw new UnauthorizedException('Invalid customer account');
      }

      request.customer = {
        accountId: account.id,
        customerId: account.customerId,
        email: account.email,
        isVerified: account.isVerified,
        customer: account.customer,
      };

      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}