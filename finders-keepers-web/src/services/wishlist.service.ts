import { api } from "@/lib/api";
import type { PricedResult } from "@/types/pricing";

export interface ServerWishlistItem {
  id: string;
  productId: string;
  variantId: string | null;
  createdAt: string;
  product: {
    id: string;
    name: string;
    slug: string;
    image: { url: string; altText?: string | null } | null;
  };
  variant: {
    id: string;
    name: string | null;
    stock: number;
    allowBackorder: boolean;
  } | null;
  pricing: PricedResult | null;
  onSale: boolean;
}

/**
 * Wishlist API (authenticated customers only).
 *
 * Guests keep using the local store on their device. On login the local list is
 * merged into the account, which is what makes sale notifications possible:
 * we can only email a customer we can identify.
 */
export const wishlistService = {
  async getAll() {
    const { data } = await api.get<ServerWishlistItem[]>("/wishlist");
    return data;
  },

  async add(productId: string, variantId?: string) {
    const { data } = await api.post<ServerWishlistItem[]>("/wishlist", {
      productId,
      variantId,
    });
    return data;
  },

  async remove(productId: string, variantId?: string) {
    const { data } = await api.delete<ServerWishlistItem[]>(
      `/wishlist/product/${productId}`,
      { params: { variantId } },
    );
    return data;
  },

  /** One-shot merge of the guest's device wishlist into their account. */
  async merge(items: { productId: string; variantId?: string }[]) {
    const { data } = await api.post<ServerWishlistItem[]>("/wishlist/merge", {
      items,
    });
    return data;
  },
};
