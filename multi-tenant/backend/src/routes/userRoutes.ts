/*
 * userRoutes.ts
 * API Routes for User Management in TypeScript
 */

import express from "express";
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  setUserStatus,
  deleteUser,
  getProfile,
  changePassword,
  adminResetPassword,
  resendInvitation,
  completeFirstLogin,
} from "../controllers/userController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";

import {
  getUserPreferences,
  updateUserPreferences,
} from "../controllers/userPreferenceController.js";

const router = express.Router();

router.use(authenticateToken);

router.get("/profile", getProfile);
router.put("/change-password", changePassword);

// First-login mandatory password setup (all authenticated roles)
router.patch("/me/complete-first-login", completeFirstLogin);

// User preferences (map theme, notification settings, dashboard layout)
router.get("/preferences", getUserPreferences);
router.put("/preferences", updateUserPreferences);

// Only Superadmin & Management can view all users
router.get("/", checkRole(["SUPERADMIN", "MANAGEMENT"]), getAllUsers);

// Create user account
router.post("/", checkRole(["SUPERADMIN", "MANAGEMENT"]), createUser);

// Resend invitation link
router.post("/:id/resend-invitation", checkRole(["SUPERADMIN", "MANAGEMENT"]), resendInvitation);

// Only Superadmin & Management can view specific user details
router.get("/:id", checkRole(["SUPERADMIN", "MANAGEMENT"]), getUserById);

// Update user profile/role
router.put("/:id", updateUser);

// Administrative password reset
router.post("/:id/reset-password", checkRole(["SUPERADMIN", "MANAGEMENT"]), adminResetPassword);

// Activate / Deactivate user account
router.patch("/:id/status", checkRole(["SUPERADMIN", "MANAGEMENT"]), setUserStatus);

// Delete user
router.delete("/:id", checkRole(["SUPERADMIN", "MANAGEMENT"]), deleteUser);

export default router;
