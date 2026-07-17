import type { Metadata } from "next";

import { ProductDetails } from "@/features/products/product-details";
import { getPrimaryCategory } from "@/lib/category";
import { SITE_NAME, SITE_URL, getProductForSeo } from "@/lib/seo";

/**
 * Product URLs stay category-independent: /products/<slug>, never
 * /category/<c>/products/<slug>. With products now belonging to several
 * categories, a category-scoped URL would give one product N addresses and
 * split its search ranking across duplicates. One product, one canonical URL.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductForSeo(slug);

  if (!product) {
    return { title: SITE_NAME };
  }

  const category = getPrimaryCategory(product);
  const title = `${product.name} | ${SITE_NAME}`;
  const description =
    product.shortDescription?.trim() ||
    product.description?.trim()?.slice(0, 200) ||
    `${product.name}${category ? ` in ${category.name}` : ""} at ${SITE_NAME}.`;

  const image =
    product.images?.find((item) => item.isPrimary)?.file.url ||
    product.images?.[0]?.file.url;

  const url = `${SITE_URL}/products/${slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "website",
      images: image ? [{ url: image }] : undefined,
    },
  };
}

export default async function ProductDetailsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return <ProductDetails slug={slug} />;
}
