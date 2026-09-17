import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { UserModel } from "../models/userModel.js";
import { RefreshTokenModel } from "../models/refreshTokenModel.js";
import { PasswordResetTokenModel } from "../models/passwordResetTokenModel.js";
import { sendMail } from "../config/mailer.js";
import { env } from "../config/env.js";

const BCRYPT_SALT_ROUNDS = 10;
const RESET_TOKEN_LIFETIME_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_BYTES = 64;
const RESET_TOKEN_BYTES = 32;
const MIN_PASSWORD_LENGTH = 8;
const ALLOWED_PUBLIC_ROLES = ["RIDER"];

const JWT_SECRET = env.JWT_SECRET;
const JWT_EXPIRES = process.env.JWT_EXPIRES || "1d";
const REFRESH_TOKEN_DAYS = parseInt(process.env.REFRESH_TOKEN_DAYS || "30", 10);

const createHttpError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const formatSanitizedUser = (user) => ({
  id: user.id,
  username: user.username,
  email: user.email,
  name: user.name,
  role: user.role,
  is_active: user.is_active,
  first_login: Boolean(user.first_login),
  birth_date: user.birth_date || null,
});

export const registerService = async ({ token, username, name, email, password, birth_date }) => {
  if (token) {
    if (!password) {
      throw createHttpError("Kata sandi baru wajib diisi untuk aktivasi.", 400);
    }

    const resetRecord = await PasswordResetTokenModel.findByToken(token);
    if (!resetRecord || resetRecord.used) {
      throw createHttpError("Token aktivasi tidak valid atau telah kedaluwarsa.", 400);
    }

    const expiresAt = new Date(resetRecord.expires_at || resetRecord.expiresAt);
    if (expiresAt < new Date()) {
      throw createHttpError("Token aktivasi telah kedaluwarsa.", 400);
    }

    const userId = resetRecord.user_id || resetRecord.userId;
    const targetUser = await UserModel.findById(userId);
    if (!targetUser) {
      throw createHttpError("Pengguna tidak ditemukan.", 404);
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    const activatedUser = await UserModel.activateUser(userId, {
      hashedPassword,
      name: name || targetUser.name,
      birth_date: birth_date || null,
    });

    await PasswordResetTokenModel.markAsUsed(token);
    await RefreshTokenModel.revokeAllForUser(userId);

    return formatSanitizedUser(activatedUser);
  }

  if (!username || !name || !email || !password) {
    throw createHttpError("Semua field wajib diisi: username, nama, email, dan kata sandi.", 400);
  }

  const [existingUser, hashedPassword] = await Promise.all([
    UserModel.findByEmail(email),
    bcrypt.hash(password, BCRYPT_SALT_ROUNDS),
  ]);

  if (existingUser) {
    throw createHttpError("Email sudah terdaftar di sistem.", 400);
  }

  const newUser = await UserModel.create({
    username,
    name,
    email,
    role: ALLOWED_PUBLIC_ROLES[0],
    password: hashedPassword,
    is_active: true,
    first_login: false,
  });

  return formatSanitizedUser(newUser);
};

export const loginService = async ({ identifier, password }) => {
  if (!identifier || !password) {
    throw createHttpError("Mohon masukkan email/username dan kata sandi.", 400);
  }

  const user = await UserModel.findByEmailOrUsername(identifier);
  if (!user) {
    throw createHttpError("Kredensial login tidak valid.", 400);
  }

  if (user.is_active === false) {
    throw createHttpError("Akun Anda berstatus nonaktif. Silakan hubungi Administrator.", 403);
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw createHttpError("Kredensial login tidak valid.", 400);
  }

  const payload = { id: user.id, role: user.role };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });

  const refreshTokenString = crypto.randomBytes(REFRESH_TOKEN_BYTES).toString("hex");
  const refreshId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);

  await RefreshTokenModel.create({
    id: refreshId,
    token: refreshTokenString,
    userId: user.id,
    expiresAt,
  });

  return {
    token,
    refreshToken: refreshTokenString,
    user: formatSanitizedUser(user),
  };
};

export const sendPasswordResetInstructionService = async (email, token) => {
  const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;
  const html = `
    <div style="font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #e0e0e0; background-color: #ffffff; color: #161616;">
      <h3 style="color: #0f62fe; margin-top: 0; font-size: 18px; font-weight: 700;">Permintaan Reset Password — MOVA DSS</h3>
      <p style="font-size: 14px; line-height: 1.5; color: #525252;">Gunakan tautan berikut untuk memperbarui kata sandi akun MOVA Anda:</p>
      <div style="margin: 24px 0;">
        <a href="${resetUrl}" style="background-color: #0f62fe; color: #ffffff; padding: 12px 24px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block;">
          Atur Ulang Kata Sandi
        </a>
      </div>
      <p style="color: #8d8d8d; font-size: 13px; margin-bottom: 0;">Tautan ini kedaluwarsa dalam <strong>15 menit</strong>. Jika Anda tidak meminta pengaturan ulang kata sandi, abaikan pesan ini.</p>
      <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;" />
      <p style="color: #a8a8a8; font-size: 11px; margin: 0;">© 2026 MOVA Decision Support System — Sejuta Jiwa HUB Sidoarjo</p>
    </div>
  `;

  try {
    const result = await sendMail({
      to: email,
      subject: "Instruksi Atur Ulang Kata Sandi — MOVA DSS",
      html,
      text: `Atur ulang kata sandi akun MOVA Anda melalui tautan berikut (berlaku 15 menit): ${resetUrl}`,
    });

    console.log(`[AUTH SERVICE] Email reset password terkirim ke ${email} (ID: ${result.messageId})`);
    if (result.previewUrl) {
      console.log(`[AUTH SERVICE] ✉️ Ethereal Preview URL: ${result.previewUrl}`);
    }

    return { sent: true, messageId: result.messageId, previewUrl: result.previewUrl };
  } catch (err) {
    console.error(`[AUTH SERVICE] Gagal mengirim email reset ke ${email}:`, err.message);
    console.log(`[AUTH SERVICE] Fallback — Reset token untuk ${email}: ${token}`);
    return { sent: false, fallback: true };
  }
};

