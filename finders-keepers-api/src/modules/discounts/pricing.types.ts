import { DiscountType } from '@prisma/client';

/**
 * A discount record reduced to exactly what the pricing maths needs.
 * Decoupled from Prisma so the engine stays trivially unit-testable.
 */
export interface PricingDiscount {
  id: string;
  type: DiscountType;
  value: number;
  publicLabel: string | null;
  priority: number;
  stackable: boolean;
  isActive: boolean;
  startsAt: Date;
  endsAt: Date | null;
  minOrderAmount: number | null;
  maxDiscountAmount: number | null;
  targets: {
    productIds: string[];
    variantIds: string[];
    categoryIds: string[];
  };
}

/** The item being priced. */
export interface PricingItem {
  variantId: string;
  productId: string;
  categoryIds: string[];
  price: number;
}

export interface AppliedDiscount {
  discountId: string;
  label: string | null;
  type: DiscountType;
  value: number;
  amount: number;
}

/**
 * The single shape every surface (storefront, cart, checkout, admin preview,
 * wishlist notifications) consumes. Nothing else may compute prices.
 */
export interface PricedResult {
  variantId: string;
  regularPrice: number;
  finalPrice: number;
  discountAmount: number;
  discountPercent: number;
  onSale: boolean;
  appliedDiscounts: AppliedDiscount[];
  /** Primary (highest-priority) discount, used for badges/snapshots. */
  discountId: string | null;
  discountLabel: string | null;
  /** Soonest expiry among applied discounts, for countdown UI. */
  expiresAt: Date | null;
}

export interface PricingContext {
  now?: Date;
  /**
   * Order subtotal, when known (cart/checkout). Discounts carrying a
   * minOrderAmount are only eligible when this is supplied and large enough,
   * so storefront listings never advertise a conditional price.
   */
  orderSubtotal?: number;
}
