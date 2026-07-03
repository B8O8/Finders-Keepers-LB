'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Loader2 } from 'lucide-react';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Table from '@/components/ui/Table';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Pagination from '@/components/ui/Pagination';
import { ordersApi } from '@/lib/api';
import { Order, OrderStatus, PaymentStatus, PaginatedResponse, AdminRole } from '@/types';
import { formatCurrency, formatDateTime, PAYMENT_STATUS_COLORS } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';

const STATUS_OPTIONS_FILTER = [
  { value: '', label: 'All Statuses' },
  ...Object.values(OrderStatus).map((s) => ({ value: s, label: s })),
];

const PAYMENT_OPTIONS = [
  { value: '', label: 'All Payments' },
  ...Object.values(PaymentStatus).map((s) => ({ value: s, label: s })),
];

const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]: 'bg-amber-100 text-amber-700',
  [OrderStatus.CONFIRMED]: 'bg-blue-100 text-blue-700',
  [OrderStatus.PROCESSING]: 'bg-indigo-100 text-indigo-700',
  [OrderStatus.SHIPPED]: 'bg-violet-100 text-violet-700',
  [OrderStatus.DELIVERED]: 'bg-emerald-100 text-emerald-700',
  [OrderStatus.CANCELLED]: 'bg-red-100 text-red-700',
  [OrderStatus.RETURNED]: 'bg-slate-100 text-slate-600',
};

const STATUS_INLINE_OPTIONS = Object.values(OrderStatus).map((s) => ({ value: s, label: s }));

const PAGE_LIMIT = 20;

function InlineStatusSelect({ order, canEdit }: { order: Order; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const [updating, setUpdating] = useState(false);

  const mutation = useMutation({
    mutationFn: (status: string) => ordersApi.updateStatus(order.id, status),
    onMutate: () => setUpdating(true),
    onSettled: () => setUpdating(false),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders'] }),
  });

  if (!canEdit) {
    return (
      <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', ORDER_STATUS_COLORS[order.status])}>
        {order.status}
      </span>
    );
  }

  return (
    <div className="relative flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      {updating && <Loader2 size={12} className="animate-spin text-slate-400 shrink-0" />}
      <select
        value={order.status}
        onChange={(e) => mutation.mutate(e.target.value)}
        disabled={updating}
        className={cn(
          'rounded-full border-0 py-0.5 pl-2.5 pr-6 text-xs font-medium appearance-none cursor-pointer',
          'focus:ring-2 focus:ring-indigo-400 focus:outline-none transition',
          'disabled:opacity-60 disabled:cursor-not-allowed',
          ORDER_STATUS_COLORS[order.status],
        )}
      >
        {STATUS_INLINE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

export default function OrdersPage() {
  const router = useRouter();
  const admin = useAuthStore((s) => s.admin);
  const canEdit = admin?.role === AdminRole.SUPER_ADMIN || admin?.role === AdminRole.ADMIN || admin?.role === AdminRole.MANAGER;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [page, setPage] = useState(1);

  const resetPage = useCallback(() => setPage(1), []);

  const params: Record<string, unknown> = { page, limit: PAGE_LIMIT };
  if (search) params.search = search;
  if (statusFilter) params.status = statusFilter;
  if (paymentFilter) params.paymentStatus = paymentFilter;

  const { data: response, isLoading } = useQuery<PaginatedResponse<Order>>({
    queryKey: ['orders', search, statusFilter, paymentFilter, page],
    queryFn: () => ordersApi.findAll(params),
  });

  const orders = response?.data ?? [];
  const meta = response?.meta;

  return (
    <div className="flex flex-col h-full">
      <Header title="Orders" subtitle="Track and manage customer orders" />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-48 max-w-sm">
            <Input
              placeholder="Search order # or customer..."
              leftIcon={<Search size={16} />}
              value={search}
              onChange={(e) => { setSearch(e.target.value); resetPage(); }}
            />
          </div>
          <div className="w-44">
            <Select
              options={STATUS_OPTIONS_FILTER}
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); resetPage(); }}
            />
          </div>
          <div className="w-44">
            <Select
              options={PAYMENT_OPTIONS}
              value={paymentFilter}
              onChange={(e) => { setPaymentFilter(e.target.value); resetPage(); }}
            />
          </div>
          {(search || statusFilter || paymentFilter) && (
            <button
              onClick={() => { setSearch(''); setStatusFilter(''); setPaymentFilter(''); resetPage(); }}
              className="text-sm text-slate-500 hover:text-slate-700 underline"
            >
              Clear filters
            </button>
          )}
          {meta && (
            <span className="text-sm text-slate-500 ml-auto">
              {meta.total} order{meta.total !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <Table<Order>
          columns={[
            {
              key: 'orderNumber',
              header: 'Order #',
              render: (row) => (
                <Link
                  href={`/orders/${row.id}`}
                  className="font-semibold text-indigo-600 hover:underline font-mono"
                  onClick={(e) => e.stopPropagation()}
                >
                  #{row.orderNumber}
                </Link>
              ),
            },
            {
              key: 'customer',
              header: 'Customer',
              render: (row) =>
                row.customer ? (
                  <div>
                    <p className="font-medium text-slate-900">
                      {row.customer.firstName} {row.customer.lastName}
                    </p>
                    <p className="text-xs text-slate-500">{row.customer.email}</p>
                  </div>
                ) : (
                  <span className="text-slate-400 italic">Guest</span>
                ),
            },
            {
              key: 'items',
              header: 'Items',
              render: (row) => (
                <span>{row.items?.length ?? 0} item{(row.items?.length ?? 0) !== 1 ? 's' : ''}</span>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              render: (row) => <InlineStatusSelect order={row} canEdit={canEdit} />,
            },
            {
              key: 'paymentStatus',
              header: 'Payment',
              render: (row) => (
                <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', PAYMENT_STATUS_COLORS[row.paymentStatus])}>
                  {row.paymentStatus}
                </span>
              ),
            },
            {
              key: 'totalAmount',
              header: 'Total',
              render: (row) => (
                <span className="font-semibold">{formatCurrency(Number(row.totalAmount))}</span>
              ),
            },
            {
              key: 'createdAt',
              header: 'Date',
              render: (row) => (
                <span className="text-slate-500 text-xs">{formatDateTime(row.createdAt)}</span>
              ),
            },
            {
              key: 'actions',
              header: '',
              className: 'w-16',
              render: (row) => (
                <Link href={`/orders/${row.id}`} onClick={(e) => e.stopPropagation()}>
                  <button className="text-xs text-indigo-600 hover:underline font-medium">View</button>
                </Link>
              ),
            },
          ]}
          data={orders}
          keyExtractor={(row) => row.id}
          loading={isLoading}
          emptyMessage="No orders found"
          onRowClick={(row) => router.push(`/orders/${row.id}`)}
        />

        {meta && meta.totalPages > 1 && (
          <Pagination
            page={page}
            totalPages={meta.totalPages}
            total={meta.total}
            limit={PAGE_LIMIT}
            onPageChange={setPage}
          />
        )}
      </div>
    </div>
  );
}
