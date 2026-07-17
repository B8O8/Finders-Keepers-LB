"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Filter, X } from "lucide-react";
import { Suspense, useState } from "react";

import { Navbar } from "@/components/layout/navbar";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProductCard } from "@/features/products/product-card";
import { RecentlyViewedSection } from "@/features/products/recently-viewed-section";
import { useCategories, useProducts } from "@/features/products/hooks";
import { findCategoryBySlug, flattenCategories } from "@/lib/category";

const sortOptions = [
  { label: "Newest", value: "newest" },
  { label: "Oldest", value: "oldest" },
  { label: "Price: Low to High", value: "price_asc" },
  { label: "Price: High to Low", value: "price_desc" },
];

function ProductsPageContent() {
  const searchParams = useSearchParams();

  const search = searchParams.get("search") || "";
  const categorySlug = searchParams.get("category") || "";
  const sort = searchParams.get("sort") || "newest";

  const [filtersOpen, setFiltersOpen] = useState(false);

  const { data: products, isLoading } = useProducts({
    page: 1,
    limit: 24,
    search: search || undefined,
    categorySlug: categorySlug || undefined,
    sort,
  });

  const { data: categories } = useCategories();

  // The API returns a tree (top-level only at the root), so both the filter
  // list and the active-category lookup must walk it — otherwise every
  // subcategory is unreachable as a filter and its heading falls back to
  // "Shop Products".
  const allCategories = flattenCategories(categories);
  const activeCategory = findCategoryBySlug(categories, categorySlug);

  function buildUrl(params: {
    category?: string;
    search?: string;
    sort?: string;
  }) {
    const query = new URLSearchParams();

    if (params.search) query.set("search", params.search);
    if (params.category) query.set("category", params.category);
    if (params.sort && params.sort !== "newest") {
      query.set("sort", params.sort);
    }

    const queryString = query.toString();

    return queryString ? `/products?${queryString}` : "/products";
  }

  const filtersContent = (
    <>
      <h2 className="text-xl font-bold text-black">Filters</h2>

      <div className="mt-6">
        <p className="mb-3 text-sm font-bold uppercase tracking-[0.25em] text-neutral-500">
          Categories
        </p>

        <div className="grid gap-2">
          <Link
            href={buildUrl({
              search,
              sort,
            })}
            scroll={false}
            onClick={() => setFiltersOpen(false)}
            className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
              !categorySlug
                ? "bg-black text-white"
                : "bg-[#f8f6f1] text-black hover:bg-black hover:text-white"
            }`}
          >
            All Products
          </Link>

          {allCategories.map((category) => (
            <Link
              key={category.id}
              href={buildUrl({
                search,
                category: category.slug,
                sort,
              })}
              scroll={false}
              onClick={() => setFiltersOpen(false)}
              className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                categorySlug === category.slug
                  ? "bg-black text-white"
                  : "bg-[#f8f6f1] text-black hover:bg-black hover:text-white"
              }`}
            >
              {category.name}
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-8">
        <p className="mb-3 text-sm font-bold uppercase tracking-[0.25em] text-neutral-500">
          Sort
        </p>

        <div className="grid gap-2">
          {sortOptions.map((item) => (
            <Link
              key={item.value}
              href={buildUrl({
                search,
                category: categorySlug,
                sort: item.value,
              })}
              scroll={false}
              onClick={() => setFiltersOpen(false)}
              className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                sort === item.value
                  ? "bg-[#d4af37] text-black"
                  : "bg-[#f8f6f1] text-black hover:bg-black hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      {(search || categorySlug || sort !== "newest") && (
        <div className="mt-8">
          <ButtonLink href="/products" variant="outline" fullWidth>
            Clear Filters
          </ButtonLink>
        </div>
      )}
    </>
  );

  return (
    <main className="min-h-screen bg-[#f8f6f1]">
      <Navbar />

      <section className="mx-auto max-w-[1440px] px-5 py-6 lg:px-10 lg:py-8">
        <div className="mb-6 rounded-3xl bg-black px-6 py-10 text-white shadow-xl lg:mb-10 lg:px-10 lg:py-12">
          <p className="mb-4 text-sm font-bold uppercase tracking-[0.35em] text-[#d4af37] lg:tracking-[0.45em]">
            Collection
          </p>

          <h1 className="text-4xl font-semibold tracking-tight lg:text-6xl">
            {search
              ? `Search: ${search}`
              : activeCategory
                ? activeCategory.name
                : "Shop Products"}
          </h1>

          <p className="mt-5 text-base text-white/75 lg:text-xl">
            Discover curated premium pieces from Finders Keepers.
          </p>
        </div>

        <div className="mb-6 flex items-center justify-between lg:hidden">
          <p className="text-sm font-semibold text-neutral-500">
            {products?.meta?.total ?? 0} product(s)
          </p>

          <Button
            type="button"
            variant="outline"
            onClick={() => setFiltersOpen(true)}
          >
            <Filter size={18} />
            Filters
          </Button>
        </div>

        <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
          <aside className="hidden lg:block">
            <Card className="sticky top-32 h-fit p-6">{filtersContent}</Card>
          </aside>

          <div>
            <div className="mb-6 hidden items-center justify-between lg:flex">
              <p className="text-sm font-semibold text-neutral-500">
                {products?.meta?.total ?? 0} product(s)
              </p>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
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
                  Try changing your filters or search term.
                </p>

                <div className="mt-8">
                  <ButtonLink href="/products" size="lg">
                    Clear Filters
                  </ButtonLink>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
                {products.data.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <RecentlyViewedSection />

      {filtersOpen ? (
        <div className="fixed inset-0 z-[9999] bg-black/40 lg:hidden">
          <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto rounded-t-[2rem] bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-black">
                Product Filters
              </h2>

              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-black/10"
              >
                <X size={22} />
              </button>
            </div>

            {filtersContent}
          </div>
        </div>
      ) : null}
    </main>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#f8f6f1]" />}>
      <ProductsPageContent />
    </Suspense>
  );
}