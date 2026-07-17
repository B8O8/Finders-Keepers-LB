import { BadRequestException } from '@nestjs/common';

import { LocalStorageService } from './local-storage.service';

describe('LocalStorageService', () => {
  let service: LocalStorageService;

  beforeEach(() => {
    process.env.UPLOADS_DIR = '/app/uploads';
    process.env.PUBLIC_MEDIA_BASE_URL = 'https://api.finderskeeperslb.com';
    service = new LocalStorageService();
  });

  const file = (over: Partial<{ mimetype: string; originalname: string; size: number }> = {}) => ({
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
      expect(() => service.validate(file({ mimetype: 'application/pdf', originalname: 'a.pdf' })))
        .toThrow(BadRequestException);
    });

    it('rejects an executable disguised by content type', () => {
      expect(() => service.validate(file({ mimetype: 'application/x-httpd-php', originalname: 'shell.php' })))
        .toThrow(BadRequestException);
    });

    it('rejects an executable extension even with an image content type', () => {
      // Classic bypass: claim image/jpeg but keep a .php extension.
      expect(() => service.validate(file({ mimetype: 'image/jpeg', originalname: 'shell.php' })))
        .toThrow(BadRequestException);
    });

    it('rejects a double extension', () => {
      expect(() => service.validate(file({ mimetype: 'image/jpeg', originalname: 'shell.php.exe' })))
        .toThrow(BadRequestException);
    });

    it('rejects a mismatched extension', () => {
      expect(() => service.validate(file({ mimetype: 'image/png', originalname: 'a.jpg' })))
        .toThrow(BadRequestException);
    });

    it('rejects a missing extension', () => {
      expect(() => service.validate(file({ originalname: 'noext' }))).toThrow(BadRequestException);
    });

    it('rejects a file over 5MB', () => {
      expect(() => service.validate(file({ size: 6 * 1024 * 1024 }))).toThrow(BadRequestException);
    });
  });

  describe('public URLs', () => {
    it('builds a URL under the API domain', () => {
      expect(service.urlFor('product/abc.jpg')).toBe(
        'https://api.finderskeeperslb.com/uploads/product/abc.jpg',
      );
    });

    it('never leaks the server filesystem path', () => {
      expect(service.urlFor('product/abc.jpg')).not.toContain('/app/uploads');
    });
  });

  describe('path safety', () => {
    // safeResolve is private; exercised through remove(), which resolves first.
    it('refuses to escape the uploads root via traversal', async () => {
      await expect(service.remove('../../etc/passwd')).rejects.toThrow(BadRequestException);
    });

    it('refuses an absolute path outside the root', async () => {
      await expect(service.remove('/etc/passwd')).rejects.toThrow(BadRequestException);
    });

    it('refuses encoded traversal', async () => {
      await expect(service.remove('product/../../../root/.ssh/id_rsa')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
