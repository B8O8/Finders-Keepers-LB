import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { AuthCustomer } from "@/services/auth.service";

interface AuthState {
  customer: AuthCustomer | null;
  accessToken: string | null;
  refreshToken: string | null;

  setAuth: (data: {
    customer: AuthCustomer;
    accessToken: string;
    refreshToken: string;
  }) => void;

  setCustomer: (customer: AuthCustomer) => void;

  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      customer: null,
      accessToken: null,
      refreshToken: null,

      setAuth: ({ customer, accessToken, refreshToken }) => {
        localStorage.setItem("customer_access_token", accessToken);
        localStorage.setItem("customer_refresh_token", refreshToken);

        set({
          customer,
          accessToken,
          refreshToken,
        });
      },

      setCustomer: (customer) => {
        set({
          customer,
        });
      },

      logout: () => {
        localStorage.removeItem("customer_access_token");
        localStorage.removeItem("customer_refresh_token");

        set({
          customer: null,
          accessToken: null,
          refreshToken: null,
        });
      },
    }),
    {
      name: "finders-keepers-auth",
      partialize: (state) => ({
        customer: state.customer,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    },
  ),
);