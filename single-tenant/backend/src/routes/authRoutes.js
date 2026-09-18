import express from "express";
import {
    register,
    login,
    completeFirstLogin,
    forgotPassword,
    resetPassword,
    verifyResetToken,
    refreshToken,
    logout,
    getMe,
} from "../controllers/authController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { loginLimiter, registerLimiter, forgotPasswordLimiter } from "../middlewares/rateLimiterMiddleware.js";
import { requireTurnstile } from "../middlewares/turnstileMiddleware.js";

const router = express.Router();

router.post("/register", registerLimiter, register);
router.post("/activate", registerLimiter, register);
router.post("/login", loginLimiter, requireTurnstile, login);
router.post("/first-login", authenticateToken, completeFirstLogin);
router.post("/forgot-password", forgotPasswordLimiter, forgotPassword);
router.post("/reset-password", resetPassword);
router.get("/verify-token", verifyResetToken);
router.get("/verify-token/:token", verifyResetToken);
router.get("/verify-reset-token/:token", verifyResetToken);
router.post("/refresh-token", refreshToken);
router.post("/logout", logout);
router.get("/me", authenticateToken, getMe);

export default router;
