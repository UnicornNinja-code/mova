import { api } from "./api";

export const authService = {
  // --- Auth Group 1 ---
  async login({ username, password, turnstileToken }) {
    const response = await api.post("/api/auth/login", {
      identifier: username,
      password,
      turnstileToken,
    });
    return response.data?.data || response.data;
  },

  async register(userData) {
    const response = await api.post("/api/auth/register", userData);
    return response.data?.data || response.data;
  },

  async getCurrentUser() {
    const response = await api.get("/api/auth/me");
    return response.data?.data || response.data;
  },

  async refreshToken(refreshToken) {
    const response = await api.post("/api/auth/refresh-token", { refreshToken });
    return response.data?.data || response.data;
  },

  async logout() {
    try {
      const response = await api.post("/api/auth/logout");
      return response.data?.data || response.data;
    } catch (e) {
      // Ignore network failure on logout
      return null;
    }
  },

  async forgotPassword(email) {
    const response = await api.post("/api/auth/forgot-password", { email });
    return response.data?.data || response.data;
  },

  async resetPassword({ token, password, newPassword }) {
    const response = await api.post("/api/auth/reset-password", {
      token,
      password: password || newPassword,
    });
    return response.data?.data || response.data;
  },

  async verifyToken(token) {
    let cleanToken = String(token || "").trim();
    if (cleanToken.includes("token=")) {
      const match = cleanToken.match(/token=([a-zA-Z0-9_-]+)/);
      if (match && match[1]) cleanToken = match[1];
    }
    const response = await api.get(`/api/auth/verify-token/${encodeURIComponent(cleanToken)}`);
    return response.data?.data || response.data;
  },

  async completeFirstLogin({ newPassword }) {
    const response = await api.post("/api/auth/first-login", { newPassword });
    return response.data?.data || response.data;
  },

  async activateAccount({ token, password, name, phone, birth_date, birthDate }) {
    const response = await api.post("/api/auth/activate", {
      token,
      password,
      name,
      phone,
      birth_date: birth_date || birthDate,
    });
    return response.data?.data || response.data;
  },

  // --- User Account Group 2 ---
  async getUsers(params = {}) {
    const response = await api.get("/api/users", { params });
    return response.data?.data || response.data;
  },

  async getUserById(id) {
    const response = await api.get(`/api/users/${id}`);
    return response.data?.data || response.data;
  },

  async updateUser(id, updateData) {
    const response = await api.patch(`/api/users/${id}`, updateData);
    return response.data?.data || response.data;
  },

  async deleteUser(id) {
    const response = await api.delete(`/api/users/${id}`);
    return response.data?.data || response.data;
  },
};
