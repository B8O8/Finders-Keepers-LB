"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Package } from "lucide-react";

import { Navbar } from "@/components/layout/navbar";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useHydrated } from "@/hooks/use-hydrated";
import { ordersService } from "@/services/orders.service";
import { useAuthStore } from "@/stores/auth-store";

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getStatusVariant(status: string) {
  if (status === "DELIVERED") return "success";
  if (status === "CANCELLED") return "danger";
  if (status === "PENDING") return "gold";
  return "default";
}

export function AccountOrdersPage() {
  const hydrated = useHydrated();
  const customer = useAuthStore((state) => state.customer);

  const { data: orders, isLoading } = useQuery({
    queryKey: ["my-orders"],
    queryFn: ordersService.getMyOrders,
    enabled: hydrated && !!customer,
  });

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
            <Package className="mx-auto mb-6" size={42} />

            <h1 className="text-4xl font-bold text-black">My Orders</h1>

            <p className="mt-4 text-neutral-500">
              Please login to view your orders.
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

      <section className="mx-auto max-w-[1100px] px-10 py-10">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.35em] text-[#b08d2c]">
              Account
            </p>

            <h1 className="mt-3 text-5xl font-bold text-black">My Orders</h1>
          </div>

          <ButtonLink href="/account" variant="outline">
            Back to Account
          </ButtonLink>
        </div>

        {isLoading ? (
          <div className="grid gap-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <Card key={index} className="h-32 animate-pulse">
                <div />
            </Card>
            ))}
          </div>
        ) : !orders?.length ? (
          <Card className="p-10 text-center">
            <h2 className="text-2xl font-bold text-black">No orders yet</h2>

            <p className="mt-3 text-neutral-500">
              Your orders will appear here after checkout.
            </p>

            <div className="mt-8">
              <ButtonLink href="/products" size="lg">
                Shop Products
              </ButtonLink>
            </div>
          </Card>
        ) : (
          <div className="grid gap-4">
            {orders.map((order) => (
              <Link key={order.id} href={`/account/orders/${order.id}`}>
                <Card className="transition hover:-translate-y-1 hover:shadow-lg">
                  <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm text-neutral-500">
                        {formatDate(order.createdAt)}
                      </p>

                      <h2 className="mt-1 text-xl font-bold text-black">
                        {order.orderNumber}
                      </h2>

                      <p className="mt-2 text-sm text-neutral-500">
                        {order.items.length} item(s)
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <Badge variant={getStatusVariant(order.status)}>
                        {order.status}
                      </Badge>

                      <Badge variant="default">{order.paymentStatus}</Badge>
                    </div>

                    <p className="text-2xl font-bold text-black">
                      ${Number(order.totalAmount).toFixed(2)}
                    </p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}