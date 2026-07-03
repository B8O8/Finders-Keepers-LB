'use client';

import { use, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { ordersApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { AdminRole, Order, OrderStatus, PaymentStatus } from '@/types';
import { formatCurrency, formatDateTime, ORDER_STATUS_COLORS, PAYMENT_STATUS_COLORS } from '@/lib/utils';
import { cn } from '@/lib/utils';

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const admin = useAuthStore((s) => s.admin);
  const canEdit = admin?.role === AdminRole.SUPER_ADMIN || admin?.role === AdminRole.ADMIN;

  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [newPayment, setNewPayment] = useState('');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const { data: order, isLoading } = useQuery<Order>({
    queryKey: ['order', id],
    queryFn: () => ordersApi.findOne(id),
  });

  const updateStatusMutation = useMutation({
    mutationFn: (status: string) => ordersApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      toast('Order status updated', 'success');
      setShowStatusModal(false);
    },
    onError: () => toast('Failed to update status', 'error'),
  });

  const updatePaymentMutation = useMutation({
    mutationFn: (paymentStatus: string) => ordersApi.updatePaymentStatus(id, paymentStatus),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      toast('Payment status updated', 'success');
      setShowPaymentModal(false);
    },
    onError: () => toast('Failed to update payment status', 'error'),
  });

  const cancelMutation = useMutation({
    mutationFn: () => ordersApi.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      toast('Order cancelled', 'success');
      setShowCancelConfirm(false);
    },
    onError: () => toast('Failed to cancel order', 'error'),
  });

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Loading..." />
        <div className="flex-1 p-6 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-slate-200" />
          ))}
        </div>
      </div>
    );
  }

  if (!order) return null;

  const isCancellable = order.status !== OrderStatus.CANCELLED && order.status !== OrderStatus.DELIVERED;

  return (
    <div className="flex flex-col h-full">
      <Header title={`Order #${order.orderNumber}`} subtitle={`Placed on ${formatDateTime(order.createdAt)}`} />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <Link
          href="/orders"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft size={16} /> Back to Orders
        </Link>

        {/* Status bar */}
        <div className="rounded-xl bg-white border border-slate-200 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div>
                <p className="text-xs text-slate-500 mb-1">Order Status</p>
                <span className={cn('inline-flex items-center rounded-full px-3 py-1 text-sm font-medium', ORDER_STATUS_COLORS[order.status])}>
                  {order.status}
                </span>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Payment Status</p>
                <span className={cn('inline-flex items-center rounded-full px-3 py-1 text-sm font-medium', PAYMENT_STATUS_COLORS[order.paymentStatus])}>
                  {order.paymentStatus}
                </span>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Total</p>
                <p className="text-lg font-bold text-slate-900">{formatCurrency(Number(order.totalAmount))}</p>
              </div>
            </div>
            {canEdit && (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => { setNewStatus(order.status); setShowStatusModal(true); }}>
                  Update Status
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setNewPayment(order.paymentStatus); setShowPaymentModal(true); }}>
                  Update Payment
                </Button>
                {isCancellable && (
                  <Button size="sm" variant="danger" onClick={() => setShowCancelConfirm(true)}>
                    Cancel Order
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Order Items */}
          <div className="lg:col-span-2 rounded-xl bg-white border border-slate-200">
            <div className="px-5 py-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900">Order Items</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {order.items?.map((item) => (
                <div key={item.id} className="flex items-center justify-between px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900 truncate">
                      {item.variant?.product?.name ?? `Variant ${item.variantId}`}
                    </p>
                    <p className="text-xs text-slate-500">
                      {item.variant?.name && `${item.variant.name} · `}
                      SKU: {item.variant?.sku ?? '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-6 shrink-0 ml-4">
                    <span className="text-sm text-slate-500">×{item.quantity}</span>
                    <span className="text-sm font-medium w-20 text-right">{formatCurrency(Number(item.unitPrice))}</span>
                    <span className="text-sm font-semibold w-24 text-right">{formatCurrency(Number(item.totalPrice))}</span>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between px-5 py-3 bg-slate-50">
                <span className="font-semibold text-slate-900">Total</span>
                <span className="text-lg font-bold text-slate-900">{formatCurrency(Number(order.totalAmount))}</span>
              </div>
            </div>
          </div>

          {/* Sidebar info */}
          <div className="space-y-4">
            {/* Customer */}
            <div className="rounded-xl bg-white border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-900 mb-3">Customer</h3>
              {order.customer ? (
                <div className="text-sm space-y-1">
                  <p className="font-medium">{order.customer.firstName} {order.customer.lastName}</p>
                  <p className="text-slate-500">{order.customer.email}</p>
                  {order.customer.phone && <p className="text-slate-500">{order.customer.phone}</p>}
                </div>
              ) : (
                <p className="text-sm text-slate-400 italic">Guest checkout</p>
              )}
            </div>

            {/* Shipping Address */}
            {order.shippingAddress && (
              <div className="rounded-xl bg-white border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-900 mb-3">Shipping Address</h3>
                <div className="text-sm space-y-0.5 text-slate-600">
                  {Object.entries(order.shippingAddress).map(([k, v]) => (
                    <p key={k}>{String(v)}</p>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {order.notes && (
              <div className="rounded-xl bg-white border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-900 mb-2">Notes</h3>
                <p className="text-sm text-slate-600">{order.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status modal */}
      <Modal open={showStatusModal} onClose={() => setShowStatusModal(false)} title="Update Order Status" size="sm">
        <div className="space-y-4">
          <Select
            label="New Status"
            options={Object.values(OrderStatus).map((s) => ({ value: s, label: s }))}
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowStatusModal(false)}>Cancel</Button>
            <Button
              loading={updateStatusMutation.isPending}
              onClick={() => newStatus && updateStatusMutation.mutate(newStatus)}
            >
              Update
            </Button>
          </div>
        </div>
      </Modal>

      {/* Payment modal */}
      <Modal open={showPaymentModal} onClose={() => setShowPaymentModal(false)} title="Update Payment Status" size="sm">
        <div className="space-y-4">
          <Select
            label="New Payment Status"
            options={Object.values(PaymentStatus).map((s) => ({ value: s, label: s }))}
            value={newPayment}
            onChange={(e) => setNewPayment(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowPaymentModal(false)}>Cancel</Button>
            <Button
              loading={updatePaymentMutation.isPending}
              onClick={() => newPayment && updatePaymentMutation.mutate(newPayment)}
            >
              Update
            </Button>
          </div>
        </div>
      </Modal>

      {/* Cancel confirm */}
      <Modal open={showCancelConfirm} onClose={() => setShowCancelConfirm(false)} title="Cancel Order" size="sm">
        <p className="text-sm text-slate-600">Are you sure you want to cancel order #{order.orderNumber}? This action cannot be undone.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setShowCancelConfirm(false)}>No, Keep Order</Button>
          <Button
            variant="danger"
            loading={cancelMutation.isPending}
            onClick={() => cancelMutation.mutate()}
          >
            Yes, Cancel Order
          </Button>
        </div>
      </Modal>
    </div>
  );
}