export const forgotPasswordService = async (email) => {
  if (!email) {
    throw createHttpError("Email is required", 400);
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const user = await UserModel.findByEmail(normalizedEmail);

  if (user) {
    await PasswordResetTokenModel.revokeAllForUser(user.id);

    const resetToken = crypto.randomBytes(RESET_TOKEN_BYTES).toString("hex");
    const resetId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + RESET_TOKEN_LIFETIME_MS);

    await PasswordResetTokenModel.create({
      id: resetId,
      token: resetToken,
      userId: user.id,
      expiresAt,
    });

    await sendPasswordResetInstructionService(user.email, resetToken);
  }

  return {
    status: "success",
    msg: "Jika email Anda terdaftar dalam sistem, tautan pengaturan ulang kata sandi telah dikirimkan ke kotak masuk Anda.",
    retryAfter: 120,
  };
};

export const resetPasswordService = async ({ token, password }) => {
  if (!token || !password) {
    throw createHttpError("Token and new password are required", 400);
  }

  const resetRecord = await PasswordResetTokenModel.findByToken(token);
  if (!resetRecord || resetRecord.used) {
    throw createHttpError("Invalid or expired reset token", 400);
  }

  const expiresAt = new Date(resetRecord.expires_at || resetRecord.expiresAt);
  if (expiresAt < new Date()) {
    throw createHttpError("Invalid or expired reset token", 400);
  }

  const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
  const userId = resetRecord.user_id || resetRecord.userId;

  await UserModel.updatePassword(userId, hashedPassword);
  await PasswordResetTokenModel.markAsUsed(token);
  await RefreshTokenModel.revokeAllForUser(userId);

  return { msg: "Password has been reset successfully" };
};

export const verifyResetTokenService = async (token) => {
  if (!token) {
    return { valid: false, reason: "Token wajib disertakan" };
  }

  const resetRecord = await PasswordResetTokenModel.findByToken(token);
  if (!resetRecord) {
    return { valid: false, reason: "Token aktivasi tidak ditemukan" };
  }

  if (resetRecord.used) {
    return { valid: false, reason: "Token aktivasi sudah pernah digunakan" };
  }

  const expiresAt = new Date(resetRecord.expires_at || resetRecord.expiresAt);
  if (expiresAt < new Date()) {
    return { valid: false, reason: "Token aktivasi telah kedaluwarsa" };
  }

  const userId = resetRecord.user_id || resetRecord.userId;
  const user = await UserModel.findById(userId);

  return {
    valid: true,
    userId: user ? user.id : userId,
    email: user ? user.email : null,
    name: user ? user.name : null,
    role: user ? user.role : null,
  };
};

export const firstLoginService = async ({ userId, newPassword }) => {
  if (!userId || !newPassword) {
    throw createHttpError("User ID dan password baru wajib diisi.", 400);
  }

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    throw createHttpError("Password baru minimal 8 karakter.", 400);
  }

  const user = await UserModel.findById(userId);
  if (!user) {
    throw createHttpError("Pengguna tidak ditemukan.", 404);
  }

  const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
  const updatedUser = await UserModel.updateFirstLoginPassword(userId, hashedPassword);

  return formatSanitizedUser(updatedUser);
};

export const refreshTokenService = async (token) => {
  if (!token) {
    throw createHttpError("Refresh token required", 400);
  }

  const stored = await RefreshTokenModel.findByToken(token);
  if (!stored || stored.revoked) {
    throw createHttpError("Invalid refresh token", 401);
  }

  const expiresAt = new Date(stored.expires_at || stored.expiresAt);
  if (expiresAt < new Date()) {
    throw createHttpError("Refresh token expired", 401);
  }

  const userId = stored.user_id || stored.userId;
  const user = await UserModel.findById(userId);
  if (!user) {
    throw createHttpError("Invalid refresh token", 401);
  }

  const newAccessToken = jwt.sign(
    { id: user.id, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );

  await RefreshTokenModel.revoke(token);

  const newRefresh = crypto.randomBytes(REFRESH_TOKEN_BYTES).toString("hex");
  const newRefreshId = crypto.randomUUID();
  const newExpiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);

  await RefreshTokenModel.create({
    id: newRefreshId,
    token: newRefresh,
    userId: user.id,
    expiresAt: newExpiresAt,
  });

  return { token: newAccessToken, refreshToken: newRefresh };
};

export const logoutService = async (token) => {
  if (!token) {
    return { msg: "Logged out" };
  }

  const stored = await RefreshTokenModel.findByToken(token);
  if (stored) {
    await RefreshTokenModel.revoke(token);
  }

  return { msg: "Logged out" };
};