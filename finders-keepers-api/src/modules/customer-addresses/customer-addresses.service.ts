import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateCustomerAddressDto } from './dto/create-customer-address.dto';
import { UpdateCustomerAddressDto } from './dto/update-customer-address.dto';

@Injectable()
export class CustomerAddressesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(customerId: string, dto: CreateCustomerAddressDto) {
    if (dto.isDefault) {
      await this.prisma.customerAddress.updateMany({
        where: { customerId },
        data: { isDefault: false },
      });
    }

    return this.prisma.customerAddress.create({
      data: {
        ...dto,
        customerId,
      },
    });
  }

  findAll(customerId: string) {
    return this.prisma.customerAddress.findMany({
      where: { customerId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(customerId: string, addressId: string) {
    const address = await this.prisma.customerAddress.findUnique({
      where: { id: addressId },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    if (address.customerId !== customerId) {
      throw new ForbiddenException('You cannot access this address');
    }

    return address;
  }

  async update(
    customerId: string,
    addressId: string,
    dto: UpdateCustomerAddressDto,
  ) {
    await this.findOne(customerId, addressId);

    if (dto.isDefault) {
      await this.prisma.customerAddress.updateMany({
        where: {
          customerId,
          NOT: { id: addressId },
        },
        data: { isDefault: false },
      });
    }

    return this.prisma.customerAddress.update({
      where: { id: addressId },
      data: dto,
    });
  }

  async delete(customerId: string, addressId: string) {
    await this.findOne(customerId, addressId);

    await this.prisma.customerAddress.delete({
      where: { id: addressId },
    });

    return { message: 'Address deleted successfully' };
  }
}