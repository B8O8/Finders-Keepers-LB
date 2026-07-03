'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, RotateCcw, Check, Minus } from 'lucide-react';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { permissionsApi } from '@/lib/api';

// ─── Permission keys & labels (mirrors backend) ───────────────────────────────

const PERMISSION_GROUPS: { label: string; keys: string[] }[] = [
  { label: 'Dashboard',  keys: ['dashboard:view'] },
  { label: 'Products',   keys: ['products:view', 'products:create', 'products:edit', 'products:delete'] },
  { label: 'Categories', keys: ['categories:view', 'categories:manage'] },
  { label: 'Customers',  keys: ['customers:view', 'customers:manage'] },
  { label: 'Orders',     keys: ['orders:view', 'orders:update_status'] },
  { label: 'Reviews',    keys: ['reviews:view', 'reviews:moderate'] },
  { label: 'Admin',      keys: ['admins:manage', 'activity_logs:view'] },
  { label: 'Settings',   keys: ['settings:edit'] },
];

const PERMISSION_LABELS: Record<string, string> = {
  'dashboard:view':       'View dashboard & stats',
  'products:view':        'View products',
  'products:create':      'Create products',
  'products:edit':        'Edit products',
  'products:delete':      'Delete products',
  'categories:view':      'View categories',
  'categories:manage':    'Manage categories',
  'customers:view':       'View customers',
  'customers:manage':     'Manage customers (activate/deactivate)',
  'orders:view':          'View orders',
  'orders:update_status': 'Update order status',
  'reviews:view':         'View reviews',
  'reviews:moderate':     'Moderate reviews (approve/reject)',
  'admins:manage':        'Manage admin accounts',
  'settings:edit':        'Edit store settings',
  'activity_logs:view':   'View activity logs',
};

const ROLES = ['ADMIN', 'MANAGER'] as const;
type Role = (typeof ROLES)[number];

const ROLE_COLORS: Record<Role, string> = {
  ADMIN:   'bg-indigo-600 text-white',
  MANAGER: 'bg-slate-600 text-white',
};

type PermissionMap = Record<string, Record<string, boolean>>;

// ─── Checkbox cell ────────────────────────────────────────────────────────────

