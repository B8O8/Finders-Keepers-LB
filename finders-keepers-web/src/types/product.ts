export interface FileAsset {
  id: string;
  url: string;
  fileName: string;
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
  stock: number;
  isDefault: boolean;
  isActive?: boolean;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  image?: FileAsset | null;
  children?: Category[];
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
  category?: Category | null;
  variants: ProductVariant[];
  images: ProductImage[];
  reviews?: ProductReview[];
  reviewStats?: {
    averageRating: number;
    totalReviews: number;
  };
}