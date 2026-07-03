"use client";

import { Trash2 } from "lucide-react";

import { Navbar } from "@/components/layout/navbar";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useHydrated } from "@/hooks/use-hydrated";
import { useCartStore } from "@/stores/cart-store";

export function CartPage() {
  const hydrated = useHydrated();

  const items = useCartStore((state) => state.items);
  const removeItem = useCartStore((state) => state.removeItem);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const total = useCartStore((state) => state.getTotal());

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
            {items.map((item) => (
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

                      <p className="hidden text-xl font-bold text-black sm:block">
                        ${(item.price * item.quantity).toFixed(2)}
                      </p>
                    </div>

                    <p className="mt-3 text-lg font-bold text-black">
                      ${item.price.toFixed(2)}
                    </p>

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
                      ${(item.price * item.quantity).toFixed(2)}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <Card className="h-fit p-6 lg:sticky lg:top-32 lg:p-8">
            <h2 className="text-2xl font-bold text-black">Order Summary</h2>

            <div className="mt-8 flex justify-between text-black">
              <span>Subtotal</span>

              <span className="font-semibold">${total.toFixed(2)}</span>
            </div>

            <div className="mt-4 flex justify-between gap-6 text-sm text-neutral-500">
              <span>Delivery</span>

              <span>Calculated at checkout</span>
            </div>

            <hr className="my-6 border-black/10" />

            <div className="flex justify-between text-xl font-bold text-black">
              <span>Total</span>

              <span>${total.toFixed(2)}</span>
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