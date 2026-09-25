import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { authService } from "@/services/authService";
import { AuthLayout } from "@/layouts/AuthLayout/AuthLayout";
import {
  Button,
  Input,
  Alert,
  Spinner,
} from "@/components/primitives";
import { FormField, FormLabel, FormErrorText } from "@/components/composites";
import { ArrowLeft, Eye, EyeOff, Check, X } from "lucide-react";

import { formatApiError } from "@/lib/errorHandler";
import {
  checkPasswordStrength,
  checkPasswordMatch,
  passwordSetupSchema,
} from "@/lib/passwordUtils";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [verifying, setVerifying] = useState(true);
  const [tokenData, setTokenData] = useState(null);
  const [verifyError, setVerifyError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(passwordSetupSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const enteredPassword = watch("password", "");
  const enteredConfirmPassword = watch("confirmPassword", "");

  const strength = checkPasswordStrength(enteredPassword);
  const matchStatus = checkPasswordMatch(enteredPassword, enteredConfirmPassword);

  useEffect(() => {
    let isMounted = true;

    async function checkToken() {
      if (!token) {
        if (isMounted) {
          setVerifying(false);
          setVerifyError({
            title: "Tautan Tidak Lengkap",
            message: "Tautan reset kata sandi tidak memiliki token valid. Silakan lakukan permintaan reset kembali.",
          });
        }
        return;
      }

      try {
        const result = await authService.verifyToken(token);
        if (isMounted) {
          if (result?.valid) {
            setTokenData(result);
          } else {
            setVerifyError(
              formatApiError(result?.reason || "Token reset kata sandi tidak valid atau telah kedaluwarsa.", "token")
            );
          }
        }
      } catch (err) {
        if (isMounted) {
          setVerifyError(formatApiError(err, "token"));
        }
      } finally {
        if (isMounted) {
          setVerifying(false);
        }
      }
    }

    checkToken();

    return () => {
      isMounted = false;
    };
  }, [token]);

  const onSubmit = async (data) => {
    setSubmitting(true);
    setSubmitError(null);

    try {
      await authService.resetPassword({
        token,
        password: data.password,
      });

      navigate("/login?reset=true", { replace: true });
    } catch (err) {
      setSubmitError(formatApiError(err, "reset-password"));
    } finally {
      setSubmitting(false);
    }
  };

  const confirmTrailingElement = (
    <div className="flex items-center gap-1.5 pr-0.5">
      {matchStatus.status === "match" && (
        <span
          title="Kata sandi cocok"
          data-testid="password-match-indicator"
          className="inline-flex items-center text-emerald-500"
        >
          <Check className="w-4 h-4" />
        </span>
      )}
      {matchStatus.status === "mismatch" && (
        <span
          title="Kata sandi belum cocok"
          data-testid="password-mismatch-indicator"
          className="inline-flex items-center text-red-400"
        >
          <X className="w-4 h-4" />
        </span>
      )}
      <button
        type="button"
        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
        aria-label={showConfirmPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
        className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
      >
        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );

  return (
    <AuthLayout
      title="Atur Ulang Kata Sandi"
      subtitle="Buat kata sandi baru untuk akun Anda"
    >
      {verifying ? (
        <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
          <Spinner size="lg" />
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">Memverifikasi keabsahan token reset...</p>
        </div>
      ) : verifyError ? (
        <div className="space-y-4">
          <Alert variant="danger" title={verifyError.title} className="text-xs">
            {verifyError.message}
          </Alert>

          <div className="pt-2 flex flex-col gap-2">
            <Link to="/forgot-password">
              <Button variant="primary" size="lg" className="w-full">
                Kirim Ulang Tautan Reset
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="outline" size="lg" className="w-full">
                Kembali ke Halaman Login
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div>
          {tokenData?.email && (
            <div className="mb-4 p-3.5 rounded-xl bg-slate-50/50 dark:bg-[#111318] border border-slate-200/80 dark:border-white/10 text-xs">
              <span className="text-[10px] text-slate-400 uppercase font-mono block">Akun</span>
              <span className="font-medium text-slate-900 dark:text-white font-mono">{tokenData.email}</span>
            </div>
          )}

          {submitError && (
            <Alert variant="danger" title={submitError.title} className="mb-4 text-xs">
              {submitError.message}
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <FormField error={!!errors.password}>
              <FormLabel htmlFor="password" required>Kata Sandi Baru</FormLabel>
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                {...register("password")}
                trailingElement={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                    className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
                placeholder="Minimal 8 karakter (kombinasi huruf & angka)"
                autoComplete="new-password"
              />
              {errors.password && <FormErrorText>{errors.password.message}</FormErrorText>}
            </FormField>

            {/* Minimal Strength Indicator */}
            {enteredPassword.length > 0 && (
              <div className="space-y-1.5 p-3 rounded-xl bg-slate-50/50 dark:bg-[#111318] border border-slate-200/80 dark:border-white/10">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 text-[11px]">Kekuatan Sandi</span>
                  <span className="font-semibold text-slate-900 dark:text-white text-xs">{strength.label}</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 h-1.5 w-full">
                  <div className={`h-full rounded-full transition-all duration-200 ${strength.score >= 1 ? strength.color : "bg-slate-200 dark:bg-zinc-800"}`} />
                  <div className={`h-full rounded-full transition-all duration-200 ${strength.score >= 2 ? strength.color : "bg-slate-200 dark:bg-zinc-800"}`} />
                  <div className={`h-full rounded-full transition-all duration-200 ${strength.score >= 3 ? strength.color : "bg-slate-200 dark:bg-zinc-800"}`} />
                </div>
              </div>
            )}

            <FormField error={!!errors.confirmPassword}>
              <FormLabel htmlFor="confirmPassword" required>Konfirmasi Kata Sandi Baru</FormLabel>
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                {...register("confirmPassword")}
                trailingElement={confirmTrailingElement}
                placeholder="Ulangi kata sandi baru"
                autoComplete="new-password"
              />
              {matchStatus.status === "match" && !errors.confirmPassword && (
                <span className="text-[11px] text-emerald-500 font-medium flex items-center gap-1 mt-1">
                  <Check className="w-3.5 h-3.5" /> Kata sandi cocok
                </span>
              )}
              {errors.confirmPassword && <FormErrorText>{errors.confirmPassword.message}</FormErrorText>}
            </FormField>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={submitting}
              className="w-full mt-4"
            >
              Perbarui Kata Sandi
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-white/5 text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-[var(--brand-primary)] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Kembali ke Halaman Login
            </Link>
          </div>
        </div>
      )}
    </AuthLayout>
  );
}

export default ResetPasswordPage;
