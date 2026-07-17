'use client';

import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { filesApi } from '@/lib/api';
import { FileAsset } from '@/types';
import { mediaTitle } from '@/lib/media';
import { formatBytes, formatDateTime } from '@/lib/utils';

/**
 * Edits the title / alt text / caption of a stored media asset.
 *
 * Works for both LOCAL and legacy SUPABASE files: metadata lives in our own
 * database row, not in the storage provider, so editing it never touches
 * Supabase and never needs Supabase credentials.
 *
 * The caller owns cache invalidation via `onSaved`, because the same file can
 * be surfaced under several different query keys (a product, a variant, a
 * category, the media library) and only the caller knows which to refresh.
 */
export default function MediaMetaModal({
  file,
  open,
  onClose,
  onSaved,
}: {
  file: FileAsset | null;
  open: boolean;
  onClose: () => void;
  onSaved?: (updated: FileAsset) => void;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [altText, setAltText] = useState('');
  const [caption, setCaption] = useState('');

  // Re-seed the form whenever a different file is opened. Without this the
  // modal would keep the previously edited file's values.
  useEffect(() => {
    if (!file) return;
    setTitle(file.title ?? '');
    setAltText(file.altText ?? '');
    setCaption(file.caption ?? '');
  }, [file]);

  const save = useMutation({
    mutationFn: () => {
      if (!file) throw new Error('No file selected');
      return filesApi.updateMetadata(file.id, {
        title: title.trim(),
        altText: altText.trim(),
        caption: caption.trim(),
      }) as Promise<FileAsset>;
    },
    onSuccess: (updated) => {
      toast('Image details saved', 'success');
      onSaved?.(updated);
      onClose();
    },
    onError: () => toast('Failed to save image details', 'error'),
  });

  if (!file) return null;

  return (
    <Modal open={open} onClose={onClose} title="Image details" size="lg">
      <div className="flex flex-col gap-4">
        <div className="flex gap-4">
          <img
            src={file.url}
            alt={altText || ''}
            className="h-28 w-28 shrink-0 rounded-lg border border-slate-200 object-cover bg-slate-50"
          />
          <dl className="grid flex-1 grid-cols-2 gap-x-4 gap-y-1.5 text-xs self-start">
            <dt className="text-slate-500">File name</dt>
            <dd className="text-slate-900 truncate" title={file.fileName}>
              {file.fileName}
            </dd>
            <dt className="text-slate-500">Size</dt>
            <dd className="text-slate-900">{formatBytes(file.size)}</dd>
            <dt className="text-slate-500">Type</dt>
            <dd className="text-slate-900">{file.mimeType || '—'}</dd>
            <dt className="text-slate-500">Uploaded</dt>
            <dd className="text-slate-900">{formatDateTime(file.createdAt)}</dd>
            <dt className="text-slate-500">Storage</dt>
            <dd className="text-slate-900">
              {file.storageType === 'SUPABASE' ? 'Supabase (legacy)' : 'This server'}
            </dd>
          </dl>
        </div>

        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={mediaTitle(file)}
          hint="Shown in the admin. Leave blank to fall back to the file name."
        />
        <Input
          label="Alt text"
          value={altText}
          onChange={(e) => setAltText(e.target.value)}
          hint="Describes the image for screen readers and search engines. Leave blank for decorative images."
        />
        <Textarea
          label="Caption"
          rows={2}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
        />

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} loading={save.isPending}>
            Save details
          </Button>
        </div>
      </div>
    </Modal>
  );
}
