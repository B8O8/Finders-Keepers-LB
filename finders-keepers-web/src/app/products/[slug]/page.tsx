import { ProductDetails } from "@/features/products/product-details";

export default async function ProductDetailsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return <ProductDetails slug={slug} />;
}