import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { setupRouteGuards } from './guards'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'dashboard',
    component: () => import('@/App.vue'),
    meta: {
      title: 'Dashboard Operasional',
      requiresAuth: true,
      roles: ['superadmin', 'management', 'supervisor'],
    },
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/App.vue'),
    meta: {
      title: 'Masuk — MOVA',
      guestOnly: true,
    },
  },
  {
    path: '/rider',
    name: 'rider-pwa',
    component: () => import('@/App.vue'),
    meta: {
      title: 'Rider Field Execution',
      requiresAuth: true,
      roles: ['rider'],
    },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/App.vue'),
    meta: {
      title: '404 Tidak Ditemukan',
    },
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

setupRouteGuards(router)

export default router