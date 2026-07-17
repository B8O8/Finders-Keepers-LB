import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import { isAbsolute, join, normalize, resolve, sep } from 'path';

import { buildStorageKey, folderFor, validateUpload } from './upload-rules';

/**
 * Local disk storage for uploaded media.
 *
 * SUPERSEDED by MinioStorageService for new uploads. Retained deliberately as
 * the rollback path: rows written while this backend was active carry
 * StorageType.LOCAL and must keep resolving. Delete this only once no LOCAL
 * rows remain.
 *
 * Files live on a persistent named volume mounted at UPLOADS_DIR (default
 * /app/uploads) so they survive container rebuilds, replacement and restarts.
 * They are served read-only at PUBLIC_MEDIA_BASE_URL (/uploads/...).
 *
 * Security posture:
 *  - MIME type AND extension must both be allowlisted (see upload-rules, shared
 *    with every other backend so they cannot drift apart).
 *  - Stored filenames are server-generated UUIDs; the client's filename is
 *    never used on disk, which removes path traversal and overwrite risks.
 *  - Every resolved path is re-checked to be inside the uploads root.
 *  - Files are written non-executable (0o644).
 */
@Injectable()
export class LocalStorageService {
  private readonly logger = new Logger(LocalStorageService.name);

  get root(): string {
    return resolve(process.env.UPLOADS_DIR || '/app/uploads');
  }

  /** Public URL base, e.g. https://api.finderskeeperslb.com */
  get publicBaseUrl(): string {
    return (process.env.PUBLIC_MEDIA_BASE_URL || '').replace(/\/+$/, '');
  }

  validate(file: { mimetype: string; originalname: string; size: number }) {
    return validateUpload(file);
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

  async save(
    file: { buffer: Buffer; mimetype: string; originalname: string; size: number },
    entity?: string,
  ): Promise<{ key: string; url: string; folder: string }> {
    const ext = this.validate(file);
    const folder = folderFor(entity);

    // Server-generated name: collision-safe and untrusted input never reaches
    // the filesystem.
    const key = buildStorageKey(folder, ext);
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
