"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Navbar } from "@/components/layout/navbar";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductCard } from "@/features/products/product-card";
import { useProduct, useProducts } from "@/features/products/hooks";
import { productReviewsService } from "@/services/product-reviews.service";
import { useAuthStore } from "@/stores/auth-store";
import { useCartStore } from "@/stores/cart-store";
import { PriceBlock, StockBadge } from "@/components/product/price-block";
import { useRecentlyViewedStore } from "@/stores/recently-viewed-store";
import { getPrimaryCategory, getProductCategories } from "@/lib/category";
import type { ProductVariant } from "@/types/product";

export function ProductDetails({ slug }: { slug: string }) {
  const queryClient = useQueryClient();

  const { data: product, isLoading } = useProduct(slug);

  const customer = useAuthStore((state) => state.customer);
  const addItem = useCartStore((state) => state.addItem);
  const addRecentlyViewed = useRecentlyViewedStore((state) => state.addItem);

  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    null,
  );

  const [quantity, setQuantity] = useState(1);
  const [rating, setRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewComment, setReviewComment] = useState("");

  const selectedVariant: ProductVariant | undefined = product
    ? product.variants.find((item) => item.id === selectedVariantId) ||
      product.variants.find((item) => item.isDefault) ||
      product.variants[0]
    : undefined;

  const mainImage = product
    ? product.images.find((item) => item.isPrimary) || product.images[0]
    : undefined;

  useEffect(() => {
    if (!product) return;

    const defaultVariant =
      product.variants.find((item) => item.isDefault) || product.variants[0];

    const image =
      product.images.find((item) => item.isPrimary) || product.images[0];

    addRecentlyViewed({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      image: image?.file.url || "/logo.jpg",
      price: Number(defaultVariant?.price || 0),
    });
  }, [product, addRecentlyViewed]);

  // Breadcrumb / eyebrow / related-products all key off the same resolved
  // category, so the page can never claim one category and recommend from
  // another.
  const primaryCategory = getPrimaryCategory(product);
  const allCategories = getProductCategories(product);

  const { data: relatedProducts, isLoading: relatedLoading } = useProducts({
    page: 1,
    limit: 4,
    categorySlug: primaryCategory?.slug,
  });

  const filteredRelatedProducts =
    relatedProducts?.data.filter((item) => item.id !== product?.id) || [];

  const reviewMutation = useMutation({
    mutationFn: productReviewsService.create,
    onSuccess: () => {
      setRating(5);
      setReviewTitle("");
      setReviewComment("");

      queryClient.invalidateQueries({
        queryKey: ["product", slug],
      });
    },
  });

  const decreaseQuantity = () => {
    setQuantity((prev) => Math.max(1, prev - 1));
  };

  const increaseQuantity = () => {
    if (!selectedVariant) return;

    // A backorderable variant has no stock ceiling; otherwise stock is the cap.
    if (selectedVariant.allowBackorder) {
      setQuantity((prev) => prev + 1);
      return;
    }

    setQuantity((prev) => Math.min(selectedVariant.stock, prev + 1));
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#f8f6f1]">
        <Navbar />

        <section className="mx-auto max-w-[1440px] px-5 py-6 lg:px-10 lg:py-10">
          <div className="h-[520px] animate-pulse rounded-3xl bg-white lg:h-[600px]" />
        </section>
      </main>
    );
  }

  if (!product || !selectedVariant) {
    return (
      <main className="min-h-screen bg-[#f8f6f1]">
        <Navbar />

        <section className="mx-auto max-w-[1440px] px-5 py-16 lg:px-10">
          <div className="rounded-3xl bg-white p-8 text-center text-black">
            Product not found.
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f8f6f1]">
      <Navbar />

      <section className="mx-auto grid max-w-[1440px] gap-8 px-5 py-6 lg:grid-cols-2 lg:gap-12 lg:px-10 lg:py-10">
        <div className="overflow-hidden rounded-3xl border border-black/10 bg-[#f4efe7]">
          <img
            src={mainImage?.file.url || "/logo.jpg"}
            alt={product.name}
            className="h-[420px] w-full object-cover sm:h-[560px] lg:h-[680px]"
          />
        </div>

        <div className="flex flex-col justify-center">
          {/* Breadcrumb follows the primary category only. The product's other
              categories are listed separately below, so a product in five
              categories doesn't produce a five-deep nonsense trail. */}
          <nav aria-label="Breadcrumb" className="mb-4">
            <ol className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.35em] text-[#b08d2c] lg:text-sm lg:tracking-[0.4em]">
              <li>
                <Link href="/products" className="transition-colors hover:text-black">
                  Finders Keepers
                </Link>
              </li>
              {primaryCategory && (
                <>
                  <li aria-hidden="true" className="text-black/25">
                    /
                  </li>
                  <li>
                    <Link
                      href={`/category/${primaryCategory.slug}`}
                      className="transition-colors hover:text-black"
                    >
                      {primaryCategory.name}
                    </Link>
                  </li>
                </>
              )}
            </ol>
          </nav>

          <h1 className="text-4xl font-semibold tracking-tight text-black lg:text-5xl">
            {product.name}
          </h1>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-neutral-500">
            <span>★ {product.reviewStats?.averageRating || 0}</span>
            <span>({product.reviewStats?.totalReviews || 0} reviews)</span>
          </div>

          {/* Every category this product belongs to, each independently
              browsable. Shown only when there's more than the breadcrumb
              already conveys. */}
          {allCategories.length > 1 && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-neutral-400">
                Also in
              </span>
              {allCategories
                .filter((category) => category.id !== primaryCategory?.id)
                .map((category) => (
                  <Link
                    key={category.id}
                    href={`/category/${category.slug}`}
                    className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs text-neutral-700 transition-colors hover:border-black/30 hover:text-black"
                  >
                    {category.name}
                  </Link>
                ))}
            </div>
          )}

          {/* Price always comes from the server-computed pricing when present,
              so the detail page can never disagree with the cart or the order. */}
          <div className="mt-7 lg:mt-8">
            {selectedVariant.pricing ? (
              <PriceBlock pricing={selectedVariant.pricing} size="lg" />
            ) : (
              <p className="text-3xl font-bold text-black lg:text-4xl">
                ${Number(selectedVariant.price).toFixed(2)}
              </p>
            )}
          </div>

          <p className="mt-5 max-w-xl text-base leading-8 text-neutral-600 lg:mt-6 lg:text-lg">
            {product.description || product.shortDescription}
          </p>

          <div className="mt-8 lg:mt-10">
            <p className="mb-4 text-sm font-bold uppercase tracking-[0.25em] text-neutral-500">
              Select Option
            </p>

            <div className="flex flex-wrap gap-3">
              {product.variants.map((variant) => {
                const isSelected = selectedVariant.id === variant.id;

                return (
                  <button
                    key={variant.id}
                    type="button"
                    onClick={() => {
                      setSelectedVariantId(variant.id);
                      setQuantity(1);
                    }}
                    className={`rounded-2xl border px-5 py-3 text-sm font-semibold transition lg:px-6 lg:py-4 ${
                      isSelected
                        ? "border-black bg-black text-white"
                        : "border-black/10 bg-white text-black hover:border-black"
                    }`}
                  >
                    {variant.name || "Default"}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Out-of-stock products stay visible and, when backordering is
              enabled, remain orderable. */}
          <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-neutral-500 lg:mt-8">
            {selectedVariant.stock > 0 ? (
              <span>{selectedVariant.stock} available</span>
            ) : (
              <>
                <StockBadge
                  inStock={false}
                  allowBackorder={!!selectedVariant.allowBackorder}
                  backorderMessage={selectedVariant.backorderMessage}
                />
                {selectedVariant.allowBackorder ? (
                  <span className="text-blue-700">
                    {selectedVariant.backorderMessage ||
                      "This item is made to order and will ship when available."}
                  </span>
                ) : (
                  <span className="text-red-600">
                    Currently unavailable - check back soon.
                  </span>
                )}
              </>
            )}

            {selectedVariant.stock <= 0 &&
              selectedVariant.allowBackorder &&
              selectedVariant.availabilityDate && (
                <span className="text-neutral-500">
                  Estimated{" "}
                  {new Date(selectedVariant.availabilityDate).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              )}
          </div>

          <div className="mt-7 lg:mt-8">
            <p className="mb-4 text-sm font-bold uppercase tracking-[0.25em] text-neutral-500">
              Quantity
            </p>

            <div className="flex w-fit items-center overflow-hidden rounded-2xl border border-black/10 bg-white">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={quantity <= 1}
                onClick={decreaseQuantity}
                className="h-12 w-12 rounded-none border-r border-black/10 px-0 text-xl lg:h-14 lg:w-14"
              >
                -
              </Button>

              <div className="flex h-12 min-w-14 items-center justify-center px-5 text-base font-semibold text-black lg:h-14 lg:min-w-16 lg:px-6 lg:text-lg">
                {quantity}
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={
                  // With backorder enabled there is no stock ceiling.
                  !selectedVariant.allowBackorder &&
                  (selectedVariant.stock <= 0 || quantity >= selectedVariant.stock)
                }
                onClick={increaseQuantity}
                className="h-12 w-12 rounded-none border-l border-black/10 px-0 text-xl lg:h-14 lg:w-14"
              >
                +
              </Button>
            </div>
          </div>

          <Button
            type="button"
            size="lg"
            fullWidth
            // Blocked only when it is genuinely unavailable: out of stock AND
            // backordering is off. A backorderable item stays purchasable.
            disabled={selectedVariant.stock <= 0 && !selectedVariant.allowBackorder}
            onClick={() =>
              addItem({
                productId: product.id,
                variantId: selectedVariant.id,
                name: product.name,
                image: mainImage?.file.url || "/logo.jpg",
                // Display-only: checkout always re-prices server-side.
                price: selectedVariant.pricing?.finalPrice ?? Number(selectedVariant.price),
                quantity,
                variantName: selectedVariant.name || undefined,
              })
            }
            className="mt-8 lg:mt-10 lg:w-fit"
          >
            {selectedVariant.stock <= 0
              ? selectedVariant.allowBackorder
                ? "Order Now (Backorder)"
                : "Out Of Stock"
              : "Add To Cart"}
          </Button>
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-5 pb-12 lg:px-10 lg:pb-16">
        <div className="rounded-3xl bg-white p-6 lg:p-10">
          <h2 className="text-3xl font-semibold text-black">Reviews</h2>

          {customer ? (
            <div className="mt-8 rounded-3xl border border-black/10 p-5 lg:p-6">
              <h3 className="text-xl font-semibold text-black">
                Write a Review
              </h3>

              <div className="mt-5">
                <label className="mb-2 block text-sm font-semibold text-black">
                  Rating
                </label>

                <select
                  value={rating}
                  onChange={(e) => setRating(Number(e.target.value))}
                  className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-black outline-none transition focus:border-black"
                >
                  <option value={5}>★★★★★ (5)</option>
                  <option value={4}>★★★★☆ (4)</option>
                  <option value={3}>★★★☆☆ (3)</option>
                  <option value={2}>★★☆☆☆ (2)</option>
                  <option value={1}>★☆☆☆☆ (1)</option>
                </select>
              </div>

              <div className="mt-4">
                <Input
                  label="Title"
                  value={reviewTitle}
                  onChange={(e) => setReviewTitle(e.target.value)}
                />
              </div>

              <div className="mt-4">
                <label className="mb-2 block text-sm font-semibold text-black">
                  Comment
                </label>

                <textarea
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  rows={5}
                  className="w-full rounded-2xl border border-black/10 px-4 py-3 text-black outline-none transition focus:border-black"
                  placeholder="Write your review..."
                />
              </div>

              <Button
                type="button"
                className="mt-5"
                fullWidth
                disabled={reviewMutation.isPending || !reviewComment.trim()}
                onClick={() =>
                  reviewMutation.mutate({
                    productId: product.id,
                    rating,
                    title: reviewTitle || undefined,
                    comment: reviewComment,
                  })
                }
              >
                {reviewMutation.isPending ? "Submitting..." : "Submit Review"}
              </Button>
            </div>
          ) : (
            <div className="mt-8 rounded-3xl border border-black/10 p-5 lg:p-6">
              <p className="text-neutral-600">Login to leave a review.</p>

              <div className="mt-5">
                <ButtonLink href="/login" size="md">
                  Login
                </ButtonLink>
              </div>
            </div>
          )}

          {product.reviews?.length ? (
            <div className="mt-10 grid gap-4">
              {product.reviews.map((review) => (
                <div
                  key={review.id}
                  className="rounded-2xl border border-black/10 p-5"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="font-semibold text-black">
                      ★ {review.rating}
                    </p>

                    {review.title ? (
                      <p className="font-semibold text-black">{review.title}</p>
                    ) : null}
                  </div>

                  <p className="mt-3 text-neutral-600">{review.comment}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-6 text-neutral-500">
              No reviews yet. Be the first to review this product.
            </p>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-5 pb-20 lg:px-10 lg:pb-24">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.35em] text-[#b08d2c]">
              Related
            </p>

            <h2 className="mt-3 text-3xl font-bold text-black lg:text-4xl">
              You may also like
            </h2>
          </div>
        </div>

        {relatedLoading ? (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="h-[560px] animate-pulse rounded-2xl bg-white"
              />
            ))}
          </div>
        ) : filteredRelatedProducts.length ? (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {filteredRelatedProducts.slice(0, 3).map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        ) : (
          <div className="rounded-3xl bg-white p-8 text-neutral-500 lg:p-10">
            No related products yet.
          </div>
        )}
      </section>
    </main>
  );
}