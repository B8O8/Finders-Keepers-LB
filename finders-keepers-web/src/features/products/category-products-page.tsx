"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { Navbar } from "@/components/layout/navbar";
import { ButtonLink } from "@/components/ui/button";
import { ProductCard } from "@/features/products/product-card";
import { useCategories, useProductsByCategory } from "@/features/products/hooks";

function formatCategoryTitle(slug: string) {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function CategoryProductsPage({ slug }: { slug: string }) {
  const searchParams = useSearchParams();

  const search = searchParams.get("search") || "";

  const { data: products, isLoading } = useProductsByCategory(slug, {
    page: 1,
    limit: 24,
    search: search || undefined,
  });

  const { data: categories } = useCategories();

  const title = formatCategoryTitle(slug);

  return (
    <main className="min-h-screen bg-[#f8f6f1]">
      <Navbar />

      <section className="mx-auto max-w-[1440px] px-10 py-8">
        <div className="mb-10 rounded-3xl bg-black px-10 py-12 text-white shadow-xl">
          <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
            <div>
              <p className="mb-4 text-sm font-bold uppercase tracking-[0.45em] text-[#d4af37]">
                Category
              </p>

              <h1 className="text-5xl font-semibold tracking-tight lg:text-6xl">
                {search ? `${title}: ${search}` : title}
              </h1>

              <p className="mt-5 text-lg text-white/75 lg:text-xl">
                Browse curated premium pieces from this collection.
              </p>
            </div>

            <ButtonLink href="/products" variant="outline" size="lg">
              All Products
            </ButtonLink>
          </div>
        </div>

        <div className="mb-8 flex flex-wrap gap-3">
          {categories?.map((category) => (
            <Link
              key={category.id}
              href={`/category/${category.slug}`}
              className={`rounded-full border px-5 py-2 text-sm font-semibold transition ${
                category.slug === slug
                  ? "border-black bg-black text-white"
                  : "border-black/10 bg-white text-black hover:border-black"
              }`}
            >
              {category.name}
            </Link>
          ))}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-[620px] animate-pulse rounded-2xl bg-white"
              />
            ))}
          </div>
        ) : !products?.data.length ? (
          <div className="rounded-3xl bg-white p-12 text-center">
            <h2 className="text-3xl font-bold text-black">
              No products found
            </h2>

            <p className="mt-3 text-neutral-500">
              This category does not have products yet.
            </p>

            <div className="mt-8">
              <ButtonLink href="/products" size="lg">
                Shop All Products
              </ButtonLink>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {products.data.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}