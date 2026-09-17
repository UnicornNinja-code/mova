/*
 * authService.ts
 * Auth Service implementing enterprise security & RBAC in TypeScript
 */

import jwt from "jsonwebtoken";
import crypto from "crypto";
import { hashPassword, verifyPassword } from "../utils/crypto.js";
import { UserModel } from "../models/userModel.js";
import { RefreshTokenModel } from "../models/refreshTokenModel.js";
import { PasswordResetTokenModel } from "../models/passwordResetTokenModel.js";
import { sendMail } from "../config/mailer.js";
import { env } from "../config/env.js";
import { UserRole } from "../types/user.types.js";
import { CaptchaUtil, type CaptchaChallenge } from "../utils/captcha.js";
import { userRepository } from "../repositories/userRepository.js";
import { auditService } from "./auditService.js";

import { pool } from "../config/database.js";
import { redisClient } from "../config/redis.js";

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret";
// Access token validity default (7 days for reliable admin & setup sessions)
const JWT_EXPIRES = (process.env.JWT_EXPIRES || "7d") as any;
const REFRESH_TOKEN_DAYS = parseInt(process.env.REFRESH_TOKEN_DAYS || "30", 10);

const FAILED_ATTEMPTS_TTL = 15 * 60; // 15 menit
const getClientIpKey = (ip?: string) => `auth:failed:ip:${(ip || "127.0.0.1").replace(/::ffff:/, "")}`;
const getAccountKey = (id?: string) => `auth:failed:user:${String(id || "").trim().toLowerCase()}`;

/**
 * Read current failed login attempt counter from Redis
 */
export const getFailedAttempts = async (key: string): Promise<number> => {
  try {
    const val = await redisClient.get(key);
    return val ? parseInt(val, 10) : 0;
  } catch (err: any) {
    console.warn("⚠️ Gagal membaca failed attempts dari Redis:", err.message);
    return 0;
  }
};

/**
 * Increment failed login attempt counter in Redis with 15-minute sliding window
 */
export const incrementFailedAttempt = async (key: string): Promise<number> => {
  try {
    const count = await redisClient.incr(key);
    if (count === 1) {
      await redisClient.expire(key, FAILED_ATTEMPTS_TTL);
    }
    return count;
  } catch (err: any) {
    console.warn("⚠️ Gagal menaikkan failed attempt di Redis:", err.message);
    return 1;
  }
};

/**
 * Reset failed attempt counters on successful login
 */
export const resetFailedAttempts = async (ipKey: string, accountKey: string): Promise<void> => {
  try {
    await redisClient.del([ipKey, accountKey]);
  } catch (err: any) {
    console.warn("⚠️ Gagal mereset failed attempts di Redis:", err.message);
  }
};

/**
 * Check if the client IP or account is currently at elevated risk (requires CAPTCHA)
 */
export const checkRiskStatusService = async (
  ip?: string,
  identifier?: string
): Promise<{ requires_captcha: boolean; ipFailures: number; userFailures: number }> => {
  const ipKey = getClientIpKey(ip);
  const accountKey = identifier ? getAccountKey(identifier) : "";

  const ipFailures = await getFailedAttempts(ipKey);
  const userFailures = accountKey ? await getFailedAttempts(accountKey) : 0;

  return {
    requires_captcha: ipFailures >= 3 || userFailures >= 3,
    ipFailures,
    userFailures,
  };
};

/**
 * Account Registration / Activation via Invitation Token
 * Public self-registration without token is disabled for MOVA enterprise system.
 */
