import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@Injectable()
export class AddressesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogsService: ActivityLogsService,
  ) {}

  async create(dto: CreateAddressDto, adminId?: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: dto.customerId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    if (dto.isDefault) {
      await this.prisma.customerAddress.updateMany({
        where: { customerId: dto.customerId },
        data: { isDefault: false },
      });
    }

    const address = await this.prisma.customerAddress.create({
      data: dto,
    });

    await this.activityLogsService.create({
      adminId,
      action: 'CUSTOMER_ADDRESS_CREATED',
      entity: 'CustomerAddress',
      entityId: address.id,
      metadata: {
        customerId: dto.customerId,
      },
    });

    return address;
  }

  findAll() {
    return this.prisma.customerAddress.findMany({
      include: {
        customer: {
          select: {
            id: true,
            email: true,
            phone: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async findByCustomer(customerId: string) {
    return this.prisma.customerAddress.findMany({
      where: { customerId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(id: string) {
    const address = await this.prisma.customerAddress.findUnique({
      where: { id },
      include: {
        customer: true,
      },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    return address;
  }

  async update(id: string, dto: UpdateAddressDto, adminId?: string) {
    const existingAddress = await this.findOne(id);

    const customerId = dto.customerId || existingAddress.customerId;

    if (dto.isDefault) {
      await this.prisma.customerAddress.updateMany({
        where: {
          customerId,
          NOT: { id },
        },
        data: { isDefault: false },
      });
    }

    const address = await this.prisma.customerAddress.update({
      where: { id },
      data: dto,
    });

    await this.activityLogsService.create({
      adminId,
      action: 'CUSTOMER_ADDRESS_UPDATED',
      entity: 'CustomerAddress',
      entityId: id,
      metadata: {
        customerId,
      },
    });

    return address;
  }

  async delete(id: string, adminId?: string) {
    const address = await this.findOne(id);

    await this.prisma.customerAddress.delete({
      where: { id },
    });

    await this.activityLogsService.create({
      adminId,
      action: 'CUSTOMER_ADDRESS_DELETED',
      entity: 'CustomerAddress',
      entityId: id,
      metadata: {
        customerId: address.customerId,
      },
    });

    return { message: 'Address deleted successfully' };
  }
}