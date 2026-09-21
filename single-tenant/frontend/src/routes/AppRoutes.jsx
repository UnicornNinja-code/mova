
import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute";
import { PublicRoute } from "./PublicRoute";
import { Spinner } from "@/components/primitives";

// Lazy-loaded pages
const LoginPage = lazy(() => import("@/pages/auth/LoginPage").then((m) => ({ default: m.LoginPage })));
const FirstLoginPage = lazy(() => import("@/pages/auth/FirstLoginPage").then((m) => ({ default: m.FirstLoginPage })));
const ActivatePage = lazy(() => import("@/pages/auth/ActivatePage").then((m) => ({ default: m.ActivatePage })));
const ForgotPasswordPage = lazy(() => import("@/pages/auth/ForgotPasswordPage").then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import("@/pages/auth/ResetPasswordPage").then((m) => ({ default: m.ResetPasswordPage })));
const AccessChangedPage = lazy(() => import("@/pages/auth/AccessChangedPage").then((m) => ({ default: m.AccessChangedPage })));
const OverviewPage = lazy(() => import("@/pages/overview/OverviewPage").then((m) => ({ default: m.OverviewPage })));
const MapOpsPage = lazy(() => import("@/pages/mapops/MapOpsPage").then((m) => ({ default: m.MapOpsPage })));
const WeatherPage = lazy(() => import("@/pages/operations/WeatherPage").then((m) => ({ default: m.WeatherPage })));
const ZoneDetailPage = lazy(() => import("@/pages/operations/ZoneDetailPage").then((m) => ({ default: m.ZoneDetailPage })));
const RiderHomePage = lazy(() => import("@/pages/rider/RiderHomePage").then((m) => ({ default: m.RiderHomePage })));
const UsersPage = lazy(() => import("@/pages/admin/UsersPage").then((m) => ({ default: m.UsersPage })));
const CreateUserPage = lazy(() => import("@/pages/admin/CreateUserPage").then((m) => ({ default: m.CreateUserPage })));
const UserDetailPage = lazy(() => import("@/pages/admin/UserDetailPage").then((m) => ({ default: m.UserDetailPage })));
const RolesPage = lazy(() => import("@/pages/help/FaqPage").then((m) => ({ default: m.FaqPage })));
const FaqPage = lazy(() => import("@/pages/help/FaqPage").then((m) => ({ default: m.FaqPage })));
const ProfilePage = lazy(() => import("@/pages/profile/ProfilePage").then((m) => ({ default: m.ProfilePage })));
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage").then((m) => ({ default: m.NotFoundPage })));

