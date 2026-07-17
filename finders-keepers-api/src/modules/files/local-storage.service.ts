import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { extname, isAbsolute, join, normalize, resolve, sep } from 'path';

/**
 * Local disk storage for uploaded media, hosted on the Docker server.
 *
 * Files live on a persistent named volume mounted at UPLOADS_DIR (default
 * /app/uploads) so they survive container rebuilds, replacement and restarts.
 * They are served read-only at PUBLIC_MEDIA_BASE_URL (/uploads/...).
 *
 * Security posture:
 *  - MIME type AND extension must both be in the allowlist (a .php renamed to
 *    .jpg is rejected on MIME; a real image renamed to .php is rejected on ext).
 *  - Stored filenames are server-generated UUIDs; the client's filename is
 *    never used on disk, which removes path traversal and overwrite risks.
 *  - Every resolved path is re-checked to be inside the uploads root.
 *  - Files are written non-executable (0o644).
 */
@Injectable()
export class LocalStorageService {
  private readonly logger = new Logger(LocalStorageService.name);

  /** MIME -> allowed extensions. Executables are never accepted. */
  private static readonly ALLOWED: Record<string, string[]> = {
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/webp': ['.webp'],
    'image/avif': ['.avif'],
  };

  private static readonly MAX_BYTES = 5 * 1024 * 1024;

  get root(): string {
    return resolve(process.env.UPLOADS_DIR || '/app/uploads');
  }

  /** Public URL base, e.g. https://api.finderskeeperslb.com */
  get publicBaseUrl(): string {
    return (process.env.PUBLIC_MEDIA_BASE_URL || '').replace(/\/+$/, '');
  }

  validate(file: { mimetype: string; originalname: string; size: number }) {
    const allowedExts = LocalStorageService.ALLOWED[file.mimetype];

    if (!allowedExts) {
      throw new BadRequestException(
        'Only JPEG, PNG, WEBP and AVIF images are allowed',
      );
    }

    const ext = extname(file.originalname || '').toLowerCase();

    if (!allowedExts.includes(ext)) {
      throw new BadRequestException(
        `File extension "${ext || '(none)'}" does not match its content type`,
      );
    }

    if (file.size > LocalStorageService.MAX_BYTES) {
      throw new BadRequestException('File size must be less than 5MB');
    }

    return ext;
  }

  /**
   * Resolves a storage key to an absolute path inside the uploads root.
   *
   * Traversal is REJECTED, not sanitised. Silently rewriting "../../etc/passwd"
   * into an in-root path would hide a real attack and leave the caller thinking
   * it deleted something it did not. Keys are server-generated UUID paths, so
   * anything else is a bug or an attack and should fail loudly.
   */
  private safeResolve(key: string): string {
    if (!key || typeof key !== 'string') {
      throw new BadRequestException('Invalid file path');
    }

    // NUL bytes can truncate paths in native calls.
    if (key.includes('\0')) {
      throw new BadRequestException('Invalid file path');
    }

    const normalized = normalize(key);

    // No absolute paths (POSIX "/x", Windows "C:\x" or UNC).
    if (isAbsolute(key) || isAbsolute(normalized) || /^[a-zA-Z]:/.test(normalized)) {
      throw new BadRequestException('Invalid file path');
    }

    // No parent-directory segments, before or after normalisation.
    const segments = normalized.split(/[\/\\]/);
    if (segments.includes('..')) {
      throw new BadRequestException('Invalid file path');
    }

    const full = resolve(join(this.root, normalized));

    // Belt and braces: the resolved path must still sit under the root.
    if (full !== this.root && !full.startsWith(this.root + sep)) {
      throw new BadRequestException('Invalid file path');
    }

    return full;
  }

  /** Folder per entity type, e.g. product/ or category/. */
  private folderFor(entity?: string): string {
    const raw = (entity || 'general').toLowerCase();
    // Only letters, digits, dash and underscore survive.
    return raw.replace(/[^a-z0-9_-]/g, '') || 'general';
  }

  async save(
    file: { buffer: Buffer; mimetype: string; originalname: string; size: number },
    entity?: string,
  ): Promise<{ key: string; url: string; folder: string }> {
    const ext = this.validate(file);
    const folder = this.folderFor(entity);

    // Server-generated name: collision-safe and untrusted input never reaches
    // the filesystem.
    const key = `${folder}/${randomUUID()}${ext}`;
    const full = this.safeResolve(key);

    await fs.mkdir(resolve(join(this.root, folder)), { recursive: true });
    await fs.writeFile(full, file.buffer, { mode: 0o644 });

    return { key, url: this.urlFor(key), folder };
  }

  urlFor(key: string): string {
    return `${this.publicBaseUrl}/uploads/${key}`;
  }

  async remove(key: string): Promise<void> {
    try {
      await fs.unlink(this.safeResolve(key));
    } catch (error: any) {
      // Already gone is not an error: the database row is the source of truth.
      if (error?.code !== 'ENOENT') throw error;
      this.logger.warn(`Local file already absent: ${key}`);
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.safeResolve(key));
      return true;
    } catch {
      return false;
    }
  }
}
