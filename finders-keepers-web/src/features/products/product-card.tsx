"use client";

import Link from "next/link";
import { Heart } from "lucide-react";

import type { Product, ProductVariant } from "@/types/product";
import { getPrimaryCategory } from "@/lib/category";
import { useHydrated } from "@/hooks/use-hydrated";
import { useWishlistStore } from "@/stores/wishlist-store";
import { PriceBlock, SaleBadge, StockBadge } from "@/components/product/price-block";

/** The variant a card represents: the default, else the first. */
function getDisplayVariant(product: Product): ProductVariant | undefined {
  return product.variants.find((item) => item.isDefault) || product.variants[0];
}

function getProductImage(product: Product) {
  const image =
    product.images.find((item) => item.isPrimary) || product.images[0];

  return image?.file?.url || "/logo.jpg";
}

/** Prefer curated alt text; fall back to the product name. */
function getImageAlt(product: Product) {
  const image =
    product.images.find((item) => item.isPrimary) || product.images[0];

  return image?.file?.altText || product.name;
}

export function ProductCard({ product }: { product: Product }) {
  const hydrated = useHydrated();

  const toggleItem = useWishlistStore((state) => state.toggleItem);
  const isWishlisted = useWishlistStore((state) =>
    state.isWishlisted(product.id),
  );

  const image = getProductImage(product);
  const variant = getDisplayVariant(product);
  const pricing = variant?.pricing;

  // Out-of-stock products stay fully visible and browsable; only the badge and
  // the add-to-cart path change.
  const inStock = variant ? (variant.inStock ?? variant.stock > 0) : false;
  const allowBackorder = variant?.allowBackorder ?? false;

  // Fall back to the raw price if the API did not price this payload.
  const fallbackPrice = variant ? Number(variant.price) : 0;

  // Same resolver the detail page uses, so a card and the product it links to
  // can never disagree about which category the product is in.
  const categoryLabel = getPrimaryCategory(product)?.name || "Finders";

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
      <button
        type="button"
        aria-label={
          hydrated && isWishlisted
            ? `Remove ${product.name} from wishlist`
            : `Add ${product.name} to wishlist`
        }
        aria-pressed={hydrated ? isWishlisted : false}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();

          toggleItem({
            productId: product.id,
            slug: product.slug,
            name: product.name,
            image,
            price: pricing?.finalPrice ?? fallbackPrice,
          });
        }}
        className={`absolute right-5 top-5 z-10 flex h-11 w-11 items-center justify-center rounded-full border shadow-sm transition ${
          hydrated && isWishlisted
            ? "border-black bg-black text-white"
            : "border-black/10 bg-white text-black hover:bg-black hover:text-white"
        }`}
      >
        <Heart
          size={20}
          fill={hydrated && isWishlisted ? "currentColor" : "none"}
        />
      </button>

      <Link href={`/products/${product.slug}`} className="block">
        <div className="relative flex h-[420px] items-center justify-center overflow-hidden bg-[#f4efe7]">
          <img
            src={image}
            alt={getImageAlt(product)}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />

          <span className="absolute left-5 top-5 rounded-xl bg-white/90 px-4 py-2 text-sm font-medium text-black shadow-sm">
            {categoryLabel}
          </span>

          {/* Sale / stock flags */}
          <div className="absolute bottom-5 left-5 flex flex-wrap gap-2">
            {pricing && <SaleBadge pricing={pricing} />}
            <StockBadge
              inStock={inStock}
              allowBackorder={allowBackorder}
              backorderMessage={variant?.backorderMessage}
            />
          </div>
        </div>

        <div className="p-6">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.3em] text-[#b08d2c]">
            Finders Keepers
          </p>

          <h3 className="text-xl font-medium text-black">{product.name}</h3>

          <div className="mt-6 flex items-center justify-between gap-3">
            {pricing ? (
              <PriceBlock pricing={pricing} size="md" showCountdown={false} />
            ) : (
              <p className="text-2xl font-bold text-black">
                ${fallbackPrice.toFixed(2)}
              </p>
            )}

            <span className="shrink-0 rounded-2xl bg-black px-6 py-3 text-sm font-semibold text-white transition group-hover:bg-[#d4af37] group-hover:text-black">
              View
            </span>
          </div>
        </div>
      </Link>
    </div>
  );
}
