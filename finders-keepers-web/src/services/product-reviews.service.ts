import { api } from "@/lib/api";

export interface CreateReviewDto {
  productId: string;
  rating: number;
  title?: string;
  comment: string;
}

export const productReviewsService = {
  async create(data: CreateReviewDto) {
    const response = await api.post("/product-reviews", data);
    return response.data;
  },
};