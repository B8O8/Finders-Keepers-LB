"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Heart,
  Menu,
  Search,
  ShoppingBag,
  User,
  X,
} from "lucide-react";
import { useState } from "react";

import { Button, ButtonLink } from "@/components/ui/button";
import { CartPreview } from "@/features/cart/cart-preview";
import { useHydrated } from "@/hooks/use-hydrated";
import { useAuthStore } from "@/stores/auth-store";
import { useCartStore } from "@/stores/cart-store";
import { useWishlistStore } from "@/stores/wishlist-store";

export function Navbar() {
  const router = useRouter();

  const hydrated = useHydrated();

  const customer = useAuthStore((state) => state.customer);

  const cartCount = useCartStore((state) => state.getCount());

  const wishlistCount = useWishlistStore((state) =>
    state.getCount(),
  );

  const [search, setSearch] = useState("");

  // Cart preview drawer. Opened from the cart button on both desktop and
  // mobile; the drawer itself handles Escape, outside-click and route changes.
  const [cartPreviewOpen, setCartPreviewOpen] = useState(false);

  const [mobileMenuOpen, setMobileMenuOpen] =
    useState(false);

  function handleSearchSubmit(
    e: React.FormEvent<HTMLFormElement>,
  ) {
    e.preventDefault();

    const value = search.trim();

    if (!value) {
      router.push("/products");
      return;
    }

    router.push(
      `/products?search=${encodeURIComponent(value)}`,
    );

    setMobileMenuOpen(false);
  }

  function closeMenu() {
    setMobileMenuOpen(false);
  }

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-black/10 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-20 max-w-[1440px] items-center justify-between px-5 lg:h-24 lg:px-10">
          <Link
            href="/"
            className="flex items-center gap-3"
          >
            <img
              src="/logo.jpg"
              alt="Finders Keepers"
              className="h-12 w-12 rounded-full border border-[#d4af37]/30 object-contain lg:h-14 lg:w-14"
            />

            <div>
              <h1 className="text-lg font-bold text-black lg:text-2xl">
                Finders Keepers
              </h1>

              <p className="hidden text-xs text-neutral-500 lg:block">
                Premium Fashion Store
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-8 lg:flex">
            <Link
              href="/"
              className="font-medium text-black transition hover:text-[#b08d2c]"
            >
              Home
            </Link>

            <Link
              href="/products"
              className="font-medium text-black transition hover:text-[#b08d2c]"
            >
              Shop
            </Link>

            <Link
              href="/wishlist"
              className="font-medium text-black transition hover:text-[#b08d2c]"
            >
              Wishlist
            </Link>

            <Link
              href="/account"
              className="font-medium text-black transition hover:text-[#b08d2c]"
            >
              Account
            </Link>
          </nav>

          <form
            onSubmit={handleSearchSubmit}
            className="hidden min-w-[260px] max-w-[360px] flex-1 items-center rounded-2xl border border-black/10 bg-[#f8f6f1] px-4 py-3 xl:flex"
          >
            <Search
              size={18}
              className="text-neutral-400"
            />

            <input
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              placeholder="Search products..."
              className="ml-3 w-full bg-transparent text-sm outline-none"
            />
          </form>

          <div className="hidden items-center gap-3 lg:flex">
            <ButtonLink
              href="/wishlist"
              variant="outline"
            >
              <Heart size={18} />
              Wishlist (
              {hydrated ? wishlistCount : 0})
            </ButtonLink>

            {customer ? (
              <ButtonLink
                href="/account"
                variant="outline"
              >
                <User size={18} />
                {customer.firstName || "Account"}
              </ButtonLink>
            ) : (
              <ButtonLink
                href="/login"
                variant="outline"
              >
                <User size={18} />
                Login
              </ButtonLink>
            )}

            <Button
              type="button"
              onClick={() => setCartPreviewOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={cartPreviewOpen}
              aria-label={`Open cart, ${hydrated ? cartCount : 0} item(s)`}
            >
              <ShoppingBag size={18} />
              Cart ({hydrated ? cartCount : 0})
            </Button>
          </div>

          <button
            type="button"
            onClick={() =>
              setMobileMenuOpen(true)
            }
            className="flex h-12 w-12 items-center justify-center rounded-xl border border-black/10 bg-white text-black lg:hidden"
          >
            <Menu size={24} />
          </button>
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/40 lg:hidden">
          <div className="absolute right-0 top-0 h-full w-[88%] max-w-sm overflow-y-auto bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-black/10 p-5">
              <div>
                <h2 className="text-xl font-bold">
                  Menu
                </h2>
              </div>

              <button
                type="button"
                onClick={closeMenu}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-black/10"
              >
                <X size={22} />
              </button>
            </div>

            <div className="p-5">
              <form
                onSubmit={handleSearchSubmit}
                className="mb-6 flex items-center rounded-2xl border border-black/10 bg-[#f8f6f1] px-4 py-3"
              >
                <Search
                  size={18}
                  className="text-neutral-400"
                />

                <input
                  value={search}
                  onChange={(e) =>
                    setSearch(e.target.value)
                  }
                  placeholder="Search..."
                  className="ml-3 w-full bg-transparent outline-none"
                />
              </form>

              <div className="space-y-3">
                <Link
                  href="/"
                  onClick={closeMenu}
                  className="block rounded-2xl bg-[#f8f6f1] px-5 py-4 font-medium"
                >
                  Home
                </Link>

                <Link
                  href="/products"
                  onClick={closeMenu}
                  className="block rounded-2xl bg-[#f8f6f1] px-5 py-4 font-medium"
                >
                  Shop
                </Link>

                <Link
                  href="/wishlist"
                  onClick={closeMenu}
                  className="block rounded-2xl bg-[#f8f6f1] px-5 py-4 font-medium"
                >
                  Wishlist (
                  {hydrated ? wishlistCount : 0})
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    closeMenu();
                    setCartPreviewOpen(true);
                  }}
                  aria-haspopup="dialog"
                  className="block w-full rounded-2xl bg-[#f8f6f1] px-5 py-4 text-left font-medium"
                >
                  Cart (
                  {hydrated ? cartCount : 0})
                </button>

                {customer ? (
                  <Link
                    href="/account"
                    onClick={closeMenu}
                    className="block rounded-2xl bg-[#f8f6f1] px-5 py-4 font-medium"
                  >
                    My Account
                  </Link>
                ) : (
                  <Link
                    href="/login"
                    onClick={closeMenu}
                    className="block rounded-2xl bg-[#f8f6f1] px-5 py-4 font-medium"
                  >
                    Login
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cart preview drawer - prices come from the server, quantities from the
          local cart store so +/- is instant. */}
      <CartPreview open={cartPreviewOpen} onClose={() => setCartPreviewOpen(false)} />
    </>
  );
}
