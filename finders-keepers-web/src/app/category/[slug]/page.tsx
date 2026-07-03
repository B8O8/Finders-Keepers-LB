import { Suspense } from "react";

import { CategoryProductsPage } from "@/features/products/category-products-page";

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <Suspense fallback={<main className="min-h-screen bg-[#f8f6f1]" />}>
      <CategoryProductsPage slug={slug} />
    </Suspense>
  );
}