import { Suspense } from "react";
import type { Metadata } from "next";

import { CategoryProductsPage } from "@/features/products/category-products-page";
import { categoryTitleFromSlug, findCategoryBySlug } from "@/lib/category";
import { SITE_NAME, SITE_URL, getCategoryTree } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  // Resolved against the full tree so subcategory pages get their real name.
  // Falls back to the de-slugged title if the API is unreachable — a degraded
  // title beats a failed render.
  const category = findCategoryBySlug(await getCategoryTree(), slug);
  const name = category?.name ?? categoryTitleFromSlug(slug);
  const title = `${name} | ${SITE_NAME}`;
  const description = `Browse ${name} at ${SITE_NAME}.`;
  const url = `${SITE_URL}/category/${slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "website",
      images: category?.image?.url ? [{ url: category.image.url }] : undefined,
    },
  };
}

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
