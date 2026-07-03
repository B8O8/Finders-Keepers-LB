'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export default function Pagination({ page, totalPages, total, limit, onPageChange, className }: PaginationProps) {
  if (totalPages <= 1) return null;

  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  // Build page numbers to show (always show first, last, and ±2 around current)
  const pages: (number | 'ellipsis')[] = [];
  const range = new Set<number>();
  range.add(1);
  range.add(totalPages);
  for (let i = Math.max(1, page - 2); i <= Math.min(totalPages, page + 2); i++) range.add(i);
  const sorted = Array.from(range).sort((a, b) => a - b);
  for (let i = 0; i < sorted.length; i++) {
    pages.push(sorted[i]);
    if (i < sorted.length - 1 && sorted[i + 1] - sorted[i] > 1) pages.push('ellipsis');
  }

  return (
    <div className={cn('flex items-center justify-between py-3 px-1', className)}>
      <p className="text-sm text-slate-500">
        Showing <span className="font-medium text-slate-700">{from}–{to}</span> of{' '}
        <span className="font-medium text-slate-700">{total}</span> results
      </p>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="inline-flex items-center justify-center h-8 w-8 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <ChevronLeft size={16} />
        </button>

        {pages.map((p, i) =>
          p === 'ellipsis' ? (
            <span key={`e-${i}`} className="h-8 w-8 flex items-center justify-center text-slate-400 text-sm">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={cn(
                'inline-flex items-center justify-center h-8 w-8 rounded-md text-sm font-medium transition',
                p === page
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              )}
            >
              {p}
            </button>
          )
        )}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="inline-flex items-center justify-center h-8 w-8 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
