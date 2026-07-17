import { BadRequestException } from '@nestjs/common';

import { MinioStorageService } from './minio-storage.service';

/**
 * These mirror local-storage.service.spec.ts on purpose.
 *
 * Swapping the storage backend is precisely when an allowlist gets forgotten,
 * so the replacement is held to the same bar as the thing it replaces. The
 * bucket policy is asserted here too: a policy granting s3:ListBucket would
 * expose the entire media library to anyone who guessed the URL, and that is
 * not the kind of mistake worth discovering in production.
 */
describe('MinioStorageService', () => {
  let service: MinioStorageService;

  beforeEach(() => {
    process.env.MINIO_BUCKET = 'uploads';
    process.env.MINIO_ENDPOINT = 'minio:9000';
    process.env.PUBLIC_MEDIA_BASE_URL = 'https://api.finderskeeperslb.com';
    service = new MinioStorageService();
  });

  const file = (
    over: Partial<{ mimetype: string; originalname: string; size: number }> = {},
  ) => ({
    mimetype: 'image/jpeg',
    originalname: 'photo.jpg',
    size: 1024,
    ...over,
  });

  describe('upload validation', () => {
    it('accepts a valid jpeg', () => {
      expect(service.validate(file())).toBe('.jpg');
    });

    it('accepts png, webp and avif', () => {
      expect(service.validate(file({ mimetype: 'image/png', originalname: 'a.png' }))).toBe('.png');
      expect(service.validate(file({ mimetype: 'image/webp', originalname: 'a.webp' }))).toBe('.webp');
      expect(service.validate(file({ mimetype: 'image/avif', originalname: 'a.avif' }))).toBe('.avif');
    });

    it('rejects a disallowed content type', () => {
      expect(() =>
        service.validate(file({ mimetype: 'application/pdf', originalname: 'a.pdf' })),
      ).toThrow(BadRequestException);
    });

    it('rejects an executable extension even with an image content type', () => {
      expect(() =>
        service.validate(file({ mimetype: 'image/jpeg', originalname: 'shell.php' })),
      ).toThrow(BadRequestException);
    });

    it('rejects a double extension', () => {
      expect(() =>
        service.validate(file({ mimetype: 'image/jpeg', originalname: 'shell.php.exe' })),
      ).toThrow(BadRequestException);
    });

    it('rejects a mismatched extension', () => {
      expect(() =>
        service.validate(file({ mimetype: 'image/png', originalname: 'a.jpg' })),
      ).toThrow(BadRequestException);
    });

    it('rejects a file over 5MB', () => {
      expect(() => service.validate(file({ size: 6 * 1024 * 1024 }))).toThrow(
        BadRequestException,
      );
    });
  });

  describe('public URLs', () => {
    it('builds the same URL shape the disk backend produced', () => {
      // This is the contract that lets MinIO drop in without rewriting a single
      // stored URL: bucket "uploads" + key => /uploads/<key>.
      expect(service.urlFor('product/abc.jpg')).toBe(
        'https://api.finderskeeperslb.com/uploads/product/abc.jpg',
      );
    });

    it('never leaks the internal MinIO endpoint', () => {
      expect(service.urlFor('product/abc.jpg')).not.toContain('minio:9000');
    });
  });

  describe('key safety', () => {
    it('rejects traversal keys', async () => {
      await expect(service.remove('../../etc/passwd')).rejects.toThrow(BadRequestException);
    });

    it('rejects absolute keys', async () => {
      await expect(service.remove('/etc/passwd')).rejects.toThrow(BadRequestException);
    });

    it('rejects embedded traversal', async () => {
      await expect(service.remove('product/../../../secrets.png')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('bucket policy', () => {
    const policy = () =>
      JSON.parse((service as any).policyFor('uploads')) as {
        Statement: { Action: string[]; Resource: string[]; Effect: string }[];
      };

    it('grants anonymous read of objects', () => {
      const statement = policy().Statement[0];
      expect(statement.Effect).toBe('Allow');
      expect(statement.Action).toContain('s3:GetObject');
      expect(statement.Resource).toContain('arn:aws:s3:::uploads/*');
    });

    it('NEVER grants ListBucket - that would expose the whole media library', () => {
      const actions = policy().Statement.flatMap((s) => s.Action);
      expect(actions).not.toContain('s3:ListBucket');
      expect(actions).not.toContain('s3:*');
    });

    it('grants no write or delete to anonymous callers', () => {
      const actions = policy().Statement.flatMap((s) => s.Action);
      expect(actions).not.toContain('s3:PutObject');
      expect(actions).not.toContain('s3:DeleteObject');
      expect(actions).toEqual(['s3:GetObject']);
    });

    it('scopes the policy to the bucket, not the whole server', () => {
      const resources = policy().Statement.flatMap((s) => s.Resource);
      expect(resources.every((r) => r.startsWith('arn:aws:s3:::uploads'))).toBe(true);
    });
  });
});
