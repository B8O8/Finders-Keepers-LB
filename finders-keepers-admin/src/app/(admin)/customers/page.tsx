'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, UserCheck, UserX, Mail, Phone, ShoppingCart, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Table from '@/components/ui/Table';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import Pagination from '@/components/ui/Pagination';
import { useToast } from '@/components/ui/Toast';
import { customersApi, ordersApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { AdminRole, Customer, PaginatedResponse, Order, OrderStatus } from '@/types';
import { formatDate, formatDateTime, formatCurrency, getInitials } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { useForm } from 'react-hook-form';

const STATUS_OPTIONS = [
  { value: '', label: 'All Customers' },
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
];

const PAGE_LIMIT = 20;

const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]: 'bg-amber-100 text-amber-700',
  [OrderStatus.CONFIRMED]: 'bg-blue-100 text-blue-700',
  [OrderStatus.PROCESSING]: 'bg-indigo-100 text-indigo-700',
  [OrderStatus.SHIPPED]: 'bg-violet-100 text-violet-700',
  [OrderStatus.DELIVERED]: 'bg-emerald-100 text-emerald-700',
  [OrderStatus.CANCELLED]: 'bg-red-100 text-red-700',
  [OrderStatus.RETURNED]: 'bg-slate-100 text-slate-600',
};

function CustomerForm({ customer, onSuccess }: { customer?: Customer; onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit } = useForm({
    defaultValues: {
      firstName: customer?.firstName ?? '',
      lastName: customer?.lastName ?? '',
      email: customer?.email ?? '',
      phone: customer?.phone ?? '',
    },
  });

  const onSubmit = async (data: Record<string, unknown>) => {
    setLoading(true);
    try {
      if (customer) {
        await customersApi.update(customer.id, data);
      } else {
        await customersApi.create(data);
      }
      onSuccess();
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit as never)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input label="First Name" placeholder="John" required {...register('firstName')} />
        <Input label="Last Name" placeholder="Doe" required {...register('lastName')} />
      </div>
      <Input label="Email" type="email" placeholder="john@example.com" required {...register('email')} />
      <Input label="Phone" type="tel" placeholder="+1 234 567 8900" {...register('phone')} />
      <div className="flex justify-end pt-2">
        <Button type="submit" loading={loading}>
          {customer ? 'Save Changes' : 'Create Customer'}
        </Button>
      </div>
    </form>
  );
}

