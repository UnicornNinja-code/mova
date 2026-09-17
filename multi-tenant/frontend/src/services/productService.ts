/*
 * productService.ts
 * REST Client Service for Product Catalog & Image Upload
 */

import { axiosInstance } from "../lib/axios";

export interface ProductItem {
  id: string;
  name: string;
  sku?: string;
  category: "KOPI" | "NON_KOPI" | "MAKANAN" | string;
  description?: string;
  base_price: number; // HPP
  price: number;      // Selling Price
  image_url?: string;
  status: "AVAILABLE" | "DISCONTINUED";
  created_at?: string;
  updated_at?: string;
}

export interface ProductUploadResponse {
  image_url: string;
  original_size: number;
  compressed_size: number;
  compression_ratio: string;
}

export const productService = {
  getProducts: async ({
    status = "ALL",
    category = "ALL",
    search = "",
    page = 1,
    limit = 50,
  }: {
    status?: string;
    category?: string;
    search?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<{ products: ProductItem[]; pagination: any }> => {
    const res = await axiosInstance.get("/products", {
      params: { status, category, search, page, limit },
    });
    return {
      products: res.data?.data || [],
      pagination: res.data?.pagination || { total: 0, page: 1, limit: 50, total_pages: 1 },
    };
  },

  getProductById: async (id: string): Promise<ProductItem> => {
    const res = await axiosInstance.get(`/products/${id}`);
    return res.data?.data;
  },

  uploadImage: async (file: File): Promise<ProductUploadResponse> => {
    const formData = new FormData();
    formData.append("image", file);

    const res = await axiosInstance.post("/products/upload-image", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return res.data?.data;
  },

  createProduct: async (payload: {
    name: string;
    sku?: string;
    category?: string;
    description?: string;
    base_price?: number;
    price: number;
    image_url?: string;
    status?: string;
  }): Promise<ProductItem> => {
    const res = await axiosInstance.post("/products", payload);
    return res.data?.data;
  },

  updateProduct: async (
    id: string,
    payload: {
      name?: string;
      sku?: string;
      category?: string;
      description?: string;
      base_price?: number;
      price?: number;
      image_url?: string;
      status?: string;
    }
  ): Promise<ProductItem> => {
    const res = await axiosInstance.put(`/products/${id}`, payload);
    return res.data?.data;
  },

  updateStatus: async (id: string, status: "AVAILABLE" | "DISCONTINUED"): Promise<ProductItem> => {
    const res = await axiosInstance.patch(`/products/${id}/status`, { status });
    return res.data?.data;
  },

  deleteProduct: async (id: string): Promise<any> => {
    const res = await axiosInstance.delete(`/products/${id}`);
    return res.data;
  },
};
