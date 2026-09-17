import axios from "axios";

const API_BASE_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) ||
  "http://localhost:8090/api";

export const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

// Flag to track active logout execution and suppress refresh loops
export let isLoggingOut = false;

export function setLoggingOut(value) {
  isLoggingOut = Boolean(value);
}

// Request Interceptor: Attach JWT Token automatically & cancel if logging out
axiosInstance.interceptors.request.use(
  (config) => {
    if (isLoggingOut) {
      const controller = new AbortController();
      config.signal = controller.signal;
      controller.abort();
      return config;
    }
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Flag to avoid infinite refresh loops
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

// Response Interceptor: Auto Handle Token Refresh & 401 Session Expiration
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    // If user is logging out, silently drop errors to prevent UI freezing
    if (isLoggingOut) {
      return Promise.reject(error);
    }

    const originalRequest = error.config;

    // Check if error is 401 and not already retried
    if (
      error.response &&
      error.response.status === 401 &&
      !originalRequest?._retry &&
      !originalRequest?.url?.includes("/auth/login") &&
      !originalRequest?.url?.includes("/auth/refresh-token") &&
      !originalRequest?.url?.includes("/auth/forgot-password")
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return axiosInstance(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const storedRefreshToken = localStorage.getItem("refreshToken");
        const res = await axios.post(
          `${API_BASE_URL}/auth/refresh-token`,
          { token: storedRefreshToken, refreshToken: storedRefreshToken },
          { withCredentials: true }
        );
        const newToken = res.data?.token;
        const newRefreshToken = res.data?.refreshToken;

        if (newToken) {
          localStorage.setItem("token", newToken);
          if (newRefreshToken) {
            localStorage.setItem("refreshToken", newRefreshToken);
          }
          axiosInstance.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;
          originalRequest.headers["Authorization"] = `Bearer ${newToken}`;
          processQueue(null, newToken);
          return axiosInstance(originalRequest);
        }
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("user");
        sessionStorage.clear();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Attach normalized error message for UI consumption
    if (error.response?.data) {
      const data = error.response.data;
      const extractedMessage = data.message || data.msg || data.error || (typeof data === "string" ? data : null);
      if (extractedMessage) {
        error.apiMessage = extractedMessage;
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;