function PermCell({
  allowed,
  locked,
  onChange,
}: {
  allowed: boolean;
  locked?: boolean;
  onChange: (v: boolean) => void;
}) {
  if (locked) {
    return (
      <div className="flex justify-center">
        <span title="Super Admin always has this" className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100">
          <Check size={13} className="text-emerald-600" />
        </span>
      </div>
    );
  }

  return (
    <div className="flex justify-center">
      <button
        onClick={() => onChange(!allowed)}
        className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all ${
          allowed
            ? 'border-emerald-500 bg-emerald-500 text-white'
            : 'border-slate-300 bg-white text-transparent hover:border-slate-400'
        }`}
      >
        <Check size={12} />
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PermissionsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: serverPerms, isLoading } = useQuery<PermissionMap>({
    queryKey: ['permissions'],
    queryFn: permissionsApi.getAll,
  });

  // Local draft — starts as copy of server state
  const [draft, setDraft] = useState<PermissionMap | null>(null);

  const perms: PermissionMap = draft ?? serverPerms ?? {};

  const toggle = useCallback((role: string, permission: string, value: boolean) => {
    setDraft((prev) => {
      const base = prev ?? serverPerms ?? {};
      return {
        ...base,
        [role]: { ...(base[role] ?? {}), [permission]: value },
      };
    });
  }, [serverPerms]);

  const reset = () => setDraft(null);

  const isDirty = draft !== null;

  // Count pending changes
  const changeCount = isDirty
    ? ROLES.flatMap((role) =>
        Object.entries(draft?.[role] ?? {}).filter(
          ([perm, val]) => (serverPerms?.[role]?.[perm] ?? false) !== val,
        ),
      ).length
    : 0;

  const saveMutation = useMutation({
    mutationFn: () => {
      const updates: { role: string; permission: string; allowed: boolean }[] = [];
      for (const role of ROLES) {
        for (const key of Object.keys(PERMISSION_LABELS)) {
          const current = perms[role]?.[key] ?? false;
          const original = serverPerms?.[role]?.[key] ?? false;
          if (current !== original) {
            updates.push({ role, permission: key, allowed: current });
          }
        }
      }
      return permissionsApi.update(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissions'] });
      setDraft(null);
      toast('Permissions saved', 'success');
    },
    onError: () => toast('Failed to save permissions', 'error'),
  });

  return (
    <div className="flex flex-col h-full">
      <Header title="Role Permissions" subtitle="Control what each role can access" />

      <div className="flex-1 overflow-auto p-6 space-y-4">
        {/* Top bar */}
        <div className="flex items-center gap-3">
          <Link
            href="/admins"
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition"
          >
            <ArrowLeft size={15} /> Back to Admin Users
          </Link>
          <div className="flex-1" />
          {isDirty && (
            <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
              {changeCount} unsaved change{changeCount !== 1 ? 's' : ''}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={reset} disabled={!isDirty}>
            <RotateCcw size={13} /> Reset
          </Button>
          <Button
            size="sm"
            onClick={() => saveMutation.mutate()}
            loading={saveMutation.isPending}
            disabled={!isDirty}
          >
            <Save size={13} /> Save Changes
          </Button>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100">
              <Check size={11} className="text-emerald-600" />
            </span>
            Super Admin (always full access — cannot be restricted)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-emerald-500 bg-emerald-500">
              <Check size={11} className="text-white" />
            </span>
            Allowed
          </span>
          <span className="flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-slate-300" />
            Denied
          </span>
        </div>

        {/* Permission matrix */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          {/* Header row */}
          <div className="grid border-b border-slate-200 bg-slate-50" style={{ gridTemplateColumns: '1fr repeat(3, 120px)' }}>
            <div className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Permission</div>
            <div className="py-3 text-center">
              <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold bg-red-100 text-red-700">
                SUPER ADMIN
              </span>
            </div>
            {ROLES.map((role) => (
              <div key={role} className="py-3 text-center">
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${ROLE_COLORS[role]}`}>
                  {role.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>

          {isLoading ? (
            <div className="divide-y divide-slate-100">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="h-3 flex-1 animate-pulse rounded bg-slate-200" />
                  <div className="h-5 w-5 animate-pulse rounded-full bg-slate-200 mx-8" />
                  <div className="h-5 w-5 animate-pulse rounded-full bg-slate-200 mx-8" />
                  <div className="h-5 w-5 animate-pulse rounded-full bg-slate-200 mx-8" />
                </div>
              ))}
            </div>
          ) : (
            <div>
              {PERMISSION_GROUPS.map((group, gi) => (
                <div key={group.label}>
                  {/* Group header */}
                  <div className="px-5 py-2 bg-slate-50 border-t border-slate-100">
                    <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                      {group.label}
                    </span>
                  </div>

                  {group.keys.map((perm, pi) => {
                    const isLast = gi === PERMISSION_GROUPS.length - 1 && pi === group.keys.length - 1;
                    return (
                      <div
                        key={perm}
                        className={`grid items-center hover:bg-slate-50 transition-colors ${!isLast ? 'border-b border-slate-100' : ''}`}
                        style={{ gridTemplateColumns: '1fr repeat(3, 120px)' }}
                      >
                        <div className="px-5 py-3">
                          <span className="text-sm text-slate-700">{PERMISSION_LABELS[perm] ?? perm}</span>
                          <span className="ml-2 font-mono text-[10px] text-slate-400">{perm}</span>
                        </div>

                        {/* SUPER_ADMIN — always locked ON */}
                        <PermCell allowed={true} locked={true} onChange={() => {}} />

                        {/* ADMIN + MANAGER — editable */}
                        {ROLES.map((role) => (
                          <PermCell
                            key={role}
                            allowed={perms[role]?.[perm] ?? false}
                            onChange={(v) => toggle(role, perm, v)}
                          />
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-xs text-slate-400 text-center pb-2">
          Changes take effect on the admin's next API request. They may need to refresh their browser.
        </p>
      </div>
    </div>
  );
}
