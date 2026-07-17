import type { PricedResult } from "@/types/pricing";

export interface FileAsset {
  id: string;
  url: string;
  fileName: string;
  /** Always populated by the API (falls back to fileName). */
  title?: string;
  /** Used for storefront image alt text. */
  altText?: string | null;
  caption?: string | null;
}

export interface ProductImage {
  id: string;
  isPrimary: boolean;
  sortOrder: number;
  file: FileAsset;
}

export interface ProductVariant {
  id: string;
  productId?: string;
  name?: string | null;
  sku?: string | null;
  plu?: string | null;
  barcode?: string | null;
  price: string | number;
  compareAtPrice?: string | number | null;
  stock: number;
  isDefault: boolean;
  isActive?: boolean;

  /** Backorder: orderable at zero stock. */
  allowBackorder?: boolean;
  backorderMessage?: string | null;
  availabilityDate?: string | null;

  /** Server-computed price. The storefront never calculates money itself. */
  pricing?: PricedResult;
  inStock?: boolean;
  isBackorder?: boolean;
  purchasable?: boolean;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  image?: FileAsset | null;
  children?: Category[];
}

export interface ProductCategoryLink {
  id: string;
  categoryId: string;
  category: Category;
}

export interface ProductReview {
  id: string;
  rating: number;
  title?: string | null;
  comment: string;
  createdAt: string;
  customer?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
  };
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  shortDescription?: string | null;
  description?: string | null;

  /** @deprecated single-category link, kept for one release */
  category?: Category | null;
  primaryCategory?: Category | null;
  productCategories?: ProductCategoryLink[];
  /** Flattened categories, provided by the storefront API. */
  categories?: Category[];

  variants: ProductVariant[];
  images: ProductImage[];
  reviews?: ProductReview[];
  reviewStats?: {
    averageRating: number;
    totalReviews: number;
  };

  /** True when any variant is discounted. */
  onSale?: boolean;
  priceFrom?: number;
  priceTo?: number;
}