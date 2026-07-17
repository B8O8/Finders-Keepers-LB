import { api } from "@/lib/api";
import type { Category, Product } from "@/types/product";
import type { PricedCart } from "@/types/pricing";

interface PaginatedProducts {
  data: Product[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const storefrontService = {
  /**
   * Prices the locally-held cart on the server.
   *
   * The cart lives in local storage so quantity changes feel instant, but the
   * prices shown always come from the API's pricing engine - the same one used
   * at checkout - so the preview can never promise a price the order won't honour.
   */
  async priceCart(items: { variantId: string; quantity: number }[]) {
    const { data } = await api.post<PricedCart>("/storefront/price-cart", { items });
    return data;
  },

  /**
   * Live prices for locally-stored lists (wishlist, recently viewed).
   * Those lists cache a price when saved, which goes stale as soon as a
   * discount changes - so the price shown must come from the server.
   */
  async priceProducts(productIds: string[]) {
    if (!productIds.length) return [];
    const { data } = await api.post<Product[]>("/storefront/price-products", { productIds });
    return data;
  },

  async getCategories() {
    const { data } = await api.get<Category[]>("/storefront/categories/tree");
    return data;
  },

  async getProducts(params?: {
    search?: string;
    categorySlug?: string;
    page?: number;
    limit?: number;
    sort?: string;
  }) {
    const { data } = await api.get<PaginatedProducts>("/storefront/products", {
      params,
    });

    return data;
  },

  async getProductsByCategory(
    slug: string,
    params?: {
      search?: string;
      page?: number;
      limit?: number;
      sort?: string;
    },
  ) {
    const { data } = await api.get<PaginatedProducts>(
      `/storefront/categories/${slug}/products`,
      {
        params,
      },
    );

    return data;
  },

  async getFeaturedProducts() {
    const { data } = await api.get<Product[]>("/storefront/products/featured");
    return data;
  },

  async getProductBySlug(slug: string) {
    const { data } = await api.get<Product>(`/storefront/products/${slug}`);
    return data;
  },
};