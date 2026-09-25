import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/primitives";
import { useUiStore } from "@/stores/useUiStore";

export function AuthLayout({
  children,
  badgeText,
  title,
  subtitle,
  maxWidth = "max-w-md",
  showBackToLogin = false,
}) {
  const { theme } = useUiStore();
  const isDark = theme === "dark";
  const bgImage = isDark ? "/assets/img/dark_mode.jpg" : "/assets/img/light_mode.jpg";

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#F8FAFC] dark:bg-[#090A0D] text-slate-800 dark:text-slate-100 font-sans antialiased overflow-x-hidden selection:bg-[var(--brand-primary)] selection:text-white">
      {/* ---------------- SISI KIRI: HERO SECTION 60% ---------------- */}
      <div
        className="relative hidden lg:flex lg:w-[60%] flex-col justify-between p-10 xl:p-14 2xl:p-16 overflow-hidden bg-cover bg-center shrink-0 transition-all duration-500"
        style={{ backgroundImage: `url('${bgImage}')` }}
      >
        {/* Subtle Ambient Overlay */}
        <div className="absolute inset-0 bg-slate-950/15 dark:bg-black/35 pointer-events-none" />

        {/* Brand Tag (Top Left) */}
        <div className="relative z-10 flex items-center gap-3">
          <img
            src="/assets/img/kopigo_logo.jpg"
            alt="KopiGo Logo"
            className="w-10 h-10 rounded-xl object-cover shadow-sm ring-1 ring-white/20"
          />
          <span className="text-xl font-heading font-medium tracking-tight text-slate-900 dark:text-white">
            KopiGo
          </span>
        </div>

        {/* Editorial Minimalist Headline (Bottom) */}
        <div className="relative z-10 mt-auto max-w-xl">
          <h1 className="text-3xl sm:text-4xl xl:text-5xl font-heading font-medium leading-[1.2] tracking-tight text-slate-900 dark:text-white">
            Mobilitas Kopi,<br />
            <span className="text-[var(--brand-primary)]">Presisi Setiap Langkah.</span>
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300/80 font-normal mt-3 max-w-md leading-relaxed">
            Sistem pendukung keputusan rute dan zonasi operasional barista keliling bertema Kopi Sejuta Jiwa.
          </p>
        </div>
      </div>

      {/* ---------------- SISI KANAN: PANEL FORM AUTH 40% ---------------- */}
      <div className="w-full lg:w-[40%] min-h-screen flex flex-col justify-between p-6 sm:p-10 lg:p-12 xl:p-14 bg-white dark:bg-[#090A0D] border-l border-slate-200/80 dark:border-white/5 transition-colors shrink-0">
        {/* Top Header Controls */}
        <div className="flex items-center justify-between w-full">
          {/* Mobile Logo Fallback */}
          <div className="flex lg:hidden items-center gap-2.5">
            <img
              src="/assets/img/kopigo_logo.jpg"
              alt="KopiGo Logo"
              className="w-8 h-8 rounded-lg object-cover shadow-xs"
            />
            <span className="text-lg font-heading font-medium tracking-tight text-slate-900 dark:text-white">
              KopiGo
            </span>
          </div>

          <div className="hidden lg:block">{/* Spacer */}</div>

          <div className="flex items-center gap-3 ml-auto">
            <ThemeToggle />
          </div>
        </div>

        {/* Center Panel Container */}
        <div className="w-full max-w-sm sm:max-w-md mx-auto my-auto py-8">
          {/* Header */}
          {(title || subtitle || badgeText) && (
            <div className="mb-6">
              {badgeText && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium tracking-wide uppercase bg-[var(--brand-subtle)] text-[var(--brand-primary)] ring-1 ring-[var(--brand-primary)]/20 mb-2">
                  {badgeText}
                </div>
              )}
              {title && (
                <h1 className="text-2xl font-heading font-semibold text-slate-900 dark:text-white tracking-tight">
                  {title}
                </h1>
              )}
              {subtitle && (
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  {subtitle}
                </p>
              )}
            </div>
          )}

          {/* Form Content */}
          <div>{children}</div>

          {/* Back to Login Link */}
          {showBackToLogin && (
            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-white/5 text-center">
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-[var(--brand-primary)] font-medium transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Kembali ke Halaman Login
              </Link>
            </div>
          )}
        </div>

        {/* Footer Credit */}
        <div className="text-center pt-4 text-xs text-slate-400 dark:text-slate-500 font-normal">
          <span>KopiGo &bull; Created by Febriyan Dwi Putra</span>
        </div>
      </div>
    </div>
  );
}

export default AuthLayout;
