import React from "react";
import { useUiStore } from "@/stores/useUiStore";
import { Sun, Moon } from "lucide-react";
import { Panel } from "@/components/primitives";

export function AuthLayout({
  children,
  badgeText = "SIDOARJO REGION • HUB-01",
  title = "MOVA CONTROL ROOM",
  subtitle = "Sidoarjo Operational Command & Decision Support System",
  maxWidth = "max-w-md",
}) {
  const { theme, toggleTheme } = useUiStore();

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between bg-[var(--background)] overflow-x-hidden selection:bg-[var(--accent-primary)] selection:text-white">
      {/* Subtle Precision Grid Background */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.05]"
        style={{
          backgroundImage: `linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)`,
          backgroundSize: "32px 32px",
        }}
        aria-hidden="true"
      />

      {/* Top Header Bar */}
      <header className="relative z-10 w-full px-4 sm:px-8 py-3.5 flex items-center justify-between border-b border-[var(--border-subtle)]">
        {/* System Location & Status */}
        <div className="flex items-center gap-2 text-xs font-mono text-[var(--text-secondary)]">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
          <span className="tracking-wide uppercase">{badgeText}</span>
        </div>

        {/* Minimal Theme Switcher */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Ganti ke Tema Terang" : "Ganti ke Tema Gelap"}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-sm)] bg-[var(--surface-raised)] hover:bg-[var(--surface-muted)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
        >
          {theme === "dark" ? (
            <>
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-mono text-[11px]">Light</span>
            </>
          ) : (
            <>
              <Moon className="w-3.5 h-3.5 text-indigo-500" />
              <span className="font-mono text-[11px]">Dark</span>
            </>
          )}
        </button>
      </header>

      {/* Main Centered Panel */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6 my-auto">
        <div className={`w-full ${maxWidth}`}>
          <Panel className="p-6 sm:p-8 bg-[var(--surface)] border-[var(--border)] shadow-md rounded-[var(--radius-lg)]">
            {/* Brand Header */}
            <div className="flex items-center gap-3.5 mb-6 pb-4 border-b border-[var(--border-subtle)]">
              <div className="w-9 h-9 rounded-[var(--radius-sm)] bg-[var(--accent-primary)] flex items-center justify-center text-white font-mono font-bold text-base shadow-xs shrink-0">
                M
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-base font-bold text-[var(--text-primary)] tracking-tight truncate">
                  {title}
                </h1>
                <p className="text-xs text-[var(--text-muted)] truncate">
                  {subtitle}
                </p>
              </div>
            </div>

            {/* Form Content */}
            {children}
          </Panel>
        </div>
      </main>

      {/* Footer System Telemetry */}
      <footer className="relative z-10 w-full px-4 py-3 border-t border-[var(--border-subtle)] flex flex-col sm:flex-row items-center justify-between gap-1 text-[11px] font-mono text-[var(--text-muted)]">
        <div>
          <span>MOVA Decision Support System</span>
        </div>
        <div>
          <span>v1.0.0-PROD</span>
        </div>
      </footer>
    </div>
  );
}

export default AuthLayout;
