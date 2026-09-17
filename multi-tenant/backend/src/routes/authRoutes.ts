/*
 * authRoutes.ts
 * API Routes for Authentication in TypeScript
 */

import express from "express";
import {
  register,
  login,
  forgotPassword,
  resetPassword,
  verifyResetToken,
  checkInvitation,
  refreshToken,
  logout,
  getMe,
  getCaptcha,
  getRiskStatus,
  googleLogin,
} from "../controllers/authController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import {
  loginLimiter,
  registerLimiter,
  forgotPasswordLimiter,
  checkAccountStatusLimiter,
  captchaLimiter,
  refreshTokenLimiter,
} from "../middlewares/rateLimiterMiddleware.js";

const router = express.Router();

router.get("/captcha", captchaLimiter, getCaptcha);
router.get("/risk-status", getRiskStatus);
router.post("/google", googleLogin);
router.post("/register", registerLimiter, register);
router.post("/login", loginLimiter, login);
router.post("/forgot-password", forgotPasswordLimiter, forgotPassword);
router.post("/check-invitation", checkAccountStatusLimiter, checkInvitation);
router.post("/check-status", checkAccountStatusLimiter, checkInvitation);
router.post("/reset-password", resetPassword);
router.get("/verify-reset-token/:token", verifyResetToken);
router.post("/refresh-token", refreshTokenLimiter, refreshToken);
router.post("/logout", logout);
router.get("/me", authenticateToken, getMe);

export default router;
