'use client';

import { useState } from 'react';
import { ImagePlus } from 'lucide-react';
import MediaCard from './MediaCard';
import MediaMetaModal from './MediaMetaModal';
import { filesApi } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { FileAsset } from '@/types';

/**
 * Single-image form field: upload, preview with metadata, edit details, clear.
 *
 * Used anywhere a record owns exactly one image (category today; anything else
 * later). Product/variant galleries use MediaCard directly since they manage
 * many images with their own ordering and primary-image rules.
 *
 * Uncontrolled uploads are avoided on purpose: the parent form holds the
 * FileAsset, so it can submit `imageId` and render a preview without a second
 * round-trip to the API.
 */
export default function MediaUploadField({
  label,
  value,
  onChange,
  entity,
  entityId,
  disabled = false,
  hint,
}: {
  label?: string;
  value?: FileAsset | null;
  onChange: (file: FileAsset | null) => void;
  /** Tags the upload so the media library can show where it came from. */
  entity?: string;
  entityId?: string;
  disabled?: boolean;
  hint?: string;
}) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [showMeta, setShowMeta] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      // Seed the title from the filename so the asset is never nameless, even
      // if the admin never opens the details dialog.
      const uploaded: FileAsset = await filesApi.upload(file, {
        entity,
        entityId,
        title: file.name.replace(/\.[^.]+$/, ''),
      });
      onChange(uploaded);
      toast('Image uploaded', 'success');
    } catch {
      toast('Failed to upload image', 'error');
    } finally {
      setUploading(false);
      // Allow re-picking the same file after a failure.
      e.target.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-1">
      {label && <span className="text-sm font-medium text-slate-700">{label}</span>}

      {value ? (
        <div className="flex items-start gap-3">
          <MediaCard
            file={value}
            canEdit={!disabled}
            onEditDetails={() => setShowMeta(true)}
            actions={
              <button
                type="button"
                onClick={() => onChange(null)}
                className="rounded bg-red-600 px-2 py-1 text-[11px] text-white transition-colors hover:bg-red-700"
              >
                Remove
              </button>
            }
            className="w-40"
          />
        </div>
      ) : (
        <label
          className={`flex h-28 w-40 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-slate-50 text-slate-500 transition-colors hover:border-indigo-400 hover:text-indigo-600 ${
            disabled ? 'pointer-events-none opacity-50' : ''
          }`}
        >
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={disabled || uploading}
            onChange={handleUpload}
          />
          <ImagePlus size={18} />
          <span className="text-[11px] font-medium">
            {uploading ? 'Uploading...' : 'Upload image'}
          </span>
        </label>
      )}

      {hint && <p className="text-xs text-slate-500">{hint}</p>}

      <MediaMetaModal
        file={value ?? null}
        open={showMeta}
        onClose={() => setShowMeta(false)}
        // Keep the parent's copy in sync so the card relabels immediately.
        onSaved={(updated) => onChange(updated)}
      />
    </div>
  );
}
