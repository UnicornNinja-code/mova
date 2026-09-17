import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { authService } from "@/services/authService";
import { AuthLayout } from "@/layouts/AuthLayout/AuthLayout";
import {
  Button,
  Input,
  Alert,
  Spinner,
} from "@/components/primitives";
import { FormField, FormLabel, FormErrorText, FormHelperText } from "@/components/composites";
import { ArrowLeft, Eye, EyeOff, RotateCcw, Check, X } from "lucide-react";
import { formatApiError } from "@/lib/errorHandler";
import {
  checkPasswordStrength,
  checkPasswordMatch,
} from "@/lib/passwordUtils";

const activationSchema = z
  .object({
    name: z.string().min(1, "Nama lengkap wajib diisi"),
    phone: z.string().optional(),
    password: z
      .string()
      .min(8, "Kata sandi minimal 8 karakter")
      .regex(/[A-Z]/, "Harus mengandung minimal 1 huruf kapital")
      .regex(/[a-z]/, "Harus mengandung minimal 1 huruf kecil")
      .regex(/[0-9]/, "Harus mengandung minimal 1 angka"),
    confirmPassword: z.string().min(1, "Konfirmasi kata sandi wajib diisi"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Konfirmasi kata sandi tidak cocok",
    path: ["confirmPassword"],
  });

export function ActivatePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialToken = searchParams.get("token") || "";

  const [inputToken, setInputToken] = useState(initialToken);
  const [verifiedToken, setVerifiedToken] = useState(null);
  const [tokenData, setTokenData] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(activationSchema),
    defaultValues: {
      name: "",
      phone: "",
      password: "",
      confirmPassword: "",
    },
  });

  const enteredPassword = watch("password", "");
  const enteredConfirmPassword = watch("confirmPassword", "");

  const strength = checkPasswordStrength(enteredPassword);
  const matchStatus = checkPasswordMatch(enteredPassword, enteredConfirmPassword);

  const performVerification = async (tokenToVerify) => {
    if (!tokenToVerify || !tokenToVerify.trim()) {
      setVerifyError({
        title: "Token Belum Diisi",
        message: "Silakan masukkan token aktivasi akun staf yang Anda terima.",
      });
      return;
    }

    setVerifying(true);
    setVerifyError(null);

    try {
      const result = await authService.verifyToken(tokenToVerify.trim());
      if (result?.valid) {
        setVerifiedToken(tokenToVerify.trim());
        setTokenData(result);
        if (result.name) {
          setValue("name", result.name);
        }
      } else {
        setVerifyError(
          formatApiError(result?.reason || "Token aktivasi tidak valid atau telah kedaluwarsa.", "token")
        );
      }
    } catch (err) {
      setVerifyError(formatApiError(err, "token"));
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    if (initialToken) {
      performVerification(initialToken);
    }
  }, [initialToken]);

  const handleManualVerify = (e) => {
    e.preventDefault();
    performVerification(inputToken);
  };

  const handleResetToken = () => {
    setVerifiedToken(null);
    setTokenData(null);
    setVerifyError(null);
    setSearchParams({});
  };

  const onSubmit = async (data) => {
    if (!verifiedToken) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      await authService.activateAccount({
        token: verifiedToken,
        name: data.name,
        phone: data.phone,
        password: data.password,
      });

      navigate("/login?activated=true", { replace: true });
    } catch (err) {
      setSubmitError(formatApiError(err, "activation"));
    } finally {
      setSubmitting(false);
    }
  };

  const confirmTrailingElement = (
    <div className="flex items-center gap-1.5 pr-0.5">
      {matchStatus.status === "match" && (
        <span
          title="Kata sandi cocok"
          data-testid="activate-match-indicator"
          className="inline-flex items-center text-emerald-500"
        >
          <Check className="w-4 h-4" />
        </span>
      )}
      {matchStatus.status === "mismatch" && (
        <span
          title="Kata sandi belum cocok"
          data-testid="activate-mismatch-indicator"
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
      title="Aktivasi Akun Staf"
      subtitle="Verifikasi token dan lengkapi kredensial akun Anda"
    >
      {verifying ? (
        <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
          <Spinner size="lg" />
          <p className="text-xs text-[var(--text-muted)] font-mono">Memverifikasi keabsahan token aktivasi...</p>
        </div>
      ) : !verifiedToken ? (
        /* ════════════════════════════════════════════════════════════
           TAHAP 1: INPUT & VERIFIKASI TOKEN AKTIVASI
           ════════════════════════════════════════════════════════════ */
        <div className="space-y-4">
          <div className="text-xs text-[var(--text-secondary)] leading-relaxed">
            Masukkan token aktivasi yang Anda terima dari Administrator untuk mengaktifkan akun staf MOVA.
          </div>

          {verifyError && (
            <Alert variant="danger" title={verifyError.title} className="text-xs">
              {verifyError.message}
            </Alert>
          )}

          <form onSubmit={handleManualVerify} className="space-y-4">
            <FormField>
              <FormLabel htmlFor="activation-token" required>Token Aktivasi Staf</FormLabel>
              <Input
                id="activation-token"
                value={inputToken}
                onChange={(e) => setInputToken(e.target.value)}
                placeholder="Tempel atau ketik kode token aktivasi"
                autoComplete="off"
                required
              />
              <FormHelperText>
                Token 64-karakter yang tercantum pada surat/pesan undangan.
              </FormHelperText>
            </FormField>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={verifying}
              className="w-full mt-2"
            >
              Verifikasi & Lanjutkan
            </Button>
          </form>

          <div className="mt-5 pt-3 border-t border-[var(--border-subtle)] text-center">
            <Link
              to="/login"
              className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Sudah punya akun aktif? <span className="text-[var(--accent-primary)] font-medium">Masuk ke Login</span>
            </Link>
          </div>
        </div>
      ) : (
        /* ════════════════════════════════════════════════════════════
           TAHAP 2: PENGISIAN PROFIL & PEMBUATAN KATA SANDI BARU
           ════════════════════════════════════════════════════════════ */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-primary)]">
              Lengkapi Data Akun
            </span>
            <button
              type="button"
              onClick={handleResetToken}
              className="text-[11px] font-mono text-[var(--text-muted)] hover:text-[var(--accent-primary)] flex items-center gap-1 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Ganti Token
            </button>
          </div>

          {/* Account Metadata Bar */}
          {tokenData?.email && (
            <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--surface-raised)] border border-[var(--border-subtle)] flex items-center justify-between text-xs">
              <div>
                <span className="text-[10px] text-[var(--text-muted)] uppercase font-mono block">Email</span>
                <span className="font-medium text-[var(--text-primary)] font-mono">{tokenData.email}</span>
              </div>
              {tokenData.role && (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border border-[var(--accent-primary)]/20">
                  {tokenData.role}
                </span>
              )}
            </div>
          )}

          {submitError && (
            <Alert variant="danger" title={submitError.title} className="text-xs">
              {submitError.message}
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <FormField error={!!errors.name}>
              <FormLabel htmlFor="name" required>Nama Lengkap</FormLabel>
              <Input
                id="name"
                {...register("name")}
                placeholder="Masukkan nama lengkap Anda"
                autoComplete="name"
              />
              {errors.name && <FormErrorText>{errors.name.message}</FormErrorText>}
            </FormField>

            <FormField error={!!errors.phone}>
              <FormLabel htmlFor="phone">Nomor Telepon</FormLabel>
              <Input
                id="phone"
                {...register("phone")}
                placeholder="08123456789 (opsional)"
                autoComplete="tel"
              />
            </FormField>

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
                    className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
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
              <div className="space-y-1.5 p-2.5 rounded-[var(--radius-sm)] bg-[var(--surface-raised)] border border-[var(--border-subtle)]">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text-muted)] text-[11px]">Kekuatan Sandi</span>
                  <span className="font-semibold text-[var(--text-primary)] text-xs">{strength.label}</span>
                </div>
                <div className="grid grid-cols-3 gap-1 h-1 w-full">
                  <div className={`h-full rounded-full transition-all duration-200 ${strength.score >= 1 ? strength.color : "bg-zinc-700/40"}`} />
                  <div className={`h-full rounded-full transition-all duration-200 ${strength.score >= 2 ? strength.color : "bg-zinc-700/40"}`} />
                  <div className={`h-full rounded-full transition-all duration-200 ${strength.score >= 3 ? strength.color : "bg-zinc-700/40"}`} />
                </div>
              </div>
            )}

            <FormField error={!!errors.confirmPassword}>
              <FormLabel htmlFor="confirmPassword" required>Konfirmasi Kata Sandi</FormLabel>
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
              className="w-full mt-2"
            >
              Aktifkan Akun Saya
            </Button>
          </form>

          <div className="mt-5 pt-3 border-t border-[var(--border-subtle)] text-center">
            <Link
              to="/login"
              className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Sudah punya akun? <span className="text-[var(--accent-primary)] font-medium">Masuk ke Login</span>
            </Link>
          </div>
        </div>
      )}
    </AuthLayout>
  );
}

export default ActivatePage;
