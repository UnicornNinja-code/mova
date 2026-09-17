/*
 * authController.ts
 * Authentication HTTP Controller in TypeScript
 */

import jwt from "jsonwebtoken";
import type { Request, Response } from "express";
import {
  registerService,
  loginService,
  forgotPasswordService,
  resetPasswordService,
  verifyResetTokenService,
  checkInvitationService,
  refreshTokenService,
  logoutService,
  generateCaptchaService,
  googleLoginService,
  checkRiskStatusService,
} from "../services/authService.js";

const REFRESH_TOKEN_COOKIE_NAME = "refreshToken";
const REFRESH_TOKEN_DAYS = parseInt(process.env.REFRESH_TOKEN_DAYS || "30", 10);

const getRefreshCookieOptions = (): any => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? ("strict" as const) : ("lax" as const),
  maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
  path: "/",
});

export const getCaptcha = async (req: Request, res: Response): Promise<any> => {
  try {
    const oldCaptchaId = (req.query.old_captcha_id as string) || undefined;
    const challenge = await generateCaptchaService(oldCaptchaId);
    return res.status(200).json(challenge);
  } catch (error: any) {
    console.error("💥 Error in getCaptcha:", error);
    return res.status(500).json({ msg: "Gagal membuat CAPTCHA.", error: error.message });
  }
};

export const getRiskStatus = async (req: Request, res: Response): Promise<any> => {
  try {
    const rawIp = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "";
    const cleanIp = rawIp.split(",")[0].trim().replace(/^::ffff:/, "");
    const identifier = req.query.identifier as string | undefined;

    const result = await checkRiskStatusService(cleanIp, identifier);
    return res.status(200).json(result);
  } catch (error: any) {
    console.error("💥 Error in getRiskStatus:", error);
    return res.status(500).json({ msg: "Gagal memeriksa status risiko IP.", error: error.message });
  }
};

export const register = async (req: Request, res: Response): Promise<any> => {
  try {
    const { token, username, name, email, password, birth_date } = req.body;
    const result = await registerService({ token, username, name, email, password, birth_date });
    return res.status(200).json(result);
  } catch (error: any) {
    if (error.code === "23505") {
      return res.status(400).json({ msg: "Email atau username sudah terdaftar." });
    }
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Gagal memproses pendaftaran/aktivasi." });
  }
};

export const login = async (req: Request, res: Response): Promise<any> => {
  try {
    const identifier = req.body.identifier || req.body.username || req.body.email;
    const password = req.body.password;
    const captcha_id = req.body.captcha_id;
    const captcha_answer = req.body.captcha_answer || req.body.answer;
    const ip_address = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "";
    const user_agent = req.headers["user-agent"] || "";

    const result = await loginService({
      identifier,
      password,
      captcha_id,
      captcha_answer,
      ip_address,
      user_agent,
    });

    res.cookie(REFRESH_TOKEN_COOKIE_NAME, result.refreshToken, getRefreshCookieOptions());

    return res.status(200).json({
      msg: "Login successful",
      token: result.token,
      refreshToken: result.refreshToken,
      user: result.user,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      status: "error",
      statusCode,
      msg: error.message || "Gagal melakukan login.",
      requires_captcha: !!error.requires_captcha,
    });
  }
};

export const googleLogin = async (req: Request, res: Response): Promise<any> => {
  try {
    const { email, name, google_id, avatar_url } = req.body;
    const ip_address = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "";
    const user_agent = req.headers["user-agent"] || "";

    const result = await googleLoginService({
      email,
      name,
      google_id,
      avatar_url,
      ip_address,
      user_agent,
    });

    res.cookie(REFRESH_TOKEN_COOKIE_NAME, result.refreshToken, getRefreshCookieOptions());

    return res.status(200).json({
      msg: "Google Login successful",
      token: result.token,
      user: result.user,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Gagal melakukan login via Google." });
  }
};

export const forgotPassword = async (req: Request, res: Response): Promise<any> => {
  try {
    const { email } = req.body;
    const ip_address = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "";
    const user_agent = req.headers["user-agent"] || "";

    const result = await forgotPasswordService(email, ip_address, user_agent);
    return res.status(200).json(result);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Gagal memproses pemulihan kata sandi." });
  }
};

export const resetPassword = async (req: Request, res: Response): Promise<any> => {
  try {
    const { token, password, birth_date } = req.body;
    const ip_address = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "";
    const user_agent = req.headers["user-agent"] || "";

    const result = await resetPasswordService({ token, password, birth_date, ip_address, user_agent });
    return res.status(200).json(result);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Gagal mereset kata sandi." });
  }
};

export const checkInvitation = async (req: Request, res: Response): Promise<any> => {
  try {
    const { email, identifier } = req.body;
    const ip_address = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "";
    const user_agent = req.headers["user-agent"] || "";
    const result = await checkInvitationService(identifier || email, ip_address, user_agent);
    return res.status(200).json(result);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Gagal memeriksa status akun." });
  }
};

export const checkAccountStatus = checkInvitation;

export const verifyResetToken = async (req: Request, res: Response): Promise<any> => {
  try {
    const token = req.params.token as string;
    const result = await verifyResetTokenService(token);
    return res.status(200).json(result);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Gagal memvalidasi token." });
  }
};

export const refreshToken = async (req: Request, res: Response): Promise<any> => {
  try {
    const token = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME] || req.body?.token;
    const ip_address = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "";
    const user_agent = req.headers["user-agent"] || "";

    const result = await refreshTokenService(token, ip_address, user_agent);

    res.cookie(REFRESH_TOKEN_COOKIE_NAME, result.refreshToken, getRefreshCookieOptions());

    return res.status(200).json({
      msg: "Token refreshed successfully",
      token: result.token,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Gagal memperbarui token sesi." });
  }
};

export const logout = async (req: Request, res: Response): Promise<any> => {
  try {
    const authHeader = req.headers["authorization"];
    const accessToken = authHeader && authHeader.split(" ")[1];
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME] || req.body?.token;

    let userId = (req as any).user?.id;
    let userRole = (req as any).user?.role;

    if (!userId && accessToken) {
      try {
        const decoded = jwt.decode(accessToken) as any;
        if (decoded?.id) {
          userId = decoded.id;
          userRole = decoded.role;
        }
      } catch {}
    }

    const result = await logoutService(refreshToken, accessToken, userId, userRole);

    res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict" as const,
      path: "/api/auth",
    });

    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    return res.status(200).json(result);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Gagal memproses logout." });
  }
};

export const getMe = async (req: Request, res: Response): Promise<any> => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  if (!req.user) {
    return res.status(401).json({ authenticated: false, msg: "Unauthorized" });
  }
  const { password, ...safeUser } = req.user;
  return res.status(200).json({
    authenticated: true,
    user: safeUser,
  });
};
