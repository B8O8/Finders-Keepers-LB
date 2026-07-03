'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  Tag,
  Users,
  ShoppingCart,
  Star,
  Shield,
  Settings,
  ScrollText,
  ChevronRight,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import { AdminRole } from '@/types';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: [AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.MANAGER] },
  { href: '/products', label: 'Products', icon: Package, roles: [AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.MANAGER] },
  { href: '/categories', label: 'Categories', icon: Tag, roles: [AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.MANAGER] },
  { href: '/customers', label: 'Customers', icon: Users, roles: [AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.MANAGER] },
  { href: '/orders', label: 'Orders', icon: ShoppingCart, roles: [AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.MANAGER] },
  { href: '/reviews', label: 'Reviews', icon: Star, roles: [AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.MANAGER] },
  { href: '/admins', label: 'Admin Users', icon: Shield, roles: [AdminRole.SUPER_ADMIN] },
  { href: '/settings', label: 'Settings', icon: Settings, roles: [AdminRole.SUPER_ADMIN, AdminRole.ADMIN] },
  { href: '/activity-logs', label: 'Activity Logs', icon: ScrollText, roles: [AdminRole.SUPER_ADMIN] },
];

export default function Sidebar() {
  const pathname = usePathname();
  const admin = useAuthStore((s) => s.admin);

  const visibleItems = navItems.filter(
    (item) => !admin || item.roles.includes(admin.role),
  );

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col bg-slate-900 text-white">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-800">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600">
          <Search size={18} className="text-white" />
        </div>
        <div>
          <p className="text-sm font-bold leading-tight text-white">Finders Keepers</p>
          <p className="text-xs text-slate-400">Admin Panel</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <p className="mb-2 px-2 text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
          Main Menu
        </p>
        <ul className="space-y-0.5">
          {visibleItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all',
                    isActive
                      ? 'bg-indigo-600 text-white font-medium'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white',
                  )}
                >
                  <Icon size={18} className="shrink-0" />
                  <span className="flex-1">{label}</span>
                  {isActive && <ChevronRight size={14} />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Admin info */}
      {admin && (
        <div className="border-t border-slate-800 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold">
              {admin.fullName?.[0] ?? admin.email[0].toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">
                {admin.fullName || admin.email}
              </p>
              <p className="truncate text-xs text-slate-400">{admin.role.replace('_', ' ')}</p>
            </div>
          </div>
        </div>
      )}
    </aside>
);
}
