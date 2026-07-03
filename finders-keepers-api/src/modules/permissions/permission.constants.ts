export const PERMISSION_KEYS = [
  'dashboard:view',
  'products:view',
  'products:create',
  'products:edit',
  'products:delete',
  'categories:view',
  'categories:manage',
  'customers:view',
  'customers:manage',
  'orders:view',
  'orders:update_status',
  'reviews:view',
  'reviews:moderate',
  'admins:manage',
  'settings:edit',
  'activity_logs:view',
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  'dashboard:view':        'View dashboard & stats',
  'products:view':         'View products',
  'products:create':       'Create products',
  'products:edit':         'Edit products',
  'products:delete':       'Delete products',
  'categories:view':       'View categories',
  'categories:manage':     'Manage categories',
  'customers:view':        'View customers',
  'customers:manage':      'Manage customers (activate/deactivate)',
  'orders:view':           'View orders',
  'orders:update_status':  'Update order status',
  'reviews:view':          'View reviews',
  'reviews:moderate':      'Moderate reviews (approve/reject)',
  'admins:manage':         'Manage admin accounts',
  'settings:edit':         'Edit store settings',
  'activity_logs:view':    'View activity logs',
};

export const PERMISSION_GROUPS: { label: string; keys: PermissionKey[] }[] = [
  { label: 'Dashboard',   keys: ['dashboard:view'] },
  { label: 'Products',    keys: ['products:view', 'products:create', 'products:edit', 'products:delete'] },
  { label: 'Categories',  keys: ['categories:view', 'categories:manage'] },
  { label: 'Customers',   keys: ['customers:view', 'customers:manage'] },
  { label: 'Orders',      keys: ['orders:view', 'orders:update_status'] },
  { label: 'Reviews',     keys: ['reviews:view', 'reviews:moderate'] },
  { label: 'Admin',       keys: ['admins:manage', 'activity_logs:view'] },
  { label: 'Settings',    keys: ['settings:edit'] },
];

/** Default permissions seeded when the app starts (if not already in DB) */
export const DEFAULT_PERMISSIONS: Record<string, Record<PermissionKey, boolean>> = {
  SUPER_ADMIN: {
    'dashboard:view': true,
    'products:view': true, 'products:create': true, 'products:edit': true, 'products:delete': true,
    'categories:view': true, 'categories:manage': true,
    'customers:view': true, 'customers:manage': true,
    'orders:view': true, 'orders:update_status': true,
    'reviews:view': true, 'reviews:moderate': true,
    'admins:manage': true,
    'settings:edit': true,
    'activity_logs:view': true,
  },
  ADMIN: {
    'dashboard:view': true,
    'products:view': true, 'products:create': true, 'products:edit': true, 'products:delete': false,
    'categories:view': true, 'categories:manage': true,
    'customers:view': true, 'customers:manage': true,
    'orders:view': true, 'orders:update_status': true,
    'reviews:view': true, 'reviews:moderate': true,
    'admins:manage': false,
    'settings:edit': true,
    'activity_logs:view': false,
  },
  MANAGER: {
    'dashboard:view': true,
    'products:view': true, 'products:create': false, 'products:edit': false, 'products:delete': false,
    'categories:view': true, 'categories:manage': false,
    'customers:view': true, 'customers:manage': false,
    'orders:view': true, 'orders:update_status': true,
    'reviews:view': true, 'reviews:moderate': true,
    'admins:manage': false,
    'settings:edit': false,
    'activity_logs:view': false,
  },
};
