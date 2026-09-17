import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import authService from '@/services/authService'
import type { UserProfile, UserRole } from '@/types/auth'

interface AuthState {
  token: string | null
  refreshToken: string | null
  user: UserProfile | null
  loading: boolean
  isAuthenticated: boolean
  role: UserRole | null

  // Role check helpers
  isSuperAdmin: () => boolean
  isManagement: () => boolean
  isSupervisor: () => boolean
  isRider: () => boolean
  hasRole: (roles: UserRole[]) => boolean

  // Actions
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  fetchProfile: () => Promise<void>
  setUser: (user: UserProfile | null) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: localStorage.getItem('token') || null,
      refreshToken: localStorage.getItem('refreshToken') || null,
      user: null,
      loading: false,
      isAuthenticated: Boolean(localStorage.getItem('token')),
      role: null,

      isSuperAdmin: () => get().user?.role === 'superadmin',
      isManagement: () => get().user?.role === 'management',
      isSupervisor: () => get().user?.role === 'supervisor',
      isRider: () => get().user?.role === 'rider',
      hasRole: (roles: UserRole[]) => {
        const userRole = get().user?.role
        return userRole ? roles.includes(userRole) : false
      },

      login: async (email: string, password: string) => {
        set({ loading: true })
        try {
          const res = await authService.login({ email, password })
          const accessToken = res.tokens?.accessToken || res.token
          const refreshToken = res.tokens?.refreshToken || res.refreshToken
          const user = res.user

          if (accessToken) {
            localStorage.setItem('token', accessToken)
          }
          if (refreshToken) {
            localStorage.setItem('refreshToken', refreshToken)
          }
          if (user) {
            localStorage.setItem('user', JSON.stringify(user))
          }

          set({
            token: accessToken,
            refreshToken: refreshToken || null,
            user,
            role: user?.role || null,
            isAuthenticated: true,
            loading: false,
          })
        } catch (error) {
          set({ loading: false })
          throw error
        }
      },

      logout: async () => {
        try {
          await authService.logout()
        } finally {
          localStorage.removeItem('token')
          localStorage.removeItem('refreshToken')
          localStorage.removeItem('user')
          set({
            token: null,
            refreshToken: null,
            user: null,
            role: null,
            isAuthenticated: false,
            loading: false,
          })
        }
      },

      fetchProfile: async () => {
        const token = get().token
        if (!token) return
        try {
          const profile = await authService.getProfile()
          set({
            user: profile,
            role: profile.role,
            isAuthenticated: true,
          })
          localStorage.setItem('user', JSON.stringify(profile))
        } catch {
          // Error handled by Axios interceptor
        }
      },

      setUser: (user) => set({ user, role: user?.role || null }),
    }),
    {
      name: 'mova-auth-storage',
      partialize: (state) => ({ token: state.token, user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
)

export default useAuthStore
