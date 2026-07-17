import { FileAsset } from '@/types';

type TitleSource = Pick<FileAsset, 'title' | 'fileName'>;

/**
 * Human label for a media asset.
 *
 * The API always populates `title` (falling back to the original filename) for
 * files uploaded after the local-storage migration. Files uploaded before it —
 * i.e. legacy Supabase rows — may still carry a null/empty title, so this
 * degrades to the filename and finally to a generic label. The admin should
 * never render an empty string where a name belongs.
 */
export function mediaTitle(file?: TitleSource | null): string {
  return file?.title?.trim() || file?.fileName?.trim() || 'Untitled image';
}

/**
 * Alt text for an <img>. Empty string is deliberate and correct for decorative
 * images — it tells screen readers to skip, which is better than announcing a
 * filename. So this returns '' rather than a fallback when altText is unset.
 */
export function mediaAlt(file?: Pick<FileAsset, 'altText'> | null): string {
  return file?.altText?.trim() || '';
}
