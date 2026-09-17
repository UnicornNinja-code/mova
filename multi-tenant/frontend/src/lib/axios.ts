/*
 * axios.ts
 * Enterprise-Grade Configured Axios Client with Automated Response Envelope Unwrapping,
 * 401 Mutex Token Refresh Queue, 403 FIRST_LOGIN_REQUIRED Trap, and Global Toast Alerts.
 */

import axios, { type AxiosRequestConfig, type AxiosResponse, type AxiosError } from "axios";
import { toast } from "./stores/toast.svelte";
import type { ApiResponse, ApiPaginatedResponse, ApiErrorEnvelope } from "./types/api";

const rawApiUrl = import.meta.env.VITE_API_URL || "/api";
export const API_BASE_URL = rawApiUrl.endsWith("/api") ? rawApiUrl : `${rawApiUrl}/api`;

// Mutex & Failed Request Queue for 401 Token Refresh
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

export interface CustomAxiosRequestConfig extends AxiosRequestConfig {
  skipGlobalToast?: boolean;
  rawResponse?: boolean;
  _retry?: boolean;
}

export const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  timeout: 20000,
});

// Request Interceptor: Attach JWT Bearer Token from localStorage
axiosInstance.interceptors.request.use(
  (config: any) => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      if (token && config.headers) {
        if (typeof config.headers.set === "function") {
          config.headers.set("Authorization", `Bearer ${token}`);
        } else {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
    } catch {
      // localStorage may fail in SSR or privacy mode
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Automated Envelope Unwrapping & Mutex Token Refresh
axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => {
    const config = response.config as CustomAxiosRequestConfig;

    // Passthrough raw response if requested or if binary Blob
    if (config?.rawResponse || response.data instanceof Blob || config?.responseType === "blob") {
      return response;
    }

    const data = response.data;

    // If backend returns standard Paginated Envelope: { success: true, data: T[], pagination: ... }
    if (data && typeof data === "object" && data.success === true && data.pagination && Array.isArray(data.data)) {
      return {
        ...response,
        data: {
          items: data.data,
          pagination: data.pagination,
          message: data.message,
          meta: data.meta,
        },
      };
    }

    // If backend returns standard Single Resource Envelope: { success: true, data: T }
    if (data && typeof data === "object" && data.success === true && data.data !== undefined) {
      return {
        ...response,
        data: data.data,
      };
    }

    // Return default response
    return response;
  },
  async (error: AxiosError<any>) => {
    const originalRequest = error.config as CustomAxiosRequestConfig;
    if (!originalRequest) {
      return Promise.reject(error);
    }

    // 1. Handle 401 Unauthorized with Refresh Token Mutex Queue
    if (error.response?.status === 401 && !originalRequest._retry) {
      // If server explicitly declared session revoked, user deleted (e.g. after db reset), or login/refresh/me endpoint failed
      if (
        error.response?.data?.error?.code === "SESSION_REVOKED" ||
        error.response?.data?.code === "SESSION_REVOKED" ||
        error.response?.data?.code === "USER_NOT_FOUND" ||
        originalRequest.url?.includes("/auth/login") ||
        originalRequest.url?.includes("/auth/refresh-token") ||
        originalRequest.url?.includes("/auth/me")
      ) {
        if (typeof window !== "undefined") {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          try {
            sessionStorage.clear();
          } catch {}
          window.dispatchEvent(new CustomEvent("auth:expired"));
        }
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Wait in queue while refresh is in progress
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              if (typeof (originalRequest.headers as any).set === "function") {
                (originalRequest.headers as any).set("Authorization", `Bearer ${token}`);
              } else {
                originalRequest.headers.Authorization = `Bearer ${token}`;
              }
            }
            return axiosInstance(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const localRefreshToken = typeof window !== "undefined" ? localStorage.getItem("refreshToken") : null;
        const refreshRes = await axios.post(
          `${API_BASE_URL}/auth/refresh-token`,
          { token: localRefreshToken || undefined },
          { withCredentials: true }
        );

        const newToken = refreshRes.data?.data?.token || refreshRes.data?.token;
        const newRefreshToken = refreshRes.data?.data?.refreshToken || refreshRes.data?.refreshToken;
        if (newToken) {
          if (typeof window !== "undefined") {
            localStorage.setItem("token", newToken);
            if (newRefreshToken) localStorage.setItem("refreshToken", newRefreshToken);
            window.dispatchEvent(new CustomEvent("auth:token_refreshed", { detail: newToken }));
          }

          if (originalRequest.headers) {
            if (typeof (originalRequest.headers as any).set === "function") {
              (originalRequest.headers as any).set("Authorization", `Bearer ${newToken}`);
            } else {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
            }
          }

          processQueue(null, newToken);
          return axiosInstance(originalRequest);
        } else {
          throw new Error("Token refresh response missing token string");
        }
      } catch (refreshErr: any) {
        processQueue(refreshErr, null);
        if (typeof window !== "undefined") {
          localStorage.removeItem("token");
          localStorage.removeItem("refreshToken");
          localStorage.removeItem("user");
          try {
            sessionStorage.clear();
          } catch {}
          window.dispatchEvent(new CustomEvent("auth:expired"));
        }
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    // 2. Intercept 403 FIRST_LOGIN_REQUIRED
    if (
      error.response?.status === 403 &&
      (error.response?.data?.error?.code === "FIRST_LOGIN_REQUIRED" ||
        error.response?.data?.code === "FIRST_LOGIN_REQUIRED" ||
        error.response?.data?.error === "FIRST_LOGIN_REQUIRED")
    ) {
      try {
        const savedUser = localStorage.getItem("user");
        if (savedUser) {
          const u = JSON.parse(savedUser);
          u.first_login = true;
          localStorage.setItem("user", JSON.stringify(u));
        }
      } catch {}
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("auth:first_login_required"));
      }
    }

    // 3. Extract and display global Toast notification (unless silenced)
    if (!originalRequest?.skipGlobalToast && typeof window !== "undefined") {
      const errorMsg =
        error.response?.data?.error?.message ||
        error.response?.data?.message ||
        error.message ||
        "Terjadi kesalahan saat memproses permintaan.";

      // Don't toast 401s that are being refreshed automatically
      if (error.response?.status !== 401 || originalRequest._retry) {
        // Warning for rate limits (429) or service unavailable (503), error for others
        if (error.response?.status === 429) {
          toast.warning("Terlalu banyak permintaan. Silakan tunggu beberapa saat.");
        } else if (error.response?.status === 503) {
          toast.warning("Layanan backend sedang dalam pemeliharaan. Silakan coba lagi.");
        } else if (error.response?.status !== 404) {
          toast.error(errorMsg);
        }
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
