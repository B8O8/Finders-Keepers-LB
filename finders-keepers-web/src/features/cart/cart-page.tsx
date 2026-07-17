"use client";

import { Trash2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Navbar } from "@/components/layout/navbar";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useHydrated } from "@/hooks/use-hydrated";
import { useCartStore } from "@/stores/cart-store";
import { storefrontService } from "@/services/storefront.service";
import { formatCurrency } from "@/lib/utils";
import type { PricedCart } from "@/types/pricing";

export function CartPage() {
  const hydrated = useHydrated();

  const items = useCartStore((state) => state.items);
  const removeItem = useCartStore((state) => state.removeItem);
  const updateQuantity = useCartStore((state) => state.updateQuantity);

  // Quantities are local (instant), money is server-side. The cached price in
  // the local store is stale as soon as a discount changes, so it is only used
  // as a fallback while the real prices load.
  const cartKey = items.map((i) => `${i.variantId}:${i.quantity}`).join(",");

  const { data: priced } = useQuery<PricedCart>({
    queryKey: ["price-cart", cartKey],
    queryFn: () =>
      storefrontService.priceCart(
        items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
      ),
    enabled: hydrated && items.length > 0,
    staleTime: 30_000,
  });

  const lineFor = (variantId: string) =>
    priced?.items.find((l) => l.variantId === variantId);

  const total =
    priced?.summary.subtotal ??
    items.reduce((acc, i) => acc + i.price * i.quantity, 0);

  if (!hydrated) {
    return (
      <main className="min-h-screen bg-[#f8f6f1]">
        <Navbar />

        <section className="mx-auto max-w-[1440px] px-5 py-6 lg:px-10 lg:py-10">
          <Card className="h-[420px] animate-pulse">
            <div />
          </Card>
        </section>
      </main>
    );
  }

  if (items.length === 0) {
    return (
      <main className="min-h-screen bg-[#f8f6f1]">
        <Navbar />

        <section className="mx-auto max-w-4xl px-5 py-16 text-center lg:px-6 lg:py-20">
          <Card className="p-8 lg:p-10">
            <h1 className="text-4xl font-bold text-black lg:text-5xl">
              Your cart is empty
            </h1>

            <p className="mt-4 text-neutral-500">
              Add products to continue shopping.
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

      <section className="mx-auto max-w-[1440px] px-5 py-6 lg:px-10 lg:py-10">
        <div className="mb-8">
          <p className="text-sm font-bold uppercase tracking-[0.35em] text-[#b08d2c]">
            Cart
          </p>

          <h1 className="mt-3 text-4xl font-bold text-black lg:text-5xl">
            Shopping Cart
          </h1>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
          <div className="space-y-4">
            {items.map((item) => {
              const line = lineFor(item.variantId);
              const unitPrice = line?.pricing.finalPrice ?? item.price;
              const lineTotal = line?.lineTotal ?? item.price * item.quantity;
              const onSale = line?.pricing.onSale ?? false;

              return (
              <Card key={item.variantId} className="p-4 lg:p-6">
                <div className="flex gap-4 lg:gap-6">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="h-28 w-24 rounded-2xl object-cover lg:h-32 lg:w-28"
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="line-clamp-2 text-lg font-semibold text-black lg:text-xl">
                          {item.name}
                        </h3>

                        {item.variantName ? (
                          <p className="mt-1 text-sm text-neutral-500">
                            {item.variantName}
                          </p>
                        ) : null}
                      </div>

                      <div className="hidden text-right sm:block">
                        {onSale && (
                          <p className="text-sm text-neutral-400 line-through">
                            {formatCurrency(
                              (line?.pricing.regularPrice ?? item.price) * item.quantity,
                            )}
                          </p>
                        )}
                        <p className="text-xl font-bold text-black">
                          {formatCurrency(lineTotal)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <p className="text-lg font-bold text-black">
                        {formatCurrency(unitPrice)}
                      </p>

                      {onSale && (
                        <>
                          <span className="text-sm text-neutral-400 line-through">
                            {formatCurrency(line?.pricing.regularPrice ?? item.price)}
                          </span>
                          <span className="rounded-full bg-[#d4af37] px-2 py-0.5 text-xs font-bold text-black">
                            {line?.pricing.discountLabel ||
                              `-${Math.round(line?.pricing.discountPercent ?? 0)}%`}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Stock / backorder */}
                    {line && !line.purchasable && (
                      <p className="mt-2 text-sm font-semibold text-red-600">
                        Out of stock - remove this item to check out
                      </p>
                    )}
                    {line && line.purchasable && line.isBackorder && (
                      <p className="mt-2 text-sm font-semibold text-blue-700">
                        {line.backorderMessage ||
                          `On backorder (${line.backorderQuantity} item(s))`}
                      </p>
                    )}

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <div className="flex items-center overflow-hidden rounded-2xl border border-black/10 bg-white">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            updateQuantity(
                              item.variantId,
                              Math.max(1, item.quantity - 1),
                            )
                          }
                          className="h-11 w-11 rounded-none px-0 text-lg"
                        >
                          -
                        </Button>

                        <span className="flex h-11 min-w-12 items-center justify-center border-x border-black/10 px-4 font-semibold text-black">
                          {item.quantity}
                        </span>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            updateQuantity(item.variantId, item.quantity + 1)
                          }
                          className="h-11 w-11 rounded-none px-0 text-lg"
                        >
                          +
                        </Button>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeItem(item.variantId)}
                        className="inline-flex items-center gap-2 text-sm font-semibold text-red-600 transition hover:text-red-700"
                      >
                        <Trash2 size={16} />
                        Remove
                      </button>
                    </div>

                    <p className="mt-4 text-right text-xl font-bold text-black sm:hidden">
                      {formatCurrency(lineTotal)}
                    </p>
                  </div>
                </div>
              </Card>
              );
            })}
          </div>

          <Card className="h-fit p-6 lg:sticky lg:top-32 lg:p-8">
            <h2 className="text-2xl font-bold text-black">Order Summary</h2>

            {priced && priced.summary.discountTotal > 0 && (
              <div className="mt-8 flex justify-between text-black">
                <span>Discounts</span>

                <span className="font-semibold text-green-700">
                  -{formatCurrency(priced.summary.discountTotal)}
                </span>
              </div>
            )}

            <div className="mt-4 flex justify-between text-black">
              <span>Subtotal</span>

              <span className="font-semibold">{formatCurrency(total)}</span>
            </div>

            <div className="mt-4 flex justify-between gap-6 text-sm text-neutral-500">
              <span>Delivery</span>

              <span>Calculated at checkout</span>
            </div>

            <hr className="my-6 border-black/10" />

            <div className="flex justify-between text-xl font-bold text-black">
              <span>Total</span>

              <span>{formatCurrency(total)}</span>
            </div>

            <div className="mt-8 grid gap-3">
              <ButtonLink href="/checkout" size="lg" fullWidth>
                Proceed To Checkout
              </ButtonLink>

              <ButtonLink href="/products" variant="outline" fullWidth>
                Continue Shopping
              </ButtonLink>
            </div>
          </Card>
        </div>
      </section>
    </main>
  );
}