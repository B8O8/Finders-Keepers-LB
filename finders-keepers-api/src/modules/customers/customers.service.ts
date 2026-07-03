import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';

import { CreateCustomerDto } from './dto/create-customer.dto';
import { GetCustomersDto } from './dto/get-customers.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogsService: ActivityLogsService,
  ) {}

  async create(dto: CreateCustomerDto, adminId?: string) {
    const email = dto.email?.toLowerCase();

    if (email) {
      const existing = await this.prisma.customer.findUnique({
        where: { email },
      });

      if (existing) {
        throw new BadRequestException('Customer email already exists');
      }
    }

    const customer = await this.prisma.customer.create({
      data: {
        ...dto,
        email,
      },
    });

    await this.activityLogsService.create({
      adminId,
      action: 'CUSTOMER_CREATED',
      entity: 'Customer',
      entityId: customer.id,
    });

    return customer;
  }

  async findAll(query: GetCustomersDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.CustomerWhereInput = {};

    if (typeof query.isActive === 'boolean') {
      where.isActive = query.isActive;
    }

    if (query.search) {
      where.OR = [
        {
          firstName: {
            contains: query.search,
            mode: 'insensitive',
          },
        },
        {
          lastName: {
            contains: query.search,
            mode: 'insensitive',
          },
        },
        {
          email: {
            contains: query.search,
            mode: 'insensitive',
          },
        },
        {
          phone: {
            contains: query.search,
            mode: 'insensitive',
          },
        },
      ];
    }

    const [customers, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        include: {
          addresses: true,
          account: {
            select: {
              id: true,
              email: true,
              isVerified: true,
              lastLoginAt: true,
              createdAt: true,
            },
          },
          _count: {
            select: {
              orders: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),

      this.prisma.customer.count({
        where,
      }),
    ]);

    return {
      data: customers,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        addresses: true,
        account: {
          select: {
            id: true,
            email: true,
            isVerified: true,
            lastLoginAt: true,
            createdAt: true,
          },
        },
        orders: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 10,
        },
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  async update(id: string, dto: UpdateCustomerDto, adminId?: string) {
    await this.findOne(id);

    const email = dto.email?.toLowerCase();

    if (email) {
      const existing = await this.prisma.customer.findFirst({
        where: {
          email,
          NOT: { id },
        },
      });

      if (existing) {
        throw new BadRequestException('Customer email already exists');
      }
    }

    const customer = await this.prisma.customer.update({
      where: { id },
      data: {
        ...dto,
        email,
      },
    });

    await this.activityLogsService.create({
      adminId,
      action: 'CUSTOMER_UPDATED',
      entity: 'Customer',
      entityId: id,
    });

    return customer;
  }

  async deactivate(id: string, adminId?: string) {
    await this.findOne(id);

    const customer = await this.prisma.customer.update({
      where: { id },
      data: {
        isActive: false,
      },
    });

    await this.activityLogsService.create({
      adminId,
      action: 'CUSTOMER_DEACTIVATED',
      entity: 'Customer',
      entityId: id,
    });

    return customer;
  }

  async activate(id: string, adminId?: string) {
    await this.findOne(id);

    const customer = await this.prisma.customer.update({
      where: { id },
      data: {
        isActive: true,
      },
    });

    await this.activityLogsService.create({
      adminId,
      action: 'CUSTOMER_ACTIVATED',
      entity: 'Customer',
      entityId: id,
    });

    return customer;
  }
}