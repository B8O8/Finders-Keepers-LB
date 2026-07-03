import { api } from "@/lib/api";

export interface AuthCustomer {
  id: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
}

export interface AuthResponse {
  customer: AuthCustomer;
  account: {
    id: string;
    email: string;
    isVerified: boolean;
  };
  accessToken: string;
  refreshToken: string;
}

export const authService = {
  async login(data: { email: string; password: string }) {
    const response = await api.post<AuthResponse>("/customer-auth/login", data);
    return response.data;
  },

  async signup(data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    email: string;
    password: string;
  }) {
    const response = await api.post<AuthResponse>("/customer-auth/signup", data);
    return response.data;
  },

  async forgotPassword(data: { email: string }) {
    const response = await api.post("/customer-auth/forgot-password", data);
    return response.data;
  },

  async resetPassword(data: { token: string; newPassword: string }) {
    const response = await api.post("/customer-auth/reset-password", data);
    return response.data;
  },

  async updateProfile(data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
  }) {
    const response = await api.patch<AuthCustomer>("/customer-auth/me", data);
    return response.data;
  },

  async changePassword(data: {
    currentPassword: string;
    newPassword: string;
  }) {
    const response = await api.patch("/customer-auth/me/password", data);
    return response.data;
  },

  async logout() {
    await api.post("/customer-auth/logout");
  },
};