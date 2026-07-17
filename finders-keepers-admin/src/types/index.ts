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
  imageId?: string | null;
  image?: FileAsset | null;
  sortOrder?: number;
  _count?: { products: number; productCategories?: number };
}

// ─── Product ──────────────────────────────────────────────────────────────────

export interface ProductImage {
  id: string;
  fileId: string;
  variantId?: string | null;
  isPrimary: boolean;
  sortOrder: number;
  file: FileAsset;
}

export interface ProductVariant {
  id: string;
  productId: string;
  name?: string | null;
  sku?: string | null;
  plu?: string | null;
  barcode?: string | null;
  posProductId?: string | null;
  price: number;
  costPrice?: number | null;
  /** Struck-through "was" price. Matches the API's compareAtPrice. */
  compareAtPrice?: number | null;
  weight?: number | null;
  stock: number;
  /** Backorder: allows ordering at zero stock. */
  allowBackorder: boolean;
  backorderMessage?: string | null;
  availabilityDate?: string | null;
  isDefault: boolean;
  isActive: boolean;
  attributes?: Record<string, string>;
  product?: Product;
  /** Server-computed price, present on storefront-facing payloads. */
  pricing?: PricedResult;
  createdAt: string;
  updatedAt: string;
}

export interface ProductCategoryLink {
  id: string;
  categoryId: string;
  category: Category;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  shortDescription?: string;
  description?: string;
  /** @deprecated kept for one release; use productCategories/primaryCategory */
  categoryId?: string;
  /** @deprecated */
  category?: Category;
  primaryCategoryId?: string | null;
  primaryCategory?: Category | null;
  /** A product may belong to many categories. */
  productCategories?: ProductCategoryLink[];
  isActive: boolean;
  isFeatured: boolean;
  seoTitle?: string;
  seoDescription?: string;
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

/**
 * A stored media asset. `title` is always populated by the API (it falls back
 * to the original filename), so the admin can always show a human label.
 */
export interface FileAsset {
  id: string;
  url: string;
  fileName: string;
  mimeType: string;
  size: number;
  storageType: 'LOCAL' | 'SUPABASE';
  title: string;
  altText?: string | null;
  caption?: string | null;
  entity?: string | null;
  entityId?: string | null;
  createdAt: string;
  updatedAt?: string;
}

/** @deprecated use FileAsset */
export type UploadedFile = FileAsset;

export interface FileReferences {
  productImages: number;
  categories: number;
  total: number;
}

// ─── Pricing / Discounts ──────────────────────────────────────────────────────

export type DiscountType = 'PERCENTAGE' | 'FIXED';
export type DiscountStatus = 'active' | 'scheduled' | 'expired' | 'inactive' | 'archived';

export interface AppliedDiscount {
  discountId: string;
  label: string | null;
  type: DiscountType;
  value: number;
  amount: number;
}

/** Mirrors the API's PricedResult - the single source of truth for money. */
export interface PricedResult {
  variantId: string;
  regularPrice: number;
  finalPrice: number;
  discountAmount: number;
  discountPercent: number;
  onSale: boolean;
  appliedDiscounts: AppliedDiscount[];
  discountId: string | null;
  discountLabel: string | null;
  expiresAt: string | null;
}

export interface DiscountTarget {
  id: string;
  targetType: 'PRODUCT' | 'VARIANT' | 'CATEGORY';
  targetId: string;
  productId?: string | null;
  variantId?: string | null;
  categoryId?: string | null;
  product?: { id: string; name: string; slug: string } | null;
  variant?: { id: string; name: string | null; sku: string | null; productId: string } | null;
  category?: { id: string; name: string; slug: string } | null;
}

export interface Discount {
  id: string;
  name: string;
  description?: string | null;
  publicLabel?: string | null;
  type: DiscountType;
  value: number;
  startsAt: string;
  endsAt?: string | null;
  isActive: boolean;
  minOrderAmount?: number | null;
  maxDiscountAmount?: number | null;
  priority: number;
  stackable: boolean;
  createdByAdminId?: string | null;
  archivedAt?: string | null;
  notificationsEnqueuedAt?: string | null;
  targets: DiscountTarget[];
  status?: DiscountStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DiscountPreviewItem {
  variantId: string;
  variantName: string | null;
  sku: string | null;
  productId: string;
  productName: string;
  productSlug: string;
  regularPrice: number;
  finalPrice: number;
  discountAmount: number;
  discountPercent: number;
}

export interface DiscountPreview {
  discountId: string;
  totalAffectedVariants: number;
  truncated: boolean;
  estimatedWishlistNotifications: number;
  items: DiscountPreviewItem[];
}

// ─── Notifications ────────────────────────────────────────────────────────────

export type NotificationStatus = 'PENDING' | 'SENT' | 'FAILED';

export interface NotificationRow {
  id: string;
  customerId: string;
  channel: 'EMAIL' | 'IN_APP';
  type: 'WISHLIST_SALE';
  status: NotificationStatus;
  discountId?: string | null;
  productId?: string | null;
  variantId?: string | null;
  attempts: number;
  error?: string | null;
  sentAt?: string | null;
  createdAt: string;
  payload?: {
    productName: string;
    variantName: string | null;
    oldPrice: number;
    newPrice: number;
    discountPercent: number;
    productUrl: string;
  } | null;
  customer?: { id: string; email: string | null; firstName: string | null; lastName: string | null };
  discount?: { id: string; name: string; publicLabel: string | null } | null;
  product?: { id: string; name: string; slug: string } | null;
  variant?: { id: string; name: string | null } | null;
}

export interface NotificationStats {
  pending: number;
  sent: number;
  failed: number;
  customersNotified: number;
  total: number;
}
