"use client";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

import { Navbar } from "@/components/layout/navbar";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProductCard } from "@/features/products/product-card";
import { RecentlyViewedSection } from "@/features/products/recently-viewed-section";
import { useCategories, useFeaturedProducts } from "@/features/products/hooks";

export default function HomePage() {
  const { data: featuredProducts, isLoading: featuredLoading } =
    useFeaturedProducts();

  const { data: categories } = useCategories();

  return (
    <main className="min-h-screen bg-[#f8f6f1]">
      <Navbar />

      <section className="mx-auto grid max-w-[1440px] gap-10 px-10 py-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="flex min-h-[620px] flex-col justify-center rounded-[2rem] bg-black p-10 text-white shadow-xl lg:p-16">
          <div className="mb-8 inline-flex w-fit items-center gap-3 rounded-full border border-white/15 bg-white/10 px-5 py-3 text-sm font-semibold text-[#d4af37]">
            <Sparkles size={18} />
            Premium Fashion Store
          </div>

          <h1 className="max-w-3xl text-6xl font-bold tracking-tight lg:text-7xl">
            Discover pieces worth keeping.
          </h1>

          <p className="mt-8 max-w-2xl text-xl leading-9 text-white/70">
            Curated fashion, elegant essentials, and standout finds from
            Finders Keepers LB.
          </p>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <ButtonLink href="/products" size="lg">
              Shop Collection
              <ArrowRight size={18} />
            </ButtonLink>

            <ButtonLink href="/wishlist" variant="outline" size="lg">
              View Wishlist
            </ButtonLink>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[2rem] border border-black/10 bg-white shadow-xl">
          <img
            src="/logo.jpg"
            alt="Finders Keepers"
            className="h-full min-h-[620px] w-full object-cover"
          />

          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

          <div className="absolute bottom-8 left-8 right-8 rounded-3xl bg-white/90 p-6 backdrop-blur">
            <p className="text-sm font-bold uppercase tracking-[0.35em] text-[#b08d2c]">
              New Arrival
            </p>

            <h2 className="mt-3 text-3xl font-bold text-black">
              Elegant styles for every occasion
            </h2>

            <p className="mt-3 text-neutral-600">
              Explore curated items selected for a premium shopping experience.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-10 py-10">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.35em] text-[#b08d2c]">
              Categories
            </p>

            <h2 className="mt-3 text-4xl font-bold text-black">
              Shop by Category
            </h2>
          </div>

          <ButtonLink href="/products" variant="outline">
            View All
          </ButtonLink>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {categories?.slice(0, 4).map((category) => (
            <Link key={category.id} href={`/products?category=${category.slug}`}>
              <Card className="group h-full transition hover:-translate-y-1 hover:shadow-xl">
                <p className="text-sm font-bold uppercase tracking-[0.3em] text-[#b08d2c]">
                  Collection
                </p>

                <h3 className="mt-4 text-3xl font-bold text-black">
                  {category.name}
                </h3>

                <p className="mt-4 text-neutral-500">
                  Explore premium pieces from this collection.
                </p>

                <div className="mt-8 inline-flex items-center gap-2 font-semibold text-black">
                  Shop Now
                  <ArrowRight
                    size={18}
                    className="transition group-hover:translate-x-1"
                  />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-10 py-10">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.35em] text-[#b08d2c]">
              Featured
            </p>

            <h2 className="mt-3 text-4xl font-bold text-black">
              Featured Products
            </h2>
          </div>

          <ButtonLink href="/products" variant="outline">
            Shop All
          </ButtonLink>
        </div>

        {featuredLoading ? (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="h-[560px] animate-pulse rounded-2xl bg-white"
              />
            ))}
          </div>
        ) : !featuredProducts?.length ? (
          <Card className="p-10 text-center">
            <h3 className="text-2xl font-bold text-black">
              No featured products yet
            </h3>

            <p className="mt-3 text-neutral-500">
              Featured products will appear here once added from the admin.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {featuredProducts.slice(0, 3).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      <RecentlyViewedSection />

      <section className="mx-auto max-w-[1440px] px-10 pb-20">
        <div className="rounded-[2rem] bg-black px-10 py-16 text-center text-white">
          <p className="text-sm font-bold uppercase tracking-[0.35em] text-[#d4af37]">
            Finders Keepers LB
          </p>

          <h2 className="mx-auto mt-4 max-w-3xl text-5xl font-bold">
            Your next favorite piece is waiting.
          </h2>

          <div className="mt-10">
            <ButtonLink href="/products" size="lg">
              Start Shopping
              <ArrowRight size={18} />
            </ButtonLink>
          </div>
        </div>
      </section>
    </main>
  );
}