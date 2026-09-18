import axios from "axios";
import { useAuthStore } from "@/stores/useAuthStore";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "",
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request Interceptor: Attach JWT Bearer Token & Update Activity Timestamp
api.interceptors.request.use(
  (config) => {
    const store = useAuthStore.getState();
    const token = store.token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    store.touchActivity();
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Silent Token Refresh & 401 Queueing Handler
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;

    // Handle 401 Unauthorized
    if (status === 401) {
      const errData = error.response?.data;
      if (errData?.code === "SESSION_REVOKED" || errData?.reason === "ROLE_CHANGED") {
        useAuthStore.getState().clearAuth();
        if (typeof window !== "undefined" && window.location.pathname !== "/access-changed") {
          try {
            sessionStorage.setItem(
              "mova_access_changed_state",
              JSON.stringify({
                previousRole: errData.previousRole || null,
                newRole: errData.newRole || null,
                reason: errData.msg || "Hak akses peran telah diubah oleh Superadmin.",
              })
            );
          } catch (e) {}
          window.location.href = "/access-changed";
        }
        return Promise.reject(error);
      }

      if (!originalRequest._retry) {
        // Don't retry if the failed request was login, refresh-token, or forgot-password
        const isAuthRoute =
          originalRequest.url?.includes("/auth/login") ||
          originalRequest.url?.includes("/auth/refresh-token") ||
          originalRequest.url?.includes("/auth/forgot-password");

        if (isAuthRoute) {
          return Promise.reject(error);
        }

        if (isRefreshing) {
          // Queue pending requests while refresh is in progress
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then((token) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              return api(originalRequest);
            })
            .catch((err) => Promise.reject(err));
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          // Attempt silent token refresh via backend API
          const refreshResponse = await axios.post(
            `${import.meta.env.VITE_API_URL || ""}/api/auth/refresh-token`,
            {},
            { withCredentials: true }
          );

          const newToken = refreshResponse.data?.data?.token || refreshResponse.data?.token;

          if (newToken) {
            useAuthStore.getState().updateToken(newToken);
            api.defaults.headers.common.Authorization = `Bearer ${newToken}`;
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            processQueue(null, newToken);
            return api(originalRequest);
          } else {
            throw new Error("No token returned from refresh endpoint");
          }
        } catch (refreshErr) {
          processQueue(refreshErr, null);
          useAuthStore.getState().clearAuth();

          if (typeof window !== "undefined" && window.location.pathname !== "/login") {
            window.location.href = "/login";
          }
          return Promise.reject(refreshErr);
        } finally {
          isRefreshing = false;
        }
      }
    }

    return Promise.reject(error);
  }
);
