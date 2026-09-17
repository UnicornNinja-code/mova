import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { authService } from "@/services/authService";
import { AuthLayout } from "@/layouts/AuthLayout/AuthLayout";
import {
  Button,
  Input,
  Alert,
} from "@/components/primitives";
import { FormField, FormLabel, FormErrorText } from "@/components/composites";
import { ArrowLeft } from "lucide-react";
import { formatApiError } from "@/lib/errorHandler";

const forgotPasswordSchema = z.object({
  email: z.string().min(1, "Email wajib diisi").email("Format email tidak valid"),
});

export function ForgotPasswordPage() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [submittedEmail, setSubmittedEmail] = useState(null);
  const [cooldown, setCooldown] = useState(0);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => Math.max(prev - 1, 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const onSubmit = async (data) => {
    setSubmitting(true);
    setError(null);

    try {
      const result = await authService.forgotPassword(data.email);
      setSubmittedEmail(data.email);
      setCooldown(result?.retryAfter || 120);
    } catch (err) {
      setError(formatApiError(err, "forgot-password"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || submitting || !submittedEmail) return;
    setSubmitting(true);
    setError(null);

    try {
      const result = await authService.forgotPassword(submittedEmail);
      setCooldown(result?.retryAfter || 120);
    } catch (err) {
      setError(formatApiError(err, "forgot-password"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Lupa Kata Sandi"
      subtitle="Pemulihan akses akun MOVA Control Room"
    >
      {submittedEmail ? (
        <div className="space-y-4">
          <Alert variant="success" title="Tautan Pemulihan Dikirim" className="text-xs">
            Jika alamat email <span className="font-mono font-semibold text-[var(--text-primary)]">{submittedEmail}</span> terdaftar dalam sistem MOVA, instruksi pengaturan ulang kata sandi telah dikirimkan ke kotak masuk Anda (berlaku 15 menit).
          </Alert>

          {/* Cooldown & Resend Action Box */}
          <div className="p-3.5 rounded-[var(--radius-sm)] bg-[var(--surface-raised)] border border-[var(--border-subtle)] space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--text-secondary)]">Belum menerima email pemulihan?</span>
              {cooldown > 0 && (
                <span className="font-mono font-semibold text-[var(--accent-primary)] tabular-nums">
                  {formatTime(cooldown)}
                </span>
              )}
            </div>

            {error && (
              <Alert variant="danger" title={error.title} className="text-xs">
                {error.message}
              </Alert>
            )}

            <Button
              type="button"
              variant={cooldown > 0 ? "outline" : "secondary"}
              size="md"
              onClick={handleResend}
              disabled={cooldown > 0}
              loading={submitting}
              className="w-full text-xs font-medium cursor-pointer"
            >
              {cooldown > 0
                ? `Kirim Ulang Email (${formatTime(cooldown)})`
                : "Kirim Ulang Tautan Pemulihan"}
            </Button>
          </div>

          <div className="pt-2">
            <Link to="/login">
              <Button variant="primary" className="w-full">
                Kembali ke Halaman Login
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-xs text-[var(--text-secondary)] mb-5 leading-relaxed">
            Masukkan alamat email yang terdaftar. Sistem akan mengirimkan tautan untuk mengatur ulang kata sandi Anda.
          </p>

          {error && (
            <Alert variant="danger" title={error.title} className="mb-5 text-xs">
              {error.message}
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <FormField error={!!errors.email}>
              <FormLabel htmlFor="email" required>Alamat Email Terdaftar</FormLabel>
              <Input
                id="email"
                type="email"
                {...register("email")}
                placeholder="nama@mantakopi.com"
                autoComplete="email"
              />
              {errors.email && <FormErrorText>{errors.email.message}</FormErrorText>}
            </FormField>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={submitting}
              className="w-full mt-2"
            >
              Kirim Tautan Pemulihan
            </Button>
          </form>

          <div className="mt-5 pt-3 border-t border-[var(--border-subtle)] text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
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

export default ForgotPasswordPage;
