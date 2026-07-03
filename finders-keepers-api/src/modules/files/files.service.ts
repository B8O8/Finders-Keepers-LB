import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { PrismaService } from '../../database/prisma.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { UploadFileDto } from './dto/upload-file.dto';

@Injectable()
export class FilesService {
  private readonly supabase: SupabaseClient;
  private readonly bucket: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogsService: ActivityLogsService,
  ) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    this.bucket = process.env.SUPABASE_BUCKET || 'products';

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async upload(
    file: any,
    dto: UploadFileDto,
    adminId?: string,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Only JPEG, PNG, and WEBP images allowed');
    }

    const maxSize = 5 * 1024 * 1024;

    if (file.size > maxSize) {
      throw new BadRequestException('File size must be less than 5MB');
    }

    const extension = extname(file.originalname);
    const fileName = `${randomUUID()}${extension}`;
    const folder = dto.entity ? dto.entity.toLowerCase() : 'general';
    const path = `${folder}/${fileName}`;

    const { error } = await this.supabase.storage
      .from(this.bucket)
      .upload(path, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (error) {
      throw new BadRequestException(error.message);
    }

    const { data } = this.supabase.storage.from(this.bucket).getPublicUrl(path);

    const fileAsset = await this.prisma.fileAsset.create({
      data: {
        bucket: this.bucket,
        path,
        url: data.publicUrl,
        fileName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
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
        path,
        fileName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        relatedEntity: dto.entity,
        relatedEntityId: dto.entityId,
      },
    });

    return fileAsset;
  }

  findAll() {
    return this.prisma.fileAsset.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async delete(id: string, adminId?: string) {
    const fileAsset = await this.prisma.fileAsset.findUnique({
      where: { id },
    });

    if (!fileAsset) {
      throw new NotFoundException('File not found');
    }

    const { error } = await this.supabase.storage
      .from(fileAsset.bucket)
      .remove([fileAsset.path]);

    if (error) {
      throw new BadRequestException(error.message);
    }

    await this.prisma.fileAsset.delete({
      where: { id },
    });

    await this.activityLogsService.create({
      adminId,
      action: 'FILE_DELETED',
      entity: 'FileAsset',
      entityId: id,
      metadata: {
        path: fileAsset.path,
        fileName: fileAsset.fileName,
      },
    });

    return { message: 'File deleted successfully' };
  }
}