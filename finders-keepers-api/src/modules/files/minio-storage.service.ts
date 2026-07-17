import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Client } from 'minio';

import {
  assertSafeKey,
  buildStorageKey,
  folderFor,
  validateUpload,
} from './upload-rules';

/**
 * Object storage for uploaded media, backed by MinIO on the Docker host.
 *
 * Why the bucket is called "uploads": MinIO serves an object at
 * /<bucket>/<key>, so bucket "uploads" + key "product/<uuid>.jpg" resolves at
 * /uploads/product/<uuid>.jpg - byte-identical to the public URL shape the
 * storefront and admin already use. Caddy proxies /uploads/* straight to MinIO
 * with no rewrite, and no stored URL ever has to change. Rename the bucket and
 * every image URL breaks.
 *
 * Security posture (identical to the disk backend it replaces):
 *  - MIME type AND extension must both be allowlisted (see upload-rules).
 *  - Object keys are server-generated UUIDs; the client's filename never
 *    reaches storage.
 *  - The bucket policy grants anonymous s3:GetObject and NOTHING else. In
 *    particular it must never grant s3:ListBucket, which would let anyone
 *    enumerate the entire media library from a browser.
 */
@Injectable()
export class MinioStorageService implements OnModuleInit {
  private readonly logger = new Logger(MinioStorageService.name);
  private client: Client | null = null;

  get bucket(): string {
    return process.env.MINIO_BUCKET || 'uploads';
  }

  /** Public URL base, e.g. https://api.finderskeeperslb.com */
  get publicBaseUrl(): string {
    return (process.env.PUBLIC_MEDIA_BASE_URL || '').replace(/\/+$/, '');
  }

  /**
   * Lazily built so that constructing the service (and therefore booting Nest)
   * never depends on MinIO being reachable.
   */
  private getClient(): Client {
    if (this.client) return this.client;

    const endpoint = process.env.MINIO_ENDPOINT || 'minio:9000';
    const [host, port] = endpoint.split(':');

    this.client = new Client({
      endPoint: host,
      port: port ? Number(port) : 9000,
      // Traffic to MinIO stays on the internal Docker network; TLS is
      // terminated at Caddy. Never expose MINIO_ENDPOINT publicly.
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ROOT_USER || '',
      secretKey: process.env.MINIO_ROOT_PASSWORD || '',
    });

    return this.client;
  }

  /**
   * Read-only access for anonymous browsers, and nothing more.
   *
   * Deliberately no s3:ListBucket: with it, GET /uploads/ would return an XML
   * index of every file in the store.
   */
  private policyFor(bucket: string): string {
    return JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { AWS: ['*'] },
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${bucket}/*`],
        },
      ],
    });
  }

  /**
   * Creates the bucket and applies its policy if needed.
   *
   * Idempotent, and deliberately non-fatal: a MinIO hiccup at boot must not
   * stop the API from serving orders. Uploads will fail loudly until it
   * recovers, which is the correct blast radius.
   */
  async onModuleInit(): Promise<void> {
    try {
      const client = this.getClient();
      const bucket = this.bucket;

      if (!(await client.bucketExists(bucket))) {
        await client.makeBucket(bucket, process.env.MINIO_REGION || 'us-east-1');
        this.logger.log(`Created MinIO bucket "${bucket}"`);
      }

      await client.setBucketPolicy(bucket, this.policyFor(bucket));
      this.logger.log(`MinIO ready: bucket "${bucket}", public read only`);
    } catch (error: any) {
      this.logger.error(
        `MinIO not ready - uploads will fail until it recovers: ${error?.message}`,
      );
    }
  }

  /** Kept public so the upload rules stay testable through this backend too. */
  validate(file: { mimetype: string; originalname: string; size: number }) {
    return validateUpload(file);
  }

  async save(
    file: {
      buffer: Buffer;
      mimetype: string;
      originalname: string;
      size: number;
    },
    entity?: string,
  ): Promise<{ key: string; url: string; folder: string }> {
    const ext = this.validate(file);
    const folder = folderFor(entity);
    const key = buildStorageKey(folder, ext);

    await this.getClient().putObject(
      this.bucket,
      key,
      file.buffer,
      file.size,
      // Content-Type is stored on the object so the browser renders the image
      // instead of downloading it. MinIO serves these bytes directly.
      { 'Content-Type': file.mimetype },
    );

    return { key, url: this.urlFor(key), folder };
  }

  urlFor(key: string): string {
    return `${this.publicBaseUrl}/uploads/${key}`;
  }

  async remove(key: string): Promise<void> {
    assertSafeKey(key);

    try {
      await this.getClient().removeObject(this.bucket, key);
    } catch (error: any) {
      // Already gone is not an error: the database row is the source of truth.
      if (error?.code === 'NoSuchKey' || error?.code === 'NotFound') {
        this.logger.warn(`MinIO object already absent: ${key}`);
        return;
      }
      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    assertSafeKey(key);

    try {
      await this.getClient().statObject(this.bucket, key);
      return true;
    } catch {
      return false;
    }
  }
}
