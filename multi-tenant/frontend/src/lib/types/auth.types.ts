/*
 * auth.types.ts
 * Auth Domain Types and Contract Interfaces adhering strictly to swagger.ts
 */

export type UserRole = "SUPERADMIN" | "MANAGEMENT" | "SUPERVISOR" | "RIDER";

export interface AuthUser {
  id: string;
  username: string;
  name: string;
  email: string;
  role: UserRole | string;
  phone?: string;
  birth_date?: string;
  avatar_url?: string;
  is_active?: boolean;
  first_login?: boolean;
  must_change_password?: boolean;
  created_at?: string;
}

export interface LoginCredentials {
  identifier: string;
  password: string;
  captcha_id?: string;
  captcha_answer?: string;
}

export interface CaptchaData {
  captcha_id: string;
  svg: string;
  expires_at: number;
}

export interface RiskStatusResponse {
  requires_captcha: boolean;
  ipFailures: number;
  userFailures: number;
}

export interface LoginResponse {
  msg?: string;
  message?: string;
  token: string;
  refreshToken?: string;
  user: AuthUser;
}

export interface GoogleLoginPayload {
  email: string;
  name?: string;
  google_id?: string;
  avatar_url?: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ForgotPasswordResponse {
  msg?: string;
  message?: string;
  preview_url?: string | null;
}

export interface CheckAccountStatusResponse {
  status: "ACTIVE" | "INVITED" | "INACTIVE" | "NOT_FOUND";
  message: string;
  email?: string;
  name?: string;
  role?: string;
}

export interface RegisterPayload {
  token: string;
  password: string;
  name?: string;
  email?: string;
  phone?: string;
  birth_date?: string;
}

export interface RegisterResponse {
  msg?: string;
  message?: string;
  token?: string;
  user?: AuthUser;
}

export interface ResetPasswordPayload {
  token: string;
  password: string;
  birth_date?: string;
}

export interface ResetPasswordResponse {
  msg?: string;
  message?: string;
}

export interface VerifyResetTokenResponse {
  valid: boolean;
  email?: string;
  name?: string;
  username?: string;
  role?: string;
  birth_date?: string;
  reason?: string;
}

export interface CompleteFirstLoginPayload {
  newPassword: string;
}

export interface CompleteFirstLoginResponse {
  success: boolean;
  message: string;
  msg?: string;
}