function CustomerDetailModal({
  customer,
  onClose,
  onEdit,
  canEdit,
}: {
  customer: Customer;
  onClose: () => void;
  onEdit: () => void;
  canEdit: boolean;
}) {
  const [tab, setTab] = useState<'info' | 'orders'>('info');

  const { data: ordersResponse, isLoading: ordersLoading } = useQuery<PaginatedResponse<Order>>({
    queryKey: ['customer-orders', customer.id],
    queryFn: () => ordersApi.findAll({ search: customer.email, limit: 50 }),
    enabled: tab === 'orders',
  });

  const orders = ordersResponse?.data ?? [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 text-lg font-bold">
          {getInitials(customer.firstName, customer.lastName)}
        </div>
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            {customer.firstName} {customer.lastName}
          </h3>
          <p className="text-sm text-slate-500">{customer.email}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Badge variant={customer.isActive ? 'success' : 'danger'}>
            {customer.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-slate-200">
        {([['info', 'Info'], ['orders', 'Orders']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px',
              tab === key
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            )}
          >
            {label}
            {key === 'orders' && customer._count?.orders ? (
              <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                {customer._count.orders}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Info tab */}
      {tab === 'info' && (
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-slate-500 text-xs">Phone</p>
            <p className="font-medium mt-0.5">{customer.phone ?? '—'}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-slate-500 text-xs">Email Verified</p>
            <p className="font-medium mt-0.5">{customer.isEmailVerified ? 'Yes' : 'No'}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-slate-500 text-xs">Total Orders</p>
            <p className="font-medium mt-0.5">{customer._count?.orders ?? 0}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-slate-500 text-xs">Joined</p>
            <p className="font-medium mt-0.5">{formatDate(customer.createdAt)}</p>
          </div>
        </div>
      )}

      {/* Orders tab */}
      {tab === 'orders' && (
        <div className="space-y-2">
          {ordersLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="rounded-lg bg-slate-50 py-8 text-center">
              <ShoppingCart size={24} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm text-slate-400">No orders found</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto rounded-lg border border-slate-200">
              {orders.map((order) => (
                <div key={order.id} className="flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 transition">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-indigo-600">
                        #{order.orderNumber}
                      </span>
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', ORDER_STATUS_COLORS[order.status])}>
                        {order.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {order.items?.length ?? 0} item{(order.items?.length ?? 1) !== 1 ? 's' : ''} · {formatDateTime(order.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-3 shrink-0">
                    <span className="text-sm font-semibold text-slate-700">
                      {formatCurrency(Number(order.totalAmount))}
                    </span>
                    <Link href={`/orders/${order.id}`} onClick={onClose}>
                      <ExternalLink size={13} className="text-slate-400 hover:text-indigo-600" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
        {canEdit && (
          <Button variant="outline" size="sm" onClick={onEdit}>
            Edit Customer
          </Button>
        )}
        <Button variant="secondary" size="sm" onClick={onClose}>Close</Button>
      </div>
    </div>
  );
}

export default function CustomersPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const admin = useAuthStore((s) => s.admin);
  const canEdit = admin?.role === AdminRole.SUPER_ADMIN || admin?.role === AdminRole.ADMIN;

  const [search, setSearch] = useState('');
  const [isActiveFilter, setIsActiveFilter] = useState('');
  const [page, setPage] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [viewCustomer, setViewCustomer] = useState<Customer | null>(null);

  const resetPage = useCallback(() => setPage(1), []);

  const params: Record<string, unknown> = { page, limit: PAGE_LIMIT };
  if (search) params.search = search;
  if (isActiveFilter !== '') params.isActive = isActiveFilter === 'true';

  const { data: response, isLoading } = useQuery<PaginatedResponse<Customer>>({
    queryKey: ['customers', search, isActiveFilter, page],
    queryFn: () => customersApi.findAll(params),
  });

  const customers = response?.data ?? [];
  const meta = response?.meta;

  const activateMutation = useMutation({
    mutationFn: (id: string) => customersApi.activate(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['customers'] }); toast('Customer activated', 'success'); },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => customersApi.deactivate(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['customers'] }); toast('Customer deactivated', 'success'); },
  });

  return (
    <div className="flex flex-col h-full">
      <Header title="Customers" subtitle="Manage customer accounts" />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-48 max-w-sm">
            <Input
              placeholder="Search by name, email, phone..."
              leftIcon={<Search size={16} />}
              value={search}
              onChange={(e) => { setSearch(e.target.value); resetPage(); }}
            />
          </div>
          <div className="w-40">
            <Select
              options={STATUS_OPTIONS}
              value={isActiveFilter}
              onChange={(e) => { setIsActiveFilter(e.target.value); resetPage(); }}
            />
          </div>
          {(search || isActiveFilter) && (
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-500"
              onClick={() => { setSearch(''); setIsActiveFilter(''); resetPage(); }}
            >
              Clear filters
            </Button>
          )}
          {meta && (
            <span className="text-sm text-slate-500 ml-auto">
              {meta.total} customer{meta.total !== 1 ? 's' : ''}
            </span>
          )}
          {canEdit && (
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus size={16} /> New Customer
            </Button>
          )}
        </div>

        <Table<Customer>
          columns={[
            {
              key: 'name',
              header: 'Customer',
              render: (row) => (
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 text-sm font-semibold">
                    {getInitials(row.firstName, row.lastName)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 truncate">
                      {row.firstName} {row.lastName}
                    </p>
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                      <Mail size={10} /> {row.email}
                    </p>
                  </div>
                </div>
              ),
            },
            {
              key: 'phone',
              header: 'Phone',
              render: (row) =>
                row.phone ? (
                  <span className="flex items-center gap-1 text-slate-600">
                    <Phone size={12} /> {row.phone}
                  </span>
                ) : (
                  <span className="text-slate-400">—</span>
                ),
            },
            {
              key: 'orders',
              header: 'Orders',
              render: (row) => (
                <span className="font-medium">{row._count?.orders ?? 0}</span>
              ),
            },
            {
              key: 'isEmailVerified',
              header: 'Email',
              render: (row) => (
                <Badge variant={row.isEmailVerified ? 'success' : 'warning'}>
                  {row.isEmailVerified ? 'Verified' : 'Unverified'}
                </Badge>
              ),
            },
            {
              key: 'isActive',
              header: 'Status',
              render: (row) => (
                <Badge variant={row.isActive ? 'success' : 'danger'}>
                  {row.isActive ? 'Active' : 'Inactive'}
                </Badge>
              ),
            },
            {
              key: 'createdAt',
              header: 'Joined',
              render: (row) => <span className="text-slate-500 text-xs">{formatDate(row.createdAt)}</span>,
            },
            {
              key: 'actions',
              header: '',
              className: 'w-28',
              render: (row) => (
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setViewCustomer(row); }}>
                    View
                  </Button>
                  {canEdit && (
                    row.isActive ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500"
                        onClick={(e) => { e.stopPropagation(); deactivateMutation.mutate(row.id); }}
                      >
                        <UserX size={14} />
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-green-600"
                        onClick={(e) => { e.stopPropagation(); activateMutation.mutate(row.id); }}
                      >
                        <UserCheck size={14} />
                      </Button>
                    )
                  )}
                </div>
              ),
            },
          ]}
          data={customers}
          keyExtractor={(row) => row.id}
          loading={isLoading}
          emptyMessage="No customers found"
          onRowClick={(row) => setViewCustomer(row)}
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

      {/* Create */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="New Customer" size="md">
        <CustomerForm
          onSuccess={() => {
            setShowCreateModal(false);
            queryClient.invalidateQueries({ queryKey: ['customers'] });
            toast('Customer created', 'success');
          }}
        />
      </Modal>

      {/* Edit */}
      <Modal open={!!editCustomer} onClose={() => setEditCustomer(null)} title="Edit Customer" size="md">
        {editCustomer && (
          <CustomerForm
            customer={editCustomer}
            onSuccess={() => {
              setEditCustomer(null);
              queryClient.invalidateQueries({ queryKey: ['customers'] });
              toast('Customer updated', 'success');
            }}
          />
        )}
      </Modal>

      {/* View */}
      <Modal open={!!viewCustomer} onClose={() => setViewCustomer(null)} title="Customer Details" size="md">
        {viewCustomer && (
          <CustomerDetailModal
            customer={viewCustomer}
            onClose={() => setViewCustomer(null)}
            onEdit={() => { setEditCustomer(viewCustomer); setViewCustomer(null); }}
            canEdit={canEdit}
          />
        )}
      </Modal>
    </div>
  );
}
