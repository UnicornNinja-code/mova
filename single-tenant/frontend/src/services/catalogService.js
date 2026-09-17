import { api } from "./api";

export const catalogService = {
  // --- Catalog & Products Group 13 ---
  async getProducts(params = {}) {
    const response = await api.get("/api/products", { params });
    return response.data?.data || response.data;
  },

  async getProductById(id) {
    const response = await api.get(`/api/products/${id}`);
    return response.data?.data || response.data;
  },

  async createProduct(productData) {
    const response = await api.post("/api/products", productData);
    return response.data?.data || response.data;
  },

  async updateProduct(id, productData) {
    const response = await api.put(`/api/products/${id}`, productData);
    return response.data?.data || response.data;
  },

  async toggleProductStatus(id, status) {
    const response = await api.patch(`/api/products/${id}/status`, { status });
    return response.data?.data || response.data;
  },

  async deleteProduct(id) {
    const response = await api.delete(`/api/products/${id}`);
    return response.data?.data || response.data;
  },
};
