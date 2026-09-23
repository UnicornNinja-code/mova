import React from "react";
import { Link } from "react-router-dom";
import { useUiStore } from "@/stores/useUiStore";
import { Sun, Moon, ArrowLeft } from "lucide-react";

export function AuthLayout({
  children,
  badgeText,
  title,
  subtitle,
  maxWidth = "max-w-md",
  showBackToLogin = false,
}) {
  const { theme, toggleTheme } = useUiStore();

  return (
    <div className="min-h-screen w-full flex flex-col justify-between bg-slate-50 dark:bg-[#0B1120] text-slate-800 dark:text-slate-100 font-sans antialiased overflow-x-hidden selection:bg-blue-600 selection:text-white transition-colors">
      {/* Top Header Bar */}
      <header className="w-full px-6 sm:px-10 py-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F172A] transition-colors shrink-0">
        {/* MOVA Logo */}
        <Link to="/login" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-xs group-hover:bg-blue-700 transition-colors">
            M
          </div>
          <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
            MOVA
          </span>
        </Link>

        {/* Right controls: Theme Switcher + Version */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Ganti ke Tema Terang" : "Ganti ke Tema Gelap"}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700/80 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-50 dark:bg-slate-800/50 transition-colors cursor-pointer"
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-500" />
            )}
          </button>

          <span className="text-xs font-mono text-slate-400 dark:text-slate-500 tracking-wider">
            MOVA v1.0.0
          </span>
        </div>
      </header>

      {/* Main Centered Panel */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-auto">
        <div className={`w-full ${maxWidth}`}>
          <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs p-6 sm:p-8 transition-colors">
            {/* Card Header */}
            {(title || subtitle || badgeText) && (
              <div className="mb-6 pb-4 border-b border-slate-100 dark:border-slate-800/80">
                {badgeText && (
                  <div className="text-[11px] font-mono font-semibold tracking-wider uppercase text-blue-600 dark:text-blue-400 mb-1">
                    {badgeText}
                  </div>
                )}
                {title && (
                  <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                    {title}
                  </h1>
                )}
                {subtitle && (
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                    {subtitle}
                  </p>
                )}
              </div>
            )}

            {/* Form Content */}
            {children}

            {/* Back to Login Link */}
            {showBackToLogin && (
              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80 text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Kembali ke Halaman Login
                </Link>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer Credit */}
      <footer className="w-full px-4 py-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F172A] flex items-center justify-center text-xs text-slate-400 dark:text-slate-500 font-medium transition-colors shrink-0">
        <span>Created by Febriyan Dwi Putra</span>
      </footer>
    </div>
  );
}

export default AuthLayout;
