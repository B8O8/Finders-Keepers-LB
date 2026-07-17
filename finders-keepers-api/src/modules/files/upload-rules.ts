import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { extname } from 'path';

/**
 * Rules every upload must satisfy, independent of where the bytes end up.
 *
 * Shared by every storage backend so that swapping the backend can never
 * quietly relax security. If these lived inside one service, a second backend
 * would start life with no allowlist at all - which is exactly how "we moved to
 * object storage" turns into a remote-code-execution report.
 */

/** MIME -> allowed extensions. Executables are never accepted. */
export const ALLOWED_UPLOAD_TYPES: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/avif': ['.avif'],
};

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/**
 * Both MIME type and extension must be allowed, and they must agree:
 *  - a .php claiming image/jpeg is rejected on the extension
 *  - a real image renamed to .php is rejected on the extension
 *  - a PDF honestly declaring application/pdf is rejected on the MIME type
 *
 * Returns the validated extension.
 */
export function validateUpload(file: {
  mimetype: string;
  originalname: string;
  size: number;
}): string {
  const allowedExts = ALLOWED_UPLOAD_TYPES[file.mimetype];

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

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new BadRequestException('File size must be less than 5MB');
  }

  return ext;
}

/** Folder per entity type, e.g. product/ or category/. */
export function folderFor(entity?: string): string {
  const raw = (entity || 'general').toLowerCase();
  // Only letters, digits, dash and underscore survive.
  return raw.replace(/[^a-z0-9_-]/g, '') || 'general';
}

/**
 * Server-generated storage key. The client's filename never reaches storage,
 * which removes overwrite and traversal risk at the source.
 */
export function buildStorageKey(folder: string, ext: string): string {
  return `${folder}/${randomUUID()}${ext}`;
}

/**
 * Guards a key before it is used against any backend.
 *
 * Object storage has no filesystem traversal, so `../` in an S3 key is merely a
 * literal key rather than an escape. It is still rejected: keys are always
 * server-generated UUID paths, so anything else means a bug or tampering, and
 * failing loudly beats silently operating on the wrong object.
 */
export function assertSafeKey(key: string): string {
  if (!key || typeof key !== 'string' || key.includes('\0')) {
    throw new BadRequestException('Invalid file path');
  }

  const segments = key.split(/[/\\]/);

  if (
    key.startsWith('/') ||
    /^[a-zA-Z]:/.test(key) ||
    segments.includes('..') ||
    segments.includes('.')
  ) {
    throw new BadRequestException('Invalid file path');
  }

  return key;
}
