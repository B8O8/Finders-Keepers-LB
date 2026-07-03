'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, UserCheck, UserX, Shield, Check, X, Pencil, Lock } from 'lucide-react';
import Header from '@/components/layout/Header';
import Table from '@/components/ui/Table';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { adminsApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { Admin, AdminRole } from '@/types';
import { formatDate } from '@/lib/utils';
import { useForm } from 'react-hook-form';
import Link from 'next/link';

const ROLE_OPTIONS = Object.values(AdminRole).map((r) => ({ value: r, label: r.replace('_', ' ') }));

const ROLE_COLORS: Record<AdminRole, string> = {
  [AdminRole.SUPER_ADMIN]: 'bg-red-100 text-red-700',
  [AdminRole.ADMIN]: 'bg-indigo-100 text-indigo-700',
  [AdminRole.MANAGER]: 'bg-slate-100 text-slate-700',
};

const ROLE_DESCRIPTIONS: Record<AdminRole, { label: string; description: string; capabilities: { label: string; allowed: boolean }[] }> = {
  [AdminRole.SUPER_ADMIN]: {
    label: 'Super Admin',
    description: 'Full unrestricted access to all features.',
    capabilities: [
      { label: 'View dashboard & stats', allowed: true },
      { label: 'Create / edit / delete products', allowed: true },
      { label: 'Manage categories', allowed: true },
      { label: 'Update order status', allowed: true },
      { label: 'Manage customers', allowed: true },
      { label: 'Moderate reviews', allowed: true },
      { label: 'Create & manage admin accounts', allowed: true },
      { label: 'Edit store settings', allowed: true },
      { label: 'View activity logs', allowed: true },
    ],
  },
  [AdminRole.ADMIN]: {
    label: 'Admin',
    description: 'Full product & order management. Cannot manage other admins.',
    capabilities: [
      { label: 'View dashboard & stats', allowed: true },
      { label: 'Create / edit products (no delete)', allowed: true },
      { label: 'Manage categories', allowed: true },
      { label: 'Update order status', allowed: true },
      { label: 'Manage customers', allowed: true },
      { label: 'Moderate reviews', allowed: true },
      { label: 'Create & manage admin accounts', allowed: false },
      { label: 'Edit store settings', allowed: true },
      { label: 'View activity logs', allowed: false },
    ],
  },
  [AdminRole.MANAGER]: {
    label: 'Manager',
    description: 'View-only access to most areas. Can update order status.',
    capabilities: [
      { label: 'View dashboard & stats', allowed: true },
      { label: 'Create / edit / delete products', allowed: false },
      { label: 'View categories', allowed: true },
      { label: 'Update order status', allowed: true },
      { label: 'View customers (read-only)', allowed: true },
      { label: 'Moderate reviews', allowed: true },
      { label: 'Create & manage admin accounts', allowed: false },
      { label: 'Edit store settings', allowed: false },
      { label: 'View activity logs', allowed: false },
    ],
  },
};

function RoleCard({ role }: { role: AdminRole }) {
  const info = ROLE_DESCRIPTIONS[role];
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2">
      <p className="text-sm font-semibold text-slate-800">{info.label} — {info.description}</p>
      <ul className="grid grid-cols-1 gap-1">
        {info.capabilities.map((cap) => (
          <li key={cap.label} className="flex items-center gap-2 text-xs">
            {cap.allowed
              ? <Check size={12} className="text-emerald-600 shrink-0" />
              : <X size={12} className="text-slate-300 shrink-0" />}
            <span className={cap.allowed ? 'text-slate-700' : 'text-slate-400'}>{cap.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AdminForm({ onSuccess }: { onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, watch } = useForm({
    defaultValues: { fullName: '', email: '', password: '', role: AdminRole.MANAGER },
  });
  const selectedRole = watch('role') as AdminRole;

  const onSubmit = async (data: Record<string, unknown>) => {
    setLoading(true);
    try { await adminsApi.create(data); onSuccess(); }
    finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit as never)} className="space-y-4">
      <Input label="Full Name" required placeholder="John Doe" {...register('fullName')} />
      <Input label="Email" type="email" required placeholder="admin@example.com" {...register('email')} />
      <Input label="Password" type="password" required placeholder="Minimum 6 characters" {...register('password')} />
      <Select label="Role" options={ROLE_OPTIONS} {...register('role')} />
      <RoleCard role={selectedRole} />
      <div className="flex justify-end pt-2">
        <Button type="submit" loading={loading}>Create Admin</Button>
      </div>
    </form>
  );
}

function EditAdminForm({ admin, onSuccess }: { admin: Admin; onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, watch } = useForm({
    defaultValues: { fullName: admin.fullName ?? '', role: admin.role },
  });
  const selectedRole = watch('role') as AdminRole;

  const onSubmit = async (data: Record<string, unknown>) => {
    setLoading(true);
    try { await adminsApi.update(admin.id, data); onSuccess(); }
    finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit as never)} className="space-y-4">
      <Input label="Full Name" placeholder="John Doe" {...register('fullName')} />
      <Select label="Role" options={ROLE_OPTIONS} {...register('role')} />
      <RoleCard role={selectedRole} />
      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
        Role changes take effect immediately. The admin may need to log out and back in.
      </p>
      <div className="flex justify-end pt-2">
        <Button type="submit" loading={loading}>Save Changes</Button>
      </div>
    </form>
  );
}

export default function AdminsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const currentAdmin = useAuthStore((s) => s.admin);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editAdmin, setEditAdmin] = useState<Admin | null>(null);
  const [viewRole, setViewRole] = useState<AdminRole | null>(null);

  const { data: admins, isLoading } = useQuery<Admin[]>({
    queryKey: ['admins'],
    queryFn: adminsApi.findAll,
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => adminsApi.activate(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admins'] }); toast('Admin activated', 'success'); },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => adminsApi.deactivate(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admins'] }); toast('Admin deactivated', 'success'); },
  });

  return (
    <div className="flex flex-col h-full">
      <Header title="Admin Users" subtitle="Manage admin access and roles" />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Role legend */}
        <div className="grid grid-cols-3 gap-3">
          {Object.values(AdminRole).map((role) => (
            <button
              key={role}
              onClick={() => setViewRole(role)}
              className="text-left rounded-xl border border-slate-200 bg-white p-4 hover:border-indigo-300 hover:shadow-sm transition group"
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${ROLE_COLORS[role]}`}>
                  <Shield size={11} /> {role.replace('_', ' ')}
                </span>
                <span className="text-xs text-indigo-500 opacity-0 group-hover:opacity-100 transition">View →</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">{ROLE_DESCRIPTIONS[role].description}</p>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">{admins?.length ?? 0} admin accounts</p>
          <div className="flex items-center gap-2">
            <Link href="/admins/permissions">
              <Button variant="outline">
                <Lock size={15} /> Manage Permissions
              </Button>
            </Link>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus size={16} /> New Admin
            </Button>
          </div>
        </div>

        <Table<Admin>
          columns={[
            {
              key: 'name',
              header: 'Admin',
              render: (row) => (
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-800 text-white text-sm font-semibold">
                    {(row.fullName?.[0] ?? row.email[0]).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">
                      {row.fullName || row.email}
                      {row.id === currentAdmin?.id && (
                        <span className="ml-2 text-xs text-indigo-500">(you)</span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500">{row.email}</p>
                  </div>
                </div>
              ),
            },
            {
              key: 'role',
              header: 'Role',
              render: (row) => (
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${ROLE_COLORS[row.role]}`}>
                  <Shield size={11} /> {row.role.replace('_', ' ')}
                </span>
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
              header: 'Created',
              render: (row) => <span className="text-slate-500 text-xs">{formatDate(row.createdAt)}</span>,
            },
            {
              key: 'actions',
              header: '',
              className: 'w-32',
              render: (row) =>
                row.id !== currentAdmin?.id ? (
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditAdmin(row)}
                      title="Edit role"
                    >
                      <Pencil size={13} />
                    </Button>
                    {row.isActive ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500 hover:text-red-700"
                        onClick={() => deactivateMutation.mutate(row.id)}
                        title="Deactivate"
                      >
                        <UserX size={14} />
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-green-600 hover:text-green-800"
                        onClick={() => activateMutation.mutate(row.id)}
                        title="Activate"
                      >
                        <UserCheck size={14} />
                      </Button>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-slate-400 px-2">—</span>
                ),
            },
          ]}
          data={admins ?? []}
          keyExtractor={(row) => row.id}
          loading={isLoading}
          emptyMessage="No admins found"
        />
      </div>

      {/* Create */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create Admin User" size="md">
        <AdminForm
          onSuccess={() => {
            setShowCreateModal(false);
            queryClient.invalidateQueries({ queryKey: ['admins'] });
            toast('Admin created', 'success');
          }}
        />
      </Modal>

      {/* Edit */}
      <Modal open={!!editAdmin} onClose={() => setEditAdmin(null)} title="Edit Admin" size="md">
        {editAdmin && (
          <EditAdminForm
            admin={editAdmin}
            onSuccess={() => {
              setEditAdmin(null);
              queryClient.invalidateQueries({ queryKey: ['admins'] });
              toast('Admin updated', 'success');
            }}
          />
        )}
      </Modal>

      {/* Role detail */}
      <Modal open={!!viewRole} onClose={() => setViewRole(null)} title={`${viewRole?.replace('_', ' ')} Permissions`} size="sm">
        {viewRole && <RoleCard role={viewRole} />}
      </Modal>
    </div>
  );
}
