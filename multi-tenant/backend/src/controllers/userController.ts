/*
 * userController.ts
 * User Management HTTP Controller in TypeScript
 */

import type { Request, Response } from "express";
import {
  getProfileService,
  getAllUsersService,
  getUserByIdService,
  createUserService,
  updateUserService,
  setUserStatusService,
  deleteUserService,
  changePasswordService,
  adminResetPasswordService,
  resendInvitationService,
  completeFirstLoginService,
} from "../services/userService.js";

const sanitizeUser = (userObj: any) => {
  if (!userObj) return null;
  const { password, ...safe } = userObj;
  return safe;
};

export const getProfile = async (req: Request, res: Response): Promise<any> => {
  try {
    const user = await getProfileService(req.user.id);
    return res.status(200).json({ user: sanitizeUser(user) });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const getAllUsers = async (req: Request, res: Response): Promise<any> => {
  try {
    const result = await getAllUsersService();
    const safeUsers = (result.users || []).map(sanitizeUser);
    return res.status(200).json({ ...result, users: safeUsers });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const getUserById = async (req: Request, res: Response): Promise<any> => {
  try {
    const id = req.params.id as string;
    const user = await getUserByIdService(id);
    return res.status(200).json({ user: sanitizeUser(user) });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const createUser = async (req: Request, res: Response): Promise<any> => {
  try {
    const { username, name, email, password, role } = req.body;
    const newUser = await createUserService(
      { username, name, email, password, role },
      req.user
    );

    return res.status(201).json({ msg: "User created successfully", user: newUser });
  } catch (error: any) {
    if (error.code === "23505") {
      return res.status(400).json({ msg: "Email or username already exists" });
    }
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const updateUser = async (req: Request, res: Response): Promise<any> => {
  try {
    const id = req.params.id as string;
    const { name, email, role } = req.body;

    const updatedUser = await updateUserService(
      id,
      { name, email, role },
      req.user
    );

    return res.status(200).json({ msg: "User updated successfully", user: updatedUser });
  } catch (error: any) {
    if (error.code === "23505") {
      return res.status(400).json({ msg: "Email or username already exists" });
    }
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const setUserStatus = async (req: Request, res: Response): Promise<any> => {
  try {
    const id = req.params.id as string;
    const { is_active } = req.body;

    const result = await setUserStatusService(id, is_active, req.user);
    return res.status(200).json({ msg: result.message, user: result.user });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const deleteUser = async (req: Request, res: Response): Promise<any> => {
  try {
    const id = req.params.id as string;
    const result = await deleteUserService(id, req.user);
    return res.status(200).json({ msg: result.message });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const changePassword = async (req: Request, res: Response): Promise<any> => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;
    await changePasswordService(userId, { currentPassword, newPassword });
    return res.status(200).json({ msg: "Password berhasil diperbarui." });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Gagal memperbarui password." });
  }
};

export const adminResetPassword = async (req: Request, res: Response): Promise<any> => {
  try {
    const id = req.params.id as string;
    const { password } = req.body;
    const result = await adminResetPasswordService(id, password, req.user);
    return res.status(200).json(result);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Gagal mereset password." });
  }
};

export const resendInvitation = async (req: Request, res: Response): Promise<any> => {
  try {
    const id = req.params.id as string;
    const result = await resendInvitationService(id, req.user);
    return res.status(200).json(result);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Gagal mengirim ulang undangan aktivasi." });
  }
};

export const completeFirstLogin = async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = req.user.id;
    const { newPassword } = req.body;
    const result = await completeFirstLoginService(userId, { newPassword });
    return res.status(200).json(result);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Gagal menyelesaikan first-login setup." });
  }
};
