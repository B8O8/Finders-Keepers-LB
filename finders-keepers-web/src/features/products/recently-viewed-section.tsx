"use client";

import Link from "next/link";
import { Trash2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PriceBlock } from "@/components/product/price-block";
import { useHydrated } from "@/hooks/use-hydrated";
import { storefrontService } from "@/services/storefront.service";
import { useRecentlyViewedStore } from "@/stores/recently-viewed-store";
import type { Product } from "@/types/product";

export function RecentlyViewedSection() {
  const hydrated = useHydrated();

  const items = useRecentlyViewedStore((state) => state.items);
  const clear = useRecentlyViewedStore((state) => state.clear);

  // The store caches the price at view time; a discount started since then would
  // otherwise be shown at the old price.
  const productIds = items.map((i) => i.productId);

  const { data: priced } = useQuery<Product[]>({
    queryKey: ["recently-viewed-prices", productIds.join(",")],
    queryFn: () => storefrontService.priceProducts(productIds),
    enabled: hydrated && productIds.length > 0,
    staleTime: 60_000,
  });

  const pricingFor = (productId: string) => {
    const p = priced?.find((x) => x.id === productId);
    if (!p) return null;
    const v = p.variants.find((x) => x.isDefault) || p.variants[0];
    return v?.pricing ?? null;
  };

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

              {(() => {
                const pricing = pricingFor(item.productId);

                return pricing ? (
                  <div className="mt-3">
                    <PriceBlock pricing={pricing} size="sm" showCountdown={false} />
                  </div>
                ) : (
                  // Fallback while live prices load.
                  <p className="mt-3 text-xl font-bold text-black">
                    ${item.price.toFixed(2)}
                  </p>
                );
              })()}

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