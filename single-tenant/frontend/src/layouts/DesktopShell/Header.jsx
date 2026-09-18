import React from "react";
import { formatRoleName } from "@/lib/formatters";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/useAuthStore";
import { useUiStore } from "@/stores/useUiStore";
import {
  Badge,
  IconButton,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/primitives";
import { Sun, Moon, LogOut, Menu, Shield, Search, Bell, ChevronDown, User } from "lucide-react";

export function Header({ onMobileMenuToggle }) {
  const location = useLocation();
  const navigate = useNavigate();

  // Atomic selectors for re-render optimization
  const user = useAuthStore((state) => state.user);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const theme = useUiStore((state) => state.theme);
  const toggleTheme = useUiStore((state) => state.toggleTheme);

  const handleLogout = () => {
    clearAuth();
    navigate("/login");
  };

  // Convert pathname to clean semantic breadcrumb segments
  const pathSegments = location.pathname.split("/").filter(Boolean);

  const formattedSegments = pathSegments.map((segment, index) => {
    // Check if segment is a UUID or long hexadecimal hash
    const isUuidOrHash =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment) ||
      /^[0-9a-fA-F-]{16,}$/.test(segment);

    if (isUuidOrHash) {
      const prev = pathSegments[index - 1];
      if (prev === "users") return "DETAIL USER";
      return "DETAIL";
    }
    if (segment === "users") return "USERS";
    if (segment === "create") return "CREATE USER";
    if (segment === "roles") return "ROLES & ACCESS";
    if (segment === "profile") return "PROFIL SAYA";
    if (segment === "mapops") return "MAP OPERATIONS";
    if (segment === "weather") return "PREDIKSI CUACA";
    if (segment === "overview") return "OVERVIEW";
    return segment.replace(/-/g, " ").toUpperCase();
  });

  const rootPillar = formattedSegments[0] || "MOVA";
  const trailingSegments = formattedSegments.slice(1);

  return (
    <header className="h-16 border-b border-[var(--border-subtle)] bg-[var(--surface)] px-6 flex items-center justify-between gap-4 z-10 select-none">
      {/* Left: Breadcrumb / Title */}
      <div className="flex items-center gap-3 min-w-0">
        {onMobileMenuToggle ? (
          <IconButton
            icon={Menu}
            label="Toggle Menu"
            size="sm"
            onClick={onMobileMenuToggle}
            className="md:hidden"
          />
        ) : null}
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-mono font-semibold text-[var(--accent-primary)] uppercase tracking-wider shrink-0">
            {rootPillar}
          </span>
          {trailingSegments.length > 0 &&
            trailingSegments.map((seg, sIdx) => (
              <React.Fragment key={`${seg}-${sIdx}`}>
                <span className="text-[var(--text-muted)] text-xs">/</span>
                <span
                  className={`text-xs uppercase truncate ${
                    sIdx === trailingSegments.length - 1
                      ? "font-bold text-[var(--text-primary)]"
                      : "text-[var(--text-secondary)] font-medium"
                  }`}
                >
                  {seg}
                </span>
              </React.Fragment>
            ))}
        </div>
      </div>

      {/* Center/Right: Quick Search Bar + Actions */}
      <div className="flex items-center gap-3">
        {/* Quick Recessed Search Bar */}
        <div className="relative hidden md:flex items-center w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 text-[var(--text-muted)] pointer-events-none" />
          <input
            type="text"
            placeholder="Cari armada, zona, rider..."
            className="w-full h-8.5 pl-8 pr-3 text-xs bg-[var(--surface-muted)]/70 hover:bg-[var(--surface-muted)] focus:bg-[var(--surface-raised)] border border-[var(--border-subtle)] focus:border-[var(--accent-primary)] rounded-[var(--radius-full)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-all outline-none"
          />
        </div>

        {/* Notification Bell */}
        <div className="relative">
          <IconButton
            icon={Bell}
            label="Notifikasi Sistem"
            size="sm"
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-raised)]"
          />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[var(--status-danger)] ring-2 ring-[var(--surface)]" />
        </div>

        {/* Theme Toggle */}
        <IconButton
          icon={theme === "dark" ? Sun : Moon}
          label={theme === "dark" ? "Ganti ke Tema Terang" : "Ganti ke Tema Gelap"}
          size="sm"
          onClick={toggleTheme}
          className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-raised)]"
        />

        {/* User Profile Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2.5 py-1 px-1.5 rounded-[var(--radius-full)] hover:bg-[var(--surface-raised)] transition-all focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] text-left cursor-pointer border border-transparent hover:border-[var(--border-subtle)]">
              <div className="w-8 h-8 rounded-full bg-[var(--accent-primary)]/15 border border-[var(--accent-primary)]/30 flex items-center justify-center text-xs font-bold text-[var(--accent-primary)] shrink-0">
                {user?.name ? user.name.charAt(0).toUpperCase() : "A"}
              </div>
              <div className="hidden lg:block text-left">
                <span className="text-xs font-semibold text-[var(--text-primary)] block leading-tight">
                  {user?.name || "Admin Operasional"}
                </span>
                <span className="text-[10px] text-[var(--text-muted)] font-medium block leading-none mt-0.5">
                  {formatRoleName(user?.role || "SUPERADMIN")}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)] hidden lg:block" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Akun Operasional</DropdownMenuLabel>
            <div className="px-3 py-1.5 text-xs text-[var(--text-secondary)]">
              <span className="text-[10px] uppercase font-mono text-[var(--text-muted)] block">Email Pengguna</span>
              <span className="font-medium text-[var(--text-primary)] truncate block" title={user?.email || "admin@mova.id"}>
                {user?.email || "admin@mova.id"}
              </span>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem icon={User} onSelect={() => navigate("/profile")}>
              Profil Saya
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem icon={LogOut} destructive onSelect={handleLogout}>
              Keluar Sesi
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
