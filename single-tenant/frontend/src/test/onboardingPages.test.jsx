import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { LoginPage } from "@/pages/auth/LoginPage";
import { FirstLoginPage } from "@/pages/auth/FirstLoginPage";
import { ActivatePage } from "@/pages/auth/ActivatePage";
import { ForgotPasswordPage } from "@/pages/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "@/pages/auth/ResetPasswordPage";
import { authService } from "@/services/authService";
import { useAuthStore } from "@/stores/useAuthStore";

// Mock authService
vi.mock("@/services/authService", () => ({
  authService: {
    login: vi.fn(),
    completeFirstLogin: vi.fn(),
    activateAccount: vi.fn(),
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
    verifyToken: vi.fn(),
    logout: vi.fn(),
  },
}));

describe("🚀 MOVA Frontend Onboarding Lifecycle Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    useAuthStore.getState().clearAuth();
  });

  describe("1️⃣ Layar A1 — LoginPage Enhancements", () => {
    it("renders login form with quick SSOT switches and onboarding links", () => {
      render(
        <MemoryRouter initialEntries={["/login"]}>
          <LoginPage />
        </MemoryRouter>
      );

      expect(screen.getByText("MOVA CONTROL ROOM")).toBeInTheDocument();
      expect(screen.getByLabelText(/Username.*Email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^Kata Sandi/i)).toBeInTheDocument();
      expect(screen.getByText(/Lupa kata sandi\?/i)).toBeInTheDocument();
      expect(screen.getByText(/Punya token aktivasi/i)).toBeInTheDocument();
    });

    it("toggles password visibility when eye button is clicked", async () => {
      const user = userEvent.setup();
      render(
        <MemoryRouter initialEntries={["/login"]}>
          <LoginPage />
        </MemoryRouter>
      );

      const passInput = screen.getByLabelText(/^Kata Sandi/i);
      expect(passInput).toHaveAttribute("type", "password");

      const toggleBtn = screen.getByLabelText(/Tampilkan kata sandi/i);
      await user.click(toggleBtn);
      expect(passInput).toHaveAttribute("type", "text");

      const hideBtn = screen.getByLabelText(/Sembunyikan kata sandi/i);
      await user.click(hideBtn);
      expect(passInput).toHaveAttribute("type", "password");
    });

    it("displays activation success banner when ?activated=true query param is present", () => {
      render(
        <MemoryRouter initialEntries={["/login?activated=true"]}>
          <LoginPage />
        </MemoryRouter>
      );

      expect(
        screen.getByText(/Akun staf Anda telah berhasil diaktifkan/i)
      ).toBeInTheDocument();
    });

    it("displays reset success banner when ?reset=true query param is present", () => {
      render(
        <MemoryRouter initialEntries={["/login?reset=true"]}>
          <LoginPage />
        </MemoryRouter>
      );

      expect(
        screen.getByText(/Kata sandi berhasil diperbarui/i)
      ).toBeInTheDocument();
    });
  });

  describe("2️⃣ Layar A2 — FirstLoginPage (Mandatory First Login Guard)", () => {
    it("renders first login notice and password inputs for authenticated user", () => {
      useAuthStore.getState().setAuth("dummy-token", {
        id: "usr-123",
        username: "newrider",
        role: "RIDER",
        first_login: true,
      });

      render(
        <MemoryRouter initialEntries={["/first-login"]}>
          <FirstLoginPage />
        </MemoryRouter>
      );

      expect(screen.getByText(/Pembaruan Kata Sandi Awal/i)).toBeInTheDocument();
      expect(screen.getByText(/newrider/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^Kata Sandi Baru/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Konfirmasi Kata Sandi Baru/i)).toBeInTheDocument();
    });

    it("shows validation error when passwords do not match", async () => {
      const user = userEvent.setup();
      useAuthStore.getState().setAuth("dummy-token", {
        id: "usr-123",
        username: "newrider",
        role: "RIDER",
        first_login: true,
      });

      render(
        <MemoryRouter initialEntries={["/first-login"]}>
          <FirstLoginPage />
        </MemoryRouter>
      );

      const passInput = screen.getByLabelText(/^Kata Sandi Baru/i);
      const confirmInput = screen.getByLabelText(/Konfirmasi Kata Sandi Baru/i);
      const submitBtn = screen.getByRole("button", { name: /Simpan & Masuk ke Sistem/i });

      await user.type(passInput, "Password123");
      await user.type(confirmInput, "DifferentPass123");
      await user.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText(/Konfirmasi kata sandi tidak cocok/i)).toBeInTheDocument();
      });
      expect(authService.completeFirstLogin).not.toHaveBeenCalled();
    });

    it("successfully submits new password and clears first_login in store", async () => {
      const user = userEvent.setup();
      authService.completeFirstLogin.mockResolvedValueOnce({
        success: true,
        msg: "Password updated",
      });

      useAuthStore.getState().setAuth("dummy-token", {
        id: "usr-123",
        username: "newrider",
        role: "RIDER",
        first_login: true,
      });

      render(
        <MemoryRouter initialEntries={["/first-login"]}>
          <FirstLoginPage />
        </MemoryRouter>
      );

      const passInput = screen.getByLabelText(/^Kata Sandi Baru/i);
      const confirmInput = screen.getByLabelText(/Konfirmasi Kata Sandi Baru/i);
      const submitBtn = screen.getByRole("button", { name: /Simpan & Masuk ke Sistem/i });

      await user.type(passInput, "SecurePass123");
      await user.type(confirmInput, "SecurePass123");
      await user.click(submitBtn);

      await waitFor(() => {
        expect(authService.completeFirstLogin).toHaveBeenCalledWith({
          newPassword: "SecurePass123",
        });
      });

      expect(useAuthStore.getState().user.first_login).toBe(false);
    });
  });

  describe("3️⃣ Layar A3 — ActivatePage (Staff Account Activation)", () => {
    it("renders Step 1 token input form when opened without a token query parameter", () => {
      render(
        <MemoryRouter initialEntries={["/activate"]}>
          <ActivatePage />
        </MemoryRouter>
      );

      expect(screen.getByLabelText(/Token Aktivasi/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Verifikasi & Lanjutkan/i })).toBeInTheDocument();
    });

    it("verifies manual token input and advances to Step 2 profile form", async () => {
      const user = userEvent.setup();
      authService.verifyToken.mockResolvedValueOnce({
        valid: true,
        email: "staff@mantakopi.com",
        name: "Staff Baru",
        role: "SUPERVISOR",
      });

      render(
        <MemoryRouter initialEntries={["/activate"]}>
          <ActivatePage />
        </MemoryRouter>
      );

      const tokenInput = screen.getByLabelText(/Token Aktivasi/i);
      const verifyBtn = screen.getByRole("button", { name: /Verifikasi & Lanjutkan/i });

      await user.type(tokenInput, "manual-token-12345");
      await user.click(verifyBtn);

      await waitFor(() => {
        expect(authService.verifyToken).toHaveBeenCalledWith("manual-token-12345");
        expect(screen.getByText(/Lengkapi Data Akun/i)).toBeInTheDocument();
        expect(screen.getByText("staff@mantakopi.com")).toBeInTheDocument();
        expect(screen.getByText("SUPERVISOR")).toBeInTheDocument();
      });

      expect(screen.getByLabelText(/Nama Lengkap/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^Kata Sandi Baru/i)).toBeInTheDocument();
    });

    it("auto-verifies token and submits activation form when token query param is provided", async () => {
      const user = userEvent.setup();
      authService.verifyToken.mockResolvedValueOnce({
        valid: true,
        email: "staff@mantakopi.com",
        name: "",
        role: "RIDER",
      });
      authService.activateAccount.mockResolvedValueOnce({
        msg: "Akun berhasil diaktifkan",
      });

      render(
        <MemoryRouter initialEntries={["/activate?token=valid-test-token-123"]}>
          <ActivatePage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/Nama Lengkap/i)).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/Nama Lengkap/i), "Budi Santoso");
      await user.type(screen.getByLabelText(/^Kata Sandi Baru/i), "BudiStrong123");
      await user.type(screen.getByLabelText(/Konfirmasi Kata Sandi/i), "BudiStrong123");

      await user.click(screen.getByRole("button", { name: /Aktifkan Akun Saya/i }));

      await waitFor(() => {
        expect(authService.activateAccount).toHaveBeenCalledWith({
          token: "valid-test-token-123",
          name: "Budi Santoso",
          phone: "",
          password: "BudiStrong123",
        });
      });
    });
  });

  describe("4️⃣ Layar A4 — ForgotPasswordPage & ResetPasswordPage", () => {
    it("submits email and displays recovery confirmation card on ForgotPasswordPage", async () => {
      const user = userEvent.setup();
      authService.forgotPassword.mockResolvedValueOnce({
        status: "success",
        msg: "Reset link sent",
      });

      render(
        <MemoryRouter initialEntries={["/forgot-password"]}>
          <ForgotPasswordPage />
        </MemoryRouter>
      );

      const emailInput = screen.getByLabelText(/Alamat Email Terdaftar/i);
      await user.type(emailInput, "operator@mantakopi.com");
      await user.click(screen.getByRole("button", { name: /Kirim Tautan Pemulihan/i }));

      await waitFor(() => {
        expect(authService.forgotPassword).toHaveBeenCalledWith("operator@mantakopi.com");
        expect(screen.getByText(/Tautan Pemulihan Dikirim/i)).toBeInTheDocument();
        expect(screen.getByText("operator@mantakopi.com")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Kirim Ulang Email/i })).toBeDisabled();
      });
    });

    it("verifies token and resets password on ResetPasswordPage", async () => {
      const user = userEvent.setup();
      authService.verifyToken.mockResolvedValueOnce({
        valid: true,
        email: "user@mantakopi.com",
      });
      authService.resetPassword.mockResolvedValueOnce({
        msg: "Password reset successful",
      });

      render(
        <MemoryRouter initialEntries={["/reset-password?token=reset-token-xyz"]}>
          <ResetPasswordPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText("user@mantakopi.com")).toBeInTheDocument();
      });

      const passInput = screen.getByLabelText(/^Kata Sandi Baru/i);
      const confirmInput = screen.getByLabelText(/Konfirmasi Kata Sandi Baru/i);
      await user.type(passInput, "NewSecure123");
      await user.type(confirmInput, "NewSecure123");

      expect(screen.getByTestId("password-match-indicator")).toBeInTheDocument();
      expect(screen.getByText("Kata sandi cocok")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /Perbarui Kata Sandi/i }));

      await waitFor(() => {
        expect(authService.resetPassword).toHaveBeenCalledWith({
          token: "reset-token-xyz",
          password: "NewSecure123",
        });
      });
    });
  });
});
