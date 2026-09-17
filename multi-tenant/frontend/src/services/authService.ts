/*
 * authService.ts
 * Authentication REST Service for Svelte 5 Frontend
 * Strictly aligned with swagger.ts contracts
 */

import { axiosInstance } from "../lib/axios";
import type {
  AuthUser,
  CaptchaData,
  CheckAccountStatusResponse,
  CompleteFirstLoginPayload,
  CompleteFirstLoginResponse,
  GoogleLoginPayload,
  LoginCredentials,
  LoginResponse,
  RegisterPayload,
  RegisterResponse,
  ResetPasswordPayload,
  ResetPasswordResponse,
  RiskStatusResponse,
  VerifyResetTokenResponse,
} from "../lib/types/auth.types";

export type {
  AuthUser,
  CaptchaData,
  CheckAccountStatusResponse,
  CompleteFirstLoginPayload,
  CompleteFirstLoginResponse,
  GoogleLoginPayload,
  LoginCredentials,
  LoginResponse,
  RegisterPayload,
  RegisterResponse,
  ResetPasswordPayload,
  ResetPasswordResponse,
  RiskStatusResponse,
  VerifyResetTokenResponse,
};

export const authService = {
  /**
   * Fetch fresh SVG Captcha challenge (with optional invalidation of old challenge)
   * GET /api/auth/captcha
   */
  getCaptcha: async (oldCaptchaId?: string): Promise<CaptchaData> => {
    const res = await axiosInstance.get("/auth/captcha", {
      params: oldCaptchaId ? { old_captcha_id: oldCaptchaId } : undefined,
    });
    return res.data;
  },

  /**
   * Check whether this client IP or account is currently in elevated risk state (requires CAPTCHA)
   * GET /api/auth/risk-status
   */
  checkRiskStatus: async (identifier?: string): Promise<RiskStatusResponse> => {
    const res = await axiosInstance.get("/auth/risk-status", {
      params: identifier ? { identifier } : undefined,
    });
    return res.data;
  },

  /**
   * User login with identifier (email/username), password, and optional CAPTCHA
   * POST /api/auth/login
   */
  login: async (credentials: LoginCredentials): Promise<LoginResponse> => {
    const res = await axiosInstance.post("/auth/login", credentials);
    return res.data;
  },

  /**
   * Google OAuth 2.0 Sign-In
   * POST /api/auth/google
   */
  loginWithGoogle: async (payload: GoogleLoginPayload): Promise<LoginResponse> => {
    const res = await axiosInstance.post("/auth/google", payload);
    return res.data;
  },

  /**
   * Fetch currently authenticated user profile
   * GET /api/auth/me
   */
  getMe: async (): Promise<{ user: AuthUser; authenticated?: boolean }> => {
    const res = await axiosInstance.get("/auth/me");
    return res.data;
  },

  /**
   * Request password reset link for a provisioned email
   * POST /api/auth/forgot-password
   */
  forgotPassword: async (email: string): Promise<{ msg?: string; message?: string; preview_url?: string | null }> => {
    const res = await axiosInstance.post("/auth/forgot-password", { email });
    return res.data;
  },

  /**
   * Check account provisioning status
   * POST /api/auth/check-status
   */
  checkAccountStatus: async (identifier: string): Promise<CheckAccountStatusResponse> => {
    const res = await axiosInstance.post("/auth/check-status", { identifier });
    return res.data;
  },

  /**
   * Check staff / rider invitation validity
   * POST /api/auth/check-invitation
   */
  checkInvitation: async (emailOrToken: string): Promise<CheckAccountStatusResponse> => {
    try {
      const res = await axiosInstance.post("/auth/check-invitation", { token: emailOrToken, identifier: emailOrToken });
      return res.data;
    } catch {
      const res = await axiosInstance.post("/auth/check-status", { identifier: emailOrToken });
      return res.data;
    }
  },

  /**
   * Complete staff / rider invitation activation
   * POST /api/auth/register
   */
  register: async (payload: RegisterPayload): Promise<RegisterResponse> => {
    try {
      const res = await axiosInstance.post("/auth/register", payload);
      return res.data;
    } catch {
      const res = await axiosInstance.post("/auth/reset-password", {
        token: payload.token,
        password: payload.password,
        birth_date: payload.birth_date,
      });
      return res.data;
    }
  },

  /**
   * Verify whether a password reset / activation token is valid
   * GET /api/auth/verify-reset-token/{token}
   */
  verifyResetToken: async (token: string): Promise<VerifyResetTokenResponse> => {
    const res = await axiosInstance.get(`/auth/verify-reset-token/${token}`);
    return res.data;
  },

  /**
   * Complete password reset with secure token
   * POST /api/auth/reset-password
   */
  resetPassword: async (payload: ResetPasswordPayload): Promise<ResetPasswordResponse> => {
    const res = await axiosInstance.post("/auth/reset-password", payload);
    return res.data;
  },

  /**
   * Refresh JWT authentication token
   * POST /api/auth/refresh-token
   */
  refreshToken: async (): Promise<{ token: string }> => {
    const res = await axiosInstance.post("/auth/refresh-token");
    return res.data;
  },

  /**
   * Logout current session
   * POST /api/auth/logout
   */
  logout: async (): Promise<{ msg?: string }> => {
    const res = await axiosInstance.post("/auth/logout");
    return res.data;
  },

  /**
   * Complete first-login mandatory password change
   * PATCH /api/users/me/complete-first-login
   */
  completeFirstLogin: async (payload: { newPassword?: string; new_password?: string } | any): Promise<CompleteFirstLoginResponse> => {
    const pwd = payload.newPassword || payload.new_password;
    const res = await axiosInstance.patch("/users/me/complete-first-login", {
      new_password: pwd,
      newPassword: pwd,
    });
    return res.data;
  },
};

export default authService;
