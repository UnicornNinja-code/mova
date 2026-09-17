import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/stores/useAuthStore";
import { DesktopShell } from "@/layouts/DesktopShell/DesktopShell";
import { RiderShell } from "@/layouts/RiderShell/RiderShell";

export function ProtectedRoute({ children, allowedRoles }) {
  const location = useLocation();
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If user is flagged with first_login, strictly confine them to /first-login until resolved
  if (user?.first_login) {
    if (location.pathname !== "/first-login") {
      return <Navigate to="/first-login" replace />;
    }
    return children;
  }

  // If user is already active and accesses /first-login, redirect to their operational home
  if (location.pathname === "/first-login" && !user?.first_login) {
    return <Navigate to={user?.role === "RIDER" ? "/rider" : "/overview"} replace />;
  }

  if (allowedRoles && user?.role && !allowedRoles.includes(user.role)) {
    // Redirect rider to /rider if attempting desktop, and desktop users to /overview if attempting rider
    if (user.role === "RIDER") {
      return <Navigate to="/rider" replace />;
    }
    return <Navigate to="/overview" replace />;
  }

  // Choose shell based on user role
  if (user?.role === "RIDER") {
    return <RiderShell>{children}</RiderShell>;
  }

  return <DesktopShell>{children}</DesktopShell>;
}
