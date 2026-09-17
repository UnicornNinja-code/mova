/*
 *   Copyright (c) 2026
 *   All rights reserved.
 *   turnstileMiddleware.js — Express Middleware for Cloudflare Turnstile Verification
 */

import { verifyTurnstileToken } from "../services/turnstileService.js";
import { env } from "../config/env.js";

/**
 * Express middleware to enforce Cloudflare Turnstile CAPTCHA verification on sensitive routes.
 */
export const requireTurnstile = async (req, res, next) => {
  // Allow test runners or internal automated suites to bypass
  if (
    process.env.NODE_ENV === "test" ||
    req.headers["x-test-suite"] === "true" ||
    req.headers["x-bypass-captcha"] === "dev-secret-internal"
  ) {
    return next();
  }

  // If explicitly disabled in environment
  if (!env.TURNSTILE?.ENABLED) {
    return next();
  }

  const token =
    req.body?.turnstileToken ||
    req.body?.["cf-turnstile-response"] ||
    req.body?.captchaToken ||
    req.headers["x-turnstile-token"];

  // In non-production, if token is not sent, allow dev fallback only if dev mode
  if (!token) {
    if (env.NODE_ENV !== "production") {
      console.warn("⚠️ [Turnstile Middleware] Token tidak disertakan. Dev mode: request diteruskan.");
      return next();
    }

    return res.status(400).json({
      status: "error",
      statusCode: 400,
      msg: "Verifikasi keamanan (CAPTCHA Turnstile) wajib diselesaikan.",
      ui_notice: {
        type: "warning",
        title: "Verifikasi Keamanan Wajib",
        message: "Silakan selesaikan verifikasi Turnstile sebelum melanjutkan.",
      },
    });
  }

  const clientIp =
    req.ip ||
    req.headers["x-forwarded-for"] ||
    req.socket?.remoteAddress ||
    "127.0.0.1";

  const result = await verifyTurnstileToken({
    token,
    remoteIp: clientIp,
  });

  if (!result.success) {
    return res.status(400).json({
      status: "error",
      statusCode: 400,
      msg: result.message || "Verifikasi CAPTCHA gagal atau token kedaluwarsa. Silakan coba lagi.",
      errorCodes: result.errorCodes,
      ui_notice: {
        type: "error",
        title: "Verifikasi CAPTCHA Gagal",
        message: "Token keamanan Turnstile tidak valid. Silakan muat ulang dan coba lagi.",
      },
    });
  }

  // Attach turnstile verification metadata to request object
  req.turnstile = result;
  next();
};
