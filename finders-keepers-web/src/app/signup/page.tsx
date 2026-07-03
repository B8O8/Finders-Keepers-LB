"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { authService } from "@/services/auth.service";
import { useAuthStore } from "@/stores/auth-store";

export default function SignupPage() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    password: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);

    try {
      const result = await authService.signup({
        firstName: form.firstName || undefined,
        lastName: form.lastName || undefined,
        phone: form.phone || undefined,
        email: form.email,
        password: form.password,
      });

      setAuth({
        customer: result.customer,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });

      router.push("/account");
    } catch (error) {
      console.error(error);
      alert("Could not create account.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f8f6f1]">
      <Navbar />

      <section className="mx-auto max-w-xl px-6 py-16">
        <Card className="p-8">
          <h1 className="text-4xl font-bold text-black">Create Account</h1>

          <p className="mt-2 text-neutral-500">
            Join Finders Keepers and checkout faster.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 grid gap-5">
            <div className="grid gap-5 md:grid-cols-2">
              <Input
                label="First Name"
                value={form.firstName}
                onChange={(e) =>
                  setForm({
                    ...form,
                    firstName: e.target.value,
                  })
                }
              />

              <Input
                label="Last Name"
                value={form.lastName}
                onChange={(e) =>
                  setForm({
                    ...form,
                    lastName: e.target.value,
                  })
                }
              />
            </div>

            <Input
              label="Phone"
              value={form.phone}
              onChange={(e) =>
                setForm({
                  ...form,
                  phone: e.target.value,
                })
              }
            />

            <Input
              label="Email"
              type="email"
              required
              value={form.email}
              onChange={(e) =>
                setForm({
                  ...form,
                  email: e.target.value,
                })
              }
            />

            <Input
              label="Password"
              type="password"
              required
              minLength={6}
              value={form.password}
              onChange={(e) =>
                setForm({
                  ...form,
                  password: e.target.value,
                })
              }
            />

            <Button type="submit" size="lg" disabled={loading}>
              {loading ? "Creating Account..." : "Create Account"}
            </Button>
          </form>

          <p className="mt-6 text-sm text-neutral-500">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-black">
              Login
            </Link>
          </p>
        </Card>
      </section>
    </main>
  );
}