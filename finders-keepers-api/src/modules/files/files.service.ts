import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, StorageType } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { LocalStorageService } from './local-storage.service';
import { MinioStorageService } from './minio-storage.service';
import { UpdateFileDto } from './dto/update-file.dto';
import { UploadFileDto } from './dto/upload-file.dto';

/**
 * Media management.
 *
 * New uploads go to MinIO (StorageType.MINIO), served publicly at
 * <PUBLIC_MEDIA_BASE_URL>/uploads/... via Caddy.
 *
 * Two older backends remain readable but are never written to again:
 *  - LOCAL    - the Docker volume MinIO replaced. Kept as the rollback path.
 *  - SUPABASE - the original host. Its SDK has been removed, so such rows can
 *               no longer be deleted from remote storage; none exist in
 *               production. The enum value stays because PostgreSQL cannot
 *               cleanly drop one, and because dropping it would rewrite history
 *               on any row that ever held it.
 */
@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogsService: ActivityLogsService,
    private readonly localStorage: LocalStorageService,
    private readonly minioStorage: MinioStorageService,
  ) {}

  /** Never expose the raw row: title falls back to the original filename. */
  private present<T extends { title: string | null; fileName: string }>(file: T) {
    return { ...file, title: file.title?.trim() || file.fileName };
  }

  async upload(file: any, dto: UploadFileDto, adminId?: string) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    // Validation (MIME + extension + size) happens inside the storage service.
    const { key, url, folder } = await this.minioStorage.save(file, dto.entity);

    try {
      const fileAsset = await this.prisma.fileAsset.create({
        data: {
          storageType: StorageType.MINIO,
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
          storageType: StorageType.MINIO,
          relatedEntity: dto.entity,
          relatedEntityId: dto.entityId,
        },
      });

      return this.present(fileAsset);
    } catch (error) {
      // Don't leave an orphan object in the bucket if the row could not be
      // written: the database is the source of truth for what exists.
      await this.minioStorage.remove(key).catch(() => undefined);
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
      // The row is already gone at this point, so a storage failure is logged
      // rather than thrown: failing the request would tell the admin the delete
      // did not happen, when in fact the asset is gone from the application.
      try {
        if (fileAsset.storageType === StorageType.MINIO) {
          await this.minioStorage.remove(fileAsset.path);
        } else if (fileAsset.storageType === StorageType.LOCAL) {
          await this.localStorage.remove(fileAsset.path);
        } else {
          // SUPABASE: the SDK is gone. Production has no such rows; if one ever
          // appears, say so plainly instead of pretending the object was removed.
          this.logger.warn(
            `Row deleted but remote object left in place - Supabase support has been removed: ${fileAsset.path}`,
          );
        }
      } catch (error: any) {
        this.logger.warn(
          `Failed to remove stored object ${fileAsset.path}: ${error?.message}`,
        );
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