function PageSuspense({ children }) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[50vh] w-full">
          <Spinner size="lg" label="Memuat Halaman..." />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      {/* Public Auth & Onboarding Routes */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <PageSuspense>
              <LoginPage />
            </PageSuspense>
          </PublicRoute>
        }
      />
      <Route
        path="/activate"
        element={
          <PublicRoute>
            <PageSuspense>
              <ActivatePage />
            </PageSuspense>
          </PublicRoute>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <PublicRoute>
            <PageSuspense>
              <ForgotPasswordPage />
            </PageSuspense>
          </PublicRoute>
        }
      />
      <Route
        path="/reset-password"
        element={
          <PublicRoute>
            <PageSuspense>
              <ResetPasswordPage />
            </PageSuspense>
          </PublicRoute>
        }
      />
      <Route
        path="/access-changed"
        element={
          <PageSuspense>
            <AccessChangedPage />
          </PageSuspense>
        }
      />

      {/* Mandatory First Login Protected Route */}
      <Route
        path="/first-login"
        element={
          <ProtectedRoute>
            <PageSuspense>
              <FirstLoginPage />
            </PageSuspense>
          </ProtectedRoute>
        }
      />

      {/* Control Room Routes (Superadmin, Management, Supervisor) */}
      <Route
        path="/"
        element={<Navigate to="/overview" replace />}
      />

      {/* User Self Profile Route (All Authenticated Roles) */}
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <PageSuspense>
              <ProfilePage />
            </PageSuspense>
          </ProtectedRoute>
        }
      />

      {/* Technical FAQ & Operational Guide Route (All Authenticated Roles) */}
      <Route
        path="/faq"
        element={
          <ProtectedRoute>
            <PageSuspense>
              <FaqPage />
            </PageSuspense>
          </ProtectedRoute>
        }
      />

      <Route
        path="/overview"
        element={
          <ProtectedRoute allowedRoles={["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"]}>
            <PageSuspense>
              <OverviewPage />
            </PageSuspense>
          </ProtectedRoute>
        }
      />

      <Route
        path="/operations/mapops"
        element={
          <ProtectedRoute allowedRoles={["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"]}>
            <PageSuspense>
              <MapOpsPage />
            </PageSuspense>
          </ProtectedRoute>
        }
      />

      <Route
        path="/operations/weather"
        element={
          <ProtectedRoute allowedRoles={["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"]}>
            <PageSuspense>
              <WeatherPage />
            </PageSuspense>
          </ProtectedRoute>
        }
      />

      <Route
        path="/operations/zones/:id"
        element={
          <ProtectedRoute allowedRoles={["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"]}>
            <PageSuspense>
              <ZoneDetailPage />
            </PageSuspense>
          </ProtectedRoute>
        }
      />

      {/* Placeholder Operations Routes */}
      <Route
        path="/operations/*"
        element={
          <ProtectedRoute allowedRoles={["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"]}>
            <PageSuspense>
              <OverviewPage />
            </PageSuspense>
          </ProtectedRoute>
        }
      />

      <Route
        path="/intelligence/*"
        element={
          <ProtectedRoute allowedRoles={["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"]}>
            <PageSuspense>
              <OverviewPage />
            </PageSuspense>
          </ProtectedRoute>
        }
      />

      <Route
        path="/data/*"
        element={
          <ProtectedRoute allowedRoles={["SUPERADMIN", "SUPERVISOR"]}>
            <PageSuspense>
              <OverviewPage />
            </PageSuspense>
          </ProtectedRoute>
        }
      />

      {/* Administration Control Room Routes (SUPERADMIN ONLY) */}
      <Route
        path="/admin"
        element={<Navigate to="/admin/users" replace />}
      />
      <Route
        path="/admin/users"
        element={
          <ProtectedRoute allowedRoles={["SUPERADMIN"]}>
            <PageSuspense>
              <UsersPage />
            </PageSuspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/users/create"
        element={
          <ProtectedRoute allowedRoles={["SUPERADMIN"]}>
            <PageSuspense>
              <CreateUserPage />
            </PageSuspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/users/:id"
        element={
          <ProtectedRoute allowedRoles={["SUPERADMIN"]}>
            <PageSuspense>
              <UserDetailPage />
            </PageSuspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/roles"
        element={
          <ProtectedRoute allowedRoles={["SUPERADMIN"]}>
            <PageSuspense>
              <RolesPage />
            </PageSuspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/*"
        element={
          <ProtectedRoute allowedRoles={["SUPERADMIN"]}>
            <PageSuspense>
              <UsersPage />
            </PageSuspense>
          </ProtectedRoute>
        }
      />

      {/* Rider Mobile-First Dedicated Routes */}
      <Route
        path="/rider"
        element={
          <ProtectedRoute allowedRoles={["RIDER"]}>
            <PageSuspense>
              <RiderHomePage />
            </PageSuspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/rider/*"
        element={
          <ProtectedRoute allowedRoles={["RIDER"]}>
            <PageSuspense>
              <RiderHomePage />
            </PageSuspense>
          </ProtectedRoute>
        }
      />

      {/* 404 Fallback */}
      <Route
        path="*"
        element={
          <PageSuspense>
            <NotFoundPage />
          </PageSuspense>
        }
      />
    </Routes>
  );
}
