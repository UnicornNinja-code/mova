import React from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/stores/useAuthStore";
import { Spinner } from "@/components/primitives";

/**
 * PublicRoute
 * Guards public auth pages (e.g. /login, /activate, /forgot-password, /reset-password)
 * so authenticated users are seamlessly redirected to their respective dashboards.
 */
export function PublicRoute({ children }) {
  const { isAuthenticated, isInitialized, user } = useAuthStore();

  if (!isInitialized) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[var(--background)]">
        <Spinner size="lg" label="Memverifikasi Sesi..." />
      </div>
    );
  }

  if (isAuthenticated) {
    if (user?.first_login) {
      return <Navigate to="/first-login" replace />;
    }
    if (user?.role === "RIDER") {
      return <Navigate to="/rider" replace />;
    }
    return <Navigate to="/overview" replace />;
  }

  return children;
}

export default PublicRoute;
