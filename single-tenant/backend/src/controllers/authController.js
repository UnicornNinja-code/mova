import {
  registerService,
  loginService,
  firstLoginService,
  forgotPasswordService,
  resetPasswordService,
  verifyResetTokenService,
  refreshTokenService,
  logoutService,
} from "../services/authService.js";
import { env } from "../config/env.js";

const REFRESH_TOKEN_COOKIE_NAME = "refreshToken";
const REFRESH_TOKEN_DAYS = env.JWT.REFRESH_TOKEN_DAYS;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const getRefreshCookieOptions = () => ({
  httpOnly: true,
  secure: env.isProduction,
  sameSite: env.isProduction ? "Strict" : "Lax",
  maxAge: REFRESH_TOKEN_DAYS * ONE_DAY_MS,
  path: "/",
});

const handleControllerError = (res, error, defaultStatus = 500) => {
  if (error.code === "23505") {
    return res.status(400).json({ msg: "Email or username already exists" });
  }
  const statusCode = error.statusCode || defaultStatus;
  return res.status(statusCode).json({ msg: error.message || "Internal server error" });
};

export const register = async (req, res) => {
  try {
    const { token, username, name, email, password, birth_date } = req.body;
    const user = await registerService({ token, username, name, email, password, birth_date });
    return res.status(201).json({
      msg: token ? "Akun berhasil diaktifkan" : "User registered successfully",
      user,
    });
  } catch (error) {
    return handleControllerError(res, error, 400);
  }
};

export const completeFirstLogin = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { newPassword, password } = req.body;
    const result = await firstLoginService({ userId, newPassword: newPassword || password });
    return res.status(200).json({
      success: true,
      msg: "Password berhasil diperbarui. Akun Anda siap digunakan.",
      user: result,
    });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const login = async (req, res) => {
  try {
    const identifier = req.body.identifier || req.body.username || req.body.email;
    const password = req.body.password;

    const result = await loginService({ identifier, password });
    res.cookie(REFRESH_TOKEN_COOKIE_NAME, result.refreshToken, getRefreshCookieOptions());

    return res.status(200).json({
      msg: "Login successful",
      token: result.token,
      refreshToken: result.refreshToken,
      user: result.user,
    });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const result = await forgotPasswordService(email);
    return res.status(200).json(result);
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    const result = await resetPasswordService({ token, password });
    return res.status(200).json(result);
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const verifyResetToken = async (req, res) => {
  try {
    const token = req.params.token || req.query.token;
    if (!token) {
      return res.status(400).json({ valid: false, msg: "Token parameter is required" });
    }
    const result = await verifyResetTokenService(token);
    return res.status(200).json(result);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ valid: false, msg: error.message || "Internal server error" });
  }
};

export const refreshToken = async (req, res) => {
  try {
    const token = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME] || req.body?.refreshToken || req.body?.token;
    const result = await refreshTokenService(token);

    res.cookie(REFRESH_TOKEN_COOKIE_NAME, result.refreshToken, getRefreshCookieOptions());

    return res.status(200).json({
      msg: "Token refreshed successfully",
      token: result.token,
      refreshToken: result.refreshToken,
      user: result.user,
    });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const logout = async (req, res) => {
  try {
    const token = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME] || req.body?.refreshToken || req.body?.token;
    const result = await logoutService(token);

    res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
      httpOnly: true,
      secure: env.isProduction,
      sameSite: env.isProduction ? "Strict" : "Lax",
      path: "/",
    });

    return res.status(200).json(result);
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const getMe = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ msg: "Unauthorized" });
  }
  const { password, ...safeUser } = req.user;
  return res.status(200).json({ user: safeUser });
};
