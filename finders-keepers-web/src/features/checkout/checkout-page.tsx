"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useHydrated } from "@/hooks/use-hydrated";
import { checkoutService } from "@/services/checkout.service";
import { storefrontService } from "@/services/storefront.service";
import { formatCurrency } from "@/lib/utils";
import type { PricedCart } from "@/types/pricing";
import { customerAddressesService } from "@/services/customer-addresses.service";
import { useAuthStore } from "@/stores/auth-store";
import { useCartStore } from "@/stores/cart-store";

export function CheckoutPage() {
  const router = useRouter();
  const hydrated = useHydrated();

  const customer = useAuthStore((state) => state.customer);

  const items = useCartStore((state) => state.items);
  // The order total is always recalculated server-side at checkout. This screen
  // must therefore show the SERVER's numbers, not the cart's cached ones, or the
  // customer would confirm one figure and be charged another.
  const cartKey = items.map((i) => `${i.variantId}:${i.quantity}`).join(",");

  const { data: priced } = useQuery<PricedCart>({
    queryKey: ["price-cart", cartKey],
    queryFn: () =>
      storefrontService.priceCart(
        items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
      ),
    enabled: items.length > 0,
    staleTime: 30_000,
  });

  const total =
    priced?.summary.subtotal ??
    items.reduce((acc, i) => acc + i.price * i.quantity, 0);
  const clearCart = useCartStore((state) => state.clearCart);

  const isLoggedIn = hydrated && !!customer;

  const { data: addresses, isLoading: addressesLoading } = useQuery({
    queryKey: ["customer-addresses"],
    queryFn: customerAddressesService.getMyAddresses,
    enabled: isLoggedIn,
  });

  const defaultAddressId = useMemo(() => {
    const defaultAddress = addresses?.find((address) => address.isDefault);
    return defaultAddress?.id || addresses?.[0]?.id || "";
  }, [addresses]);

  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);

  const [form, setForm] = useState({
    guestName: "",
    guestEmail: "",
    guestPhone: "",
    city: "",
    area: "",
    street: "",
    building: "",
    floor: "",
    apartment: "",
    notes: "",
    latitude: undefined as number | undefined,
    longitude: undefined as number | undefined,
  });

  useEffect(() => {
    if (defaultAddressId && !selectedAddressId) {
      setSelectedAddressId(defaultAddressId);
    }
  }, [defaultAddressId, selectedAddressId]);

  function getCurrentLocation() {
    if (!navigator.geolocation) {
      alert("Location is not supported by this browser.");
      return;
    }

    setLocationLoading(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((prev) => ({
          ...prev,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }));

        setLocationLoading(false);
      },
      () => {
        alert("Unable to get your location.");
        setLocationLoading(false);
      },
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!items.length) {
      alert("Your cart is empty.");
      return;
    }

    setLoading(true);

    try {
      let order;

      if (customer) {
        if (!selectedAddressId) {
          alert("Please select a delivery address.");
          setLoading(false);
          return;
        }

        await checkoutService.syncCustomerCartToBackend(items);

        order = await checkoutService.customerCheckout({
          addressId: selectedAddressId,
          notes: form.notes || undefined,
        });
      } else {
        if (
          !form.guestName ||
          !form.guestPhone ||
          !form.city ||
          !form.area ||
          !form.street
        ) {
          alert("Full name, phone, city, area, and street are required.");
          setLoading(false);
          return;
        }

        const guestToken = await checkoutService.syncGuestCartToBackend(items);

        order = await checkoutService.guestCheckout({
          guestToken,
          guestName: form.guestName,
          guestEmail: form.guestEmail || undefined,
          guestPhone: form.guestPhone,
          city: form.city,
          area: form.area,
          street: form.street,
          building: form.building || undefined,
          floor: form.floor || undefined,
          apartment: form.apartment || undefined,
          notes: form.notes || undefined,
          latitude: form.latitude,
          longitude: form.longitude,
        });
      }

      clearCart();

      router.push(`/checkout/success?order=${order.orderNumber}`);
    } catch (error) {
      console.error(error);
      alert("Checkout failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!hydrated) {
    return (
      <main className="min-h-screen bg-[#f8f6f1]">
        <Navbar />
      </main>
    );
  }

  if (!items.length) {
    return (
      <main className="min-h-screen bg-[#f8f6f1]">
        <Navbar />

        <section className="mx-auto max-w-xl px-5 py-16 text-center">
          <Card className="p-8">
            <h1 className="text-4xl font-bold text-black">Checkout</h1>

            <p className="mt-4 text-neutral-500">
              Your cart is empty. Add products before checkout.
            </p>

            <div className="mt-8">
              <Button
                type="button"
                size="lg"
                onClick={() => router.push("/products")}
              >
                Shop Products
              </Button>
            </div>
          </Card>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f8f6f1]">
      <Navbar />

      <section className="mx-auto grid max-w-[1200px] gap-8 px-5 py-6 lg:grid-cols-[1fr_380px] lg:px-10 lg:py-10">
        <form onSubmit={handleSubmit}>
          <Card className="p-6 lg:p-8">
            <p className="text-sm font-bold uppercase tracking-[0.35em] text-[#b08d2c]">
              Checkout
            </p>

            <h1 className="mt-3 text-4xl font-bold text-black lg:text-5xl">
              Delivery Details
            </h1>

            <p className="mt-3 text-neutral-500">Cash on delivery order.</p>

            {customer ? (
              <div className="mt-8">
                <h2 className="text-2xl font-bold text-black">
                  Delivery Address
                </h2>

                <p className="mt-2 text-sm text-neutral-500">
                  Choose one of your saved addresses.
                </p>

                {addressesLoading ? (
                  <div className="mt-6 h-32 animate-pulse rounded-3xl bg-neutral-100" />
                ) : !addresses?.length ? (
                  <div className="mt-6 rounded-3xl border border-red-200 bg-red-50 p-6">
                    <p className="font-semibold text-red-700">
                      You don&apos;t have any saved addresses yet.
                    </p>

                    <p className="mt-2 text-sm text-red-600">
                      Please add an address from your account before checking
                      out.
                    </p>

                    <Button
                      type="button"
                      className="mt-5"
                      onClick={() => router.push("/account/addresses")}
                    >
                      Add Address
                    </Button>
                  </div>
                ) : (
                  <div className="mt-6 grid gap-4">
                    {addresses.map((address) => {
                      const selected = selectedAddressId === address.id;

                      return (
                        <button
                          key={address.id}
                          type="button"
                          onClick={() => setSelectedAddressId(address.id)}
                          className={`rounded-3xl border p-5 text-left transition ${
                            selected
                              ? "border-black bg-black text-white"
                              : "border-black/10 bg-white text-black hover:border-black"
                          }`}
                        >
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="font-bold">
                                {address.label || "Delivery Address"}
                              </p>

                              <p
                                className={`mt-2 text-sm ${
                                  selected
                                    ? "text-white/75"
                                    : "text-neutral-500"
                                }`}
                              >
                                {address.fullName || "No name"} ·{" "}
                                {address.phone || "No phone"}
                              </p>

                              <p
                                className={`mt-2 text-sm leading-6 ${
                                  selected
                                    ? "text-white/75"
                                    : "text-neutral-500"
                                }`}
                              >
                                {[
                                  address.area,
                                  address.city,
                                  address.street,
                                  address.building,
                                  address.floor
                                    ? `Floor ${address.floor}`
                                    : null,
                                  address.apartment
                                    ? `Apt ${address.apartment}`
                                    : null,
                                ]
                                  .filter(Boolean)
                                  .join(", ")}
                              </p>
                            </div>

                            {address.isDefault ? (
                              <span
                                className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${
                                  selected
                                    ? "bg-white text-black"
                                    : "bg-[#d4af37]/20 text-[#8a6a12]"
                                }`}
                              >
                                Default
                              </span>
                            ) : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                <Input
                  label="Order Notes Optional"
                  className="mt-6"
                  value={form.notes}
                  onChange={(e) =>
                    setForm({ ...form, notes: e.target.value })
                  }
                />
              </div>
            ) : (
              <div className="mt-8 grid gap-5">
                <div className="grid gap-5 md:grid-cols-2">
                  <Input
                    label="Full Name"
                    required
                    value={form.guestName}
                    onChange={(e) =>
                      setForm({ ...form, guestName: e.target.value })
                    }
                  />

                  <Input
                    label="Phone Number"
                    required
                    value={form.guestPhone}
                    onChange={(e) =>
                      setForm({ ...form, guestPhone: e.target.value })
                    }
                  />
                </div>

                <Input
                  label="Email Optional"
                  type="email"
                  value={form.guestEmail}
                  onChange={(e) =>
                    setForm({ ...form, guestEmail: e.target.value })
                  }
                />

                <div className="grid gap-5 md:grid-cols-2">
                  <Input
                    label="City"
                    required
                    value={form.city}
                    onChange={(e) =>
                      setForm({ ...form, city: e.target.value })
                    }
                  />

                  <Input
                    label="Area"
                    required
                    value={form.area}
                    onChange={(e) =>
                      setForm({ ...form, area: e.target.value })
                    }
                  />
                </div>

                <Input
                  label="Street"
                  required
                  value={form.street}
                  onChange={(e) =>
                    setForm({ ...form, street: e.target.value })
                  }
                />

                <div className="grid gap-5 md:grid-cols-3">
                  <Input
                    label="Building"
                    value={form.building}
                    onChange={(e) =>
                      setForm({ ...form, building: e.target.value })
                    }
                  />

                  <Input
                    label="Floor"
                    value={form.floor}
                    onChange={(e) =>
                      setForm({ ...form, floor: e.target.value })
                    }
                  />

                  <Input
                    label="Apartment"
                    value={form.apartment}
                    onChange={(e) =>
                      setForm({ ...form, apartment: e.target.value })
                    }
                  />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={getCurrentLocation}
                  disabled={locationLoading}
                >
                  <MapPin size={18} />
                  {locationLoading
                    ? "Getting Location..."
                    : form.latitude && form.longitude
                      ? "Location Added"
                      : "Use Current Location"}
                </Button>

                <Input
                  label="Notes Optional"
                  value={form.notes}
                  onChange={(e) =>
                    setForm({ ...form, notes: e.target.value })
                  }
                />
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              fullWidth
              className="mt-8"
              disabled={
                loading ||
                items.length === 0 ||
                (!!customer && !selectedAddressId)
              }
            >
              {loading ? "Placing Order..." : "Place Order"}
            </Button>
          </Card>
        </form>

        <Card className="h-fit p-6 lg:sticky lg:top-32 lg:p-8">
          <h2 className="text-2xl font-bold text-black">Order Summary</h2>

          <div className="mt-6 space-y-4">
            {items.map((item) => (
              <div
                key={item.variantId}
                className="flex justify-between gap-4 text-sm"
              >
                <div>
                  <p className="font-semibold text-black">{item.name}</p>

                  <p className="mt-1 text-neutral-500">
                    {item.variantName} × {item.quantity}
                  </p>
                </div>

                <p className="font-semibold text-black">
                  {formatCurrency(
                    priced?.items.find((l) => l.variantId === item.variantId)
                      ?.lineTotal ?? item.price * item.quantity,
                  )}
                </p>
              </div>
            ))}
          </div>

          <hr className="my-6 border-black/10" />

          {priced && priced.summary.discountTotal > 0 && (
            <div className="mb-4 flex justify-between text-sm">
              <span className="text-neutral-500">Discounts</span>
              <span className="font-semibold text-green-700">
                -{formatCurrency(priced.summary.discountTotal)}
              </span>
            </div>
          )}

          {priced?.summary.hasBackorderedItems && (
            <p className="mb-4 rounded-xl bg-blue-50 p-3 text-xs text-blue-800">
              Some items are on backorder and will ship when available.
            </p>
          )}

          <div className="flex justify-between text-sm text-neutral-500">
            <span>Delivery</span>
            <span>Calculated after confirmation</span>
          </div>

          <div className="mt-5 flex justify-between text-xl font-bold text-black">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </Card>
      </section>
    </main>
  );
}