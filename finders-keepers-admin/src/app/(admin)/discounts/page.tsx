'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Percent,
  Plus,
  Power,
  PowerOff,
  Archive,
  Eye,
  Pencil,
  RotateCcw,
  Bell,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import Table from '@/components/ui/Table';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Pagination from '@/components/ui/Pagination';
import { useToast } from '@/components/ui/Toast';
import { discountsApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { AdminRole } from '@/types';
import type {
  Discount,
  DiscountPreview,
  DiscountPreviewItem,
  DiscountStatus,
  PaginatedResponse,
} from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import DiscountForm from './DiscountForm';

const statusVariant: Record<DiscountStatus, 'success' | 'info' | 'warning' | 'default'> = {
  active: 'success',
  scheduled: 'info',
  expired: 'default',
  inactive: 'warning',
  archived: 'default',
};

export default function DiscountsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const admin = useAuthStore((s) => s.admin);
  const canEdit = admin?.role === AdminRole.SUPER_ADMIN || admin?.role === AdminRole.ADMIN;

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [startsFrom, setStartsFrom] = useState('');
  const [startsTo, setStartsTo] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Discount | undefined>();
  const [previewId, setPreviewId] = useState<string | null>(null);

  const params = {
    page,
    limit: 20,
    search: search || undefined,
    status: status || undefined,
    startsFrom: startsFrom || undefined,
    startsTo: startsTo || undefined,
    includeArchived: includeArchived ? 'true' : undefined,
  };

  const { data, isLoading } = useQuery<PaginatedResponse<Discount>>({
    queryKey: ['discounts', params],
    queryFn: () => discountsApi.findAll(params),
  });

  const { data: preview, isLoading: previewLoading } = useQuery<DiscountPreview>({
    queryKey: ['discount-preview', previewId],
    queryFn: () => discountsApi.preview(previewId as string),
    enabled: !!previewId,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['discounts'] });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      isActive ? discountsApi.deactivate(id) : discountsApi.activate(id),
    onSuccess: (_r, v) => {
      invalidate();
      toast(v.isActive ? 'Discount deactivated' : 'Discount activated', 'success');
    },
    onError: () => toast('Could not update the discount', 'error'),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => discountsApi.archive(id),
    onSuccess: () => {
      invalidate();
      toast('Discount archived', 'success');
    },
    onError: () => toast('Could not archive the discount', 'error'),
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => discountsApi.restore(id),
    onSuccess: () => {
      invalidate();
      toast('Discount restored', 'success');
    },
    onError: () => toast('Could not restore the discount', 'error'),
  });

  const discounts = data?.data ?? [];
  const activeCount = discounts.filter((d) => d.status === 'active').length;

  return (
    <div className="flex h-full flex-col">
      <Header
        title="Discounts"
        subtitle={
          isLoading ? 'Loading...' : `${data?.meta.total ?? 0} discount(s) - ${activeCount} running now`
        }
      />

      <div className="flex-1 overflow-auto p-6">
        {/* Filters */}
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
          <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-4">
            <Input
              placeholder="Search name or label..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            <Select
              options={[
                { value: '', label: 'All statuses' },
                { value: 'active', label: 'Active' },
                { value: 'scheduled', label: 'Scheduled' },
                { value: 'expired', label: 'Expired' },
                { value: 'inactive', label: 'Inactive' },
              ]}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            />
            <Input
              type="date"
              aria-label="Starting from"
              value={startsFrom}
              onChange={(e) => {
                setStartsFrom(e.target.value);
                setPage(1);
              }}
            />
            <Input
              type="date"
              aria-label="Starting before"
              value={startsTo}
              onChange={(e) => {
                setStartsTo(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap text-sm text-slate-600">
            <input
              type="checkbox"
              className="rounded"
              checked={includeArchived}
              onChange={(e) => {
                setIncludeArchived(e.target.checked);
                setPage(1);
              }}
            />
            Show archived
          </label>

          {canEdit && (
            <Button
              onClick={() => {
                setEditing(undefined);
                setFormOpen(true);
              }}
            >
              <Plus size={16} /> New Discount
            </Button>
          )}
        </div>

        {!isLoading && discounts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-12 text-center">
            <Percent className="mx-auto mb-3 text-slate-300" size={32} />
            <p className="font-medium text-slate-700">No discounts found</p>
            <p className="mt-1 text-sm text-slate-400">
              {search || status
                ? 'Try clearing the filters.'
                : 'Create your first discount to start a sale.'}
            </p>
          </div>
        ) : (
          <>
            <Table<Discount>
              loading={isLoading}
              data={discounts}
              keyExtractor={(row) => row.id}
              emptyMessage="No discounts found."
              columns={[
                {
                  key: 'name',
                  header: 'Name',
                  render: (row) => (
                    <div>
                      <p className="font-medium text-slate-900">{row.name}</p>
                      {row.publicLabel && (
                        <p className="text-xs text-slate-400">{row.publicLabel}</p>
                      )}
                    </div>
                  ),
                },
                {
                  key: 'value',
                  header: 'Discount',
                  render: (row) => (
                    <span className="font-medium text-slate-800">
                      {row.type === 'PERCENTAGE' ? `${row.value}%` : formatCurrency(row.value)}
                    </span>
                  ),
                },
                {
                  key: 'window',
                  header: 'Window',
                  render: (row) => (
                    <span className="text-xs text-slate-500">
                      {formatDate(row.startsAt)}
                      <br />
                      {row.endsAt ? formatDate(row.endsAt) : 'No end date'}
                    </span>
                  ),
                },
                {
                  key: 'priority',
                  header: 'Priority',
                  render: (row) => (
                    <span className="text-slate-700">
                      {row.priority}
                      {row.stackable && (
                        <Badge variant="info" className="ml-2">
                          stackable
                        </Badge>
                      )}
                    </span>
                  ),
                },
                {
                  key: 'targets',
                  header: 'Targets',
                  render: (row) => (
                    <span className="text-xs text-slate-500">{row.targets?.length ?? 0} target(s)</span>
                  ),
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: (row) => (
                    <Badge variant={statusVariant[row.status ?? 'inactive']}>{row.status}</Badge>
                  ),
                },
                {
                  key: 'actions',
                  header: '',
                  className: 'text-right',
                  render: (row) => (
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setPreviewId(row.id)}
                        aria-label={`Preview ${row.name}`}
                      >
                        <Eye size={14} />
                      </Button>

                      {canEdit && !row.archivedAt && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Edit ${row.name}`}
                            onClick={() => {
                              setEditing(row);
                              setFormOpen(true);
                            }}
                          >
                            <Pencil size={14} />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={row.isActive ? `Deactivate ${row.name}` : `Activate ${row.name}`}
                            onClick={() =>
                              toggleMutation.mutate({ id: row.id, isActive: row.isActive })
                            }
                          >
                            {row.isActive ? <PowerOff size={14} /> : <Power size={14} />}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Archive ${row.name}`}
                            className="text-red-500 hover:text-red-700"
                            onClick={() => {
                              if (confirm(`Archive "${row.name}"? It will stop affecting prices.`)) {
                                archiveMutation.mutate(row.id);
                              }
                            }}
                          >
                            <Archive size={14} />
                          </Button>
                        </>
                      )}

                      {canEdit && row.archivedAt && (
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Restore ${row.name}`}
                          onClick={() => restoreMutation.mutate(row.id)}
                        >
                          <RotateCcw size={14} />
                        </Button>
                      )}
                    </div>
                  ),
                },
              ]}
            />

            {data && data.meta.totalPages > 1 && (
              <div className="mt-4">
                <Pagination
                  page={data.meta.page}
                  totalPages={data.meta.totalPages}
                  total={data.meta.total}
                  limit={data.meta.limit}
                  onPageChange={setPage}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Create / edit */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit Discount' : 'New Discount'}
        size="xl"
      >
        <DiscountForm
          discount={editing}
          onSuccess={() => {
            setFormOpen(false);
            invalidate();
            toast(editing ? 'Discount updated' : 'Discount created', 'success');
          }}
        />
      </Modal>

      {/* Affected products preview */}
      <Modal open={!!previewId} onClose={() => setPreviewId(null)} title="Affected products" size="xl">
        {previewLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        ) : !preview ? (
          <p className="py-6 text-center text-sm text-slate-400">Nothing to show.</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Affected variants</p>
                <p className="text-xl font-bold text-slate-900">{preview.totalAffectedVariants}</p>
              </div>
              <div className="rounded-lg bg-amber-50 p-3">
                <p className="flex items-center gap-1 text-xs text-amber-700">
                  <Bell size={12} /> Wishlist customers to notify
                </p>
                <p className="text-xl font-bold text-amber-900">
                  {preview.estimatedWishlistNotifications}
                </p>
              </div>
            </div>

            {preview.truncated && (
              <p className="text-xs text-slate-400">
                Showing the first {preview.items.length} affected variants.
              </p>
            )}

            <Table<DiscountPreviewItem>
              data={preview.items}
              keyExtractor={(row) => row.variantId}
              emptyMessage="This discount does not currently reduce any product's price."
              columns={[
                { key: 'product', header: 'Product', render: (row) => row.productName },
                {
                  key: 'variant',
                  header: 'Variant',
                  render: (row) => row.variantName || row.sku || '-',
                },
                {
                  key: 'was',
                  header: 'Was',
                  render: (row) => (
                    <span className="text-slate-400 line-through">
                      {formatCurrency(row.regularPrice)}
                    </span>
                  ),
                },
                {
                  key: 'now',
                  header: 'Now',
                  render: (row) => (
                    <span className="font-semibold text-slate-900">
                      {formatCurrency(row.finalPrice)}
                    </span>
                  ),
                },
                {
                  key: 'save',
                  header: 'Save',
                  render: (row) => <Badge variant="success">-{row.discountPercent}%</Badge>,
                },
              ]}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
