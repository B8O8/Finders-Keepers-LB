import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { GetActivityLogsDto } from './dto/get-activity-logs.dto';

type CreateActivityLogParams = {
  adminId?: string;
  action: string;
  entity?: string;
  entityId?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
};

@Injectable()
export class ActivityLogsService {
  constructor(private readonly prisma: PrismaService) {}

  create(params: CreateActivityLogParams) {
    return this.prisma.activityLog.create({
      data: {
        adminId: params.adminId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        metadata: params.metadata,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    });
  }

  async findAll(query?: GetActivityLogsDto) {
    const page = query?.page || 1;
    const limit = Math.min(query?.limit || 50, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.ActivityLogWhereInput = {};

    if (query?.search) {
      where.OR = [
        { action: { contains: query.search, mode: 'insensitive' } },
        { entity: { contains: query.search, mode: 'insensitive' } },
        { entityId: { contains: query.search, mode: 'insensitive' } },
        {
          admin: {
            OR: [
              { fullName: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    if (query?.entity) where.entity = query.entity;
    if (query?.action) where.action = query.action;
    if (query?.adminId) where.adminId = query.adminId;

    if (query?.dateFrom || query?.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) (where.createdAt as any).gte = new Date(query.dateFrom);
      if (query.dateTo) {
        const end = new Date(query.dateTo);
        end.setHours(23, 59, 59, 999);
        (where.createdAt as any).lte = end;
      }
    }

    const [logs, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        where,
        include: {
          admin: {
            select: { id: true, email: true, fullName: true, role: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.activityLog.count({ where }),
    ]);

    return {
      data: logs,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getDistinctEntities(): Promise<string[]> {
    const result = await this.prisma.activityLog.findMany({
      select: { entity: true },
      distinct: ['entity'],
      where: { entity: { not: null } },
    });
    return result.map((r) => r.entity).filter(Boolean) as string[];
  }

  async getDistinctActions(): Promise<string[]> {
    const result = await this.prisma.activityLog.findMany({
      select: { action: true },
      distinct: ['action'],
    });
    return result.map((r) => r.action);
  }
}
