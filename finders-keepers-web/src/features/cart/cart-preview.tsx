"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Minus, Plus, ShoppingBag, Trash2, X, AlertTriangle } from "lucide-react";

import { formatCurrency } from "@/lib/utils";
import { storefrontService } from "@/services/storefront.service";
import { useCartStore } from "@/stores/cart-store";
import type { PricedCart } from "@/types/pricing";

interface CartPreviewProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Cart preview drawer.
 *
 * Quantities live in the local cart store, so +/- feels instant. Prices come
 * from the server (POST /storefront/price-cart) through the same engine the
 * order uses, so the preview can never quote a price checkout won't honour.
 *
 * Accessibility: rendered as a modal dialog with a focus trap, Escape to close,
 * outside-click to close, and background scroll locked while open.
 */
export function CartPreview({ open, onClose }: CartPreviewProps) {
  const items = useCartStore((s) => s.items);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);

  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const pathname = usePathname();

  const cartKey = items.map((i) => `${i.variantId}:${i.quantity}`).join(",");

  const { data, isLoading, isError, refetch } = useQuery<PricedCart>({
    queryKey: ["price-cart", cartKey],
    queryFn: () =>
      storefrontService.priceCart(
        items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
      ),
    enabled: open && items.length > 0,
    staleTime: 30_000,
  });

  // Close when navigating away.
  useEffect(() => {
    if (open) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Escape to close + focus trap.
  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement;
    closeRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key !== "Tab" || !panelRef.current) return;

      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])',
      );

      if (!focusables.length) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      // Return focus where it came from.
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  const lines = data?.items ?? [];
  const summary = data?.summary;

  return (
    <div className="fixed inset-0 z-[9999]" aria-hidden={!open}>
      {/* Overlay */}
      <button
        type="button"
        aria-label="Close cart"
        tabIndex={-1}
        className="absolute inset-0 h-full w-full cursor-default bg-black/40"
        onClick={onClose}
      />

      {/* Panel: full-width sheet on mobile, side drawer on desktop */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart preview"
        className="absolute bottom-0 right-0 flex max-h-[90vh] w-full flex-col rounded-t-[2rem] bg-white shadow-2xl sm:top-0 sm:max-h-none sm:w-[420px] sm:rounded-none"
      >
        <div className="flex items-center justify-between border-b border-black/5 px-5 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-black">
            <ShoppingBag size={18} />
            Your Cart
            {items.length > 0 && (
              <span className="text-sm font-normal text-neutral-400">
                ({items.length})
              </span>
            )}
          </h2>

          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close cart"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 transition hover:bg-black hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Empty */}
          {items.length === 0 && (
            <div className="py-16 text-center">
              <ShoppingBag className="mx-auto mb-4 text-neutral-300" size={40} />
              <p className="font-semibold text-black">Your cart is empty</p>
              <p className="mt-1 text-sm text-neutral-500">
                Add something you love to get started.
              </p>
              <Link
                href="/products"
                onClick={onClose}
                className="mt-6 inline-block rounded-full bg-black px-6 py-3 text-sm font-semibold text-white"
              >
                Browse products
              </Link>
            </div>
          )}

          {/* Loading */}
          {items.length > 0 && isLoading && (
            <div className="space-y-3">
              {items.map((i) => (
                <div key={i.variantId} className="flex gap-3">
                  <div className="h-20 w-20 animate-pulse rounded-xl bg-neutral-100" />
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-3 w-3/4 animate-pulse rounded bg-neutral-100" />
                    <div className="h-3 w-1/2 animate-pulse rounded bg-neutral-100" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {items.length > 0 && isError && (
            <div className="rounded-2xl border border-red-100 bg-red-50 p-5 text-center">
              <AlertTriangle className="mx-auto mb-2 text-red-500" size={22} />
              <p className="text-sm font-semibold text-red-700">
                Could not load your cart prices
              </p>
              <button
                type="button"
                onClick={() => refetch()}
                className="mt-3 rounded-full bg-black px-4 py-2 text-xs font-semibold text-white"
              >
                Try again
              </button>
            </div>
          )}

          {/* Items */}
          {!isLoading && !isError && lines.length > 0 && (
            <ul className="space-y-4">
              {lines.map((line) => (
                <li key={line.variantId} className="flex gap-3">
                  <Link
                    href={`/products/${line.productSlug}`}
                    onClick={onClose}
                    className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-[#f8f6f1]"
                  >
                    {line.image?.url ? (
                      <Image
                        src={line.image.url}
                        alt={line.image.altText || line.productName}
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    ) : null}
                  </Link>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/products/${line.productSlug}`}
                        onClick={onClose}
                        className="truncate text-sm font-semibold text-black hover:underline"
                      >
                        {line.productName}
                      </Link>

                      <button
                        type="button"
                        aria-label={`Remove ${line.productName} from cart`}
                        onClick={() => removeItem(line.variantId)}
                        className="shrink-0 text-neutral-400 transition hover:text-red-600"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    {line.variantName && (
                      <p className="truncate text-xs text-neutral-500">{line.variantName}</p>
                    )}

                    {/* Stock / backorder */}
                    {!line.inStock && line.allowBackorder && (
                      <p className="mt-1 text-xs font-semibold text-blue-700">
                        {line.backorderMessage || "Available on order"}
                      </p>
                    )}
                    {!line.purchasable && (
                      <p className="mt-1 text-xs font-semibold text-red-600">
                        Out of stock - remove to check out
                      </p>
                    )}
                    {line.purchasable && line.isBackorder && line.inStock && (
                      <p className="mt-1 text-xs font-semibold text-blue-700">
                        {line.backorderQuantity} on backorder
                      </p>
                    )}

                    <div className="mt-2 flex items-center justify-between gap-2">
                      {/* Quantity */}
                      <div className="flex items-center rounded-full border border-black/10">
                        <button
                          type="button"
                          aria-label={`Decrease quantity of ${line.productName}`}
                          disabled={line.quantity <= 1}
                          onClick={() => updateQuantity(line.variantId, line.quantity - 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-full disabled:opacity-30"
                        >
                          <Minus size={12} />
                        </button>

                        <span
                          className="w-7 text-center text-xs font-semibold"
                          aria-live="polite"
                        >
                          {line.quantity}
                        </span>

                        <button
                          type="button"
                          aria-label={`Increase quantity of ${line.productName}`}
                          onClick={() => updateQuantity(line.variantId, line.quantity + 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-full"
                        >
                          <Plus size={12} />
                        </button>
                      </div>

                      {/* Unit price + line total */}
                      <div className="text-right">
                        {line.pricing.onSale && (
                          <p className="text-[11px] text-neutral-400 line-through">
                            {formatCurrency(line.pricing.regularPrice * line.quantity)}
                          </p>
                        )}
                        <p className="text-sm font-bold text-black">
                          {formatCurrency(line.lineTotal)}
                        </p>
                        {line.quantity > 1 && (
                          <p className="text-[11px] text-neutral-400">
                            {formatCurrency(line.pricing.finalPrice)} each
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {data && data.unavailable.length > 0 && (
            <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
              {data.unavailable.length} item(s) are no longer available and were not priced.
            </p>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-black/5 px-5 py-4">
            {summary && (
              <div className="mb-3 space-y-1">
                {summary.discountTotal > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-500">Discounts</span>
                    <span className="font-semibold text-green-700">
                      -{formatCurrency(summary.discountTotal)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="font-semibold text-black">Subtotal</span>
                  <span className="text-lg font-bold text-black">
                    {formatCurrency(summary.subtotal)}
                  </span>
                </div>
                <p className="text-xs text-neutral-400">
                  Delivery calculated at checkout.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/cart"
                onClick={onClose}
                className="rounded-full border border-black px-4 py-3 text-center text-sm font-semibold text-black transition hover:bg-black hover:text-white"
              >
                View Cart
              </Link>
              <Link
                href="/checkout"
                onClick={onClose}
                className="rounded-full bg-black px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-neutral-800"
              >
                Checkout
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
