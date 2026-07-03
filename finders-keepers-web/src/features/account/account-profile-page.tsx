"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Lock, User } from "lucide-react";

import { Navbar } from "@/components/layout/navbar";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useHydrated } from "@/hooks/use-hydrated";
import { authService } from "@/services/auth.service";
import { useAuthStore } from "@/stores/auth-store";

export function AccountProfilePage() {
  const hydrated = useHydrated();

  const customer = useAuthStore((state) => state.customer);
  const setCustomer = useAuthStore((state) => state.setCustomer);

  const [profileForm, setProfileForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    if (!customer) return;

    setProfileForm({
      firstName: customer.firstName || "",
      lastName: customer.lastName || "",
      phone: customer.phone || "",
    });
  }, [customer]);

  const updateProfileMutation = useMutation({
    mutationFn: authService.updateProfile,
    onSuccess: (updatedCustomer) => {
      setCustomer(updatedCustomer);
      alert("Profile updated successfully.");
    },
    onError: () => {
      alert("Could not update profile.");
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: authService.changePassword,
    onSuccess: () => {
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });

      alert("Password changed successfully.");
    },
    onError: () => {
      alert("Could not change password. Please check your current password.");
    },
  });

  function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();

    updateProfileMutation.mutate({
      firstName: profileForm.firstName || undefined,
      lastName: profileForm.lastName || undefined,
      phone: profileForm.phone || undefined,
    });
  }

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (passwordForm.newPassword.length < 6) {
      alert("New password must be at least 6 characters.");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      alert("New password and confirmation do not match.");
      return;
    }

    changePasswordMutation.mutate({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
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

        <section className="mx-auto max-w-xl px-5 py-16 text-center">
          <Card className="p-8">
            <User className="mx-auto mb-6" size={42} />

            <h1 className="text-4xl font-bold text-black">Edit Profile</h1>

            <p className="mt-4 text-neutral-500">
              Please login to manage your profile.
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

      <section className="mx-auto max-w-[1100px] px-5 py-6 lg:px-10 lg:py-10">
        <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.35em] text-[#b08d2c]">
              Account
            </p>

            <h1 className="mt-3 text-4xl font-bold text-black lg:text-5xl">
              Edit Profile
            </h1>
          </div>

          <ButtonLink href="/account" variant="outline">
            Back to Account
          </ButtonLink>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <Card className="p-6 lg:p-8">
            <div className="flex items-center gap-3">
              <User size={24} className="text-[#b08d2c]" />

              <h2 className="text-2xl font-bold text-black">
                Profile Details
              </h2>
            </div>

            <p className="mt-3 text-sm text-neutral-500">
              Update your personal details used for orders and delivery.
            </p>

            <form onSubmit={handleProfileSubmit} className="mt-8 grid gap-5">
              <div className="grid gap-5 md:grid-cols-2">
                <Input
                  label="First Name"
                  value={profileForm.firstName}
                  onChange={(e) =>
                    setProfileForm({
                      ...profileForm,
                      firstName: e.target.value,
                    })
                  }
                />

                <Input
                  label="Last Name"
                  value={profileForm.lastName}
                  onChange={(e) =>
                    setProfileForm({
                      ...profileForm,
                      lastName: e.target.value,
                    })
                  }
                />
              </div>

              <Input
                label="Phone"
                value={profileForm.phone}
                onChange={(e) =>
                  setProfileForm({
                    ...profileForm,
                    phone: e.target.value,
                  })
                }
              />

              <Input
                label="Email"
                value={customer.email || ""}
                disabled
                className="cursor-not-allowed bg-neutral-100 text-neutral-500"
              />

              <Button
                type="submit"
                size="lg"
                fullWidth
                disabled={updateProfileMutation.isPending}
              >
                {updateProfileMutation.isPending
                  ? "Saving..."
                  : "Save Profile"}
              </Button>
            </form>
          </Card>

          <Card className="p-6 lg:p-8">
            <div className="flex items-center gap-3">
              <Lock size={24} className="text-[#b08d2c]" />

              <h2 className="text-2xl font-bold text-black">
                Change Password
              </h2>
            </div>

            <p className="mt-3 text-sm text-neutral-500">
              Use a strong password to keep your account secure.
            </p>

            <form onSubmit={handlePasswordSubmit} className="mt-8 grid gap-5">
              <Input
                label="Current Password"
                type="password"
                required
                value={passwordForm.currentPassword}
                onChange={(e) =>
                  setPasswordForm({
                    ...passwordForm,
                    currentPassword: e.target.value,
                  })
                }
              />

              <Input
                label="New Password"
                type="password"
                required
                minLength={6}
                value={passwordForm.newPassword}
                onChange={(e) =>
                  setPasswordForm({
                    ...passwordForm,
                    newPassword: e.target.value,
                  })
                }
              />

              <Input
                label="Confirm New Password"
                type="password"
                required
                minLength={6}
                value={passwordForm.confirmPassword}
                onChange={(e) =>
                  setPasswordForm({
                    ...passwordForm,
                    confirmPassword: e.target.value,
                  })
                }
              />

              <Button
                type="submit"
                size="lg"
                fullWidth
                disabled={changePasswordMutation.isPending}
              >
                {changePasswordMutation.isPending
                  ? "Changing..."
                  : "Change Password"}
              </Button>
            </form>
          </Card>
        </div>
      </section>
    </main>
  );
}