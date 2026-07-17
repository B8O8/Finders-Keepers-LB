/** Mirrors the API's PricedResult. Money is only ever computed server-side. */
export interface PricedResult {
  variantId: string;
  regularPrice: number;
  finalPrice: number;
  discountAmount: number;
  discountPercent: number;
  onSale: boolean;
  discountId: string | null;
  discountLabel: string | null;
  expiresAt: string | null;
  appliedDiscounts: {
    discountId: string;
    label: string | null;
    amount: number;
  }[];
}

export interface PricedCartLine {
  variantId: string;
  productId: string;
  quantity: number;

  productName: string;
  productSlug: string;
  variantName: string | null;
  image: { url: string; altText?: string | null; title?: string } | null;

  pricing: PricedResult;
  lineTotal: number;

  stock: number;
  inStock: boolean;
  allowBackorder: boolean;
  isBackorder: boolean;
  backorderQuantity: number;
  backorderMessage: string | null;
  availabilityDate: string | null;
  purchasable: boolean;
}

export interface PricedCart {
  items: PricedCartLine[];
  /** Variant ids that no longer exist or are inactive. */
  unavailable: string[];
  summary: {
    itemsCount: number;
    regularSubtotal: number;
    discountTotal: number;
    subtotal: number;
    hasBackorderedItems: boolean;
  };
}
