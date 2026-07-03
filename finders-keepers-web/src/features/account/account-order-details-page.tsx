"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { ArrowLeft, MapPin, Package, XCircle } from "lucide-react";

import { Navbar } from "@/components/layout/navbar";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
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

function formatMoney(value: string | number) {
  return Number(value || 0).toFixed(2);
}

export function AccountOrderDetailsPage({ id }: { id: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const hydrated = useHydrated();
  const customer = useAuthStore((state) => state.customer);

  const { data: order, isLoading } = useQuery({
    queryKey: ["my-order", id],
    queryFn: () => ordersService.getMyOrder(id),
    enabled: hydrated && !!customer && !!id,
  });

  const cancelMutation = useMutation({
    mutationFn: () => ordersService.cancelMyOrder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-order", id] });
      queryClient.invalidateQueries({ queryKey: ["my-orders"] });
    },
  });

  const canCancel =
    order?.status === "PENDING" || order?.status === "CONFIRMED";

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

            <h1 className="text-4xl font-bold text-black">Order Details</h1>

            <p className="mt-4 text-neutral-500">
              Please login to view this order.
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

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#f8f6f1]">
        <Navbar />

        <section className="mx-auto max-w-[1100px] px-10 py-10">
          <Card className="h-96 animate-pulse">
            <div />
          </Card>
        </section>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="min-h-screen bg-[#f8f6f1]">
        <Navbar />

        <section className="mx-auto max-w-xl px-6 py-20 text-center">
          <Card className="p-10">
            <h1 className="text-4xl font-bold text-black">Order not found</h1>

            <div className="mt-8">
              <ButtonLink href="/account/orders" size="lg">
                Back to Orders
              </ButtonLink>
            </div>
          </Card>
        </section>
      </main>
    );
  }

  const address = order.addressSnapshot;

  return (
    <main className="min-h-screen bg-[#f8f6f1]">
      <Navbar />

      <section className="mx-auto max-w-[1100px] px-10 py-10">
        <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <button
              type="button"
              onClick={() => router.push("/account/orders")}
              className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-neutral-500 hover:text-black"
            >
              <ArrowLeft size={16} />
              Back to orders
            </button>

            <p className="text-sm font-bold uppercase tracking-[0.35em] text-[#b08d2c]">
              Order Details
            </p>

            <h1 className="mt-3 text-5xl font-bold text-black">
              {order.orderNumber}
            </h1>

            <p className="mt-3 text-neutral-500">
              Placed on {formatDate(order.createdAt)}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Badge variant={getStatusVariant(order.status)}>
              {order.status}
            </Badge>

            <Badge variant="default">{order.paymentStatus}</Badge>

            <Badge variant="gold">{order.paymentMethod}</Badge>
          </div>
        </div>

        <Card className="mb-8">
          <h2 className="text-2xl font-bold text-black">Order Status</h2>

          <div className="mt-6 flex flex-wrap gap-3">
            <Badge variant={order.status === "PENDING" ? "gold" : "default"}>
              Pending
            </Badge>

            <Badge
              variant={
                ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"].includes(
                  order.status,
                )
                  ? "success"
                  : "default"
              }
            >
              Confirmed
            </Badge>

            <Badge
              variant={
                ["PROCESSING", "SHIPPED", "DELIVERED"].includes(order.status)
                  ? "success"
                  : "default"
              }
            >
              Processing
            </Badge>

            <Badge
              variant={
                ["SHIPPED", "DELIVERED"].includes(order.status)
                  ? "success"
                  : "default"
              }
            >
              Shipped
            </Badge>

            <Badge variant={order.status === "DELIVERED" ? "success" : "default"}>
              Delivered
            </Badge>

            {order.status === "CANCELLED" ? (
              <Badge variant="danger">Cancelled</Badge>
            ) : null}
          </div>
        </Card>

        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          <Card>
            <h2 className="text-2xl font-bold text-black">Items</h2>

            <div className="mt-6 grid gap-4">
              {order.items.map((item) => (
                <div
                  key={item.id}
                  className="flex justify-between gap-5 border-b border-black/10 pb-4 last:border-0 last:pb-0"
                >
                  <div>
                    <p className="font-bold text-black">{item.productName}</p>

                    {item.variantName ? (
                      <p className="mt-1 text-sm text-neutral-500">
                        {item.variantName}
                      </p>
                    ) : null}

                    <p className="mt-2 text-sm text-neutral-500">
                      Qty: {item.quantity} × ${formatMoney(item.unitPrice)}
                    </p>
                  </div>

                  <p className="font-bold text-black">
                    ${formatMoney(item.totalPrice)}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          <div className="grid h-fit gap-6">
            {address ? (
              <Card>
                <div className="flex items-center gap-3">
                  <MapPin size={22} className="text-[#b08d2c]" />

                  <h2 className="text-2xl font-bold text-black">
                    Delivery Address
                  </h2>
                </div>

                <div className="mt-5 space-y-4 text-sm">
                  <div>
                    <p className="text-neutral-500">Recipient</p>
                    <p className="font-semibold text-black">
                      {address.fullName || "Not provided"}
                    </p>
                  </div>

                  <div>
                    <p className="text-neutral-500">Phone</p>
                    <p className="font-semibold text-black">
                      {address.phone || "Not provided"}
                    </p>
                  </div>

                  {address.email ? (
                    <div>
                      <p className="text-neutral-500">Email</p>
                      <p className="font-semibold text-black">
                        {address.email}
                      </p>
                    </div>
                  ) : null}

                  <div>
                    <p className="text-neutral-500">Address</p>
                    <p className="font-semibold leading-6 text-black">
                      {[
                        address.area,
                        address.city,
                        address.street,
                        address.building,
                        address.floor ? `Floor ${address.floor}` : null,
                        address.apartment ? `Apt ${address.apartment}` : null,
                        address.country,
                      ]
                        .filter(Boolean)
                        .join(", ") || "Not provided"}
                    </p>
                  </div>

                  {address.notes ? (
                    <div>
                      <p className="text-neutral-500">Delivery Notes</p>
                      <p className="font-semibold text-black">{address.notes}</p>
                    </div>
                  ) : null}

                  {address.latitude && address.longitude ? (
                    <a
                      href={`https://www.google.com/maps?q=${address.latitude},${address.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex font-semibold text-[#8a6a12] hover:text-black"
                    >
                      Open location on map
                    </a>
                  ) : null}
                </div>
              </Card>
            ) : null}

            <Card>
              <h2 className="text-2xl font-bold text-black">Summary</h2>

              <div className="mt-6 grid gap-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Subtotal</span>
                  <span className="font-semibold text-black">
                    ${formatMoney(order.subtotal)}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-neutral-500">Delivery</span>
                  <span className="font-semibold text-black">
                    ${formatMoney(order.deliveryFee)}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-neutral-500">Discount</span>
                  <span className="font-semibold text-black">
                    ${formatMoney(order.discountAmount)}
                  </span>
                </div>

                <hr className="border-black/10" />

                <div className="flex justify-between text-xl font-bold">
                  <span>Total</span>
                  <span>${formatMoney(order.totalAmount)}</span>
                </div>
              </div>
            </Card>

            {canCancel ? (
              <Card>
                <h2 className="text-xl font-bold text-black">Need to cancel?</h2>

                <p className="mt-2 text-sm text-neutral-500">
                  You can cancel this order while it is still pending or
                  confirmed.
                </p>

                <Button
                  type="button"
                  variant="secondary"
                  fullWidth
                  className="mt-5"
                  disabled={cancelMutation.isPending}
                  onClick={() => {
                    const confirmed = confirm(
                      "Are you sure you want to cancel this order?",
                    );

                    if (confirmed) {
                      cancelMutation.mutate();
                    }
                  }}
                >
                  <XCircle size={18} />
                  {cancelMutation.isPending ? "Cancelling..." : "Cancel Order"}
                </Button>
              </Card>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}