import bcrypt from "bcrypt";
import crypto from "crypto";
import { pool } from "../config/database.js";
import { UserModel } from "../models/userModel.js";
import { RefreshTokenModel } from "../models/refreshTokenModel.js";
import { PasswordResetTokenModel } from "../models/passwordResetTokenModel.js";
import { OperationalSessionRepository } from "../repositories/operationalSessionRepository.js";
import { auditLogger } from "../utils/AuditLogger.js";
import { socketManager } from "../socket/socketManager.js";
import { env } from "../config/env.js";

const BCRYPT_SALT_ROUNDS = 10;
const INVITATION_TOKEN_BYTES = 32;
const INVITATION_EXPIRY_HOURS = 48;
const MIN_PASSWORD_LENGTH = 6;
const VALID_ROLES = ["SUPERADMIN", "MANAGEMENT", "SUPERVISOR", "RIDER"];

const createHttpError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const assertCanManageTargetRole = (currentUserRole, targetRole, actionDescription) => {
  if (currentUserRole === "SUPERADMIN") return;

  if (currentUserRole === "MANAGEMENT") {
    if (targetRole === "SUPERADMIN") {
      throw createHttpError(
        `Akses ditolak (Hierarchy Guard): Management dilarang ${actionDescription} akun dengan peran SUPERADMIN.`,
        403
      );
    }
    return;
  }

  throw createHttpError("Akses ditolak: Anda tidak memiliki wewenang untuk tindakan ini.", 403);
};

export const getProfileService = async (userId) => {
  const user = await UserModel.findById(userId);
  if (!user) {
    throw createHttpError("Pengguna tidak ditemukan.", 404);
  }
  return user;
};

export const getAllUsersService = async (currentUser, filters = {}) => {
  let users = await UserModel.findAll();

  if (currentUser.role === "SUPERVISOR") {
    users = users.filter((u) => u.role === "RIDER");
  } else if (filters.role) {
    users = users.filter((u) => u.role === filters.role.toUpperCase());
  }

  if (filters.status) {
    const targetStatus = filters.status.toUpperCase();
    users = users.filter((u) => u.account_status === targetStatus);
  }

  if (filters.search) {
    const searchKeyword = filters.search.toLowerCase();
    users = users.filter(
      (u) =>
        u.name?.toLowerCase().includes(searchKeyword) ||
        u.email?.toLowerCase().includes(searchKeyword) ||
        u.username?.toLowerCase().includes(searchKeyword)
    );
  }

  return { users, count: users.length };
};

export const resendActivationService = async (userId, currentUser) => {
  const targetUser = await UserModel.findById(userId);
  if (!targetUser) {
    throw createHttpError("Pengguna tidak ditemukan.", 404);
  }

  assertCanManageTargetRole(currentUser.role, targetUser.role, "mengirim ulang aktivasi");

  const invitation_token = crypto.randomBytes(INVITATION_TOKEN_BYTES).toString("hex");
  const resetId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_HOURS * 60 * 60 * 1000);

  // Invalidate previous activation tokens
  await PasswordResetTokenModel.revokeAllForUser(userId);

  await PasswordResetTokenModel.create({
    id: resetId,
    token: invitation_token,
    userId: targetUser.id,
    expiresAt,
  });

  const frontendBaseUrl = env.FRONTEND_URL || "http://localhost:8074";
  const invitation_link = `${frontendBaseUrl}/activate?token=${invitation_token}&email=${encodeURIComponent(targetUser.email)}`;

  return {
    user: targetUser,
    invitation_token,
    invitation_link,
    expires_at: expiresAt,
    message: "Tautan aktivasi baru berhasil dibuat.",
  };
};

export const revokeUserSessionsService = async (userId, currentUser) => {
  const targetUser = await UserModel.findById(userId);
  if (!targetUser) {
    throw createHttpError("Pengguna tidak ditemukan.", 404);
  }

  if (String(userId) !== String(currentUser.id)) {
    assertCanManageTargetRole(currentUser.role, targetUser.role, "mencabut sesi");
  }

  await RefreshTokenModel.revokeAllForUser(userId);

  return {
    user: targetUser,
    message: "Seluruh sesi aktif pengguna berhasil dicabut.",
  };
};

export const getUserByIdService = async (id, currentUser) => {
  const user = await UserModel.findById(id);
  if (!user) {
    throw createHttpError("Pengguna tidak ditemukan.", 404);
  }

  if (currentUser.role === "SUPERVISOR" && user.role !== "RIDER") {
    throw createHttpError("Akses ditolak: Supervisor hanya dapat melihat profil Rider.", 403);
  }

  return user;
};

