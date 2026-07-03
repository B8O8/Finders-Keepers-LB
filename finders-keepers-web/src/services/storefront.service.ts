import { api } from "@/lib/api";
import type { Category, Product } from "@/types/product";

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