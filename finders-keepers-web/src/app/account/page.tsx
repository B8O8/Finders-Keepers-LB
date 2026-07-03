"use client";

import { useRouter } from "next/navigation";
import { User, LogOut } from "lucide-react";

import { Navbar } from "@/components/layout/navbar";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useHydrated } from "@/hooks/use-hydrated";
import { useAuthStore } from "@/stores/auth-store";

export default function AccountPage() {
  const router = useRouter();
  const hydrated = useHydrated();

  const customer = useAuthStore((state) => state.customer);
  const logout = useAuthStore((state) => state.logout);

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
            <User className="mx-auto mb-6" size={42} />

            <h1 className="text-4xl font-bold text-black">
              My Account
            </h1>

            <p className="mt-4 text-neutral-500">
              Login or create an account to view your orders and manage your profile.
            </p>

            <div className="mt-8 flex justify-center gap-4">
              <ButtonLink href="/login" size="lg">
                Login
              </ButtonLink>

              <ButtonLink href="/signup" variant="outline" size="lg">
                Sign Up
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

      <section className="mx-auto max-w-[1100px] px-10 py-10">
        <div className="mb-8">
          <p className="text-sm font-bold uppercase tracking-[0.35em] text-[#b08d2c]">
            Account
          </p>

          <h1 className="mt-3 text-5xl font-bold text-black">
            Welcome, {customer.firstName || "Customer"}
          </h1>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card className="md:col-span-2">
            <h2 className="text-2xl font-bold text-black">
              Profile Details
            </h2>

            <div className="mt-6 grid gap-4 text-sm">
              <div className="flex justify-between border-b border-black/10 pb-3">
                <span className="text-neutral-500">Name</span>
                <span className="font-semibold text-black">
                  {[customer.firstName, customer.lastName].filter(Boolean).join(" ") ||
                    "Not provided"}
                </span>
              </div>

              <div className="flex justify-between border-b border-black/10 pb-3">
                <span className="text-neutral-500">Email</span>
                <span className="font-semibold text-black">
                  {customer.email || "Not provided"}
                </span>
              </div>

              <div className="flex justify-between border-b border-black/10 pb-3">
                <span className="text-neutral-500">Phone</span>
                <span className="font-semibold text-black">
                  {customer.phone || "Not provided"}
                </span>
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="text-2xl font-bold text-black">Actions</h2>

            <div className="mt-6 grid gap-3">
              <ButtonLink href="/account/orders" variant="outline" fullWidth>
                My Orders
              </ButtonLink>

              <ButtonLink href="/account/profile" variant="outline" fullWidth>
                Edit Profile
              </ButtonLink>

              <Button
                type="button"
                variant="secondary"
                fullWidth
                onClick={() => {
                  logout();
                  router.push("/");
                }}
              >
                <LogOut size={18} />
                Logout
              </Button>
            </div>
          </Card>
        </div>
      </section>
    </main>
  );
}