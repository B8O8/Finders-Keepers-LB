import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';

@Injectable()
export class AdminsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogsService: ActivityLogsService,
  ) {}

  findAll() {
    return this.prisma.admin.findMany({
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(createAdminDto: CreateAdminDto, currentAdminId?: string) {
    const email = createAdminDto.email.toLowerCase();

    const existingAdmin = await this.prisma.admin.findUnique({
      where: { email },
    });

    if (existingAdmin) {
      throw new BadRequestException('Admin with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(createAdminDto.password, 10);

    const admin = await this.prisma.admin.create({
      data: {
        email,
        fullName: createAdminDto.fullName,
        password: hashedPassword,
        role: createAdminDto.role,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.activityLogsService.create({
      adminId: currentAdminId,
      action: 'ADMIN_CREATED',
      entity: 'Admin',
      entityId: admin.id,
      metadata: {
        createdAdminEmail: admin.email,
        createdAdminRole: admin.role,
      },
    });

    return admin;
  }

  async deactivate(id: string, currentAdminId?: string) {
    const admin = await this.prisma.admin.findUnique({ where: { id } });

    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    const updatedAdmin = await this.prisma.admin.update({
      where: { id },
      data: {
        isActive: false,
        refreshToken: null,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.activityLogsService.create({
      adminId: currentAdminId,
      action: 'ADMIN_DEACTIVATED',
      entity: 'Admin',
      entityId: id,
      metadata: {
        targetEmail: updatedAdmin.email,
        targetRole: updatedAdmin.role,
      },
    });

    return updatedAdmin;
  }

  async activate(id: string, currentAdminId?: string) {
    const admin = await this.prisma.admin.findUnique({ where: { id } });

    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    const updatedAdmin = await this.prisma.admin.update({
      where: { id },
      data: { isActive: true },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.activityLogsService.create({
      adminId: currentAdminId,
      action: 'ADMIN_ACTIVATED',
      entity: 'Admin',
      entityId: id,
      metadata: {
        targetEmail: updatedAdmin.email,
        targetRole: updatedAdmin.role,
      },
    });

    return updatedAdmin;
  }

  async update(id: string, dto: UpdateAdminDto, currentAdminId?: string) {
    const admin = await this.prisma.admin.findUnique({ where: { id } });

    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    const data: Record<string, unknown> = {};
    if (dto.fullName !== undefined) data.fullName = dto.fullName;
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.password) data.password = await bcrypt.hash(dto.password, 10);

    const updatedAdmin = await this.prisma.admin.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.activityLogsService.create({
      adminId: currentAdminId,
      action: 'ADMIN_UPDATED',
      entity: 'Admin',
      entityId: id,
      metadata: {
        targetEmail: updatedAdmin.email,
        changes: Object.keys(data).filter((k) => k !== 'password'),
      },
    });

    return updatedAdmin;
  }

}