export const createUserService = async (
  { username, name, email, password, phone, role, birth_date },
  currentUser
) => {
  if (!name || !email || !role) {
    throw createHttpError("Semua field wajib diisi: nama lengkap, email, dan peran (role).", 400);
  }

  const targetRole = role.toUpperCase();
  if (!VALID_ROLES.includes(targetRole)) {
    throw createHttpError(`Peran '${role}' tidak valid. Pilihan: ${VALID_ROLES.join(", ")}`, 400);
  }

  assertCanManageTargetRole(currentUser.role, targetRole, "membuat");

  const resolvedUsername = (username || `${email.split("@")[0]}_${Date.now().toString().slice(-4)}`)
    .toLowerCase()
    .trim();

  const isInvite = !password;
  const initialPassword = password || crypto.randomBytes(16).toString("hex");

  const [existingEmail, existingUsername, hashedPassword] = await Promise.all([
    UserModel.findByEmailOrUsername(email),
    UserModel.findByEmailOrUsername(resolvedUsername),
    bcrypt.hash(initialPassword, BCRYPT_SALT_ROUNDS),
  ]);

  if (existingEmail) {
    throw createHttpError("Email ini sudah terdaftar di sistem.", 400);
  }

  if (existingUsername) {
    throw createHttpError("Username ini sudah digunakan oleh akun lain.", 400);
  }

  const newUser = await UserModel.create({
    username: resolvedUsername,
    name: name.trim(),
    email: email.toLowerCase().trim(),
    phone: phone || null,
    role: targetRole,
    password: hashedPassword,
    is_active: !isInvite,
    first_login: false,
    birth_date: birth_date || null,
  });

  let invitation_token = null;
  let invitation_link = null;

  if (isInvite) {
    invitation_token = crypto.randomBytes(INVITATION_TOKEN_BYTES).toString("hex");
    const resetId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_HOURS * 60 * 60 * 1000);

    await PasswordResetTokenModel.create({
      id: resetId,
      token: invitation_token,
      userId: newUser.id,
      expiresAt,
    });

    const frontendBaseUrl = env.FRONTEND_URL || "http://localhost:5173";
    invitation_link = `${frontendBaseUrl}/activate?token=${invitation_token}&email=${encodeURIComponent(newUser.email)}`;
  }

  return {
    ...newUser,
    ...(isInvite && { invitation_token, invitation_link }),
  };
};

export const updateUserService = async (id, { name, email, phone, role }, currentUser) => {
  const targetUser = await UserModel.findById(id);
  if (!targetUser) {
    throw createHttpError("Pengguna tidak ditemukan.", 404);
  }

  const isSelf = String(currentUser.id) === String(id);
  const targetRole = role ? role.toUpperCase() : undefined;

  if (isSelf) {
    if (targetRole && targetRole !== targetUser.role && currentUser.role !== "SUPERADMIN") {
      throw createHttpError("Akses ditolak: Hanya SUPERADMIN yang dapat mengubah peran akun.", 403);
    }
  } else {
    assertCanManageTargetRole(currentUser.role, targetUser.role, "mengubah");
    if (targetRole) {
      assertCanManageTargetRole(currentUser.role, targetRole, "menetapkan");
    }
  }

  if (email && email.toLowerCase() !== targetUser.email.toLowerCase()) {
    const existingEmail = await UserModel.findByEmailOrUsername(email);
    if (existingEmail && String(existingEmail.id) !== String(id)) {
      throw createHttpError("Email baru sudah digunakan oleh akun lain.", 400);
    }
  }

  return await UserModel.update(id, {
    name: name ? name.trim() : targetUser.name,
    email: email ? email.toLowerCase().trim() : targetUser.email,
    phone: phone !== undefined ? phone : targetUser.phone,
    role: targetRole || targetUser.role,
  });
};

export const setUserStatusService = async (id, isActive, currentUser) => {
  if (typeof isActive !== "boolean") {
    throw createHttpError("Parameter 'is_active' bertipe boolean (true/false) diperlukan.", 400);
  }

  if (String(id) === String(currentUser.id)) {
    throw createHttpError("Anda tidak dapat menonaktifkan akun Anda sendiri.", 400);
  }

  const targetUser = await UserModel.findById(id);
  if (!targetUser) {
    throw createHttpError("Pengguna tidak ditemukan.", 404);
  }

  assertCanManageTargetRole(currentUser.role, targetUser.role, "mengubah status");

  const updatedUser = await UserModel.updateStatus(id, isActive);

  if (isActive === false) {
    await RefreshTokenModel.revokeAllForUser(id);
  }

  return {
    user: updatedUser,
    message: `Akun pengguna berhasil ${isActive ? "diaktifkan" : "dinonaktifkan"}.`,
  };
};

export const deleteUserService = async (id, currentUser) => {
  if (String(id) === String(currentUser.id)) {
    throw createHttpError("Anda tidak dapat menghapus akun Anda sendiri.", 400);
  }

  const targetUser = await UserModel.findById(id);
  if (!targetUser) {
    throw createHttpError("Pengguna tidak ditemukan.", 404);
  }

  assertCanManageTargetRole(currentUser.role, targetUser.role, "menghapus");

  await RefreshTokenModel.revokeAllForUser(id);
  const deletedUser = await UserModel.delete(id);

  return { message: "Akun pengguna berhasil dihapus dari sistem.", user: deletedUser };
};

