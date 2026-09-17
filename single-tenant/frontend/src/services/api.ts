import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import type { ApiEnvelope } from '@/types/auth'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

// Variables to handle refreshing token queue
let isRefreshing = false
let failedQueue: Array<{
  resolve: (value?: unknown) => void
  reject: (reason?: unknown) => void
}> = []

const processQueue = (error: AxiosError | null, token: string | null = null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error)
    } else {
      promise.resolve(token)
    }
  })
  failedQueue = []
}

// 1. Request Interceptor: Attach Access Token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('mova_access_token')
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// 2. Response Interceptor: Handle Token Refresh & 401
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiEnvelope<unknown>>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    // Check if error is 401 and not already retried
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      if (originalRequest.url?.includes('/auth/login') || originalRequest.url?.includes('/auth/refresh-token')) {
        return Promise.reject(error)
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then((token) => {
            if (originalRequest.headers && token) {
              originalRequest.headers.Authorization = `Bearer ${token}`
            }
            return apiClient(originalRequest)
          })
          .catch((err) => Promise.reject(err))
      }

      originalRequest._retry = true
      isRefreshing = true

      const refreshToken = localStorage.getItem('mova_refresh_token')
      if (!refreshToken) {
        isRefreshing = false
        localStorage.removeItem('mova_access_token')
        localStorage.removeItem('mova_refresh_token')
        localStorage.removeItem('mova_user')
        window.location.href = '/login'
        return Promise.reject(error)
      }

      try {
        const response = await axios.post(`${API_BASE_URL}/auth/refresh-token`, {
          refreshToken,
        })

        const newAccessToken = response.data?.data?.accessToken || response.data?.accessToken
        const newRefreshToken = response.data?.data?.refreshToken || response.data?.refreshToken

        if (newAccessToken) {
          localStorage.setItem('mova_access_token', newAccessToken)
          if (newRefreshToken) {
            localStorage.setItem('mova_refresh_token', newRefreshToken)
          }

          apiClient.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
          }

          processQueue(null, newAccessToken)
          return apiClient(originalRequest)
        } else {
          throw new Error('No token returned from refresh endpoint')
        }
      } catch (refreshError) {
        processQueue(refreshError as AxiosError, null)
        localStorage.removeItem('mova_access_token')
        localStorage.removeItem('mova_refresh_token')
        localStorage.removeItem('mova_user')
        window.location.href = '/login'
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

export default apiClient
