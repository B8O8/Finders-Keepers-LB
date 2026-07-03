"use client";

import Link from "next/link";
import { Trash2 } from "lucide-react";

import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useHydrated } from "@/hooks/use-hydrated";
import { useRecentlyViewedStore } from "@/stores/recently-viewed-store";

export function RecentlyViewedSection() {
  const hydrated = useHydrated();

  const items = useRecentlyViewedStore((state) => state.items);
  const clear = useRecentlyViewedStore((state) => state.clear);

  if (!hydrated || !items.length) {
    return null;
  }

  return (
    <section className="mx-auto max-w-[1440px] px-10 pb-24">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.35em] text-[#b08d2c]">
            History
          </p>

          <h2 className="mt-3 text-4xl font-bold text-black">
            Recently Viewed
          </h2>
        </div>

        <button
          type="button"
          onClick={clear}
          className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-500 transition hover:text-black"
        >
          <Trash2 size={16} />
          Clear
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {items.slice(0, 4).map((item) => (
          <Card key={item.productId} className="overflow-hidden p-0">
            <Link href={`/products/${item.slug}`} className="block">
              <div className="h-64 overflow-hidden bg-[#f4efe7]">
                <img
                  src={item.image}
                  alt={item.name}
                  className="h-full w-full object-cover transition hover:scale-105"
                />
              </div>
            </Link>

            <div className="p-5">
              <h3 className="line-clamp-2 text-lg font-bold text-black">
                {item.name}
              </h3>

              <p className="mt-3 text-xl font-bold text-black">
                ${item.price.toFixed(2)}
              </p>

              <div className="mt-5">
                <ButtonLink href={`/products/${item.slug}`} fullWidth>
                  View Product
                </ButtonLink>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}