export const changePasswordService = async (userId, { currentPassword, newPassword }) => {
  if (!currentPassword || !newPassword) {
    throw createHttpError("Kata sandi saat ini dan kata sandi baru wajib diisi.", 400);
  }

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    throw createHttpError(`Kata sandi baru minimal ${MIN_PASSWORD_LENGTH} karakter.`, 400);
  }

  const user = await UserModel.findByIdWithPassword(userId);
  if (!user) {
    throw createHttpError("Pengguna tidak ditemukan.", 404);
  }

  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) {
    throw createHttpError("Kata sandi saat ini tidak sesuai.", 400);
  }

  const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
  return await UserModel.updatePassword(userId, hashedPassword);
};

export const changeUserRoleService = async ({
  targetUserId,
  newRole,
  reason,
  currentUser,
  ipAddress = null,
  userAgent = null,
}) => {
  if (!newRole) {
    throw createHttpError("Peran baru (newRole) wajib ditentukan.", 400);
  }

  const normalizedNewRole = newRole.toUpperCase().trim();
  if (!VALID_ROLES.includes(normalizedNewRole)) {
    throw createHttpError(
      `Peran '${newRole}' tidak valid. Pilihan yang tersedia: ${VALID_ROLES.join(", ")}`,
      400
    );
  }

  if (!reason || typeof reason !== "string" || reason.trim().length < 5) {
    throw createHttpError(
      "Alasan perubahan peran wajib diisi (minimal 5 karakter) untuk keperluan audit keamanan.",
      400
    );
  }

  const targetUser = await UserModel.findById(targetUserId);
  if (!targetUser) {
    throw createHttpError("Pengguna target tidak ditemukan.", 404);
  }

  const isSelf = String(currentUser.id) === String(targetUserId);
  if (isSelf) {
    throw createHttpError(
      "Akses ditolak (Self-Protection Guard): Anda tidak dapat mengubah peran akun Anda sendiri.",
      400
    );
  }

  if (targetUser.role === normalizedNewRole) {
    throw createHttpError(
      `Pengguna sudah memiliki peran ${normalizedNewRole}.`,
      400
    );
  }

  // Hierarchy Guard
  assertCanManageTargetRole(currentUser.role, targetUser.role, "mengubah peran");
  assertCanManageTargetRole(currentUser.role, normalizedNewRole, "menetapkan peran");

  // Guard: Last Superadmin Protection
  if (targetUser.role === "SUPERADMIN" && normalizedNewRole !== "SUPERADMIN") {
    const { rows } = await pool.query(
      "SELECT COUNT(*)::int AS count FROM users WHERE role = 'SUPERADMIN' AND is_active = true;"
    );
    const superadminCount = rows[0]?.count || 0;
    if (superadminCount <= 1) {
      throw createHttpError(
        "ROLE_CHANGE_BLOCKED: Sistem mewajibkan setidaknya terdapat minimal 1 akun Superadmin yang aktif.",
        400
      );
    }
  }

  // Guard: Active Operational Session Block
  if (targetUser.role === "RIDER") {
    const activeSession = await OperationalSessionRepository.getInstance().findActiveSessionByRiderId(targetUserId);
    if (activeSession && ["CLAIMED", "CHECKED_IN", "ACTIVE"].includes(activeSession.session_status || activeSession.status)) {
      throw createHttpError(
        "ROLE_CHANGE_BLOCKED: Pengguna masih memiliki sesi operasional lapangan yang aktif. Selesaikan atau checkout sesi operasional terlebih dahulu.",
        400
      );
    }
  }

  // Perform Role Transition
  const updatedUser = await UserModel.updateRole(targetUserId, normalizedNewRole);

  // Invalidate all active sessions immediately
  await RefreshTokenModel.revokeAllForUser(targetUserId);

  // Real-Time Notification via Socket.IO
  try {
    socketManager.sendToUser(targetUserId, "access:changed", {
      reason: "ROLE_CHANGED",
      previousRole: targetUser.role,
      newRole: normalizedNewRole,
      requiresReauthentication: true,
    });
  } catch (socketErr) {
    console.warn(`[USER SERVICE] Failed to emit access:changed event: ${socketErr.message}`);
  }

  // Audit Log
  auditLogger.logAction({
    userId: currentUser.id,
    userRole: currentUser.role,
    action: "ROLE_CHANGED",
    entityType: "USER",
    entityId: targetUser.id,
    details: {
      target_user_id: targetUser.id,
      target_name: targetUser.name,
      target_email: targetUser.email,
      previous_role: targetUser.role,
      new_role: normalizedNewRole,
      reason: reason.trim(),
    },
    ipAddress,
    userAgent,
    status: "SUCCESS",
  });

  return {
    user: updatedUser,
    previous_role: targetUser.role,
    new_role: normalizedNewRole,
    message: `Peran pengguna ${targetUser.name} berhasil diubah dari ${targetUser.role} menjadi ${normalizedNewRole}. Seluruh sesi aktif pengguna telah dicabut.`,
  };
};
