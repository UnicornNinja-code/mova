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
  ThemeToggle,
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
    if (segment === "faq") return "FAQ & PANDUAN";
    if (segment === "mapops") return "MAP OPERATIONS";
    if (segment === "weather") return "PREDIKSI CUACA";
    if (segment === "overview") return "OVERVIEW";
    return segment.replace(/-/g, " ").toUpperCase();
  });

  const rootPillar = formattedSegments[0] || "KopiGo";
  const trailingSegments = formattedSegments.slice(1);

  return (
    <header className="h-16 border-b border-slate-200/80 dark:border-white/5 bg-white dark:bg-[#090A0D] px-6 flex items-center justify-between gap-4 z-10 select-none">
      {/* Left: Breadcrumb / Title */}
      <div className="flex items-center gap-3 min-w-0">
        {onMobileMenuToggle ? (
          <IconButton
            icon={Menu}
            label="Toggle Menu"
            size="sm"
            onClick={onMobileMenuToggle}
            className="md:hidden text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          />
        ) : null}
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-mono font-semibold text-[var(--brand-primary)] uppercase tracking-wider shrink-0">
            {rootPillar}
          </span>
          {trailingSegments.length > 0 &&
            trailingSegments.map((seg, sIdx) => (
              <React.Fragment key={`${seg}-${sIdx}`}>
                <span className="text-slate-300 dark:text-slate-600 text-xs">/</span>
                <span
                  className={`text-xs uppercase truncate ${
                    sIdx === trailingSegments.length - 1
                      ? "font-heading font-medium text-slate-900 dark:text-slate-100"
                      : "text-slate-500 dark:text-slate-400 font-medium"
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
          <Search className="w-3.5 h-3.5 absolute left-3 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Cari armada, zona, rider..."
            className="w-full h-9 pl-9 pr-3 text-xs bg-slate-50/80 dark:bg-[#111318] hover:bg-slate-100/80 dark:hover:bg-[#181B22] focus:bg-white dark:focus:bg-[#111318] border border-slate-200/80 dark:border-white/10 focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)] rounded-xl text-slate-800 dark:text-slate-100 placeholder:text-slate-400 transition-colors duration-150 outline-none"
          />
        </div>

        {/* Notification Bell */}
        <div className="relative">
          <IconButton
            icon={Bell}
            label="Notifikasi Sistem"
            size="sm"
            className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100/70 dark:hover:bg-[#181B22]/70"
          />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[var(--status-danger)] ring-2 ring-white dark:ring-[#090A0D]" />
        </div>

        {/* Modern Theme Switch */}
        <ThemeToggle />

        {/* User Profile Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2.5 py-1 px-2 rounded-xl hover:bg-slate-100/70 dark:hover:bg-[#181B22]/70 transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)] text-left cursor-pointer border border-transparent hover:border-slate-200/80 dark:hover:border-white/5">
              <div className="w-8 h-8 rounded-lg bg-[var(--brand-primary)]/10 border border-[var(--brand-primary)]/20 flex items-center justify-center text-xs font-heading font-medium text-[var(--brand-primary)] shrink-0">
                {user?.name ? user.name.charAt(0).toUpperCase() : "A"}
              </div>
              <div className="hidden lg:block text-left">
                <span className="text-xs font-heading font-medium text-slate-900 dark:text-slate-100 block leading-tight">
                  {user?.name || "Admin Operasional"}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block leading-none mt-0.5">
                  {formatRoleName(user?.role || "SUPERADMIN")}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden lg:block" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Akun Operasional</DropdownMenuLabel>
            <div className="px-3 py-2 text-xs text-slate-600 dark:text-slate-400 bg-slate-50/50 dark:bg-[#14161D] rounded-lg my-1">
              <span className="text-[10px] uppercase font-mono text-slate-400 dark:text-slate-500 block">Email Pengguna</span>
              <span className="font-medium text-slate-900 dark:text-slate-100 truncate block" title={user?.email || "admin@kopigo.id"}>
                {user?.email || "admin@kopigo.id"}
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
