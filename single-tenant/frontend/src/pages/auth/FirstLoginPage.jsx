import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuthStore } from "@/stores/useAuthStore";
import { authService } from "@/services/authService";
import { AuthLayout } from "@/layouts/AuthLayout/AuthLayout";
import {
  Button,
  Input,
  Alert,
} from "@/components/primitives";
import { FormField, FormLabel, FormErrorText } from "@/components/composites";
import { Eye, EyeOff, Check, X } from "lucide-react";

import { formatApiError } from "@/lib/errorHandler";
import {
  checkPasswordStrength,
  checkPasswordMatch,
  passwordRequirements,
} from "@/lib/passwordUtils";

const firstLoginSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, "Kata sandi minimal 8 karakter")
      .regex(/[A-Z]/, "Harus mengandung minimal 1 huruf kapital")
      .regex(/[a-z]/, "Harus mengandung minimal 1 huruf kecil")
      .regex(/[0-9]/, "Harus mengandung minimal 1 angka"),
    confirmPassword: z.string().min(1, "Konfirmasi kata sandi wajib diisi"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Konfirmasi kata sandi tidak cocok",
    path: ["confirmPassword"],
  });

export function FirstLoginPage() {
  const navigate = useNavigate();
  const { user, updateUser, clearAuth } = useAuthStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(firstLoginSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  const enteredPassword = watch("newPassword", "");
  const enteredConfirmPassword = watch("confirmPassword", "");

  const strength = checkPasswordStrength(enteredPassword);
  const matchStatus = checkPasswordMatch(enteredPassword, enteredConfirmPassword);

  const onSubmit = async (data) => {
    setLoading(true);
    setError(null);

    try {
      await authService.completeFirstLogin({
        newPassword: data.newPassword,
      });

      updateUser({ first_login: false });

      if (user?.role === "RIDER") {
        navigate("/rider", { replace: true });
      } else {
        navigate("/overview", { replace: true });
      }
    } catch (err) {
      setError(formatApiError(err, "first-login"));
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await authService.logout();
    clearAuth();
    navigate("/login", { replace: true });
  };

  const confirmTrailingElement = (
    <div className="flex items-center gap-1.5 pr-0.5">
      {matchStatus.status === "match" && (
        <span
          title="Kata sandi cocok"
          data-testid="first-login-match-indicator"
          className="inline-flex items-center text-emerald-500"
        >
          <Check className="w-4 h-4" />
        </span>
      )}
      {matchStatus.status === "mismatch" && (
        <span
          title="Kata sandi belum cocok"
          data-testid="first-login-mismatch-indicator"
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
      title="Pembaruan Kata Sandi Awal"
      subtitle="Akun baru wajib mengganti kata sandi sebelum melanjutkan"
    >
      {/* Account Info Bar */}
      <div className="mb-4 p-3 rounded-[var(--radius-sm)] bg-[var(--surface-raised)] border border-[var(--border-subtle)] flex items-center justify-between text-xs">
        <div>
          <span className="text-[10px] text-[var(--text-muted)] uppercase font-mono block">Akun</span>
          <span className="font-mono font-semibold text-[var(--text-primary)]">{user?.username || "Pengguna"}</span>
        </div>
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border border-[var(--accent-primary)]/20">
          {user?.role || "STAFF"}
        </span>
      </div>

      {error && (
        <Alert variant="danger" title={error.title} className="mb-5 text-xs">
          {error.message}
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormField error={!!errors.newPassword}>
          <FormLabel htmlFor="newPassword" required>Kata Sandi Baru</FormLabel>
          <Input
            id="newPassword"
            type={showNewPassword ? "text" : "password"}
            {...register("newPassword")}
            trailingElement={
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                aria-label={showNewPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
            placeholder="Minimal 8 karakter (kombinasi huruf & angka)"
            autoComplete="new-password"
          />
          {errors.newPassword && <FormErrorText>{errors.newPassword.message}</FormErrorText>}
        </FormField>

        {/* Minimal Password Strength Indicator */}
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
          loading={loading}
          className="w-full mt-3"
        >
          Simpan & Masuk ke Sistem
        </Button>
      </form>

      <div className="mt-5 pt-3 border-t border-[var(--border-subtle)] flex items-center justify-center">
        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={handleLogout}
          className="text-xs text-[var(--text-muted)] hover:text-red-400"
        >
          Batalkan dan Keluar
        </Button>
      </div>
    </AuthLayout>
  );
}

export default FirstLoginPage;
