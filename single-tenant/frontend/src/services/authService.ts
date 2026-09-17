import apiClient from './api'
import type { LoginResponse, UserProfile, ApiEnvelope } from '@/types/auth'

export const authService = {
  async login(payload: { email: string; password: string }): Promise<LoginResponse> {
    const response = await apiClient.post<ApiEnvelope<LoginResponse>>('/auth/login', payload)
    return response.data.data
  },

  async logout(): Promise<void> {
    const refreshToken = localStorage.getItem('mova_refresh_token')
    try {
      await apiClient.post('/auth/logout', { refreshToken })
    } finally {
      localStorage.removeItem('mova_access_token')
      localStorage.removeItem('mova_refresh_token')
      localStorage.removeItem('mova_user')
    }
  },

  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken?: string }> {
    const response = await apiClient.post<ApiEnvelope<{ accessToken: string; refreshToken?: string }>>(
      '/auth/refresh-token',
      { refreshToken }
    )
    return response.data.data
  },

  async getProfile(): Promise<UserProfile> {
    const response = await apiClient.get<ApiEnvelope<UserProfile>>('/users/profile')
    return response.data.data
  },

  async activateAccount(payload: { token: string; password: string }): Promise<void> {
    await apiClient.post('/auth/activate', payload)
  },

  async forgotPassword(email: string): Promise<void> {
    await apiClient.post('/auth/forgot-password', { email })
  },

  async resetPassword(payload: { token: string; password: string }): Promise<void> {
    await apiClient.post('/auth/reset-password', payload)
  },
}

export default authService
