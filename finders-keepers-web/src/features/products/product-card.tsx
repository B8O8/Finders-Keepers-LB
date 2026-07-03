"use client";

import Link from "next/link";
import { Heart } from "lucide-react";

import type { Product } from "@/types/product";
import { useHydrated } from "@/hooks/use-hydrated";
import { useWishlistStore } from "@/stores/wishlist-store";

function getProductPrice(product: Product) {
  const variant =
    product.variants.find((item) => item.isDefault) || product.variants[0];

  return variant ? Number(variant.price).toFixed(2) : "0.00";
}

function getProductImage(product: Product) {
  const image =
    product.images.find((item) => item.isPrimary) || product.images[0];

  return image?.file?.url || "/logo.jpg";
}

export function ProductCard({ product }: { product: Product }) {
  const hydrated = useHydrated();

  const toggleItem = useWishlistStore((state) => state.toggleItem);
  const isWishlisted = useWishlistStore((state) =>
    state.isWishlisted(product.id),
  );

  const image = getProductImage(product);
  const price = Number(getProductPrice(product));

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();

          toggleItem({
            productId: product.id,
            slug: product.slug,
            name: product.name,
            image,
            price,
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
            alt={product.name}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />

          <span className="absolute left-5 top-5 rounded-xl bg-white/90 px-4 py-2 text-sm font-medium text-black shadow-sm">
            {product.category?.name || "Finders"}
          </span>
        </div>

        <div className="p-6">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.3em] text-[#b08d2c]">
            Finders Keepers
          </p>

          <h3 className="text-xl font-medium text-black">{product.name}</h3>

          <div className="mt-6 flex items-center justify-between">
            <p className="text-2xl font-bold text-black">${price.toFixed(2)}</p>

            <span className="rounded-2xl bg-black px-6 py-3 text-sm font-semibold text-white transition group-hover:bg-[#d4af37] group-hover:text-black">
              View
            </span>
          </div>
        </div>
      </Link>
    </div>
  );
}