export const registerService = async ({
  token,
  username,
  name,
  email,
  password,
  birth_date,
}: {
  token?: string;
  username?: string;
  name?: string;
  email?: string;
  password?: string;
  birth_date?: string | Date;
}): Promise<any> => {
  // If no invitation token is provided, reject public self-registration
  if (!token) {
    const error: any = new Error(
      "Pendaftaran mandiri publik dinonaktifkan. Akun MOVA harus didaftarkan oleh Administrator atau Manajemen melalui sistem undangan."
    );
    error.statusCode = 403;
    throw error;
  }

  const resetRecord = await PasswordResetTokenModel.findByToken(token);
  if (!resetRecord || resetRecord.used) {
    const error: any = new Error("Tautan aktivasi tidak valid atau sudah pernah digunakan.");
    error.statusCode = 400;
    throw error;
  }

  const userId = resetRecord.user_id || resetRecord.userId;
  const user = await UserModel.findById(userId);
  if (!user) {
    const error: any = new Error("Pengguna untuk tautan aktivasi ini tidak ditemukan.");
    error.statusCode = 404;
    throw error;
  }

  const finalPassword = password || "MovaSecurePass2026!";
  const hashedPassword = await hashPassword(finalPassword);

  if (name || username) {
    await UserModel.update(userId, {
      name: name || user.name,
    });
  }

  await UserModel.updatePassword(userId, hashedPassword, birth_date ? new Date(birth_date) : null);
  await PasswordResetTokenModel.markAsUsed(token);
  await RefreshTokenModel.revokeAllForUser(userId);

  await auditService.logAction({
    userId: user.id,
    userRole: user.role,
    action: "AUTH_REGISTER_SUCCESS",
    entityType: "USER",
    entityId: String(user.id),
    details: { username: user.username, email: user.email, activated_via: "INVITATION_TOKEN" },
  });

  return {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    role: user.role,
    is_active: true,
    message: "Akun Anda berhasil diaktivasi. Silakan login untuk memulai.",
  };
};

/**
 * Generate a fresh SVG Captcha challenge
 */
export const generateCaptchaService = async (oldCaptchaId?: string): Promise<CaptchaChallenge> => {
  return await CaptchaUtil.generate(oldCaptchaId);
};

/**
 * Login user and issue Access Token + Refresh Token with Progressive Challenge
 */
