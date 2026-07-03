"use client";

import Link from "next/link";
import { Heart, Trash2 } from "lucide-react";

import { Navbar } from "@/components/layout/navbar";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useHydrated } from "@/hooks/use-hydrated";
import { useWishlistStore } from "@/stores/wishlist-store";

export function WishlistPage() {
  const hydrated = useHydrated();

  const items = useWishlistStore((state) => state.items);
  const removeItem = useWishlistStore((state) => state.removeItem);

  if (!hydrated) {
    return (
      <main className="min-h-screen bg-[#f8f6f1]">
        <Navbar />

        <section className="mx-auto max-w-[1200px] px-10 py-10">
          <Card className="h-96 animate-pulse">
            <div />
          </Card>
        </section>
      </main>
    );
  }

  if (!items.length) {
    return (
      <main className="min-h-screen bg-[#f8f6f1]">
        <Navbar />

        <section className="mx-auto max-w-xl px-6 py-20 text-center">
          <Card className="p-10">
            <Heart className="mx-auto mb-6" size={42} />

            <h1 className="text-4xl font-bold text-black">Wishlist</h1>

            <p className="mt-4 text-neutral-500">
              Save your favorite products and come back to them anytime.
            </p>

            <div className="mt-8">
              <ButtonLink href="/products" size="lg">
                Shop Products
              </ButtonLink>
            </div>
          </Card>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f8f6f1]">
      <Navbar />

      <section className="mx-auto max-w-[1200px] px-10 py-10">
        <div className="mb-8">
          <p className="text-sm font-bold uppercase tracking-[0.35em] text-[#b08d2c]">
            Saved
          </p>

          <h1 className="mt-3 text-5xl font-bold text-black">Wishlist</h1>

          <p className="mt-3 text-neutral-500">
            {items.length} favorite product(s)
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <Card key={item.productId} className="overflow-hidden p-0">
              <Link href={`/products/${item.slug}`} className="block">
                <div className="h-80 overflow-hidden bg-[#f4efe7]">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="h-full w-full object-cover transition hover:scale-105"
                  />
                </div>
              </Link>

              <div className="p-6">
                <h2 className="text-xl font-bold text-black">{item.name}</h2>

                <p className="mt-3 text-2xl font-bold text-black">
                  ${item.price.toFixed(2)}
                </p>

                <div className="mt-6 flex gap-3">
                  <ButtonLink
                    href={`/products/${item.slug}`}
                    size="md"
                    fullWidth
                  >
                    View Product
                  </ButtonLink>

                  <button
                    type="button"
                    onClick={() => removeItem(item.productId)}
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-black/10 bg-white text-black transition hover:bg-black hover:text-white"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}