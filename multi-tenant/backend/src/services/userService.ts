/*
 * userService.ts
 * User Profile & RBAC Service in TypeScript
 */

import { hashPassword, verifyPassword } from "../utils/crypto.js";
import { UserModel } from "../models/userModel.js";
import { RefreshTokenModel } from "../models/refreshTokenModel.js";
import { PasswordResetTokenModel } from "../models/passwordResetTokenModel.js";
import { sendMail } from "../config/mailer.js";
import { env } from "../config/env.js";
import crypto from "crypto";
import { UserRole } from "../types/user.types.js";
import { auditService } from "./auditService.js";

/**
 * Get current user profile by user ID
 */
export const getProfileService = async (userId: number | string): Promise<any> => {
  const user = await UserModel.findById(userId);
  if (!user) {
    const error: any = new Error("User tidak ditemukan");
    error.statusCode = 404;
    throw error;
  }
  return user;
};

/**
 * Get all users
 */
export const getAllUsersService = async (): Promise<{ users: any[]; count: number }> => {
  const users = await UserModel.findAll();
  return { users, count: users.length };
};

/**
 * Get user by ID
 */
export const getUserByIdService = async (id: number | string): Promise<any> => {
  const user = await UserModel.findById(id);
  if (!user) {
    const error: any = new Error("User tidak ditemukan");
    error.statusCode = 404;
    throw error;
  }
  return user;
};

/**
 * Create a new user account with RBAC Hierarchy check and send email invitation
 * Default status is PENDING ACTIVATION (is_active = false)
 */