export const loginService = async ({
  identifier,
  password,
  captcha_id,
  captcha_answer,
  ip_address,
  user_agent,
}: {
  identifier: string;
  password?: string;
  captcha_id?: string;
  captcha_answer?: string;
  ip_address?: string;
  user_agent?: string;
}): Promise<any> => {
  if (!identifier || !password) {
    const error: any = new Error("Harap isi username/email dan kata sandi.");
    error.statusCode = 400;
    throw error;
  }

  const cleanId = String(identifier).trim().toLowerCase();
  const ipKey = getClientIpKey(ip_address);
  const accountKey = getAccountKey(cleanId);
  const threshold = env.SECURITY?.AUTH_PROGRESSIVE_CAPTCHA_THRESHOLD || 3;

  // 1. Evaluate Risk (Progressive Challenge)
  const ipFailures = await getFailedAttempts(ipKey);
  const userFailures = cleanId ? await getFailedAttempts(accountKey) : 0;
  const isElevatedRisk = ipFailures >= threshold || userFailures >= threshold;

  // 2. Progressive Challenge Verification
  if (isElevatedRisk) {
    if (!captcha_id || !captcha_answer) {
      await auditService.logAction({
        action: "AUTH_CAPTCHA_REQUIRED",
        details: { identifier: cleanId, ipFailures, userFailures },
        ipAddress: ip_address,
        userAgent: user_agent,
        status: "FAILED",
      });

      const error: any = new Error("Verifikasi keamanan (CAPTCHA) diperlukan karena terdeteksi aktivitas mencurigakan.");
      error.statusCode = 400;
      error.requires_captcha = true;
      throw error;
    }

    // Verify provided CAPTCHA atomically (single-use & replay protection)
    const captchaRes = await CaptchaUtil.verify(captcha_id, captcha_answer);
    if (!captchaRes.valid) {
      await incrementFailedAttempt(ipKey);
      if (cleanId) await incrementFailedAttempt(accountKey);

      const auditAction =
        captchaRes.reason === "EXPIRED"
          ? "AUTH_CAPTCHA_EXPIRED"
          : captchaRes.reason === "REPLAY"
            ? "AUTH_CAPTCHA_REPLAY"
            : "AUTH_CAPTCHA_FAILED";

      await auditService.logAction({
        action: auditAction,
        details: { identifier: cleanId, reason: captchaRes.reason },
        ipAddress: ip_address,
        userAgent: user_agent,
        status: "FAILED",
      });

      const error: any = new Error(captchaRes.msg);
      error.statusCode = 400;
      error.requires_captcha = true;
      throw error;
    }
  } else if (captcha_id && captcha_answer) {
    // Voluntary CAPTCHA verification in low-risk mode
    const captchaRes = await CaptchaUtil.verify(captcha_id, captcha_answer);
    if (!captchaRes.valid) {
      const error: any = new Error(captchaRes.msg);
      error.statusCode = 400;
      error.requires_captcha = false;
      throw error;
    }
  }

  // 3. User Authentication
  const user = await UserModel.findByEmailOrUsername(cleanId);
  if (!user) {
    const newIpFailures = await incrementFailedAttempt(ipKey);
    const newAccountFailures = cleanId ? await incrementFailedAttempt(accountKey) : 0;
    const nowRequiresCaptcha = newIpFailures >= threshold || newAccountFailures >= threshold;

    await auditService.logAction({
      action: "AUTH_LOGIN_FAILED",
      details: { identifier: cleanId, reason: "INVALID_CREDENTIALS" },
      ipAddress: ip_address,
      userAgent: user_agent,
      status: "FAILED",
    });

    const error: any = new Error("Username atau kata sandi tidak valid.");
    error.statusCode = 400;
    error.requires_captcha = nowRequiresCaptcha;
    throw error;
  }

  // 4. Inactive Account Check
  if (user.is_active === false) {
    await auditService.logAction({
      userId: user.id,
      userRole: user.role,
      action: "AUTH_LOGIN_FAILED",
      entityType: "USER",
      entityId: String(user.id),
      details: { identifier: cleanId, reason: "ACCOUNT_INACTIVE_OR_PENDING_ACTIVATION" },
      ipAddress: ip_address,
      userAgent: user_agent,
      status: "FAILED",
    });
    const error: any = new Error("Akun Anda belum diaktivasi atau dinonaktifkan. Silakan periksa email aktivasi atau hubungi Manajemen.");
    error.statusCode = 403;
    throw error;
  }

  // 5. Password Verification
  const isMatch = await verifyPassword(password, user.password || "");
  if (!isMatch) {
    const newIpFailures = await incrementFailedAttempt(ipKey);
    const newAccountFailures = cleanId ? await incrementFailedAttempt(accountKey) : 0;
    const nowRequiresCaptcha = newIpFailures >= threshold || newAccountFailures >= threshold;

    await auditService.logAction({
      userId: user.id,
      userRole: user.role,
      action: "AUTH_LOGIN_FAILED",
      entityType: "USER",
      entityId: String(user.id),
      details: { identifier: cleanId, reason: "INVALID_CREDENTIALS" },
      ipAddress: ip_address,
      userAgent: user_agent,
      status: "FAILED",
    });

    const error: any = new Error("Username atau kata sandi tidak valid.");
    error.statusCode = 400;
    error.requires_captcha = nowRequiresCaptcha;
    throw error;
  }

  // 6. Login Success: Reset failed counters & log success
  await resetFailedAttempts(ipKey, accountKey);

  const payload = { id: user.id, role: user.role, name: user.name, email: user.email };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });

  const refreshTokenString = crypto.randomBytes(64).toString("hex");
  const refreshId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);

  await RefreshTokenModel.create({
    id: refreshId,
    token: refreshTokenString,
    userId: user.id,
    expiresAt,
  });

  await auditService.logAction({
    userId: user.id,
    userRole: user.role,
    action: "AUTH_LOGIN_SUCCESS",
    entityType: "USER",
    entityId: String(user.id),
    ipAddress: ip_address,
    userAgent: user_agent,
    status: "SUCCESS",
  });

  return {
    token,
    refreshToken: refreshTokenString,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      role: user.role,
      first_login: (user as any).first_login ?? false,
    },
  };
};

