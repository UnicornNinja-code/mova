export type UserRole = 'superadmin' | 'management' | 'supervisor' | 'rider'

export interface UserProfile {
  id: string
  name: string
  email: string
  role: UserRole
  phone?: string
  avatar?: string
  status?: 'active' | 'inactive' | 'pending'
  zone_id?: string | null
  created_at?: string
  updated_at?: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken?: string
  tokenType?: string
  expiresIn?: number
}

export interface LoginResponse {
  user: UserProfile
  tokens: AuthTokens
}

export interface ApiEnvelope<T = unknown> {
  status: 'success' | 'error' | 'fail'
  message?: string
  data: T
  meta?: {
    page?: number
    limit?: number
    total?: number
    timestamp?: string
  }
}