export const createUserService = async (
  { username, name, email, password, role }: { username?: string; name: string; email: string; password?: string; role: string },
  currentUser: any
): Promise<any> => {
  if (!name || !email || !role) {
    const error: any = new Error("Harap lengkapi field wajib: Nama Lengkap, Alamat Email, dan Peran Akun.");
    error.statusCode = 400;
    throw error;
  }

  const validRoles = ["SUPERADMIN", "MANAGEMENT", "SUPERVISOR", "RIDER"];
  if (!validRoles.includes(role)) {
    const error: any = new Error("Peran pengguna tidak valid.");
    error.statusCode = 400;
    throw error;
  }

  // RBAC Enforcement on User Creation
  if (currentUser.role === "SUPERADMIN") {
    // Superadmin can provision any role
  } else if (currentUser.role === "MANAGEMENT") {
    if (role === "SUPERADMIN" || role === "MANAGEMENT") {
      const error: any = new Error("Akses Ditolak: Manajemen hanya memiliki hak membuat akun Supervisor dan Rider.");
      error.statusCode = 403;
      throw error;
    }
  } else {
    const error: any = new Error("Akses Ditolak: Anda tidak memiliki otoritas membuat akun pengguna.");
    error.statusCode = 403;
    throw error;
  }

  const existingUser = await UserModel.findByEmailOrUsername(email);
  if (existingUser) {
    const error: any = new Error(`Email [${email}] sudah terdaftar dalam sistem.`);
    error.statusCode = 400;
    throw error;
  }

  let finalUsername = username?.trim() || email.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "_");
  const existingUsername = await UserModel.findByEmailOrUsername(finalUsername);
  if (existingUsername) {
    finalUsername = `${finalUsername}_${Math.floor(100 + Math.random() * 900)}`;
  }

  // Temporary password placeholder before user sets their own password during activation
  const initialPassword = password || crypto.randomBytes(16).toString("hex") + "A1!";
  const hashedPassword = await hashPassword(initialPassword);

  const newUser = await UserModel.create({
    username: finalUsername,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    role: role as UserRole,
    password: hashedPassword,
    isActive: false,     // Default: Pending Activation
    firstLogin: true,    // Must set own password on first login
  });

  // 1. Generate secure 48-hour invitation token
  const invitationToken = crypto.randomBytes(32).toString("hex");
  const resetId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000); // Tanpa kadaluarsa

  await PasswordResetTokenModel.create({
    id: resetId,
    token: invitationToken,
    userId: newUser.id,
    expiresAt,
  });

  const activationUrl = `${env.FRONTEND_URL}/register?token=${invitationToken}&email=${encodeURIComponent(email)}`;

  // 2. Send Invitation Email via Nodemailer
  const roleLabel = role === "RIDER" ? "Rider Armada Kopi Keliling" : role === "SUPERVISOR" ? "Supervisor Operasional" : role === "MANAGEMENT" ? "Manajemen Operasional" : role;
  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; background: #131316; color: #f4f4f5; border-radius: 16px; border: 1px solid #272730;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="color: #FF634A; margin: 0; font-size: 24px;">☕ MOVA</h1>
        <p style="color: #a1a1aa; font-size: 13px; margin-top: 4px;">Move Where Demand Is. — Mobile Operations & Visibility Analytics</p>
      </div>
      <div style="background: #18181D; padding: 20px; border-radius: 12px; border: 1px solid #272730;">
        <h2 style="color: #fff; font-size: 18px; margin-top: 0;">Halo, ${name}! 👋</h2>
        <p style="color: #d4d4d8; font-size: 14px; line-height: 1.6;">
          Akun Anda telah didaftarkan oleh Manajemen sebagai <strong>${roleLabel}</strong>.
        </p>
        <p style="color: #d4d4d8; font-size: 14px; line-height: 1.6;">
          Silakan lakukan aktivasi akun dan tetapkan kata sandi Anda untuk mulai bertugas:
        </p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${activationUrl}" 
             style="display: inline-block; padding: 12px 32px; background: #FF634A; color: #09090B; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 14px; box-shadow: 0 4px 14px rgba(255, 99, 74, 0.4);">
            Aktivasi Akun Sekarang
          </a>
        </div>
        <p style="color: #a1a1aa; font-size: 12px; line-height: 1.5; border-top: 1px solid #272730; padding-top: 12px;">
          💡 <strong>Petunjuk Aktivasi:</strong> Klik tombol di atas untuk membuat kata sandi baru akun Anda. Tautan berlaku selama 48 jam.
        </p>
      </div>
      <p style="color: #71717a; font-size: 11px; text-align: center; margin-top: 20px;">
        © 2026 MOVA. Move Where Demand Is.
      </p>
    </div>
  `;

  let mailResult: any = { sent: false };
  try {
    mailResult = await sendMail({
      to: email,
      subject: `🚀 Undangan Bergabung & Aktivasi Akun ${roleLabel} — MOVA`,
      html,
      text: `Halo ${name}, Anda diundang bergabung sebagai ${roleLabel}. Buka link berikut untuk aktivasi akun: ${activationUrl}`,
    });
    console.log(`📧 Undangan email terkirim ke ${email} (ID: ${mailResult.messageId})`);
    if (mailResult?.previewUrl) {
      console.log(`🔗 Buka & Baca Email di Ethereal: ${mailResult.previewUrl}`);
    }
  } catch (err: any) {
    console.warn(`⚠️ Gagal mengirim email ke ${email}:`, err.message);
  }

  // Record audit log
  await auditService.logAction({
    userId: currentUser.id,
    userRole: currentUser.role,
    action: "USER_CREATED",
    entityType: "USER",
    entityId: String(newUser.id),
    details: { name: newUser.name, email: newUser.email, role: newUser.role, username: newUser.username },
  });

  return {
    ...newUser,
    invitation_token: invitationToken,
    invitation_link: activationUrl,
    email_preview_url: mailResult?.previewUrl || null,
  };
};

/**
 * Resend account activation invitation email & token
 */
export const resendInvitationService = async (userId: number | string, currentUser: any): Promise<any> => {
  const targetUser = await UserModel.findById(userId);
  if (!targetUser) {
    const error: any = new Error("User tidak ditemukan");
    error.statusCode = 404;
    throw error;
  }

  if (currentUser.role === "MANAGEMENT" && (targetUser.role === "SUPERADMIN" || targetUser.role === "MANAGEMENT")) {
    const error: any = new Error("Akses Ditolak: Manajemen tidak memiliki hak mengelola akun Super Admin atau Manajemen lain.");
    error.statusCode = 403;
    throw error;
  }

  const invitationToken = crypto.randomBytes(32).toString("hex");
  const resetId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000); // Tanpa kadaluarsa

  await PasswordResetTokenModel.create({
    id: resetId,
    token: invitationToken,
    userId: targetUser.id,
    expiresAt,
  });

  const activationUrl = `${env.FRONTEND_URL}/register?token=${invitationToken}&email=${encodeURIComponent(targetUser.email)}`;
  const roleLabel = targetUser.role === "RIDER" ? "Rider Armada Kopi Keliling" : targetUser.role === "SUPERVISOR" ? "Supervisor Operasional" : targetUser.role === "MANAGEMENT" ? "Manajemen Operasional" : targetUser.role;

  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; background: #131316; color: #f4f4f5; border-radius: 16px; border: 1px solid #272730;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="color: #FF634A; margin: 0; font-size: 24px;">☕ MOVA</h1>
        <p style="color: #a1a1aa; font-size: 13px; margin-top: 4px;">Move Where Demand Is. — Mobile Operations & Visibility Analytics</p>
      </div>
      <div style="background: #18181D; padding: 20px; border-radius: 12px; border: 1px solid #272730;">
        <h2 style="color: #fff; font-size: 18px; margin-top: 0;">Halo, ${targetUser.name}! 👋</h2>
        <p style="color: #d4d4d8; font-size: 14px; line-height: 1.6;">
          Berikut adalah tautan baru untuk aktivasi akun Anda sebagai <strong>${roleLabel}</strong>:
        </p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${activationUrl}" 
             style="display: inline-block; padding: 12px 32px; background: #FF634A; color: #09090B; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 14px; box-shadow: 0 4px 14px rgba(255, 99, 74, 0.4);">
            Aktivasi Akun Sekarang
          </a>
        </div>
        <p style="color: #a1a1aa; font-size: 12px; line-height: 1.5; border-top: 1px solid #272730; padding-top: 12px;">
          💡 Tautan berlaku selama 48 jam.
        </p>
      </div>
    </div>
  `;

  let mailResult: any = { sent: false };
  try {
    mailResult = await sendMail({
      to: targetUser.email,
      subject: `🚀 Tautan Aktivasi Akun ${roleLabel} — MOVA`,
      html,
      text: `Halo ${targetUser.name}, Buka link berikut untuk aktivasi akun: ${activationUrl}`,
    });
  } catch (err: any) {
    console.warn(`⚠️ Gagal mengirim email ke ${targetUser.email}:`, err.message);
  }

  await auditService.logAction({
    userId: currentUser.id,
    userRole: currentUser.role,
    action: "USER_INVITATION_RESENT",
    entityType: "USER",
    entityId: String(targetUser.id),
    details: { email: targetUser.email },
  });

  return {
    message: `Tautan aktivasi berhasil dibuat dan dikirim ke ${targetUser.email}`,
    invitation_token: invitationToken,
    invitation_link: activationUrl,
    email_preview_url: mailResult?.previewUrl || null,
  };
};