/**
 * Google OAuth 2.0 Sign-In Service (Corporate Pre-Provisioned Whitelist Match)
 */
export const googleLoginService = async ({
  email,
  name,
  google_id,
  avatar_url,
  ip_address,
  user_agent,
}: {
  email: string;
  name?: string;
  google_id?: string;
  avatar_url?: string;
  ip_address?: string;
  user_agent?: string;
}): Promise<any> => {
  if (!email) {
    const error: any = new Error("Email Google tidak valid.");
    error.statusCode = 400;
    throw error;
  }

  let user = await UserModel.findByEmailOrUsername(email);

  if (!user) {
    await auditService.logAction({
      action: "AUTH_LOGIN_FAILED",
      details: { email, provider: "GOOGLE", reason: "EMAIL_NOT_PRE_PROVISIONED" },
      ipAddress: ip_address,
      userAgent: user_agent,
      status: "FAILED",
    });
    const error: any = new Error(
      `Email Google [${email}] belum terdaftar dalam sistem COZIS. Silakan hubungi Manajemen untuk aktivasi akun internal.`
    );
    error.statusCode = 403;
    throw error;
  }

  if (user.is_active === false) {
    const error: any = new Error("Akun Anda belum diaktivasi atau sedang dinonaktifkan. Silakan hubungi Administrator.");
    error.statusCode = 403;
    throw error;
  }

  if (google_id) {
    await userRepository.updateGoogleInfo(user.id, google_id, avatar_url);
  }

  const payload = { id: user.id, role: user.role, name: user.name, email: user.email };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });

  const refreshTokenString = crypto.randomBytes(64).toString("hex");
  const refreshId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);

  await RefreshTokenModel.create({
    id: refreshId,
    token: refreshTokenString,
    userId: user.id,
    expiresAt,
  });

  await auditService.logAction({
    userId: user.id,
    userRole: user.role,
    action: "AUTH_LOGIN_SUCCESS",
    entityType: "USER",
    entityId: String(user.id),
    details: { provider: "GOOGLE" },
    ipAddress: ip_address,
    userAgent: user_agent,
  });

  return {
    token,
    refreshToken: refreshTokenString,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      role: user.role,
      avatar_url: avatar_url || (user as any).avatar_url,
    },
  };
};

/**
 * Send password reset email via Nodemailer
 */
