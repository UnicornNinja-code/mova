import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Bike, ShoppingBag, User } from "lucide-react";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const location = useLocation();

  const tabs = [
    { label: "Tugas Shift", path: "/rider", icon: Bike },
    { label: "POS & Jual", path: "/rider/pos", icon: ShoppingBag },
    { label: "Akun Saya", path: "/rider/account", icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 h-16 bg-[var(--surface)] border-t border-[var(--border)] px-4 flex items-center justify-around shadow-lg">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = location.pathname === tab.path;

        return (
          <Link
            key={tab.path}
            to={tab.path}
            className={cn(
              "flex flex-col items-center justify-center flex-1 h-full py-1 text-xs font-medium transition-colors select-none",
              isActive
                ? "text-[var(--accent-primary)] font-bold"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            )}
          >
            <div className={cn("p-1 rounded-full transition-transform", isActive && "bg-[var(--accent-primary)]/10 scale-110")}>
              <Icon className="w-5 h-5" />
            </div>
            <span className="text-[11px] mt-0.5">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function RiderShell({ children }) {
  return (
    <div className="flex flex-col min-h-screen bg-[var(--background)] pb-20">
      {/* Rider Minimal Mobile Header */}
      <header className="sticky top-0 z-30 h-14 bg-[var(--surface)] border-b border-[var(--border)] px-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-[var(--radius-sm)] bg-[var(--accent-primary)] flex items-center justify-center text-white font-mono font-bold text-xs">
            M
          </div>
          <span className="text-xs font-bold font-mono tracking-wider text-[var(--text-primary)]">
            MOVA RIDER
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
          <span className="w-2 h-2 rounded-full bg-[var(--status-success)] animate-pulse" />
          <span>Sidoarjo</span>
        </div>
      </header>

      {/* Main Action Content Area */}
      <main className="flex-1 p-4 max-w-md mx-auto w-full">
        {children}
      </main>

      {/* Bottom 3-Tab Nav */}
      <BottomNav />
    </div>
  );
}