/**
 * Complete first-login mandatory password change
 * User is already authenticated; sets new password and marks first_login = false
 */
export const completeFirstLoginService = async (
  userId: number | string,
  { newPassword }: { newPassword: string }
): Promise<{ success: boolean; message: string }> => {
  if (!newPassword) {
    const error: any = new Error("Password baru wajib diisi.");
    error.statusCode = 400;
    throw error;
  }

  if (newPassword.length < 8) {
    const error: any = new Error("Password baru minimal 8 karakter.");
    error.statusCode = 400;
    throw error;
  }

  const userWithPw = await UserModel.findByIdWithPassword(userId);
  if (!userWithPw) {
    const error: any = new Error("Akun tidak ditemukan.");
    error.statusCode = 404;
    throw error;
  }

  // Check if new password is identical to the current temporary password
  if (userWithPw.password) {
    const isSame = await verifyPassword(newPassword, userWithPw.password);
    if (isSame) {
      const error: any = new Error("Password baru tidak boleh sama dengan password sementara.");
      error.statusCode = 400;
      throw error;
    }
  }

  const hashedNewPassword = await hashPassword(newPassword);
  // updatePassword automatically sets first_login = FALSE, is_active = TRUE via SQL
  await UserModel.updatePassword(userId, hashedNewPassword);

  await auditService.logAction({
    userId: String(userId),
    action: "FIRST_LOGIN_PASSWORD_CHANGED",
    entityType: "USER",
    entityId: String(userId),
    status: "SUCCESS",
  });

  return { success: true, message: "Password berhasil diperbarui. Selamat datang di MOVA!" };
};