export const sendPasswordResetInstructionService = async (email: string, token: string): Promise<any> => {
  const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${token}`;

  const html = `
    <div style="font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif; max-width: 420px; margin: 24px auto; padding: 32px 24px; background-color: #131316; color: #f4f4f5; border-radius: 20px; border: 1px solid #272730; text-align: center; box-shadow: 0 12px 36px rgba(0,0,0,0.5);">
      <div style="margin-bottom: 24px;">
        <h1 style="color: #ffffff; margin: 0 0 4px 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">MOVA</h1>
        <p style="color: #FF8573; font-size: 13px; font-weight: 600; margin: 0;">Move Where Demand Is.</p>
      </div>

      <div style="margin: 28px 0;">
        <a href="${resetUrl}" 
           style="display: inline-block; padding: 13px 28px; background-color: #FF634A; background-image: linear-gradient(135deg, #FF634A 0%, #FF8573 100%); color: #09090B; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 14px; box-shadow: 0 4px 18px rgba(255, 99, 74, 0.4); text-align: center;">
          <span style="font-size: 15px; vertical-align: middle; margin-right: 6px;">✉️</span>
          <span style="vertical-align: middle;">Atur Ulang Kata Sandi</span>
        </a>
      </div>

      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #24242A;">
        <p style="color: #71717A; font-size: 12px; margin: 0; line-height: 1.6;">
          ⏳ Tautan berlaku selama <strong>1 jam</strong>.<br>
          Abaikan jika Anda tidak meminta pengaturan ulang kata sandi.
        </p>
      </div>
    </div>
  `;

  try {
    const result = await sendMail({
      to: email,
      subject: "Atur Ulang Kata Sandi — MOVA",
      html,
      text: `Reset kata sandi Anda di: ${resetUrl} (berlaku 1 jam)`,
    });

    console.log(`[AUTH SERVICE] Email reset password terkirim ke ${email} (ID: ${result.messageId})`);
    if (result.previewUrl) {
      console.log(`[AUTH SERVICE] Preview Ethereal: ${result.previewUrl}`);
    }

    return { sent: true, messageId: result.messageId, previewUrl: result.previewUrl };
  } catch (err: any) {
    console.error(`[AUTH SERVICE] Gagal mengirim email reset ke ${email}:`, err.message);
    return { sent: false, fallback: true };
  }
};

/**
 * Request password reset token with anti-account enumeration protection
 */
export const forgotPasswordService = async (email: string, ip_address?: string, user_agent?: string): Promise<any> => {
  if (!email) {
    const error: any = new Error("Alamat email wajib diisi.");
    error.statusCode = 400;
    throw error;
  }

  const cleanEmail = email.trim().toLowerCase();
  const user = await UserModel.findByEmail(cleanEmail);

  if (!user) {
    await auditService.logAction({
      action: "AUTH_PASSWORD_RESET_REQUEST_NOT_FOUND",
      details: { requested_email: cleanEmail },
      ipAddress: ip_address,
      userAgent: user_agent,
      status: "FAILED",
    });

    const error: any = new Error(
      "Akun belum terdaftar dalam sistem. Silakan hubungi Administrator atau Manajemen untuk provisioning akun."
    );
    error.statusCode = 404;
    throw error;
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  const resetId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 jam

  await PasswordResetTokenModel.create({
    id: resetId,
    token: resetToken,
    userId: user.id,
    expiresAt,
  });

  const mailResult = await sendPasswordResetInstructionService(cleanEmail, resetToken);

  await auditService.logAction({
    userId: user.id,
    userRole: user.role,
    action: "AUTH_PASSWORD_RESET_REQUEST",
    entityType: "USER",
    entityId: String(user.id),
    ipAddress: ip_address,
    userAgent: user_agent,
  });

  return {
    msg: "Tautan instruksi pemulihan kata sandi telah dikirimkan ke email terdaftar Anda.",
    preview_url: mailResult?.previewUrl || null,
  };
};

/**
 * Reset password using token & invalidate all active sessions
 */
export const resetPasswordService = async ({
  token,
  password,
  birth_date,
  ip_address,
  user_agent,
}: {
  token: string;
  password?: string;
  birth_date?: string | Date;
  ip_address?: string;
  user_agent?: string;
}): Promise<any> => {
  if (!token || !password) {
    const error: any = new Error("Token dan kata sandi baru wajib diisi.");
    error.statusCode = 400;
    throw error;
  }

  if (password.length < 6) {
    const error: any = new Error("Kata sandi baru minimal 6 karakter.");
    error.statusCode = 400;
    throw error;
  }

  const resetRecord = await PasswordResetTokenModel.findByToken(token);

  if (!resetRecord || resetRecord.used) {
    const error: any = new Error("Tautan pemulihan tidak valid atau telah digunakan.");
    error.statusCode = 400;
    throw error;
  }

  const hashedPassword = await hashPassword(password);
  const userId = resetRecord.user_id || resetRecord.userId;
  const user = await UserModel.findById(userId);

  await UserModel.updatePassword(userId, hashedPassword, birth_date);
  await PasswordResetTokenModel.markAsUsed(token);

  // Security Invariant: Revoke all active sessions on password change
  await RefreshTokenModel.revokeAllForUser(userId);

  await auditService.logAction({
    userId,
    userRole: user?.role,
    action: "AUTH_PASSWORD_RESET_SUCCESS",
    entityType: "USER",
    entityId: String(userId),
    ipAddress: ip_address,
    userAgent: user_agent,
  });

  return { msg: "Kata sandi Anda berhasil diperbarui. Silakan login kembali dengan kata sandi baru." };
};

/**
 * Check whether an account is provisioned, active, invited, or inactive
 * Enterprise Security: Does NOT leak activation token or activation links!
 */
export const checkAccountStatusService = async (
  identifier: string,
  ip_address?: string,
  user_agent?: string
): Promise<any> => {
  if (!identifier || !identifier.trim()) {
    const error: any = new Error("Alamat email atau username wajib diisi.");
    error.statusCode = 400;
    throw error;
  }

  const cleanIdentifier = identifier.trim().toLowerCase();
  const user = await UserModel.findByEmailOrUsername(cleanIdentifier);

  if (!user) {
    await auditService.logAction({
      action: "AUTH_CHECK_ACCOUNT_STATUS",
      details: { identifier: cleanIdentifier, result: "NOT_FOUND" },
      ipAddress: ip_address,
      userAgent: user_agent,
      status: "SUCCESS",
    });

    return {
      status: "NOT_FOUND",
      message: "Akun belum terdaftar dalam sistem. Silakan hubungi Administrator atau Manajemen untuk provisioning akun.",
      identifier: cleanIdentifier,
    };
  }

  if (user.is_active) {
    await auditService.logAction({
      userId: user.id,
      userRole: user.role,
      action: "AUTH_CHECK_ACCOUNT_STATUS",
      details: { identifier: cleanIdentifier, result: "ACTIVE" },
      ipAddress: ip_address,
      userAgent: user_agent,
      status: "SUCCESS",
    });

    return {
      status: "ACTIVE",
      message: "Akun Anda sudah aktif. Silakan langsung masuk menggunakan kredensial Anda.",
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }

  // User is inactive or pending invitation (is_active === false)
  const tokenRecord = await pool.query(
    `SELECT token FROM password_reset_tokens WHERE user_id = $1 AND used = false ORDER BY created_at DESC LIMIT 1;`,
    [user.id]
  );
  const hasActiveInvitation = tokenRecord.rows.length > 0;

  if (hasActiveInvitation) {
    await auditService.logAction({
      userId: user.id,
      userRole: user.role,
      action: "AUTH_CHECK_ACCOUNT_STATUS",
      details: { identifier: cleanIdentifier, result: "INVITED" },
      ipAddress: ip_address,
      userAgent: user_agent,
      status: "SUCCESS",
    });

    return {
      status: "INVITED",
      message: "Undangan aktivasi telah dikirim ke email resmi Anda. Harap periksa folder kotak masuk (inbox) atau spam email Anda untuk mengklik tautan aktivasi akun.",
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }

  // Account is deactivated / suspended
  await auditService.logAction({
    userId: user.id,
    userRole: user.role,
    action: "AUTH_CHECK_ACCOUNT_STATUS",
    details: { identifier: cleanIdentifier, result: "INACTIVE" },
    ipAddress: ip_address,
    userAgent: user_agent,
    status: "SUCCESS",
  });

  return {
    status: "INACTIVE",
    message: "Akun Anda saat ini berstatus nonaktif. Silakan hubungi Administrator untuk informasi lebih lanjut mengenai akses Anda.",
    email: user.email,
    name: user.name,
    role: user.role,
  };
};

export const checkInvitationService = checkAccountStatusService;

/**
 * Verify if a password reset / activation token is still valid (tanpa batas expired)
 */
export const verifyResetTokenService = async (token: string): Promise<any> => {
  if (!token) {
    return { valid: false, reason: "Token is required" };
  }

  const resetRecord = await PasswordResetTokenModel.findByToken(token);

  if (!resetRecord) {
    return { valid: false, reason: "Token not found" };
  }

  if (resetRecord.used) {
    return { valid: false, reason: "Token has already been used" };
  }

  const user = await UserModel.findById(resetRecord.user_id || resetRecord.userId);

  return {
    valid: true,
    email: user?.email,
    name: user?.name,
    username: user?.username,
    role: user?.role,
    birth_date: user?.birth_date,
    is_active: user?.is_active,
  };
};

/**
 * Refresh Access Token using Refresh Token with token rotation
 */
export const refreshTokenService = async (token: string, ip_address?: string, user_agent?: string): Promise<any> => {
  if (!token) {
    const error: any = new Error("Sesi refresh token tidak ditemukan.");
    error.statusCode = 400;
    throw error;
  }

  const stored = await RefreshTokenModel.findByToken(token);
  if (!stored || stored.revoked) {
    const error: any = new Error("Sesi tidak valid atau telah dicabut.");
    error.statusCode = 401;
    throw error;
  }

  const expiresAt = new Date(stored.expires_at || stored.expiresAt);
  if (expiresAt < new Date()) {
    const error: any = new Error("Sesi telah kedaluwarsa.");
    error.statusCode = 401;
    throw error;
  }

  const userId = stored.user_id || stored.userId;
  const user = await UserModel.findById(userId);

  if (!user || user.is_active === false) {
    const error: any = new Error("Pengguna tidak aktif atau tidak ditemukan.");
    error.statusCode = 401;
    throw error;
  }

  const newAccessToken = jwt.sign(
    { id: user.id, role: user.role, name: user.name, email: user.email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );

  // Refresh Token Rotation
  await RefreshTokenModel.revoke(token);

  const newRefresh = crypto.randomBytes(64).toString("hex");
  const newRefreshId = crypto.randomUUID();
  const newExpiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);

  await RefreshTokenModel.create({
    id: newRefreshId,
    token: newRefresh,
    userId: user.id,
    expiresAt: newExpiresAt,
  });

  await auditService.logAction({
    userId: user.id,
    userRole: user.role,
    action: "AUTH_REFRESH",
    entityType: "USER",
    entityId: String(user.id),
    ipAddress: ip_address,
    userAgent: user_agent,
  });

  return { token: newAccessToken, refreshToken: newRefresh };
};

/**
 * Logout and revoke Refresh Token and Access Token (Single-Session & Blacklist Guard)
 */
export const logoutService = async (
  refreshToken?: string,
  accessToken?: string,
  userId?: string | number,
  userRole?: string
): Promise<any> => {
  if (refreshToken) {
    await RefreshTokenModel.revoke(refreshToken);
  }

  if (accessToken) {
    try {
      // Blacklist access token in Redis for 24 hours
      await redisClient.setEx(`jwt:revoked:${accessToken}`, 86400, "1");
    } catch (e: any) {
      console.warn("Failed to blacklist access token in Redis:", e.message);
    }
  }

  if (userId) {
    try {
      // Invalidate all tokens issued before this timestamp for this user
      await redisClient.setEx(`user:logout_at:${userId}`, 86400, String(Date.now()));
    } catch (e: any) {
      console.warn("Failed to set user logout timestamp in Redis:", e.message);
    }

    await auditService.logAction({
      userId,
      userRole,
      action: "AUTH_LOGOUT",
      entityType: "USER",
      entityId: String(userId),
    });
  }

  return { success: true, msg: "Berhasil keluar dari sesi." };
};
