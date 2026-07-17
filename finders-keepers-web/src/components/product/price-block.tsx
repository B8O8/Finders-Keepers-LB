"use client";

import { useEffect, useState } from "react";

import { formatCurrency } from "@/lib/utils";
import type { PricedResult } from "@/types/pricing";

interface PriceBlockProps {
  pricing: PricedResult;
  size?: "sm" | "md" | "lg";
  showCountdown?: boolean;
  className?: string;
}

const sizes = {
  sm: { final: "text-base", regular: "text-xs", badge: "text-[10px] px-1.5 py-0.5" },
  md: { final: "text-xl", regular: "text-sm", badge: "text-xs px-2 py-0.5" },
  lg: { final: "text-3xl", regular: "text-base", badge: "text-sm px-2.5 py-1" },
};

/** "2d 4h left" / "6h 12m left" - only shown when an end date is near. */
function useTimeLeft(expiresAt: string | null, enabled: boolean) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !expiresAt) {
      setLabel(null);
      return;
    }

    function tick() {
      const ms = new Date(expiresAt as string).getTime() - Date.now();

      if (ms <= 0) {
        setLabel(null);
        return;
      }

      const days = Math.floor(ms / 86_400_000);
      const hours = Math.floor((ms % 86_400_000) / 3_600_000);
      const minutes = Math.floor((ms % 3_600_000) / 60_000);

      // Only worth a countdown when it is actually urgent.
      if (days > 7) setLabel(null);
      else if (days > 0) setLabel(`${days}d ${hours}h left`);
      else if (hours > 0) setLabel(`${hours}h ${minutes}m left`);
      else setLabel(`${minutes}m left`);
    }

    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [expiresAt, enabled]);

  return label;
}

/**
 * The only way a price is rendered on the storefront.
 *
 * Always driven by the server-computed PricedResult, so strike-through, badge
 * and final price cannot drift from what the cart and order will charge.
 */
export function PriceBlock({
  pricing,
  size = "md",
  showCountdown = true,
  className = "",
}: PriceBlockProps) {
  const s = sizes[size];
  const timeLeft = useTimeLeft(pricing.expiresAt, showCountdown && pricing.onSale);

  if (!pricing.onSale) {
    return (
      <p className={`font-bold text-black ${s.final} ${className}`}>
        {formatCurrency(pricing.finalPrice)}
      </p>
    );
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap items-baseline gap-2">
        <p className={`font-bold text-black ${s.final}`}>
          {formatCurrency(pricing.finalPrice)}
        </p>

        <p className={`text-neutral-400 line-through ${s.regular}`}>
          {formatCurrency(pricing.regularPrice)}
        </p>

        <span
          className={`rounded-full bg-[#d4af37] font-bold text-black ${s.badge}`}
        >
          {pricing.discountLabel || `-${Math.round(pricing.discountPercent)}%`}
        </span>
      </div>

      {timeLeft && (
        <p className="mt-1 text-xs font-semibold text-red-600">{timeLeft}</p>
      )}
    </div>
  );
}

/** Small "Sale" flag for cards and image corners. */
export function SaleBadge({ pricing }: { pricing: PricedResult }) {
  if (!pricing.onSale) return null;

  return (
    <span className="rounded-full bg-[#d4af37] px-2.5 py-1 text-xs font-bold text-black">
      {pricing.discountLabel || `-${Math.round(pricing.discountPercent)}% Sale`}
    </span>
  );
}

/**
 * Stock / backorder state.
 *
 * Out-of-stock products stay visible and are only blocked from purchase when
 * backordering is off, so the badge has to distinguish the two cases.
 */
export function StockBadge({
  inStock,
  allowBackorder,
  backorderMessage,
}: {
  inStock: boolean;
  allowBackorder: boolean;
  backorderMessage?: string | null;
}) {
  if (inStock) return null;

  if (allowBackorder) {
    return (
      <span
        className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700"
        title={backorderMessage ?? undefined}
      >
        Available on Order
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-500">
      Out of Stock
    </span>
  );
}
