'use client';

import { ReactNode } from 'react';
import { ImageOff, Info, Pencil } from 'lucide-react';
import { FileAsset } from '@/types';
import { mediaAlt, mediaTitle } from '@/lib/media';
import { cn, formatBytes, formatDate } from '@/lib/utils';

/**
 * The single media tile used everywhere an image is shown or picked —
 * product images, variant images, category images, media library.
 *
 * It renders the asset plus its metadata (title, size, upload date, alt state)
 * and delegates everything context-specific to slots, so callers add their own
 * controls without forking the component:
 *
 *   badges  - corner markers over the thumbnail (primary star, variant tag)
 *   actions - buttons revealed on hover (set primary, remove)
 *   footer  - anything under the metadata (variant selector)
 */
export default function MediaCard({
  file,
  canEdit = false,
  onEditDetails,
  badges,
  actions,
  footer,
  className,
}: {
  file?: FileAsset | null;
  canEdit?: boolean;
  onEditDetails?: () => void;
  badges?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  if (!file) {
    return (
      <div
        className={cn(
          'flex aspect-square flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-200 bg-slate-50 text-slate-400',
          className,
        )}
      >
        <ImageOff size={20} />
        <span className="text-[11px]">Image unavailable</span>
      </div>
    );
  }

  const label = mediaTitle(file);
  const alt = mediaAlt(file);

  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white',
        className,
      )}
    >
      <div className="group relative aspect-square bg-slate-50">
        <img src={file.url} alt={alt} className="h-full w-full object-cover" />
        {badges}
        {canEdit && (actions || onEditDetails) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
            {actions}
            {onEditDetails && (
              <button
                type="button"
                onClick={onEditDetails}
                className="inline-flex items-center gap-1 rounded bg-white/90 px-2 py-1 text-[11px] font-medium text-slate-800 transition-colors hover:bg-white"
              >
                <Pencil size={10} />
                Details
              </button>
            )}
          </div>
        )}
      </div>

      {/* Metadata strip */}
      <div className="border-t border-slate-200 px-2 py-1.5">
        <p className="truncate text-[11px] font-medium text-slate-800" title={label}>
          {label}
        </p>
        <p className="mt-0.5 text-[10px] text-slate-500">
          {formatBytes(file.size)} · {formatDate(file.createdAt)}
        </p>
        {!alt && (
          // Missing alt text is an SEO/accessibility gap the admin can fix, so
          // surface it rather than letting it stay invisible.
          <p className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-amber-600">
            <Info size={9} />
            No alt text
          </p>
        )}
      </div>

      {footer}
    </div>
  );
}
