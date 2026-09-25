import React from "react";
import { Link, useLocation } from "react-router-dom";
import { NAVIGATION_PILLARS } from "./navigationConfig";
import { useAuthStore } from "@/stores/useAuthStore";
import { useUiStore } from "@/stores/useUiStore";
import { Tooltip, TooltipProvider, IconButton } from "@/components/primitives";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Sidebar({ className }) {
  const location = useLocation();

  // Atomic selectors for re-render optimization
  const userRole = useAuthStore((state) => state.user?.role || "SUPERVISOR");
  const isSidebarCollapsed = useUiStore((state) => state.isSidebarCollapsed);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);

  return (
    <TooltipProvider delayDuration={150}>
      <aside
        className={cn(
          "flex flex-col h-screen border-r border-slate-200/80 dark:border-white/5 bg-white dark:bg-[#090A0D] transition-all duration-200 select-none z-20 shrink-0",
          isSidebarCollapsed ? "w-18" : "w-64",
          className
        )}
      >
        {/* Brand Header */}
        <div
          className={cn(
            "flex items-center h-16 border-b border-slate-200/80 dark:border-white/5 bg-white dark:bg-[#090A0D] transition-all",
            isSidebarCollapsed ? "justify-center px-2" : "justify-between px-4"
          )}
        >
          {!isSidebarCollapsed ? (
            <>
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src="/assets/img/kopigo_logo.jpg"
                  alt="KopiGo Logo"
                  className="w-8 h-8 rounded-xl object-cover shrink-0 shadow-xs"
                />
                <div className="min-w-0">
                  <span className="font-heading font-medium text-sm tracking-tight text-slate-900 dark:text-slate-100 block leading-tight">
                   KopiGo System
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 tracking-wider uppercase font-mono block mt-0.5">
                    Unit Kopi Keliling
                  </span>
                </div>
              </div>

              <IconButton
                icon={ChevronLeft}
                label="Kecilkan Menu"
                size="sm"
                onClick={toggleSidebar}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              />
            </>
          ) : (
            <Tooltip content="Perluas Menu (KopiGo Control)" side="right">
              <button
                type="button"
                onClick={toggleSidebar}
                className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center shadow-xs transition-colors hover:ring-2 hover:ring-[var(--brand-primary)] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] p-0.5 bg-slate-100 dark:bg-[#181B22]"
                aria-label="Perluas Menu"
              >
                <img
                  src="/assets/img/kopigo_logo.jpg"
                  alt="KopiGo Logo"
                  className="w-full h-full rounded-lg object-cover"
                />
              </button>
            </Tooltip>
          )}
        </div>

        {/* Navigation Pillars */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
          {NAVIGATION_PILLARS.map((pillar) => {
            if (!pillar.roles.includes(userRole)) return null;

            const visibleItems = pillar.items.filter((item) => item.roles.includes(userRole));
            if (visibleItems.length === 0) return null;

            return (
              <div key={pillar.id} className="space-y-1.5">
                {!isSidebarCollapsed ? (
                  <div className="px-3 py-1 text-[10px] font-heading font-medium tracking-widest text-slate-400 dark:text-slate-500 uppercase font-mono">
                    {pillar.title}
                  </div>
                ) : (
                  <div className="h-[1px] bg-slate-200/80 dark:bg-white/5 my-2 mx-1" />
                )}

                <div className="space-y-1">
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(`${item.path}/`));

                    const linkContent = (
                      <Link
                        to={item.path}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors duration-150 cursor-pointer group",
                          isActive
                            ? "bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] font-semibold border-l-2 border-[var(--brand-primary)]"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/70 dark:hover:bg-[#181B22]/70",
                          isSidebarCollapsed ? "justify-center px-0 h-10 w-10 mx-auto" : ""
                        )}
                      >
                        <Icon className={cn("w-4 h-4 shrink-0 transition-colors", isActive ? "text-[var(--brand-primary)]" : "text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200")} />
                        {!isSidebarCollapsed ? <span className="truncate">{item.label}</span> : null}
                      </Link>
                    );

                    if (isSidebarCollapsed) {
                      return (
                        <Tooltip key={item.path} content={item.label} side="right">
                          {linkContent}
                        </Tooltip>
                      );
                    }

                    return <div key={item.path}>{linkContent}</div>;
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Operational Telemetry Pulse Footer */}
        <div className="p-3 border-t border-slate-200/80 dark:border-white/5 bg-white dark:bg-[#090A0D]">
          {!isSidebarCollapsed ? (
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[var(--status-success)] animate-pulse" />
                <span className="font-mono text-[10px] uppercase font-semibold text-slate-800 dark:text-slate-200">
                  SYSTEM ONLINE
                </span>
              </div>
              <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">v1.0.0</span>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2">
              <Tooltip content="Perluas Menu" side="right">
                <IconButton
                  icon={ChevronRight}
                  label="Perluas Menu"
                  size="sm"
                  onClick={toggleSidebar}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 h-7 w-7"
                />
              </Tooltip>
              <Tooltip content="Status: System Online (v1.0.0)" side="right">
                <div className="p-0.5 cursor-default">
                  <span className="w-2 h-2 rounded-full bg-[var(--status-success)] animate-pulse block" />
                </div>
              </Tooltip>
            </div>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
