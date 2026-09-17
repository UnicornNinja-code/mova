import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
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
import { Eye, EyeOff } from "lucide-react";

import { formatApiError } from "@/lib/errorHandler";

const loginSchema = z.object({
  identifier: z.string().min(1, "Username atau email wajib diisi"),
  password: z.string().min(1, "Kata sandi wajib diisi"),
});

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successNotice, setSuccessNotice] = useState(null);
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

      setAuth(response.token, response.user);

      if (response.user?.first_login) {
        navigate("/first-login");
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

  const passwordToggleBtn = (
    <button
      type="button"
      onClick={() => setShowPassword(!showPassword)}
      aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
      className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
    >
      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
    </button>
  );

  return (
    <AuthLayout
      title="MOVA CONTROL ROOM"
      subtitle="Sidoarjo Operational Command System"
    >
      {successNotice && (
        <Alert variant="success" className="mb-5 text-xs">
          {successNotice}
        </Alert>
      )}

      {error && (
        <Alert variant="danger" title={error.title} className="mb-5 text-xs">
          {error.message}
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormField error={!!errors.identifier}>
          <FormLabel htmlFor="identifier" required>Username atau Email</FormLabel>
          <Input
            id="identifier"
            {...register("identifier")}
            placeholder="Masukkan username atau email"
            autoComplete="username"
          />
          {errors.identifier && <FormErrorText>{errors.identifier.message}</FormErrorText>}
        </FormField>

        <FormField error={!!errors.password}>
          <div className="flex items-center justify-between">
            <FormLabel htmlFor="password" required>Kata Sandi</FormLabel>
            <Link
              to="/forgot-password"
              className="text-xs text-[var(--accent-primary)] hover:underline"
            >
              Lupa kata sandi?
            </Link>
          </div>
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            {...register("password")}
            trailingElement={passwordToggleBtn}
            placeholder="Masukkan kata sandi"
            autoComplete="current-password"
          />
          {errors.password && <FormErrorText>{errors.password.message}</FormErrorText>}
        </FormField>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={loading}
          className="w-full mt-2"
        >
          Masuk ke Ruang Kontrol
        </Button>
      </form>

      {/* Staff Activation Invitation Link */}
      <div className="mt-5 pt-4 border-t border-[var(--border-subtle)] text-center">
        <Link
          to="/activate"
          className="text-xs text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors"
        >
          Punya token aktivasi akun staf? <span className="text-[var(--accent-primary)] font-medium">Aktivasi di sini</span>
        </Link>
      </div>
    </AuthLayout>
  );
}

export default LoginPage;
