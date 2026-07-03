import { api } from "@/lib/api";

export interface CustomerAddress {
  id: string;
  label?: string | null;
  fullName?: string | null;
  phone?: string | null;
  country: string;
  city?: string | null;
  area?: string | null;
  street?: string | null;
  building?: string | null;
  floor?: string | null;
  apartment?: string | null;
  notes?: string | null;
  isDefault: boolean;
}

export interface CreateCustomerAddressInput {
  label?: string;
  fullName: string;
  phone: string;
  country?: string;
  city: string;
  area: string;
  street: string;
  building?: string;
  floor?: string;
  apartment?: string;
  notes?: string;
  isDefault?: boolean;
}

export const customerAddressesService = {
  async getMyAddresses() {
    const response = await api.get<CustomerAddress[]>("/customer-addresses");
    return response.data;
  },

  async createAddress(data: CreateCustomerAddressInput) {
    const response = await api.post<CustomerAddress>("/customer-addresses", {
      ...data,
      country: data.country || "Lebanon",
    });

    return response.data;
  },

  async updateAddress(id: string, data: Partial<CreateCustomerAddressInput>) {
    const response = await api.patch<CustomerAddress>(
      `/customer-addresses/${id}`,
      data,
    );

    return response.data;
  },

  async deleteAddress(id: string) {
    const response = await api.delete(`/customer-addresses/${id}`);
    return response.data;
  },

  async setDefaultAddress(id: string) {
    const response = await api.patch<CustomerAddress>(
      `/customer-addresses/${id}`,
      {
        isDefault: true,
      },
    );

    return response.data;
  },
};