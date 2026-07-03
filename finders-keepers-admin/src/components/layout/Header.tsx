'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Bell, ShoppingCart, AlertTriangle, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth.store';
import { authApi, dashboardApi } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import type { DashboardData } from '@/types';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: dashboardApi.getStats,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const pendingOrders = data?.stats?.pendingOrders ?? 0;
  const lowStockCount = data?.lowStockProducts?.length ?? 0;
  const totalAlerts = pendingOrders + lowStockCount;

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
      >
        <Bell size={20} />
        {totalAlerts > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {totalAlerts > 9 ? '9+' : totalAlerts}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-slate-200 bg-white shadow-lg z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <p className="text-sm font-semibold text-slate-800">Notifications</p>
            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {/* Pending orders */}
            <button
              onClick={() => { router.push('/orders?status=PENDING'); setOpen(false); }}
              className="w-full flex items-start gap-3 px-4 py-3 hover:bg-slate-50 text-left transition"
            >
              <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${pendingOrders > 0 ? 'bg-amber-100' : 'bg-slate-100'}`}>
                <ShoppingCart size={14} className={pendingOrders > 0 ? 'text-amber-600' : 'text-slate-400'} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800">
                  {pendingOrders > 0 ? `${pendingOrders} pending order${pendingOrders !== 1 ? 's' : ''}` : 'No pending orders'}
                </p>
                <p className="text-xs text-slate-500">
                  {pendingOrders > 0 ? 'Tap to view and process' : 'All orders are up to date'}
                </p>
              </div>
              {pendingOrders > 0 && (
                <span className="shrink-0 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
                  {pendingOrders}
                </span>
              )}
            </button>

            {/* Low stock */}
            <button
              onClick={() => { router.push('/dashboard'); setOpen(false); }}
              className="w-full flex items-start gap-3 px-4 py-3 hover:bg-slate-50 text-left transition"
            >
              <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${lowStockCount > 0 ? 'bg-rose-100' : 'bg-slate-100'}`}>
                <AlertTriangle size={14} className={lowStockCount > 0 ? 'text-rose-600' : 'text-slate-400'} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800">
                  {lowStockCount > 0 ? `${lowStockCount} low-stock alert${lowStockCount !== 1 ? 's' : ''}` : 'Stock levels OK'}
                </p>
                <p className="text-xs text-slate-500">
                  {lowStockCount > 0 ? 'Tap to view on dashboard' : 'All products are well stocked'}
                </p>
              </div>
              {lowStockCount > 0 && (
                <span className="shrink-0 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white">
                  {lowStockCount}
                </span>
              )}
            </button>
          </div>

          {totalAlerts === 0 && (
            <p className="px-4 py-4 text-center text-xs text-slate-400">You're all caught up 🎉</p>
          )}

          <div className="border-t border-slate-100 px-4 py-2">
            <p className="text-[10px] text-slate-400 text-center">Auto-refreshes every 60 seconds</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Header({ title, subtitle }: HeaderProps) {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const { toast } = useToast();

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore errors on logout
    }
    logout();
    toast('Logged out successfully', 'success');
    router.push('/login');
  };

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">
        <NotificationBell />
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
        >
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </div>
    </header>
  );
}
