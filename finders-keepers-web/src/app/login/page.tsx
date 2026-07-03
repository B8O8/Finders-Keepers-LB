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

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);

    try {
      const result = await authService.login(form);

      setAuth({
        customer: result.customer,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });

      router.push("/account");
    } catch (error) {
      console.error(error);
      alert("Invalid email or password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f8f6f1]">
      <Navbar />

      <section className="mx-auto max-w-lg px-5 py-16">
        <Card className="p-8">
          <h1 className="text-4xl font-bold text-black">Login</h1>

          <p className="mt-2 text-neutral-500">
            Access your Finders Keepers account.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 grid gap-5">
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

            <div>
              <Input
                label="Password"
                type="password"
                required
                value={form.password}
                onChange={(e) =>
                  setForm({
                    ...form,
                    password: e.target.value,
                  })
                }
              />

              <div className="mt-2 text-right">
                <Link
                  href="/forgot-password"
                  className="text-sm font-semibold text-black hover:text-[#8a6a12]"
                >
                  Forgot password?
                </Link>
              </div>
            </div>

            <Button type="submit" size="lg" fullWidth disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </Button>
          </form>

          <p className="mt-6 text-sm text-neutral-500">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="font-semibold text-black">
              Sign up
            </Link>
          </p>
        </Card>
      </section>
    </main>
  );
}