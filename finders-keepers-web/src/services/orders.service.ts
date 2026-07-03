import { api } from "@/lib/api";

export interface OrderItem {
  id: string;
  productName: string;
  variantName?: string | null;
  quantity: number;
  unitPrice: string | number;
  totalPrice: string | number;
}

export interface OrderAddressSnapshot {
  id?: string;
  label?: string;
  fullName?: string;
  phone?: string;
  email?: string;

  country?: string;
  city?: string;
  area?: string;
  street?: string;
  building?: string;
  floor?: string;
  apartment?: string;

  notes?: string;

  latitude?: number;
  longitude?: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;

  subtotal: string | number;
  deliveryFee: string | number;
  discountAmount: string | number;
  totalAmount: string | number;
  currency: string;

  notes?: string | null;
  addressSnapshot?: OrderAddressSnapshot | null;

  createdAt: string;
  items: OrderItem[];
}

export const ordersService = {
  async getMyOrders() {
    const response = await api.get<Order[]>("/orders/me");
    return response.data;
  },

  async getMyOrder(id: string) {
    const response = await api.get<Order>(`/orders/me/${id}`);
    return response.data;
  },

  async cancelMyOrder(id: string) {
    const response = await api.patch<Order>(`/orders/me/${id}/cancel`);
    return response.data;
  },
};