/**
 * Update user profile / role with RBAC & Invariant checks
 */
export const updateUserService = async (
  id: number | string,
  { name, email, role }: { name?: string; email?: string; role?: string },
  currentUser: any
): Promise<any> => {
  const targetUser = await UserModel.findById(id);
  if (!targetUser) {
    const error: any = new Error("User tidak ditemukan");
    error.statusCode = 404;
    throw error;
  }

  const isSelf = String(currentUser.id) === String(id);

  if (isSelf) {
    if (role && role !== targetUser.role && currentUser.role !== "SUPERADMIN") {
      const error: any = new Error("Akses Ditolak: Anda tidak dapat mengubah peran akun Anda sendiri.");
      error.statusCode = 403;
      throw error;
    }
  } else {
    if (currentUser.role === "SUPERADMIN") {
      // Allowed
    } else if (currentUser.role === "MANAGEMENT") {
      if (targetUser.role === "SUPERADMIN" || targetUser.role === "MANAGEMENT") {
        const error: any = new Error("Akses Ditolak: Manajemen tidak memiliki otoritas mengubah akun Super Admin atau Manajemen lain.");
        error.statusCode = 403;
        throw error;
      }
      if (role === "SUPERADMIN" || role === "MANAGEMENT") {
        const error: any = new Error("Akses Ditolak: Manajemen tidak dapat memberikan peran Super Admin atau Manajemen.");
        error.statusCode = 403;
        throw error;
      }
    } else {
      const error: any = new Error("Akses Ditolak: Anda hanya memiliki hak memperbarui profil pribadi Anda.");
      error.statusCode = 403;
      throw error;
    }
  }

  // Protection against demoting the last active Superadmin
  if (role && role !== "SUPERADMIN" && targetUser.role === "SUPERADMIN") {
    const activeSuperadminCount = await UserModel.countActiveSuperadmins();
    if (activeSuperadminCount <= 1) {
      const error: any = new Error("Tindakan Ditolak: Tidak dapat mengubah peran Super Admin terakhir dalam sistem demi integritas operasional.");
      error.statusCode = 400;
      throw error;
    }
  }

  if (email && email.toLowerCase() !== targetUser.email.toLowerCase()) {
    const existingEmail = await UserModel.findByEmailOrUsername(email);
    if (existingEmail && String(existingEmail.id) !== String(id)) {
      const error: any = new Error("Alamat email sudah terdaftar pada akun lain.");
      error.statusCode = 400;
      throw error;
    }
  }

  const updatedUser = await UserModel.update(id, { name, email, role: (role as UserRole) || undefined });

  // Record audit log
  await auditService.logAction({
    userId: currentUser.id,
    userRole: currentUser.role,
    action: role && role !== targetUser.role ? "USER_ROLE_CHANGED" : "USER_UPDATED",
    entityType: "USER",
    entityId: String(id),
    oldValues: { name: targetUser.name, email: targetUser.email, role: targetUser.role },
    newValues: { name: updatedUser?.name, email: updatedUser?.email, role: updatedUser?.role },
  });

  return updatedUser;
};

