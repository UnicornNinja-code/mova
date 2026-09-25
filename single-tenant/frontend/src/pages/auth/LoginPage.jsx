import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, useSearchParams, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuthStore } from "@/stores/useAuthStore";
import { useUiStore } from "@/stores/useUiStore";
import { authService } from "@/services/authService";
import { Alert, ThemeToggle } from "@/components/primitives";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
} from "lucide-react";
import { formatApiError } from "@/lib/errorHandler";

const loginSchema = z.object({
  identifier: z.string().min(1, "Username atau email wajib diisi"),
  password: z.string().min(1, "Kata sandi wajib diisi"),
});

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const setAuth = useAuthStore((state) => state.setAuth);
  const { theme } = useUiStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successNotice, setSuccessNotice] = useState(null);
  const [warningNotice, setWarningNotice] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: "",
      password: "",
    },
  });

  useEffect(() => {
    if (searchParams.get("activated") === "true") {
      setSuccessNotice("Akun staf Anda telah berhasil diaktifkan. Silakan login dengan kata sandi baru Anda.");
    } else if (searchParams.get("reset") === "true") {
      setSuccessNotice("Kata sandi berhasil diperbarui. Silakan masuk dengan kredensial baru Anda.");
    } else if (searchParams.get("reason") === "session_expired") {
      setWarningNotice("Sesi login Anda telah berakhir. Silakan masuk kembali untuk melanjutkan.");
    } else if (searchParams.get("reason") === "idle_timeout") {
      setWarningNotice("Sesi Anda telah berakhir karena tidak ada aktivitas. Silakan masuk kembali.");
    }
  }, [searchParams]);

  const onSubmit = async (data) => {
    setLoading(true);
    setError(null);

    try {
      const response = await authService.login({
        username: data.identifier,
        password: data.password,
      });

      setAuth(response.token, response.user, response.refreshToken);

      const fromPath = location.state?.from?.pathname;
      if (response.user?.first_login) {
        navigate("/first-login");
      } else if (fromPath && fromPath !== "/login" && fromPath !== "/first-login") {
        navigate(fromPath);
      } else if (response.user?.role === "RIDER") {
        navigate("/rider");
      } else {
        navigate("/overview");
      }
    } catch (err) {
      setError(formatApiError(err, "login"));
    } finally {
      setLoading(false);
    }
  };

  const isDark = theme === "dark";
  const bgImage = isDark ? "/assets/img/dark_mode.jpg" : "/assets/img/light_mode.jpg";

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#F8FAFC] dark:bg-[#090A0D] text-slate-800 dark:text-slate-100 font-sans antialiased overflow-x-hidden selection:bg-[var(--brand-primary)] selection:text-white">
      {/* ---------------- SISI KIRI: HERO SECTION 60% ---------------- */}
      <div
        className="relative hidden lg:flex lg:w-[60%] flex-col justify-between p-10 xl:p-14 2xl:p-16 overflow-hidden bg-cover bg-center shrink-0 transition-all duration-500"
        style={{ backgroundImage: `url('${bgImage}')` }}
      >
        {/* Subtle Ambient Lighting Overlay */}
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
            Sistem pendukung keputusan  zona operasional lokasi penjualan kopi keliling.
          </p>
        </div>
      </div>

      {/* ---------------- SISI KANAN: PANEL FORM LOGIN 40% ---------------- */}
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

        {/* Center Login Form Container */}
        <div className="w-full max-w-sm sm:max-w-md mx-auto my-auto py-8">
          {/* Clean Heading */}
          <h2 className="text-2xl font-heading font-semibold text-slate-900 dark:text-white tracking-tight">
            Login
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 mb-6">
            Masukkan kredensial akun Anda untuk mengakses sistem.
          </p>

          {/* Status Notices */}
          {successNotice && (
            <Alert variant="success" className="mb-4 text-xs">
              {successNotice}
            </Alert>
          )}

          {warningNotice && (
            <Alert variant="warning" className="mb-4 text-xs">
              {warningNotice}
            </Alert>
          )}

          {error && (
            <Alert variant="danger" title={error.title} className="mb-4 text-xs">
              {error.message}
            </Alert>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label
                htmlFor="identifier"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Username atau Email <span className="text-[var(--brand-primary)]">*</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="identifier"
                  type="text"
                  {...register("identifier")}
                  placeholder="superadmin@kopigo.id"
                  autoComplete="username"
                  className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl border text-sm transition-all shadow-xs bg-slate-50/50 dark:bg-[#111318] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-[#111318] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)] ${errors.identifier ? "border-red-500 focus:ring-red-500/20" : "border-slate-200 dark:border-white/10"
                    }`}
                />
              </div>
              {errors.identifier && (
                <p className="text-xs text-red-500 mt-1 font-medium">{errors.identifier.message}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Kata Sandi <span className="text-[var(--brand-primary)]">*</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  {...register("password")}
                  placeholder="Masukkan kata sandi"
                  autoComplete="current-password"
                  className={`w-full pl-10 pr-10 py-2.5 rounded-xl border text-sm transition-all shadow-xs bg-slate-50/50 dark:bg-[#111318] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-[#111318] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)] ${errors.password ? "border-red-500 focus:ring-red-500/20" : "border-slate-200 dark:border-white/10"
                    }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer p-0.5"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-red-500 mt-1 font-medium">{errors.password.message}</p>
              )}

              <div className="flex justify-end mt-1.5">
                <Link
                  to="/forgot-password"
                  className="text-xs text-[var(--brand-primary)] hover:underline font-medium transition-colors"
                >
                  Lupa kata sandi?
                </Link>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-5 py-2.5 px-4 rounded-xl bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] active:bg-[var(--brand-primary-active)] text-white font-heading font-medium text-sm transition-colors duration-150 flex items-center justify-center gap-2 shadow-sm shadow-red-500/20 disabled:opacity-60 cursor-pointer"
            >
              {loading ? (
                "Memproses..."
              ) : (
                <>
                  Masuk <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Staff Activation Invitation Link */}
          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-white/5 text-center">
            <Link
              to="/activate"
              className="text-xs text-slate-500 dark:text-slate-400 hover:text-[var(--brand-primary)] transition-colors"
            >
              Punya token aktivasi akun staf?{" "}
              <span className="text-[var(--brand-primary)] font-medium hover:underline">
                Aktivasi di sini
              </span>
            </Link>
          </div>
        </div>

        {/* Footer Credit */}
        <div className="text-center pt-4 text-xs text-slate-400 dark:text-slate-500 font-normal">
          <span>KopiGo &bull; Created by Febriyan Dwi Putra</span>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
