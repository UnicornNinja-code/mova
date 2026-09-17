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
          "flex flex-col h-screen border-r border-[var(--border-subtle)] bg-[var(--surface)] transition-all duration-200 select-none z-20 shrink-0",
          isSidebarCollapsed ? "w-18" : "w-64",
          className
        )}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-[var(--border-subtle)] bg-[var(--surface)]">
          {!isSidebarCollapsed ? (
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-[var(--radius-md)] bg-[var(--accent-primary)] flex items-center justify-center text-white shrink-0 font-bold font-mono text-sm shadow-xs">
                M
              </div>
              <div className="min-w-0">
                <span className="font-bold text-sm tracking-tight text-[var(--text-primary)] block leading-none">
                  MOVA CONTROL
                </span>
                <span className="text-[10px] text-[var(--text-muted)] tracking-wider uppercase font-mono block mt-1">
                  Sidoarjo Hub
                </span>
              </div>
            </div>
          ) : (
            <div className="w-8 h-8 mx-auto rounded-[var(--radius-md)] bg-[var(--accent-primary)] flex items-center justify-center text-white font-bold font-mono text-sm shadow-xs">
              M
            </div>
          )}

          <IconButton
            icon={isSidebarCollapsed ? ChevronRight : ChevronLeft}
            label={isSidebarCollapsed ? "Perluas Menu" : "Kecilkan Menu"}
            size="sm"
            onClick={toggleSidebar}
            className={cn("text-[var(--text-muted)] hover:text-[var(--text-primary)]", isSidebarCollapsed ? "hidden md:flex mx-auto mt-2" : "")}
          />
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
                  <div className="px-3 py-1 text-[10px] font-bold tracking-widest text-[var(--text-muted)] uppercase font-mono">
                    {pillar.title}
                  </div>
                ) : (
                  <div className="h-[1px] bg-[var(--border-subtle)] my-2 mx-1" />
                )}

                <div className="space-y-1">
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(`${item.path}/`));

                    const linkContent = (
                      <Link
                        to={item.path}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-[var(--radius-md)] text-xs font-medium transition-all duration-150 cursor-pointer",
                          isActive
                            ? "bg-[var(--accent-primary)] text-white shadow-xs font-semibold"
                            : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-raised)]",
                          isSidebarCollapsed ? "justify-center px-0 h-10 w-10 mx-auto" : ""
                        )}
                      >
                        <Icon className={cn("w-4 h-4 shrink-0 transition-colors", isActive ? "text-white" : "text-[var(--text-muted)] group-hover:text-[var(--text-primary)]")} />
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
        <div className="p-3.5 border-t border-[var(--border-subtle)] bg-[var(--surface)]">
          {!isSidebarCollapsed ? (
            <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[var(--status-success)] animate-pulse" />
                <span className="font-mono text-[10px] uppercase font-semibold text-[var(--text-primary)]">
                  SYSTEM ONLINE
                </span>
              </div>
              <span className="font-mono text-[10px] text-[var(--text-muted)]">v1.0.0</span>
            </div>
          ) : (
            <div className="flex justify-center">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--status-success)] animate-pulse" title="System Online" />
            </div>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