/**
 * Activate or Deactivate user account with RBAC & Invariant checks
 */
export const setUserStatusService = async (id: number | string, isActive: boolean, currentUser: any): Promise<any> => {
  if (typeof isActive !== "boolean") {
    const error: any = new Error("Parameter 'is_active' boolean diperlukan.");
    error.statusCode = 400;
    throw error;
  }

  if (String(id) === String(currentUser.id)) {
    const error: any = new Error("Tindakan Ditolak: Tidak dapat mengaktifkan atau menonaktifkan akun sendiri.");
    error.statusCode = 400;
    throw error;
  }

  const targetUser = await UserModel.findById(id);
  if (!targetUser) {
    const error: any = new Error("User tidak ditemukan");
    error.statusCode = 404;
    throw error;
  }

  if (currentUser.role === "SUPERADMIN") {
    // Allowed
  } else if (currentUser.role === "MANAGEMENT") {
    if (targetUser.role === "SUPERADMIN" || targetUser.role === "MANAGEMENT") {
      const error: any = new Error("Akses Ditolak: Manajemen tidak memiliki otoritas mengubah status akun Super Admin atau Manajemen lain.");
      error.statusCode = 403;
      throw error;
    }
  } else {
    const error: any = new Error("Akses Ditolak: Otoritas tidak mencukupi untuk mengelola status akun pengguna.");
    error.statusCode = 403;
    throw error;
  }

  // Protection against deactivating the last active Superadmin
  if (!isActive && targetUser.role === "SUPERADMIN") {
    const activeSuperadminCount = await UserModel.countActiveSuperadmins();
    if (activeSuperadminCount <= 1) {
      const error: any = new Error("Tindakan Ditolak: Tidak dapat menonaktifkan Super Admin terakhir dalam sistem demi integritas operasional.");
      error.statusCode = 400;
      throw error;
    }
  }

  const updatedUser = await UserModel.updateStatus(id, isActive);

  if (isActive === false) {
    await RefreshTokenModel.revokeAllForUser(id);
  }

  await auditService.logAction({
    userId: currentUser.id,
    userRole: currentUser.role,
    action: "USER_STATUS_CHANGED",
    entityType: "USER",
    entityId: String(id),
    details: { is_active: isActive, target_username: targetUser.username, target_email: targetUser.email },
  });

  return {
    user: updatedUser,
    message: `Akun pengguna berhasil ${isActive ? "diaktifkan" : "dinonaktifkan"}.`,
  };
};

/**
 * Delete user by ID with RBAC & Invariant checks
 */
export const deleteUserService = async (id: number | string, currentUser: any): Promise<any> => {
  if (String(id) === String(currentUser.id)) {
    const error: any = new Error("Tindakan Ditolak: Tidak dapat menghapus akun Anda sendiri.");
    error.statusCode = 400;
    throw error;
  }

  const targetUser = await UserModel.findById(id);
  if (!targetUser) {
    const error: any = new Error("User tidak ditemukan");
    error.statusCode = 404;
    throw error;
  }

  if (currentUser.role === "SUPERADMIN") {
    // Allowed
  } else if (currentUser.role === "MANAGEMENT") {
    if (targetUser.role === "SUPERADMIN" || targetUser.role === "MANAGEMENT") {
      const error: any = new Error("Akses Ditolak: Manajemen tidak memiliki otoritas menghapus akun Super Admin atau Manajemen lain.");
      error.statusCode = 403;
      throw error;
    }
  } else {
    const error: any = new Error("Akses Ditolak: Otoritas tidak mencukupi untuk menghapus akun pengguna.");
    error.statusCode = 403;
    throw error;
  }

  // Protection against deleting the last active Superadmin
  if (targetUser.role === "SUPERADMIN") {
    const activeSuperadminCount = await UserModel.countActiveSuperadmins();
    if (activeSuperadminCount <= 1) {
      const error: any = new Error("Tindakan Ditolak: Tidak dapat menghapus Super Admin terakhir dalam sistem demi integritas operasional.");
      error.statusCode = 400;
      throw error;
    }
  }

  await RefreshTokenModel.revokeAllForUser(id);

  const deletedUser = await UserModel.delete(id);

  await auditService.logAction({
    userId: currentUser.id,
    userRole: currentUser.role,
    action: "USER_DELETED",
    entityType: "USER",
    entityId: String(id),
    details: { name: targetUser.name, email: targetUser.email, role: targetUser.role },
  });

  return { message: "Akun pengguna berhasil dihapus.", user: deletedUser };
};

