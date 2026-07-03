import { CategoryProductsPage } from "@/features/products/category-products-page";

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return <CategoryProductsPage slug={slug} />;
}