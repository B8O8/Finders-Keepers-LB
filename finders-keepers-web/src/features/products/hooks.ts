import { useQuery } from "@tanstack/react-query";
import { storefrontService } from "@/services/storefront.service";

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: storefrontService.getCategories,
  });
}

export function useProducts(params?: {
  search?: string;
  categorySlug?: string;
  page?: number;
  limit?: number;
  sort?: string;
}) {
  return useQuery({
    queryKey: ["products", params],
    queryFn: () => storefrontService.getProducts(params),
  });
}

export function useProductsByCategory(
  slug: string,
  params?: {
    search?: string;
    page?: number;
    limit?: number;
    sort?: string;
  },
) {
  return useQuery({
    queryKey: ["category-products", slug, params],
    queryFn: () => storefrontService.getProductsByCategory(slug, params),
    enabled: !!slug,
  });
}

export function useFeaturedProducts() {
  return useQuery({
    queryKey: ["featured-products"],
    queryFn: storefrontService.getFeaturedProducts,
  });
}

export function useProduct(slug: string) {
  return useQuery({
    queryKey: ["product", slug],
    queryFn: () => storefrontService.getProductBySlug(slug),
    enabled: !!slug,
  });
}