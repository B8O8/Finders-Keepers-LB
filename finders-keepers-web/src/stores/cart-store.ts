import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  productId: string;
  variantId: string;
  name: string;
  image: string;
  /**
   * DISPLAY-ONLY snapshot taken when the item was added.
   *
   * Never use this for totals: it goes stale as soon as a discount changes.
   * Real prices come from POST /storefront/price-cart, and checkout recalculates
   * everything server-side regardless of what the client sends.
   */
  price: number;
  quantity: number;
  variantName?: string;
}

interface CartState {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (variantId: string) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  clearCart: () => void;
  getCount: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) => {
        const existing = get().items.find(
          (cartItem) => cartItem.variantId === item.variantId,
        );

        if (existing) {
          set({
            items: get().items.map((cartItem) =>
              cartItem.variantId === item.variantId
                ? {
                    ...cartItem,
                    quantity: cartItem.quantity + item.quantity,
                  }
                : cartItem,
            ),
          });

          return;
        }

        set({
          items: [...get().items, item],
        });
      },

      removeItem: (variantId) => {
        set({
          items: get().items.filter(
            (cartItem) => cartItem.variantId !== variantId,
          ),
        });
      },

      updateQuantity: (variantId, quantity) => {
        set({
          items: get().items.map((cartItem) =>
            cartItem.variantId === variantId
              ? {
                  ...cartItem,
                  quantity: Math.max(1, quantity),
                }
              : cartItem,
          ),
        });
      },

      clearCart: () => {
        set({
          items: [],
        });
      },


      getCount: () =>
        get().items.reduce((count, item) => count + item.quantity, 0),
    }),
    {
      name: "finders-keepers-cart",
      partialize: (state) => ({
        items: state.items,
      }),
    },
  ),
);