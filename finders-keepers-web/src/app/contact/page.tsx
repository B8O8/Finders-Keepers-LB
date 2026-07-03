"use client";

import { useState } from "react";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";

import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function ContactPage() {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    message: "",
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const text = encodeURIComponent(
      `Hello Finders Keepers,%0A%0AName: ${form.name}%0APhone: ${form.phone}%0AEmail: ${form.email}%0A%0AMessage:%0A${form.message}`,
    );

    window.open(`https://wa.me/96170123456?text=${text}`, "_blank");
  }

  return (
    <main className="min-h-screen bg-[#f8f6f1]">
      <Navbar />

      <section className="mx-auto max-w-[1200px] px-5 py-10 lg:px-10">
        <div className="mb-10 rounded-3xl bg-black px-8 py-12 text-white lg:px-12">
          <p className="text-sm font-bold uppercase tracking-[0.35em] text-[#d4af37]">
            Contact
          </p>

          <h1 className="mt-4 text-5xl font-bold">Get in Touch</h1>

          <p className="mt-4 max-w-2xl text-white/70">
            Have a question about products, orders, delivery, or sizing? Contact
            Finders Keepers LB anytime.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_420px]">
          <Card className="p-6 lg:p-8">
            <h2 className="text-3xl font-bold text-black">Send a Message</h2>

            <form onSubmit={handleSubmit} className="mt-8 grid gap-5">
              <Input
                label="Full Name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />

              <Input
                label="Phone"
                required
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />

              <Input
                label="Email Optional"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-black">
                  Message
                </span>

                <textarea
                  required
                  rows={6}
                  value={form.message}
                  onChange={(e) =>
                    setForm({ ...form, message: e.target.value })
                  }
                  className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-black outline-none transition focus:border-black"
                />
              </label>

              <Button type="submit" size="lg" fullWidth>
                <MessageCircle size={18} />
                Send on WhatsApp
              </Button>
            </form>
          </Card>

          <div className="grid h-fit gap-5">
            <Card className="p-6">
              <Phone className="mb-4 text-[#b08d2c]" size={28} />
              <h3 className="text-xl font-bold text-black">Phone</h3>
              <p className="mt-2 text-neutral-500">+961 70 123 456</p>
            </Card>

            <Card className="p-6">
              <MessageCircle className="mb-4 text-[#b08d2c]" size={28} />
              <h3 className="text-xl font-bold text-black">WhatsApp</h3>
              <p className="mt-2 text-neutral-500">
                Fast support for orders and delivery.
              </p>
            </Card>

            <Card className="p-6">
              <Mail className="mb-4 text-[#b08d2c]" size={28} />
              <h3 className="text-xl font-bold text-black">Email</h3>
              <p className="mt-2 text-neutral-500">
                support@finderskeeperslb.com
              </p>
            </Card>

            <Card className="p-6">
              <MapPin className="mb-4 text-[#b08d2c]" size={28} />
              <h3 className="text-xl font-bold text-black">Location</h3>
              <p className="mt-2 text-neutral-500">Lebanon</p>
            </Card>
          </div>
        </div>
      </section>
    </main>
  );
}