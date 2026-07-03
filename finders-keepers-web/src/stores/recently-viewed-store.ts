import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface RecentlyViewedItem {
  productId: string;
  slug: string;
  name: string;
  image: string;
  price: number;
}

interface RecentlyViewedState {
  items: RecentlyViewedItem[];
  addItem: (item: RecentlyViewedItem) => void;
  clear: () => void;
}

export const useRecentlyViewedStore = create<RecentlyViewedState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) => {
        const filtered = get().items.filter(
          (existing) => existing.productId !== item.productId,
        );

        set({
          items: [item, ...filtered].slice(0, 8),
        });
      },

      clear: () => {
        set({
          items: [],
        });
      },
    }),
    {
      name: "finders-keepers-recently-viewed",
      partialize: (state) => ({
        items: state.items,
      }),
    },
  ),
);