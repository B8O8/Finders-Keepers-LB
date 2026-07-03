import { api } from "@/lib/api";
import type { CartItem } from "@/stores/cart-store";

function getGuestToken() {
  if (typeof window === "undefined") return "";

  let token = localStorage.getItem("finders-keepers-guest-token");

  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem("finders-keepers-guest-token", token);
  }

  return token;
}

export const checkoutService = {
  async syncGuestCartToBackend(items: CartItem[]) {
    const guestToken = getGuestToken();

    for (const item of items) {
      await api.post("/cart/items", {
        guestToken,
        variantId: item.variantId,
        quantity: item.quantity,
      });
    }

    return guestToken;
  },

  async syncCustomerCartToBackend(items: CartItem[]) {
    for (const item of items) {
      await api.post("/cart/me/items", {
        variantId: item.variantId,
        quantity: item.quantity,
      });
    }
  },

  async guestCheckout(data: {
    guestToken: string;
    guestName: string;
    guestEmail?: string;
    guestPhone: string;
    city?: string;
    area?: string;
    street?: string;
    building?: string;
    floor?: string;
    apartment?: string;
    notes?: string;
    latitude?: number;
    longitude?: number;
  }) {
    const response = await api.post("/orders/checkout/guest", {
      ...data,
      paymentMethod: "CASH_ON_DELIVERY",
    });

    return response.data;
  },

  async customerCheckout(data: {
    addressId: string;
    notes?: string;
  }) {
    const response = await api.post("/orders/checkout/me", {
      ...data,
      paymentMethod: "CASH_ON_DELIVERY",
    });

    return response.data;
  },
};