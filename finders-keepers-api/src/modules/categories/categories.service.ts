import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogsService: ActivityLogsService,
  ) {}

  async create(dto: CreateCategoryDto, adminId?: string) {
    const existing = await this.prisma.category.findUnique({
      where: { slug: dto.slug },
    });

    if (existing) {
      throw new BadRequestException('Category slug already exists');
    }

    if (dto.parentId) {
      const parent = await this.prisma.category.findUnique({
        where: { id: dto.parentId },
      });

      if (!parent) {
        throw new NotFoundException('Parent category not found');
      }
    }

    const category = await this.prisma.category.create({
      data: dto,
      include: {
        image: true,
        parent: true,
      },
    });

    await this.activityLogsService.create({
      adminId,
      action: 'CATEGORY_CREATED',
      entity: 'Category',
      entityId: category.id,
    });

    return category;
  }

  async findAll() {
    return this.prisma.category.findMany({
      include: {
        image: true,
        parent: true,
        children: true,
      },
      orderBy: [
        { sortOrder: 'asc' },
        { createdAt: 'desc' },
      ],
    });
  }

  async findTree() {
    const categories = await this.prisma.category.findMany({
      where: {
        parentId: null,
      },
      include: {
        image: true,
        children: {
          include: {
            image: true,
            children: true,
          },
          orderBy: {
            sortOrder: 'asc',
          },
        },
      },
      orderBy: {
        sortOrder: 'asc',
      },
    });

    return categories;
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        image: true,
        parent: true,
        children: true,
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async update(id: string, dto: UpdateCategoryDto, adminId?: string) {
    await this.findOne(id);

    if (dto.slug) {
      const existing = await this.prisma.category.findFirst({
        where: {
          slug: dto.slug,
          NOT: { id },
        },
      });

      if (existing) {
        throw new BadRequestException('Category slug already exists');
      }
    }

    if (dto.parentId === id) {
      throw new BadRequestException(
        'Category cannot be parent of itself',
      );
    }

    const category = await this.prisma.category.update({
      where: { id },
      data: dto,
      include: {
        image: true,
        parent: true,
        children: true,
      },
    });

    await this.activityLogsService.create({
      adminId,
      action: 'CATEGORY_UPDATED',
      entity: 'Category',
      entityId: id,
    });

    return category;
  }

  async delete(id: string, adminId?: string) {
    const category = await this.findOne(id);

    const productsCount = await this.prisma.product.count({
      where: {
        categoryId: id,
      },
    });

    if (productsCount > 0) {
      throw new BadRequestException(
        'Cannot delete category with products',
      );
    }

    await this.prisma.category.delete({
      where: { id },
    });

    await this.activityLogsService.create({
      adminId,
      action: 'CATEGORY_DELETED',
      entity: 'Category',
      entityId: id,
      metadata: {
        categoryName: category.name,
      },
    });

    return {
      message: 'Category deleted successfully',
    };
  }
}