import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Prisma, StorageType } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { LocalStorageService } from './local-storage.service';
import { UpdateFileDto } from './dto/update-file.dto';
import { UploadFileDto } from './dto/upload-file.dto';

/**
 * Media management.
 *
 * New uploads are written to the local Docker volume (StorageType.LOCAL).
 * Historical Supabase-hosted assets keep working untouched: their rows stay
 * StorageType.SUPABASE and their stored absolute URLs continue to resolve, so
 * nothing needs migrating and no image 404s during rollout.
 *
 * Supabase remains configured only so those legacy files can still be deleted.
 */
@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);
  private readonly supabase: SupabaseClient | null;
  private readonly legacyBucket: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogsService: ActivityLogsService,
    private readonly localStorage: LocalStorageService,
  ) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    this.legacyBucket = process.env.SUPABASE_BUCKET || 'products';

    // Optional now. Uploads no longer depend on Supabase, so a deployment
    // without these variables is valid; only legacy deletes are affected.
    this.supabase =
      supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

    if (!this.supabase) {
      this.logger.log(
        'Supabase not configured - legacy remote assets cannot be deleted from storage',
      );
    }
  }

  /** Never expose the raw row: title falls back to the original filename. */
  private present<T extends { title: string | null; fileName: string }>(file: T) {
    return { ...file, title: file.title?.trim() || file.fileName };
  }

  async upload(file: any, dto: UploadFileDto, adminId?: string) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    // Validation (MIME + extension + size) happens inside the storage service.
    const { key, url, folder } = await this.localStorage.save(file, dto.entity);

    try {
      const fileAsset = await this.prisma.fileAsset.create({
        data: {
          storageType: StorageType.LOCAL,
          bucket: folder,
          path: key,
          url,
          fileName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          title: dto.title?.trim() || file.originalname,
          altText: dto.altText?.trim() || null,
          caption: dto.caption?.trim() || null,
          entity: dto.entity,
          entityId: dto.entityId,
        },
      });

      await this.activityLogsService.create({
        adminId,
        action: 'FILE_UPLOADED',
        entity: 'FileAsset',
        entityId: fileAsset.id,
        metadata: {
          path: key,
          fileName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          storageType: StorageType.LOCAL,
          relatedEntity: dto.entity,
          relatedEntityId: dto.entityId,
        },
      });

      return this.present(fileAsset);
    } catch (error) {
      // Don't leave an orphan file on disk if the row could not be written.
      await this.localStorage.remove(key).catch(() => undefined);
      throw error;
    }
  }

  async findAll(params: { page?: number; limit?: number; search?: string } = {}) {
    const page = params.page || 1;
    const limit = params.limit || 50;
    const skip = (page - 1) * limit;

    const where: Prisma.FileAssetWhereInput = {};

    if (params.search) {
      where.OR = [
        { fileName: { contains: params.search, mode: 'insensitive' } },
        { title: { contains: params.search, mode: 'insensitive' } },
        { altText: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.fileAsset.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.fileAsset.count({ where }),
    ]);

    return {
      data: data.map((f) => this.present(f)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const file = await this.prisma.fileAsset.findUnique({ where: { id } });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    return this.present(file);
  }

  /** Editable media metadata (title / alt text / caption). */
  async updateMetadata(id: string, dto: UpdateFileDto, adminId?: string) {
    const existing = await this.prisma.fileAsset.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException('File not found');
    }

    const file = await this.prisma.fileAsset.update({
      where: { id },
      data: {
        title: dto.title === undefined ? undefined : dto.title.trim() || null,
        altText: dto.altText === undefined ? undefined : dto.altText.trim() || null,
        caption: dto.caption === undefined ? undefined : dto.caption.trim() || null,
      },
    });

    await this.activityLogsService.create({
      adminId,
      action: 'FILE_METADATA_UPDATED',
      entity: 'FileAsset',
      entityId: id,
      metadata: { title: file.title, altText: file.altText },
    });

    return this.present(file);
  }

  /** Where this asset is still used. Drives safe deletion. */
  async references(id: string) {
    const [productImages, categories] = await Promise.all([
      this.prisma.productImage.count({ where: { fileId: id } }),
      this.prisma.category.count({ where: { imageId: id } }),
    ]);

    return { productImages, categories, total: productImages + categories };
  }

  /**
   * Deletes an asset only when nothing references it.
   *
   * The physical file is removed after the row, and only for LOCAL assets that
   * no other FileAsset row shares a path with.
   */
  async delete(id: string, adminId?: string) {
    const fileAsset = await this.prisma.fileAsset.findUnique({ where: { id } });

    if (!fileAsset) {
      throw new NotFoundException('File not found');
    }

    const refs = await this.references(id);

    if (refs.total > 0) {
      throw new BadRequestException(
        `This image is still used by ${refs.productImages} product image(s) and ` +
          `${refs.categories} category/categories. Detach it before deleting.`,
      );
    }

    await this.prisma.fileAsset.delete({ where: { id } });

    // Only unlink from disk when no other row points at the same object.
    const sharing = await this.prisma.fileAsset.count({
      where: { path: fileAsset.path },
    });

    if (sharing === 0) {
      if (fileAsset.storageType === StorageType.LOCAL) {
        await this.localStorage.remove(fileAsset.path);
      } else if (this.supabase) {
        const { error } = await this.supabase.storage
          .from(fileAsset.bucket || this.legacyBucket)
          .remove([fileAsset.path]);

        if (error) {
          // The row is already gone; log rather than fail the request.
          this.logger.warn(
            `Failed to remove legacy remote object ${fileAsset.path}: ${error.message}`,
          );
        }
      }
    }

    await this.activityLogsService.create({
      adminId,
      action: 'FILE_DELETED',
      entity: 'FileAsset',
      entityId: id,
      metadata: {
        path: fileAsset.path,
        fileName: fileAsset.fileName,
        storageType: fileAsset.storageType,
      },
    });

    return { message: 'File deleted successfully' };
  }
}
