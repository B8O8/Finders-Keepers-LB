'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing, RefreshCw, RotateCcw, Send, AlertTriangle } from 'lucide-react';
import Header from '@/components/layout/Header';
import Table from '@/components/ui/Table';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import StatCard from '@/components/ui/StatCard';
import Pagination from '@/components/ui/Pagination';
import { useToast } from '@/components/ui/Toast';
import { notificationsApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { AdminRole } from '@/types';
import type { NotificationRow, NotificationStats, PaginatedResponse } from '@/types';
import { formatCurrency, formatDateTime } from '@/lib/utils';

const statusVariant: Record<string, 'success' | 'warning' | 'danger'> = {
  SENT: 'success',
  PENDING: 'warning',
  FAILED: 'danger',
};

/**
 * Wishlist sale notifications.
 *
 * Delivery happens in a background job, so this screen reports the outbox:
 * who was notified, what is still queued, and what failed (with a retry).
 */
export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const admin = useAuthStore((s) => s.admin);
  const canRetry = admin?.role === AdminRole.SUPER_ADMIN || admin?.role === AdminRole.ADMIN;

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  const params = { page, limit: 20, status: status || undefined, search: search || undefined };

  const { data, isLoading } = useQuery<PaginatedResponse<NotificationRow>>({
    queryKey: ['notifications', params],
    queryFn: () => notificationsApi.findAll(params),
    // The processor drains the queue in the background; keep the view fresh.
    refetchInterval: 30_000,
  });

  const { data: stats } = useQuery<NotificationStats>({
    queryKey: ['notification-stats'],
    queryFn: () => notificationsApi.stats(),
    refetchInterval: 30_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    queryClient.invalidateQueries({ queryKey: ['notification-stats'] });
  };

  const retryMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.retry(id),
    onSuccess: () => {
      invalidate();
      toast('Queued for retry', 'success');
    },
    onError: () => toast('Could not retry', 'error'),
  });

  const retryAllMutation = useMutation({
    mutationFn: () => notificationsApi.retryAllFailed(),
    onSuccess: (r: { message?: string }) => {
      invalidate();
      toast(r?.message ?? 'Failed notifications re-queued', 'success');
    },
    onError: () => toast('Could not re-queue', 'error'),
  });

  const processMutation = useMutation({
    mutationFn: () => notificationsApi.process(),
    onSuccess: (r: { sent?: number; failed?: number }) => {
      invalidate();
      toast(`Processed: ${r?.sent ?? 0} sent, ${r?.failed ?? 0} failed`, 'success');
    },
    onError: () => toast('Could not process the queue', 'error'),
  });

  const rows = data?.data ?? [];

  return (
    <div className="flex h-full flex-col">
      <Header
        title="Sale Notifications"
        subtitle="Customers alerted when a wishlisted item goes on sale"
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            title="Customers notified"
            value={stats?.customersNotified ?? 0}
            icon={<BellRing size={18} />}
            color="indigo"
          />
          <StatCard
            title="Sent"
            value={stats?.sent ?? 0}
            icon={<Send size={18} />}
            color="emerald"
          />
          <StatCard
            title="Pending"
            value={stats?.pending ?? 0}
            icon={<RefreshCw size={18} />}
            color="amber"
          />
          <StatCard
            title="Failed"
            value={stats?.failed ?? 0}
            icon={<AlertTriangle size={18} />}
            color="rose"
          />
        </div>

        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
          <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-2">
            <Input
              placeholder="Search customer email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            <Select
              options={[
                { value: '', label: 'All statuses' },
                { value: 'PENDING', label: 'Pending' },
                { value: 'SENT', label: 'Sent' },
                { value: 'FAILED', label: 'Failed' },
              ]}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {canRetry && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => processMutation.mutate()}
                loading={processMutation.isPending}
              >
                <Send size={15} /> Send queued now
              </Button>
              <Button
                variant="outline"
                onClick={() => retryAllMutation.mutate()}
                loading={retryAllMutation.isPending}
                disabled={!stats?.failed}
              >
                <RotateCcw size={15} /> Retry all failed
              </Button>
            </div>
          )}
        </div>

        <Table<NotificationRow>
          loading={isLoading}
          data={rows}
          keyExtractor={(row) => row.id}
          emptyMessage="No notifications yet. They are queued automatically when a discount goes live."
          columns={[
            {
              key: 'customer',
              header: 'Customer',
              render: (row) => (
                <div>
                  <p className="font-medium text-slate-900">{row.customer?.email ?? '-'}</p>
                  {row.customer?.firstName && (
                    <p className="text-xs text-slate-400">{row.customer.firstName}</p>
                  )}
                </div>
              ),
            },
            {
              key: 'product',
              header: 'Item',
              render: (row) => (
                <div>
                  <p className="text-slate-800">{row.payload?.productName ?? row.product?.name ?? '-'}</p>
                  {row.payload?.variantName && (
                    <p className="text-xs text-slate-400">{row.payload.variantName}</p>
                  )}
                </div>
              ),
            },
            {
              key: 'price',
              header: 'Price',
              render: (row) =>
                row.payload ? (
                  <span className="text-sm">
                    <span className="text-slate-400 line-through">
                      {formatCurrency(row.payload.oldPrice)}
                    </span>{' '}
                    <span className="font-semibold text-slate-900">
                      {formatCurrency(row.payload.newPrice)}
                    </span>
                  </span>
                ) : (
                  <span className="text-slate-400">-</span>
                ),
            },
            {
              key: 'discount',
              header: 'Discount',
              render: (row) => (
                <span className="text-xs text-slate-500">{row.discount?.name ?? '-'}</span>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              render: (row) => (
                <div>
                  <Badge variant={statusVariant[row.status] ?? 'default'}>{row.status}</Badge>
                  {row.attempts > 0 && (
                    <p className="mt-0.5 text-xs text-slate-400">{row.attempts} attempt(s)</p>
                  )}
                  {row.error && (
                    <p className="mt-0.5 max-w-[200px] truncate text-xs text-red-500" title={row.error}>
                      {row.error}
                    </p>
                  )}
                </div>
              ),
            },
            {
              key: 'date',
              header: 'Created',
              render: (row) => (
                <span className="text-xs text-slate-500">{formatDateTime(row.createdAt)}</span>
              ),
            },
            {
              key: 'actions',
              header: '',
              className: 'text-right',
              render: (row) =>
                canRetry && row.status === 'FAILED' ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="Retry notification"
                    onClick={() => retryMutation.mutate(row.id)}
                  >
                    <RotateCcw size={14} />
                  </Button>
                ) : null,
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
      </div>
    </div>
  );
}
