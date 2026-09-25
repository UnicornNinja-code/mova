import React from "react";
import { useUiStore } from "@/stores/useUiStore";
import { Sun, Moon } from "lucide-react";
import clsx from "clsx";

/**
 * Modern KopiGo Pill Theme Toggle Switch (28px x 56px)
 * Smooth animated slider with integrated dynamic Sun/Moon indicators
 */
export function ThemeToggle({ className = "", size = "default" }) {
  const { theme, toggleTheme } = useUiStore();
  const isDark = theme === "dark";

  const handleKeyDown = (e) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      toggleTheme();
    }
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? "Beralih ke Tema Terang (Light Mode)" : "Beralih ke Tema Gelap (Dark Mode)"}
      onClick={toggleTheme}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      className={clsx(
        "relative inline-flex items-center h-7 w-14 rounded-full p-0.5 transition-colors duration-300 cursor-pointer select-none",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]",
        isDark
          ? "bg-[#161F30] border border-slate-700/80 shadow-inner"
          : "bg-slate-200/90 border border-slate-300/80 shadow-inner",
        className
      )}
    >
      {/* Background Icons Container */}
      <div className="absolute inset-0 flex items-center justify-between px-1.5 pointer-events-none">
        {/* Sun indicator on left */}
        <span
          className={clsx(
            "flex items-center justify-center transition-all duration-300",
            isDark
              ? "opacity-90 scale-100 text-amber-400"
              : "opacity-0 scale-75 text-slate-400"
          )}
        >
          <Sun className="w-3.5 h-3.5" strokeWidth={2.5} />
        </span>

        {/* Moon indicator on right */}
        <span
          className={clsx(
            "flex items-center justify-center transition-all duration-300",
            !isDark
              ? "opacity-90 scale-100 text-slate-600"
              : "opacity-0 scale-75 text-slate-500"
          )}
        >
          <Moon className="w-3.5 h-3.5" strokeWidth={2.5} />
        </span>
      </div>

      {/* Sliding Knob / Thumb */}
      <span
        className={clsx(
          "relative z-10 w-[22px] h-[22px] rounded-full transition-transform duration-300 ease-in-out flex items-center justify-center shadow-md",
          isDark
            ? "translate-x-[28px] bg-slate-900 border border-slate-700 text-amber-300 shadow-slate-950/50"
            : "translate-x-0.5 bg-white text-slate-600 shadow-slate-400/40"
        )}
      >
        {isDark ? (
          <Moon className="w-2.5 h-2.5 fill-amber-300/20 text-amber-300" strokeWidth={2.5} />
        ) : (
          <Sun className="w-2.5 h-2.5 text-amber-500" strokeWidth={2.5} />
        )}
      </span>
    </button>
  );
}

export default ThemeToggle;