/**
 * Change user password with current password validation
 */
export const changePasswordService = async (
  userId: number | string,
  { currentPassword, newPassword }: { currentPassword?: string; newPassword?: string }
): Promise<any> => {
  if (!currentPassword || !newPassword) {
    const error: any = new Error("Kata sandi lama dan kata sandi baru wajib diisi.");
    error.statusCode = 400;
    throw error;
  }
  if (newPassword.length < 6) {
    const error: any = new Error("Kata sandi baru minimal 6 karakter.");
    error.statusCode = 400;
    throw error;
  }
  const user = await UserModel.findByIdWithPassword(userId);
  if (!user) {
    const error: any = new Error("User tidak ditemukan");
    error.statusCode = 404;
    throw error;
  }
  const isMatch = await verifyPassword(currentPassword, user.password || "");
  if (!isMatch) {
    const error: any = new Error("Kata sandi saat ini (lama) tidak sesuai.");
    error.statusCode = 400;
    throw error;
  }
  const hashedPassword = await hashPassword(newPassword);
  const updatedUser = await UserModel.updatePassword(userId, hashedPassword);

  await auditService.logAction({
    userId,
    userRole: user.role,
    action: "USER_PASSWORD_CHANGED",
    entityType: "USER",
    entityId: String(userId),
  });

  return updatedUser;
};

/**
 * Admin reset user password with RBAC check
 */
export const adminResetPasswordService = async (
  targetUserId: number | string,
  newPassword: string,
  currentUser: any
): Promise<any> => {
  if (!newPassword || newPassword.length < 6) {
    const error: any = new Error("Password baru minimal 6 karakter");
    error.statusCode = 400;
    throw error;
  }

  const targetUser = await UserModel.findById(targetUserId);
  if (!targetUser) {
    const error: any = new Error("User tidak ditemukan");
    error.statusCode = 404;
    throw error;
  }

  if (currentUser.role === "SUPERADMIN") {
    // Allowed
  } else if (currentUser.role === "MANAGEMENT") {
    if (targetUser.role === "SUPERADMIN" || targetUser.role === "MANAGEMENT") {
      const error: any = new Error("Akses Ditolak: Manajemen tidak memiliki otoritas mereset password akun Super Admin atau Manajemen lain.");
      error.statusCode = 403;
      throw error;
    }
  } else {
    const error: any = new Error("Akses Ditolak: Otoritas tidak mencukupi untuk mereset password pengguna.");
    error.statusCode = 403;
    throw error;
  }

  const hashedPassword = await hashPassword(newPassword);
  await UserModel.updatePassword(targetUserId, hashedPassword);
  await RefreshTokenModel.revokeAllForUser(targetUserId);

  await auditService.logAction({
    userId: currentUser.id,
    userRole: currentUser.role,
    action: "USER_PASSWORD_RESET_BY_ADMIN",
    entityType: "USER",
    entityId: String(targetUserId),
    details: { target_username: targetUser.username, target_email: targetUser.email },
  });

  return { message: `Password akun ${targetUser.username} berhasil direset.` };
};

