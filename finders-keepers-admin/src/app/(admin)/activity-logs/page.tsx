'use client';

import { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity, Search, Filter, Download, RefreshCw,
  Package, ShoppingCart, Users, Shield, Settings, Star, ChevronDown, ChevronUp,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import Pagination from '@/components/ui/Pagination';
import { activityLogsApi, adminsApi } from '@/lib/api';
import { ActivityLog, Admin, PaginatedResponse } from '@/types';
import { formatDateTime } from '@/lib/utils';
import { cn } from '@/lib/utils';

// ─── Action colour + icon map ─────────────────────────────────────────────────

const ACTION_META: Record<string, { color: string; bg: string }> = {
  PRODUCT_CREATED:               { color: 'text-emerald-700', bg: 'bg-emerald-100' },
  PRODUCT_UPDATED:               { color: 'text-blue-700',    bg: 'bg-blue-100'    },
  PRODUCT_DELETED:               { color: 'text-red-700',     bg: 'bg-red-100'     },
  PRODUCT_IMAGE_ADDED:           { color: 'text-violet-700',  bg: 'bg-violet-100'  },
  PRODUCT_IMAGE_REMOVED:         { color: 'text-orange-700',  bg: 'bg-orange-100'  },
  PRODUCT_PRIMARY_IMAGE_UPDATED: { color: 'text-violet-700',  bg: 'bg-violet-100'  },
  PRODUCT_IMAGES_REORDERED:      { color: 'text-slate-700',   bg: 'bg-slate-100'   },
  PRODUCT_IMAGE_VARIANT_ASSIGNED:{ color: 'text-indigo-700',  bg: 'bg-indigo-100'  },
  ADMIN_CREATED:                 { color: 'text-emerald-700', bg: 'bg-emerald-100' },
  ADMIN_UPDATED:                 { color: 'text-blue-700',    bg: 'bg-blue-100'    },
  ADMIN_ACTIVATED:               { color: 'text-emerald-700', bg: 'bg-emerald-100' },
  ADMIN_DEACTIVATED:             { color: 'text-red-700',     bg: 'bg-red-100'     },
  ORDER_STATUS_UPDATED:          { color: 'text-amber-700',   bg: 'bg-amber-100'   },
  ORDER_PAYMENT_UPDATED:         { color: 'text-amber-700',   bg: 'bg-amber-100'   },
};

const ENTITY_ICONS: Record<string, React.ReactNode> = {
  Product:  <Package size={13} />,
  Order:    <ShoppingCart size={13} />,
  Customer: <Users size={13} />,
  Admin:    <Shield size={13} />,
  Settings: <Settings size={13} />,
  Review:   <Star size={13} />,
};

function actionMeta(action: string) {
  return ACTION_META[action] ?? { color: 'text-indigo-700', bg: 'bg-indigo-100' };
}

function formatAction(action: string) {
  return action.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

// ─── Metadata viewer ─────────────────────────────────────────────────────────

function MetaViewer({ metadata }: { metadata: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);
  const keys = Object.keys(metadata);
  if (keys.length === 0) return null;
  return (
    <div className="mt-1">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-600 transition"
      >
        {open ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        {open ? 'Hide' : 'Show'} details ({keys.length} field{keys.length !== 1 ? 's' : ''})
      </button>
      {open && (
        <div className="mt-1.5 rounded-md bg-slate-100 px-3 py-2 font-mono text-[11px] text-slate-600 space-y-0.5">
          {keys.map((k) => (
            <div key={k} className="flex gap-2">
              <span className="text-slate-400 shrink-0">{k}:</span>
              <span className="break-all">
                {typeof metadata[k] === 'object'
                  ? JSON.stringify(metadata[k])
                  : String(metadata[k])}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

function exportCSV(logs: ActivityLog[]) {
  const rows = [
    ['Date', 'Admin', 'Action', 'Entity', 'Entity ID', 'Details'],
    ...logs.map((log) => [
      formatDateTime(log.createdAt),
      log.admin ? (log.admin.fullName || log.admin.email) : 'System',
      log.action,
      log.entity ?? '',
      log.entityId ?? '',
      log.metadata ? JSON.stringify(log.metadata) : '',
    ]),
  ];
  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `activity-logs-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const PAGE_LIMIT = 50;

const ENTITY_OPTIONS = [
  { value: '', label: 'All Entities' },
  'Product', 'Order', 'Customer', 'Admin', 'Settings', 'Review',
].map((v) => typeof v === 'string' ? { value: v, label: v } : v);

export default function ActivityLogsPage() {
  const [search, setSearch] = useState('');
  const [entity, setEntity] = useState('');
  const [action, setAction] = useState('');
  const [adminId, setAdminId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  const resetPage = useCallback(() => setPage(1), []);

  const params: Record<string, unknown> = { page, limit: PAGE_LIMIT };
  if (search)   params.search   = search;
  if (entity)   params.entity   = entity;
  if (action)   params.action   = action;
  if (adminId)  params.adminId  = adminId;
  if (dateFrom) params.dateFrom = dateFrom;
  if (dateTo)   params.dateTo   = dateTo;

  const { data: response, isLoading, refetch, isFetching } = useQuery<PaginatedResponse<ActivityLog>>({
    queryKey: ['activity-logs', search, entity, action, adminId, dateFrom, dateTo, page],
    queryFn: () => activityLogsApi.findAll(params),
    refetchInterval: 30_000,
  });

  const { data: admins } = useQuery<Admin[]>({
    queryKey: ['admins'],
    queryFn: adminsApi.findAll,
  });

  const { data: actions } = useQuery<string[]>({
    queryKey: ['activity-log-actions'],
    queryFn: activityLogsApi.getActions,
    staleTime: 5 * 60 * 1000,
  });

  const logs = response?.data ?? [];
  const meta = response?.meta;

  const adminOptions = [
    { value: '', label: 'All Admins' },
    ...(admins ?? []).map((a) => ({ value: a.id, label: a.fullName || a.email })),
  ];

  const actionOptions = [
    { value: '', label: 'All Actions' },
    ...(actions ?? []).map((a) => ({ value: a, label: formatAction(a) })),
  ];

  const activeFilters = [search, entity, action, adminId, dateFrom, dateTo].filter(Boolean).length;

  const clearFilters = () => {
    setSearch(''); setEntity(''); setAction('');
    setAdminId(''); setDateFrom(''); setDateTo('');
    resetPage();
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="Activity Logs" subtitle="Full audit trail of admin actions" />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Filters */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-48 max-w-sm">
              <Input
                placeholder="Search action, entity, admin..."
                leftIcon={<Search size={15} />}
                value={search}
                onChange={(e) => { setSearch(e.target.value); resetPage(); }}
              />
            </div>
            <div className="w-40">
              <Select
                options={ENTITY_OPTIONS}
                value={entity}
                onChange={(e) => { setEntity(e.target.value); resetPage(); }}
              />
            </div>
            <div className="w-52">
              <Select
                options={actionOptions}
                value={action}
                onChange={(e) => { setAction(e.target.value); resetPage(); }}
              />
            </div>
            <div className="w-44">
              <Select
                options={adminOptions}
                value={adminId}
                onChange={(e) => { setAdminId(e.target.value); resetPage(); }}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500 whitespace-nowrap">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); resetPage(); }}
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500 whitespace-nowrap">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); resetPage(); }}
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            {activeFilters > 0 && (
              <Button variant="ghost" size="sm" className="text-slate-500" onClick={clearFilters}>
                <Filter size={13} /> Clear ({activeFilters})
              </Button>
            )}
            <div className="ml-auto flex items-center gap-2">
              {meta && (
                <span className="text-sm text-slate-500">
                  {meta.total.toLocaleString()} log{meta.total !== 1 ? 's' : ''}
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetch()}
                className={cn('text-slate-500', isFetching && 'opacity-50')}
              >
                <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
              </Button>
              {logs.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportCSV(logs)}
                >
                  <Download size={14} /> Export CSV
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Log feed */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          {isLoading ? (
            <div className="divide-y divide-slate-100">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-start gap-4 px-5 py-4">
                  <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-slate-200" />
                  <div className="flex-1 space-y-2 pt-1">
                    <div className="h-3 w-1/3 animate-pulse rounded bg-slate-200" />
                    <div className="h-3 w-2/3 animate-pulse rounded bg-slate-200" />
                  </div>
                  <div className="h-3 w-24 animate-pulse rounded bg-slate-200 mt-1" />
                </div>
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="py-16 text-center">
              <Activity size={32} className="mx-auto text-slate-200 mb-3" />
              <p className="text-sm text-slate-400">No activity found</p>
              {activeFilters > 0 && (
                <button onClick={clearFilters} className="mt-2 text-xs text-indigo-500 hover:underline">
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {logs.map((log) => {
                const meta = actionMeta(log.action);
                return (
                  <div
                    key={log.id}
                    className="flex items-start gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors"
                  >
                    {/* Admin avatar */}
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-800 text-white text-xs font-semibold mt-0.5">
                      {log.admin ? (log.admin.fullName?.[0] ?? log.admin.email[0]).toUpperCase() : 'S'}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium text-slate-900 text-sm">
                          {log.admin ? (log.admin.fullName || log.admin.email) : 'System'}
                        </span>

                        <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold', meta.bg, meta.color)}>
                          {formatAction(log.action)}
                        </span>

                        {log.entity && (
                          <>
                            <span className="text-xs text-slate-400">on</span>
                            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-700">
                              {ENTITY_ICONS[log.entity] ?? null}
                              {log.entity}
                            </span>
                          </>
                        )}

                        {log.entityId && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            #{log.entityId.slice(0, 8)}
                          </span>
                        )}
                      </div>

                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <MetaViewer metadata={log.metadata as Record<string, unknown>} />
                      )}
                    </div>

                    {/* Time */}
                    <p className="shrink-0 text-xs text-slate-400 whitespace-nowrap mt-0.5">
                      {formatDateTime(log.createdAt)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

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
