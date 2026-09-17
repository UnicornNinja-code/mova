import { axiosInstance } from "../lib/axios.js";

/**
 * Product & Catalog Domain Service (Canonical Backend Phase 4/7)
 */
export const productService = {
  getAll: async (params = {}) => {
    const res = await axiosInstance.get("/products", { params });
    return res.data;
  },

  getProducts: async (params = {}) => {
    const res = await axiosInstance.get("/products", { params });
    return res.data;
  },

  getById: async (id) => {
    const res = await axiosInstance.get(`/products/${id}`);
    return res.data;
  },

  getProductById: async (id) => {
    const res = await axiosInstance.get(`/products/${id}`);
    return res.data;
  },

  create: async ({ name, description = "", price, status = "AVAILABLE" }) => {
    const res = await axiosInstance.post("/products", {
      name,
      description,
      price: Number(price),
      status,
    });
    return res.data;
  },

  createProduct: async (payload) => {
    return productService.create(payload);
  },

  update: async (id, { name, description, price, status }) => {
    const payload = {};
    if (name !== undefined) payload.name = name;
    if (description !== undefined) payload.description = description;
    if (price !== undefined) payload.price = Number(price);
    if (status !== undefined) payload.status = status;
    const res = await axiosInstance.put(`/products/${id}`, payload);
    return res.data;
  },

  updateProduct: async (id, payload) => {
    return productService.update(id, payload);
  },

  toggleStatus: async (id, status) => {
    const res = await axiosInstance.patch(`/products/${id}/status`, { status });
    return res.data;
  },

  updateStatus: async (id, status) => {
    return productService.toggleStatus(id, status);
  },

  delete: async (id) => {
    const res = await axiosInstance.delete(`/products/${id}`);
    return res.data;
  },

  deleteProduct: async (id) => {
    return productService.delete(id);
  },
};
