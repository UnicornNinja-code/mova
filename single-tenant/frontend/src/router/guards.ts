import type { Router } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import type { UserRole } from '@/types/auth'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    requiresAuth?: boolean
    guestOnly?: boolean
    roles?: UserRole[]
  }
}

export function setupRouteGuards(router: Router) {
  router.beforeEach(async (to, _from, next) => {
    const authStore = useAuthStore()

    // 1. Update document title
    if (to.meta.title) {
      document.title = `${to.meta.title} — MOVA`
    } else {
      document.title = 'MOVA — Mobile Operations & Visibility Application'
    }

    // 2. Fetch profile if token exists but user profile is missing
    if (authStore.isAuthenticated && !authStore.user) {
      await authStore.fetchProfile()
    }

    // 3. Handle guestOnly routes (e.g. /login)
    if (to.meta.guestOnly && authStore.isAuthenticated) {
      if (authStore.isRider) {
        return next({ path: '/rider' })
      }
      return next({ path: '/' })
    }

    // 4. Handle routes requiring authentication
    if (to.meta.requiresAuth && !authStore.isAuthenticated) {
      return next({
        path: '/login',
        query: { redirect: to.fullPath !== '/' ? to.fullPath : undefined },
      })
    }

    // 5. Handle Role-Based Access Control (RBAC)
    if (to.meta.roles && to.meta.roles.length > 0) {
      const allowedRoles = to.meta.roles
      const userRole = authStore.user?.role

      if (!userRole || !allowedRoles.includes(userRole)) {
        // Redirect to their respective authorized area
        if (authStore.isRider) {
          return next({ path: '/rider' })
        }
        return next({ path: '/' })
      }
    }

    return next()
  })
}
