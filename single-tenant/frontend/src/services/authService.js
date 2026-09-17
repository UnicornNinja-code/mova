/*
 * authService.js
 * Single Source of Truth (SSOT) Authentication Service
 * Strictly conforms to Swagger OpenAPI 3.0.3 Contract for MOVA Single-Tenant
 */

import { axiosInstance } from "../lib/axios.js";

export const authService = {
  /**
   * User Login (Email or Username + Password + Cloudflare Turnstile Token)
   * @param {Object} params
   * @param {string} params.identifier - Email address or username (case-insensitive)
   * @param {string} params.password - Plaintext password
   * @param {string} [params.turnstileToken] - Cloudflare Turnstile token
   * @returns {Promise<{ msg: string, token: string, user: Object }>}
   */
  async login({ identifier, password, turnstileToken }) {
    const payload = {
      identifier: identifier.trim(),
      password,
      ...(turnstileToken && { turnstileToken, "cf-turnstile-response": turnstileToken }),
    };
    const res = await axiosInstance.post("/auth/login", payload);
    const data = res.data;
    if (data?.token) {
      axiosInstance.defaults.headers.common["Authorization"] = `Bearer ${data.token}`;
      localStorage.setItem("token", data.token);
      if (data.refreshToken) {
        localStorage.setItem("refreshToken", data.refreshToken);
      }
    }
    return data;
  },

  /**
   * Fetch Authenticated User Profile & Active Session
   * @returns {Promise<{ user: Object }>}
   */
  async getMe() {
    const res = await axiosInstance.get("/auth/me");
    return res.data;
  },

  /**
   * Activate User Account via Invitation Token
   * @param {Object} params
   * @param {string} params.token - 32-character invitation/activation token
   * @param {string} params.password - New password to set
   * @param {string} [params.email] - Optional verified email
   * @param {string} [params.name] - Optional full name
   * @param {string} [params.birth_date] - Optional birth date (YYYY-MM-DD)
   * @returns {Promise<{ msg: string, user: Object }>}
   */
  async activateAccount({ token, password, email, name, birth_date }) {
    const payload = {
      token: token?.trim(),
      password,
      ...(email && { email: email.trim() }),
      ...(name && { name: name.trim() }),
      ...(birth_date && { birth_date }),
    };
    const res = await axiosInstance.post("/auth/activate", payload);
    return res.data;
  },

  /**
   * Register New User (Restricted by Role Hierarchy Guard)
   * @param {Object} userData
   * @returns {Promise<{ msg: string, user: Object }>}
   */
  async register(userData) {
    const res = await axiosInstance.post("/auth/register", userData);
    return res.data;
  },

  /**
   * Request Password Reset Link / Token
   * @param {string} email
   * @returns {Promise<{ msg: string, previewUrl?: string }>}
   */
  async forgotPassword(email) {
    const res = await axiosInstance.post("/auth/forgot-password", {
      email: email.trim(),
    });
    return res.data;
  },

  /**
   * Submit New Password with Reset Token
   * @param {Object} params
   * @param {string} params.token
   * @param {string} params.password
   * @returns {Promise<{ msg: string }>}
   */
  async resetPassword({ token, password, newPassword }) {
    const payload = {
      token: token?.trim(),
      password: password || newPassword,
    };
    const res = await axiosInstance.post("/auth/reset-password", payload);
    return res.data;
  },

  /**
   * Verify Reset / Activation Token Validity
   * @param {string} token
   * @returns {Promise<{ valid: boolean, msg?: string, email?: string }>}
   */
  async verifyResetToken(token) {
    const res = await axiosInstance.get(`/auth/verify-token/${encodeURIComponent(token)}`);
    return res.data;
  },

  /**
   * Force Password Change on First Superadmin / Staff Login
   * @param {Object} params
   * @param {string} params.newPassword
   * @returns {Promise<{ success: boolean, msg: string, user: Object }>}
   */
  async completeFirstLogin({ newPassword }) {
    const payload = {
      newPassword,
      new_password: newPassword,
    };
    const res = await axiosInstance.post("/auth/first-login", payload);
    return res.data;
  },

  /**
   * Refresh Expired Access Token
   * @returns {Promise<{ msg: string, token: string }>}
   */
  async refreshToken() {
    const res = await axiosInstance.post("/auth/refresh-token");
    return res.data;
  },

  /**
   * Invalidate Session & Revoke Token
   * @returns {Promise<{ msg: string }>}
   */
  async logout() {
    const res = await axiosInstance.post("/auth/logout");
    return res.data;
  },
};

export default authService;
