'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  ShoppingCart,
  Users,
  Package,
  DollarSign,
  Clock,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import { dashboardApi } from '@/lib/api';
import { formatCurrency, formatDateTime, ORDER_STATUS_COLORS, PAYMENT_STATUS_COLORS } from '@/lib/utils';
import type { DashboardData, Order, ProductVariant } from '@/types';
import { cn } from '@/lib/utils';

export default function DashboardPage() {
  const router = useRouter();
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: dashboardApi.getStats,
    refetchInterval: 60_000,
  });

  const stats = data?.stats;

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Dashboard"
        subtitle={`Overview · ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`}
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Stat cards — clickable for quick navigation */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <button onClick={() => router.push('/orders')} className="text-left focus:outline-none group">
            <StatCard
              title="Total Orders"
              value={isLoading ? '—' : (stats?.totalOrders ?? 0)}
              icon={<ShoppingCart size={20} />}
              color="indigo"
              className="group-hover:shadow-md transition-shadow cursor-pointer"
            />
          </button>
          <button onClick={() => router.push('/orders?status=PENDING')} className="text-left focus:outline-none group">
            <StatCard
              title="Pending Orders"
              value={isLoading ? '—' : (stats?.pendingOrders ?? 0)}
              icon={<Clock size={20} />}
              color="amber"
              className="group-hover:shadow-md transition-shadow cursor-pointer"
            />
          </button>
          <button onClick={() => router.push('/customers')} className="text-left focus:outline-none group">
            <StatCard
              title="Customers"
              value={isLoading ? '—' : (stats?.totalCustomers ?? 0)}
              icon={<Users size={20} />}
              color="blue"
              className="group-hover:shadow-md transition-shadow cursor-pointer"
            />
          </button>
          <button onClick={() => router.push('/products')} className="text-left focus:outline-none group">
            <StatCard
              title="Products"
              value={isLoading ? '—' : (stats?.totalProducts ?? 0)}
              icon={<Package size={20} />}
              color="violet"
              className="group-hover:shadow-md transition-shadow cursor-pointer"
            />
          </button>
          <StatCard
            title="Total Revenue"
            value={isLoading ? '—' : formatCurrency(stats?.totalRevenue ?? 0)}
            icon={<DollarSign size={20} />}
            color="emerald"
          />
          <StatCard
            title="Today's Revenue"
            value={isLoading ? '—' : formatCurrency(stats?.todayRevenue ?? 0)}
            icon={<TrendingUp size={20} />}
            color="rose"
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Recent Orders */}
          <div className="xl:col-span-2 rounded-xl bg-white border border-slate-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">Recent Orders</h2>
              <a href="/orders" className="text-xs text-indigo-600 hover:underline font-medium">
                View all →
              </a>
            </div>
            <Table<Order>
              columns={[
                {
                  key: 'orderNumber',
                  header: 'Order',
                  render: (row) => (
                    <a href={`/orders/${row.id}`} className="font-medium text-indigo-600 hover:underline font-mono">
                      #{row.orderNumber}
                    </a>
                  ),
                },
                {
                  key: 'customer',
                  header: 'Customer',
                  render: (row) =>
                    row.customer
                      ? `${row.customer.firstName} ${row.customer.lastName}`
                      : 'Guest',
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: (row) => (
                    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', ORDER_STATUS_COLORS[row.status])}>
                      {row.status}
                    </span>
                  ),
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
                  header: 'Amount',
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
              ]}
              data={data?.recentOrders ?? []}
              keyExtractor={(row) => row.id}
              loading={isLoading}
              emptyMessage="No recent orders"
              onRowClick={(row) => router.push(`/orders/${row.id}`)}
            />
          </div>

          {/* Low Stock */}
          <div className="rounded-xl bg-white border border-slate-200">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-200">
              <AlertTriangle size={16} className="text-amber-500" />
              <h2 className="text-base font-semibold text-slate-900">Low Stock Alerts</h2>
            </div>
            {isLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-12 animate-pulse rounded bg-slate-100" />
                ))}
              </div>
            ) : (data?.lowStockProducts ?? []).length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-400">All products are well-stocked ✓</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {(data?.lowStockProducts ?? []).map((variant: ProductVariant) => (
                  <li
                    key={variant.id}
                    className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 cursor-pointer"
                    onClick={() => variant.productId && router.push(`/products/${variant.productId}`)}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {variant.product?.name ?? 'Unknown'}
                      </p>
                      <p className="text-xs text-slate-500 truncate">{variant.name} · {variant.sku}</p>
                    </div>
                    <Badge
                      variant={variant.stock === 0 ? 'danger' : 'warning'}
                      className="ml-3 shrink-0"
                    >
                      {variant.stock} left
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
