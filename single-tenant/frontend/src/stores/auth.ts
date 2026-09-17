import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { UserProfile, UserRole } from '@/types/auth'
import authService from '@/services/authService'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('mova_access_token'))
  const user = ref<UserProfile | null>(() => {
    const cached = localStorage.getItem('mova_user')
    return cached ? JSON.parse(cached) : null
  })
  const loading = ref(false)

  const isAuthenticated = computed(() => !!token.value)
  const role = computed<UserRole | null>(() => user.value?.role || null)

  // Role Checks
  const isSuperAdmin = computed(() => user.value?.role === 'superadmin')
  const isManagement = computed(() => user.value?.role === 'management')
  const isSupervisor = computed(() => user.value?.role === 'supervisor')
  const isRider = computed(() => user.value?.role === 'rider')

  function hasRole(allowedRoles: UserRole[]): boolean {
    if (!user.value?.role) return false
    return allowedRoles.includes(user.value.role)
  }

  async function login(email: string, password: string): Promise<void> {
    loading.value = true
    try {
      const response = await authService.login({ email, password })
      token.value = response.tokens.accessToken
      user.value = response.user

      localStorage.setItem('mova_access_token', response.tokens.accessToken)
      if (response.tokens.refreshToken) {
        localStorage.setItem('mova_refresh_token', response.tokens.refreshToken)
      }
      localStorage.setItem('mova_user', JSON.stringify(response.user))
    } finally {
      loading.value = false
    }
  }

  async function logout(): Promise<void> {
    try {
      await authService.logout()
    } finally {
      token.value = null
      user.value = null
      localStorage.removeItem('mova_access_token')
      localStorage.removeItem('mova_refresh_token')
      localStorage.removeItem('mova_user')
    }
  }

  async function fetchProfile(): Promise<void> {
    if (!token.value) return
    try {
      const profile = await authService.getProfile()
      user.value = profile
      localStorage.setItem('mova_user', JSON.stringify(profile))
    } catch {
      // If fetching profile fails with 401, interceptor will handle refresh or redirect
    }
  }

  return {
    token,
    user,
    role,
    loading,
    isAuthenticated,
    isSuperAdmin,
    isManagement,
    isSupervisor,
    isRider,
    hasRole,
    login,
    logout,
    fetchProfile,
  }
})