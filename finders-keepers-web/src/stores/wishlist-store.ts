import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface WishlistItem {
  productId: string;
  slug: string;
  name: string;
  image: string;
  price: number;
}

interface WishlistState {
  items: WishlistItem[];
  addItem: (item: WishlistItem) => void;
  removeItem: (productId: string) => void;
  toggleItem: (item: WishlistItem) => void;
  isWishlisted: (productId: string) => boolean;
  getCount: () => number;
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) => {
        const exists = get().items.some(
          (wishlistItem) => wishlistItem.productId === item.productId,
        );

        if (exists) return;

        set({
          items: [...get().items, item],
        });
      },

      removeItem: (productId) => {
        set({
          items: get().items.filter((item) => item.productId !== productId),
        });
      },

      toggleItem: (item) => {
        const exists = get().items.some(
          (wishlistItem) => wishlistItem.productId === item.productId,
        );

        if (exists) {
          get().removeItem(item.productId);
          return;
        }

        get().addItem(item);
      },

      isWishlisted: (productId) =>
        get().items.some((item) => item.productId === productId),

      getCount: () => get().items.length,
    }),
    {
      name: "finders-keepers-wishlist",
      partialize: (state) => ({
        items: state.items,
      }),
    },
  ),
);