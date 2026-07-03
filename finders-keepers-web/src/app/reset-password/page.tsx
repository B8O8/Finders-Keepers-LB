"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Lock } from "lucide-react";
import { useMutation } from "@tanstack/react-query";

import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { authService } from "@/services/auth.service";

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [success, setSuccess] = useState(false);

  const mutation = useMutation({
    mutationFn: authService.resetPassword,
    onSuccess: () => {
      setSuccess(true);
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: () => {
      alert("Could not reset password. The link may be invalid or expired.");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!token) {
      alert("Missing reset token.");
      return;
    }

    if (newPassword.length < 6) {
      alert("Password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      alert("Passwords do not match.");
      return;
    }

    mutation.mutate({
      token,
      newPassword,
    });
  }

  return (
    <main className="min-h-screen bg-[#f8f6f1]">
      <Navbar />

      <section className="mx-auto max-w-lg px-5 py-16">
        <Card className="p-8">
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-black text-white">
            <Lock size={26} />
          </div>

          <h1 className="text-4xl font-bold text-black">Reset Password</h1>

          <p className="mt-3 text-neutral-500">
            Create a new password for your account.
          </p>

          {!token ? (
            <div className="mt-8 rounded-3xl border border-red-200 bg-red-50 p-6">
              <p className="font-semibold text-red-700">
                Missing reset token.
              </p>

              <p className="mt-2 text-sm text-red-600">
                Please request a new password reset link.
              </p>

              <div className="mt-6">
                <Link
                  href="/forgot-password"
                  className="font-semibold text-black"
                >
                  Request new link
                </Link>
              </div>
            </div>
          ) : success ? (
            <div className="mt-8 rounded-3xl border border-green-200 bg-green-50 p-6">
              <p className="font-semibold text-green-700">
                Password reset successfully.
              </p>

              <p className="mt-2 text-sm text-green-700">
                You can now login using your new password.
              </p>

              <div className="mt-6">
                <Link href="/login" className="font-semibold text-black">
                  Go to login
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 grid gap-5">
              <Input
                label="New Password"
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />

              <Input
                label="Confirm New Password"
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />

              <Button
                type="submit"
                size="lg"
                fullWidth
                disabled={mutation.isPending}
              >
                {mutation.isPending ? "Resetting..." : "Reset Password"}
              </Button>
            </form>
          )}

          <p className="mt-6 text-sm text-neutral-500">
            Back to{" "}
            <Link href="/login" className="font-semibold text-black">
              Login
            </Link>
          </p>
        </Card>
      </section>
    </main>
  );
}