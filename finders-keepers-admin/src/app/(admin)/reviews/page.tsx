'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Star, CheckCircle, XCircle } from 'lucide-react';
import Header from '@/components/layout/Header';
import Table from '@/components/ui/Table';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { reviewsApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { AdminRole, ProductReview } from '@/types';
import { formatDate } from '@/lib/utils';

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={14}
          className={i < rating ? 'text-amber-400 fill-amber-400' : 'text-slate-200 fill-slate-200'}
        />
      ))}
    </div>
  );
}

export default function ReviewsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const admin = useAuthStore((s) => s.admin);
  const canModerate = admin?.role === AdminRole.SUPER_ADMIN || admin?.role === AdminRole.ADMIN;

  const [previewReview, setPreviewReview] = useState<ProductReview | null>(null);

  const { data: reviews, isLoading } = useQuery<ProductReview[]>({
    queryKey: ['reviews'],
    queryFn: reviewsApi.findAll,
  });

  const moderateMutation = useMutation({
    mutationFn: ({ id, isApproved }: { id: string; isApproved: boolean }) =>
      reviewsApi.moderate(id, isApproved),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      toast('Review updated', 'success');
    },
    onError: () => toast('Failed to moderate review', 'error'),
  });

  const pending = reviews?.filter((r) => !r.isApproved).length ?? 0;

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Product Reviews"
        subtitle={pending > 0 ? `${pending} review${pending !== 1 ? 's' : ''} pending approval` : 'All reviews up to date'}
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <Table<ProductReview>
          columns={[
            {
              key: 'product',
              header: 'Product',
              render: (row) => (
                <p className="font-medium text-slate-900 truncate max-w-[150px]">
                  {row.product?.name ?? '—'}
                </p>
              ),
            },
            {
              key: 'customer',
              header: 'Customer',
              render: (row) =>
                row.customer ? (
                  <p className="text-slate-700">
                    {row.customer.firstName} {row.customer.lastName}
                  </p>
                ) : (
                  <span className="text-slate-400">—</span>
                ),
            },
            {
              key: 'rating',
              header: 'Rating',
              render: (row) => <StarRating rating={row.rating} />,
            },
            {
              key: 'review',
              header: 'Review',
              render: (row) => (
                <div className="max-w-xs">
                  {row.title && <p className="font-medium text-slate-800 truncate">{row.title}</p>}
                  {row.comment && <p className="text-xs text-slate-500 truncate">{row.comment}</p>}
                </div>
              ),
            },
            {
              key: 'isApproved',
              header: 'Status',
              render: (row) => (
                <Badge variant={row.isApproved ? 'success' : 'warning'}>
                  {row.isApproved ? 'Approved' : 'Pending'}
                </Badge>
              ),
            },
            {
              key: 'createdAt',
              header: 'Date',
              render: (row) => <span className="text-slate-500 text-xs">{formatDate(row.createdAt)}</span>,
            },
            {
              key: 'actions',
              header: '',
              className: 'w-32',
              render: (row) =>
                canModerate ? (
                  <div className="flex items-center gap-1">
                    {!row.isApproved ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-green-600 hover:text-green-800 hover:bg-green-50"
                        onClick={() => moderateMutation.mutate({ id: row.id, isApproved: true })}
                        title="Approve"
                      >
                        <CheckCircle size={16} />
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => moderateMutation.mutate({ id: row.id, isApproved: false })}
                        title="Unapprove"
                      >
                        <XCircle size={16} />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setPreviewReview(row)}
                    >
                      View
                    </Button>
                  </div>
                ) : null,
            },
          ]}
          data={reviews ?? []}
          keyExtractor={(row) => row.id}
          loading={isLoading}
          emptyMessage="No reviews yet"
        />
      </div>

      {/* Preview modal */}
      <Modal
        open={!!previewReview}
        onClose={() => setPreviewReview(null)}
        title="Review Details"
        size="md"
      >
        {previewReview && (
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-slate-900">{previewReview.product?.name ?? 'Unknown product'}</p>
                <StarRating rating={previewReview.rating} />
              </div>
              {previewReview.title && (
                <p className="font-medium text-slate-800">{previewReview.title}</p>
              )}
              {previewReview.comment && (
                <p className="text-sm text-slate-600">{previewReview.comment}</p>
              )}
              <p className="text-xs text-slate-400">
                by {previewReview.customer?.firstName} {previewReview.customer?.lastName}
                {' · '}{formatDate(previewReview.createdAt)}
              </p>
            </div>

            <div className="flex items-center justify-between">
              <Badge variant={previewReview.isApproved ? 'success' : 'warning'}>
                {previewReview.isApproved ? 'Approved' : 'Pending'}
              </Badge>
              {canModerate && (
                <div className="flex gap-2">
                  {!previewReview.isApproved ? (
                    <Button
                      variant="primary"
                      onClick={() => {
                        moderateMutation.mutate({ id: previewReview.id, isApproved: true });
                        setPreviewReview(null);
                      }}
                      loading={moderateMutation.isPending}
                    >
                      Approve
                    </Button>
                  ) : (
                    <Button
                      variant="danger"
                      onClick={() => {
                        moderateMutation.mutate({ id: previewReview.id, isApproved: false });
                        setPreviewReview(null);
                      }}
                      loading={moderateMutation.isPending}
                    >
                      Unapprove
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
