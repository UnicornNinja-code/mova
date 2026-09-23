import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, useSearchParams, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuthStore } from "@/stores/useAuthStore";
import { useUiStore } from "@/stores/useUiStore";
import { authService } from "@/services/authService";
import { Alert } from "@/components/primitives";
import { TurnstileWidget } from "@/components/composites";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  MapPin,
  Brain,
  Bike,
  BarChart2,
  Sun,
  Moon,
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
  const { theme, toggleTheme } = useUiStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successNotice, setSuccessNotice] = useState(null);
  const [warningNotice, setWarningNotice] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");

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
        turnstileToken,
      });

      setAuth(response.token, response.user);

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

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-slate-50 dark:bg-[#0B1120] text-slate-800 dark:text-slate-100 font-sans antialiased overflow-x-hidden selection:bg-blue-600 selection:text-white">
      {/* ---------------- SISI KIRI: HERO SPASIAL MOVA (PORSI 60%) ---------------- */}
      <div
        className="relative hidden lg:flex lg:w-[60%] flex-col justify-between p-8 xl:p-12 2xl:p-16 text-white bg-slate-950 overflow-hidden shrink-0"
        style={{
          backgroundImage: "url('/assets/img/movabg.png')",
          backgroundSize: "cover",
          backgroundPosition: "right center",
          backgroundRepeat: "no-repeat",
        }}
      >
        {/* Spatial Deep Midnight Blue Overlays: Keeping map polygons clear on right while ensuring high contrast for text on left/bottom */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#040812]/95 via-[#060D1A]/70 to-[#081122]/80 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#040812]/90 via-[#060D1A]/50 to-transparent pointer-events-none" />

        <div className="relative z-10 flex flex-col justify-between h-full">
          {/* Top Brand Tag */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-blue-500/25 shrink-0">
              M
            </div>
            <div>
              <div className="text-xl font-bold tracking-tight text-white leading-tight">MOVA</div>
              <div className="text-xs text-blue-200/80 font-normal tracking-wide">
                Mobile Operations &amp; Visibility Application
              </div>
            </div>
          </div>

          {/* Lower Hero Copy: Pushed to lower quadrant so upper map polygons are visible */}
          <div className="mt-auto mb-10 max-w-2xl">
            <h1 className="text-3xl xl:text-4xl 2xl:text-5xl font-extrabold text-white leading-[1.18] tracking-tight">
              Keputusan yang tepat untuk operasi yang{" "}
              <span className="text-blue-500">lebih baik</span>
            </h1>
            <p className="text-sm xl:text-base text-slate-300/90 leading-relaxed mt-5 max-w-xl">
              MOVA membantu mengelola data spasial, menganalisis kondisi operasional, dan mendistribusikan armada secara lebih efisien untuk mendukung bisnis penjualan keliling.
            </p>
          </div>

          {/* Bottom 4 Feature Badges */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-6 pt-8 border-t border-slate-700/50">
            <div>
              <div className="w-8 h-8 rounded-md bg-blue-500/10 flex items-center justify-center mb-2.5">
                <MapPin className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-sm font-bold text-white tracking-tight">Data Spasial</div>
              <div className="text-xs text-slate-400 mt-1 leading-snug">
                POI, jalan, kompetitor, &amp; kondisi lingkungan
              </div>
            </div>

            <div>
              <div className="w-8 h-8 rounded-md bg-blue-500/10 flex items-center justify-center mb-2.5">
                <Brain className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-sm font-bold text-white tracking-tight">DSS Hybrid</div>
              <div className="text-xs text-slate-400 mt-1 leading-snug">
                BWM - TOPSIS untuk rekomendasi zona
              </div>
            </div>

            <div>
              <div className="w-8 h-8 rounded-md bg-blue-500/10 flex items-center justify-center mb-2.5">
                <Bike className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-sm font-bold text-white tracking-tight">Armada &amp; Distribusi</div>
              <div className="text-xs text-slate-400 mt-1 leading-snug">
                Pengelolaan rider, assignment, dan rute
              </div>
            </div>

            <div>
              <div className="w-8 h-8 rounded-md bg-blue-500/10 flex items-center justify-center mb-2.5">
                <BarChart2 className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-sm font-bold text-white tracking-tight">Monitoring</div>
              <div className="text-xs text-slate-400 mt-1 leading-snug">
                Pantau real-time dan evaluasi kinerja
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ---------------- SISI KANAN: FORM LOGIN (PORSI 40%) ---------------- */}
      <div className="w-full lg:w-[40%] min-h-screen flex flex-col justify-between p-6 sm:p-8 lg:p-12 xl:p-16 bg-white dark:bg-[#0F172A] border-l border-slate-200 dark:border-slate-800 transition-colors shrink-0">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between w-full">
          {/* Mobile Logo Fallback */}
          <div className="flex lg:hidden items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-xs">
              M
            </div>
            <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">MOVA</span>
          </div>

          <div className="hidden lg:block">
            {/* Spacer */}
          </div>

          <div className="flex items-center gap-3 ml-auto">
            {/* Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Ganti ke Tema Terang" : "Ganti ke Tema Gelap"}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700/80 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-50 dark:bg-slate-800/50 transition-colors cursor-pointer"
            >
              {theme === "dark" ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
            </button>

            {/* Version Badge */}
            <span className="text-xs font-mono text-slate-400 dark:text-slate-500 tracking-wider">
              MOVA v1.0.0
            </span>
          </div>
        </div>

        {/* Center Login Form Container */}
        <div className="w-full max-w-sm xl:max-w-md mx-auto my-auto py-8">
          {/* Heading */}
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Login
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 mb-6 leading-relaxed">
            Gunakan akun Anda untuk mengakses sistem operasional MOVA.
          </p>

          {/* Status Notices */}
          {successNotice && (
            <Alert variant="success" className="mb-5 text-xs">
              {successNotice}
            </Alert>
          )}

          {warningNotice && (
            <Alert variant="warning" className="mb-5 text-xs">
              {warningNotice}
            </Alert>
          )}

          {error && (
            <Alert variant="danger" title={error.title} className="mb-5 text-xs">
              {error.message}
            </Alert>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label htmlFor="identifier" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Username atau Email <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="identifier"
                  type="text"
                  {...register("identifier")}
                  placeholder="superadmin@kopikeliling.com"
                  autoComplete="username"
                  className={`w-full pl-10 pr-3.5 py-2.5 rounded-lg border text-sm transition-all shadow-xs bg-slate-50/60 dark:bg-slate-900/90 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-400/20 focus:border-blue-600 dark:focus:border-blue-500 ${
                    errors.identifier ? "border-red-500 focus:ring-red-500/20" : "border-slate-300 dark:border-slate-700"
                  }`}
                />
              </div>
              {errors.identifier && (
                <p className="text-xs text-red-500 mt-1 font-medium">{errors.identifier.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Kata Sandi <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  {...register("password")}
                  placeholder="Masukkan kata sandi"
                  autoComplete="current-password"
                  className={`w-full pl-10 pr-10 py-2.5 rounded-lg border text-sm transition-all shadow-xs bg-slate-50/60 dark:bg-slate-900/90 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-400/20 focus:border-blue-600 dark:focus:border-blue-500 ${
                    errors.password ? "border-red-500 focus:ring-red-500/20" : "border-slate-300 dark:border-slate-700"
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
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium transition-colors"
                >
                  Lupa kata sandi?
                </Link>
              </div>
            </div>

            <TurnstileWidget
              size="invisible"
              onVerify={(token) => setTurnstileToken(token)}
              onError={() => setTurnstileToken("")}
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-6 py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-sm transition-all duration-150 flex items-center justify-center gap-2 shadow-sm shadow-blue-500/25 disabled:opacity-60 cursor-pointer"
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
          <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800/80 text-center">
            <Link
              to="/activate"
              className="text-xs text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              Punya token aktivasi akun staf?{" "}
              <span className="text-blue-600 dark:text-blue-400 font-semibold">Aktivasi di sini</span>
            </Link>
          </div>
        </div>

        {/* Footer Credit */}
        <div className="flex items-center justify-center pt-6 text-xs text-slate-400 dark:text-slate-500 font-medium">
          <span>Created by Febriyan Dwi Putra</span>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
