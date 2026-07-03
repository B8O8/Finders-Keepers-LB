"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, Trash2 } from "lucide-react";

import { Navbar } from "@/components/layout/navbar";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useHydrated } from "@/hooks/use-hydrated";
import { customerAddressesService } from "@/services/customer-addresses.service";
import { useAuthStore } from "@/stores/auth-store";

export function AccountAddressesPage() {
  const queryClient = useQueryClient();
  const hydrated = useHydrated();
  const customer = useAuthStore((state) => state.customer);

  const [form, setForm] = useState({
    label: "",
    fullName: "",
    phone: "",
    city: "",
    area: "",
    street: "",
    building: "",
    floor: "",
    apartment: "",
    notes: "",
    isDefault: false,
  });

  const { data: addresses, isLoading } = useQuery({
    queryKey: ["customer-addresses"],
    queryFn: customerAddressesService.getMyAddresses,
    enabled: hydrated && !!customer,
  });

  const createMutation = useMutation({
    mutationFn: customerAddressesService.createAddress,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-addresses"] });

      setForm({
        label: "",
        fullName: "",
        phone: "",
        city: "",
        area: "",
        street: "",
        building: "",
        floor: "",
        apartment: "",
        notes: "",
        isDefault: false,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: customerAddressesService.deleteAddress,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-addresses"] });
    },
  });

  const defaultMutation = useMutation({
    mutationFn: customerAddressesService.setDefaultAddress,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-addresses"] });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    createMutation.mutate({
      label: form.label || undefined,
      fullName: form.fullName,
      phone: form.phone,
      city: form.city,
      area: form.area,
      street: form.street,
      building: form.building || undefined,
      floor: form.floor || undefined,
      apartment: form.apartment || undefined,
      notes: form.notes || undefined,
      isDefault: form.isDefault,
    });
  }

  if (!hydrated) {
    return (
      <main className="min-h-screen bg-[#f8f6f1]">
        <Navbar />
      </main>
    );
  }

  if (!customer) {
    return (
      <main className="min-h-screen bg-[#f8f6f1]">
        <Navbar />

        <section className="mx-auto max-w-xl px-6 py-20 text-center">
          <Card className="p-10">
            <MapPin className="mx-auto mb-6" size={42} />

            <h1 className="text-4xl font-bold text-black">Addresses</h1>

            <p className="mt-4 text-neutral-500">
              Please login to manage your delivery addresses.
            </p>

            <div className="mt-8">
              <ButtonLink href="/login" size="lg">
                Login
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

      <section className="mx-auto max-w-[1200px] px-10 py-10">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.35em] text-[#b08d2c]">
              Account
            </p>

            <h1 className="mt-3 text-5xl font-bold text-black">
              Delivery Addresses
            </h1>
          </div>

          <ButtonLink href="/account" variant="outline">
            Back to Account
          </ButtonLink>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_420px]">
          <div className="grid gap-4">
            {isLoading ? (
              Array.from({ length: 2 }).map((_, index) => (
                <Card key={index} className="h-40 animate-pulse">
                  <div />
                </Card>
              ))
            ) : !addresses?.length ? (
              <Card className="p-10 text-center">
                <h2 className="text-2xl font-bold text-black">
                  No addresses yet
                </h2>

                <p className="mt-3 text-neutral-500">
                  Add your first delivery address to make checkout faster.
                </p>
              </Card>
            ) : (
              addresses.map((address) => (
                <Card key={address.id}>
                  <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <h2 className="text-xl font-bold text-black">
                          {address.label || "Delivery Address"}
                        </h2>

                        {address.isDefault ? (
                          <span className="rounded-full bg-[#d4af37]/20 px-3 py-1 text-xs font-bold text-[#8a6a12]">
                            Default
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-3 font-semibold text-black">
                        {address.fullName} · {address.phone}
                      </p>

                      <p className="mt-2 max-w-xl text-sm leading-6 text-neutral-500">
                        {[
                          address.area,
                          address.city,
                          address.street,
                          address.building,
                          address.floor ? `Floor ${address.floor}` : null,
                          address.apartment
                            ? `Apt ${address.apartment}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </p>

                      {address.notes ? (
                        <p className="mt-2 text-sm text-neutral-500">
                          Notes: {address.notes}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex gap-2">
                      {!address.isDefault ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => defaultMutation.mutate(address.id)}
                        >
                          Set Default
                        </Button>
                      ) : null}

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteMutation.mutate(address.id)}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>

          <Card className="h-fit p-8">
            <h2 className="text-2xl font-bold text-black">Add Address</h2>

            <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
              <Input
                label="Label"
                placeholder="Home, Work..."
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
              />

              <Input
                label="Full Name"
                required
                value={form.fullName}
                onChange={(e) =>
                  setForm({ ...form, fullName: e.target.value })
                }
              />

              <Input
                label="Phone"
                required
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  label="City"
                  required
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />

                <Input
                  label="Area"
                  required
                  value={form.area}
                  onChange={(e) => setForm({ ...form, area: e.target.value })}
                />
              </div>

              <Input
                label="Street"
                required
                value={form.street}
                onChange={(e) => setForm({ ...form, street: e.target.value })}
              />

              <div className="grid gap-4 md:grid-cols-3">
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
                  onChange={(e) => setForm({ ...form, floor: e.target.value })}
                />

                <Input
                  label="Apt"
                  value={form.apartment}
                  onChange={(e) =>
                    setForm({ ...form, apartment: e.target.value })
                  }
                />
              </div>

              <Input
                label="Notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />

              <label className="flex items-center gap-3 text-sm font-semibold text-black">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(e) =>
                    setForm({ ...form, isDefault: e.target.checked })
                  }
                />
                Set as default address
              </label>

              <Button
                type="submit"
                size="lg"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? "Saving..." : "Save Address"}
              </Button>
            </form>
          </Card>
        </div>
      </section>
    </main>
  );
}