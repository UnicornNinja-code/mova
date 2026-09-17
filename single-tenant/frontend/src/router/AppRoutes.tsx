import React, { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import type { UserRole } from '@/types/auth'
import MainLayout from '@/layouts/MainLayout'
import LoginPage from '@/pages/auth/LoginPage'
import DashboardPage from '@/pages/dashboard/DashboardPage'

// Protected Route Guard
interface ProtectedRouteProps {
  children: React.ReactNode
  roles?: UserRole[]
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, roles }) => {
  const location = useLocation()
  const { isAuthenticated, hasRole, isRider } = useAuthStore()

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (roles && roles.length > 0 && !hasRole(roles)) {
    if (isRider()) {
      return <Navigate to="/rider" replace />
    }
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

// Guest-Only Route Guard
const GuestRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isRider } = useAuthStore()

  if (isAuthenticated) {
    if (isRider()) {
      return <Navigate to="/rider" replace />
    }
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

export const AppRoutes: React.FC = () => {
  const { fetchProfile, isAuthenticated } = useAuthStore()

  useEffect(() => {
    if (isAuthenticated) {
      fetchProfile()
    }
  }, [isAuthenticated, fetchProfile])

  return (
    <Routes>
      {/* Public / Guest Routes */}
      <Route
        path="/login"
        element={
          <GuestRoute>
            <LoginPage />
          </GuestRoute>
        }
      />

      {/* Protected Desktop Shell */}
      <Route
        path="/"
        element={
          <ProtectedRoute roles={['superadmin', 'management', 'supervisor']}>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="operations" element={<DashboardPage />} />
        <Route path="dss" element={<DashboardPage />} />
      </Route>

      {/* Rider PWA Route */}
      <Route
        path="/rider"
        element={
          <ProtectedRoute roles={['rider']}>
            <div className="min-h-screen bg-zinc-950 text-white p-4">
              <h1 className="text-xl font-bold">Rider Mobile Execution PWA</h1>
              <p className="text-xs text-zinc-400 mt-2">Claim armada dan cek shift aktif.</p>
            </div>
          </ProtectedRoute>
        }
      />

      {/* 404 Fallback */}
      <Route
        path="*"
        element={
          <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-white p-4 space-y-3 text-center">
            <span className="text-6xl font-mono font-bold text-emerald-400">404</span>
            <h2 className="text-lg font-semibold">Halaman Tidak Ditemukan</h2>
            <a href="/" className="text-xs text-emerald-400 hover:underline">Kembali ke Beranda</a>
          </div>
        }
      />
    </Routes>
  )
}

export default AppRoutes
