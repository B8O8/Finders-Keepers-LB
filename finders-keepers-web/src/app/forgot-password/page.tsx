"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import { useMutation } from "@tanstack/react-query";

import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { authService } from "@/services/auth.service";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const mutation = useMutation({
    mutationFn: authService.forgotPassword,
    onSuccess: () => {
      setSent(true);
    },
    onError: () => {
      alert("Could not send reset email. Please try again.");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    mutation.mutate({
      email,
    });
  }

  return (
    <main className="min-h-screen bg-[#f8f6f1]">
      <Navbar />

      <section className="mx-auto max-w-lg px-5 py-16">
        <Card className="p-8">
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-black text-white">
            <Mail size={26} />
          </div>

          <h1 className="text-4xl font-bold text-black">Forgot Password</h1>

          <p className="mt-3 text-neutral-500">
            Enter your email and we&apos;ll send you a password reset link.
          </p>

          {sent ? (
            <div className="mt-8 rounded-3xl border border-green-200 bg-green-50 p-6">
              <p className="font-semibold text-green-700">
                Reset link sent successfully.
              </p>

              <p className="mt-2 text-sm text-green-700">
                Please check your email inbox.
              </p>

              <div className="mt-6">
                <Link href="/login" className="font-semibold text-black">
                  Back to login
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 grid gap-5">
              <Input
                label="Email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <Button
                type="submit"
                size="lg"
                fullWidth
                disabled={mutation.isPending}
              >
                {mutation.isPending ? "Sending..." : "Send Reset Link"}
              </Button>
            </form>
          )}

          <p className="mt-6 text-sm text-neutral-500">
            Remember your password?{" "}
            <Link href="/login" className="font-semibold text-black">
              Login
            </Link>
          </p>
        </Card>
      </section>
    </main>
  );
}