import { CheckCircle } from "lucide-react";

import { Navbar } from "@/components/layout/navbar";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="min-h-screen bg-[#f8f6f1]">
      <Navbar />

      <section className="mx-auto max-w-3xl px-6 py-20">
        <Card className="p-10 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-green-700">
            <CheckCircle size={44} />
          </div>

          <p className="mt-8 text-sm font-bold uppercase tracking-[0.35em] text-[#b08d2c]">
            Order Confirmed
          </p>

          <h1 className="mt-4 text-5xl font-bold text-black">
            Thank you for your order
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-neutral-600">
            We received your order successfully. Our team will contact you
            shortly to confirm delivery details.
          </p>

          {params.order ? (
            <div className="mx-auto mt-8 rounded-3xl border border-black/10 bg-[#f8f6f1] p-6">
              <p className="text-sm text-neutral-500">Order Number</p>

              <p className="mt-2 text-2xl font-bold text-black">
                {params.order}
              </p>
            </div>
          ) : null}

          <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
            <ButtonLink href="/products" size="lg">
              Continue Shopping
            </ButtonLink>

            <ButtonLink href="/account/orders" variant="outline" size="lg">
              View My Orders
            </ButtonLink>
          </div>
        </Card>
      </section>
    </main>
  );
}