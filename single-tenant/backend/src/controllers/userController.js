import {
  getProfileService,
  getAllUsersService,
  getUserByIdService,
  createUserService,
  updateUserService,
  setUserStatusService,
  deleteUserService,
  changePasswordService,
  resendActivationService,
  revokeUserSessionsService,
  changeUserRoleService,
} from "../services/userService.js";
import { sendSuccess, sendPaginated, sendError } from "../utils/apiResponse.js";

const sanitizeUser = (userObj) => {
  if (!userObj) return null;
  const { password, ...safe } = userObj;
  return safe;
};

const handleControllerError = (res, error, defaultStatus = 500) => {
  if (error.code === "23505") {
    return sendError(res, "Email atau username sudah terdaftar.", 400);
  }
  const statusCode = error.statusCode || defaultStatus;
  return sendError(res, error.message || "Internal server error", statusCode);
};

export const getProfile = async (req, res) => {
  try {
    const user = await getProfileService(req.user.id);
    const safeUser = sanitizeUser(user);
    return sendSuccess(res, safeUser, "Profil pengguna berhasil dimuat.", 200, { user: safeUser });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { name, email, phone, birth_date } = req.body;
    const updatedUser = await updateUserService(
      req.user.id,
      { name, email, phone, birth_date },
      req.user
    );
    const safeUser = sanitizeUser(updatedUser);
    return sendSuccess(res, safeUser, "Profil berhasil diperbarui.", 200, { user: safeUser });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page || "1", 10);
    const limit = parseInt(req.query.limit || "20", 10);

    const result = await getAllUsersService(req.user, req.query);
    const safeUsers = (result.users || []).map(sanitizeUser);

    const pagination = {
      page,
      limit,
      total_records: result.total_records !== undefined ? result.total_records : safeUsers.length,
      total_pages: Math.ceil((result.total_records || safeUsers.length) / limit) || 1,
    };

    return sendPaginated(res, safeUsers, pagination, "Daftar pengguna berhasil dimuat.", 200, {
      users: safeUsers,
    });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await getUserByIdService(id, req.user);
    const safeUser = sanitizeUser(user);
    return sendSuccess(res, safeUser, "Detail pengguna berhasil dimuat.", 200, { user: safeUser });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const createUser = async (req, res) => {
  try {
    const { username, name, email, password, phone, role } = req.body;
    const newUser = await createUserService(
      { username, name, email, password, phone, role },
      req.user
    );
    const safeUser = sanitizeUser(newUser);
    return sendSuccess(res, safeUser, "Pengguna berhasil dibuat.", 201, { user: safeUser });
  } catch (error) {
    return handleControllerError(res, error, 400);
  }
};

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, role } = req.body;

    const updatedUser = await updateUserService(
      id,
      { name, email, phone, role },
      req.user
    );
    const safeUser = sanitizeUser(updatedUser);
    return sendSuccess(res, safeUser, "Data pengguna berhasil diperbarui.", 200, { user: safeUser });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const setUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    const result = await setUserStatusService(id, is_active, req.user);
    const safeUser = sanitizeUser(result.user);
    return sendSuccess(res, safeUser, result.message || "Status pengguna berhasil diubah.", 200, { user: safeUser });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await deleteUserService(id, req.user);
    const safeUser = sanitizeUser(result.user);
    return sendSuccess(res, safeUser, result.message || "Pengguna berhasil dihapus.", 200, { user: safeUser });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const resendActivation = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await resendActivationService(id, req.user);
    const safeUser = sanitizeUser(result.user);
    return sendSuccess(
      res,
      {
        user: safeUser,
        invitation_token: result.invitation_token,
        invitation_link: result.invitation_link,
        expires_at: result.expires_at,
      },
      result.message || "Tautan aktivasi baru berhasil dibuat.",
      200
    );
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const revokeUserSessions = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await revokeUserSessionsService(id, req.user);
    const safeUser = sanitizeUser(result.user);
    return sendSuccess(res, safeUser, result.message || "Seluruh sesi aktif pengguna berhasil dicabut.", 200, {
      user: safeUser,
    });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    await changePasswordService(req.user.id, { currentPassword, newPassword });
    return sendSuccess(res, null, "Kata sandi berhasil diperbarui.", 200);
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const changeUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { newRole, role, reason } = req.body;
    const targetRole = newRole || role;

    const result = await changeUserRoleService({
      targetUserId: id,
      newRole: targetRole,
      reason,
      currentUser: req.user,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    const safeUser = sanitizeUser(result.user);
    return sendSuccess(
      res,
      {
        user: safeUser,
        previous_role: result.previous_role,
        new_role: result.new_role,
      },
      result.message,
      200,
      { user: safeUser }
    );
  } catch (error) {
    return handleControllerError(res, error);
  }
};


