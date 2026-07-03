// ─── Enums ────────────────────────────────────────────────────────────────────

export enum AdminRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
}

export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  RETURNED = 'RETURNED',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}


// ─── Auth ──────────────────────────────────────────────────────────────────────

export interface Admin {
  id: string;
  email: string;
  fullName: string;
  role: AdminRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse {
  admin: Admin;
  tokens: AuthTokens;
}

// ─── Dashboard ─────────────────────────────────────────────────────────────────

export interface DashboardStats {
  totalOrders: number;
  pendingOrders: number;
  totalCustomers: number;
  totalProducts: number;
  totalRevenue: number;
  todayRevenue: number;
}

export interface DashboardData {
  stats: DashboardStats;
  lowStockProducts: ProductVariant[];
  recentOrders: Order[];
}

// ─── Category ─────────────────────────────────────────────────────────────────

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parentId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  children?: Category[];
  _count?: { products: number };
}

// ─── Product ──────────────────────────────────────────────────────────────────

export interface ProductImage {
  id: string;
  fileId: string;
  variantId?: string | null;
  isPrimary: boolean;
  sortOrder: number;
  file: { url: string };
}

export interface ProductVariant {
  id: string;
  productId: string;
  name: string;
  sku?: string;
  plu?: string;
  barcode?: string;
  posProductId?: string;
  price: number;
  costPrice?: number;
  comparePrice?: number;
  stock: number;
  isDefault: boolean;
  isActive: boolean;
  attributes?: Record<string, string>;
  product?: Product;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description?: string;
  categoryId?: string;
  category?: Category;
  isActive: boolean;
  isFeatured: boolean;
  images: ProductImage[];
  variants: ProductVariant[];
  _count?: { variants: number; reviews: number };
  createdAt: string;
  updatedAt: string;
}

// ─── Customer ─────────────────────────────────────────────────────────────────

export interface Customer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  isActive: boolean;
  isEmailVerified: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { orders: number };
}

// ─── Order ────────────────────────────────────────────────────────────────────

export interface OrderItem {
  id: string;
  orderId: string;
  variantId: string;
  variant?: ProductVariant;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId?: string;
  customer?: Customer;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  totalAmount: number;
  shippingAddress?: Record<string, string>;
  notes?: string;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
}

// ─── Review ───────────────────────────────────────────────────────────────────

export interface ProductReview {
  id: string;
  productId: string;
  product?: Product;
  customerId: string;
  customer?: Customer;
  rating: number;
  title?: string;
  comment?: string;
  isApproved: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export interface StoreSettings {
  storeName: string;
  storeEmail?: string;
  storePhone?: string;
  currency: string;
  currencySymbol: string;
  maintenanceMode: boolean;
  allowGuestCheckout: boolean;
  lowStockThreshold: number;
}

// ─── Activity Log ─────────────────────────────────────────────────────────────

export interface ActivityLog {
  id: string;
  adminId?: string;
  admin?: Admin;
  action: string;
  entity: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginatedMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginatedMeta;
}

// ─── File ─────────────────────────────────────────────────────────────────────

export interface UploadedFile {
 id: string;
  url: string;
  filename: string;
  mimetype: string;
  size: number;
  createdAt: string;
}
