/*
 * authMiddleware.ts
 * JWT Authentication & Session Consistency Middleware in TypeScript (MOVA Server Truth)
 */

import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { UserModel } from "../models/userModel.js";
import { redisClient } from "../config/redis.js";

export const authenticateToken = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    // 1. Enforce strict Cache-Control: no-store on ALL authenticated API responses
    // Prevents browser back/forward cache (bfcache) or intermediate proxies from storing sensitive/snapshot data
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Surrogate-Control", "no-store");

    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({ msg: "No token provided, unauthorized", code: "NO_TOKEN" });
    }

    // 2. Check if token has been revoked in Redis (explicit logout or revocation)
    try {
      const isRevoked = await redisClient.get(`jwt:revoked:${token}`);
      if (isRevoked) {
        return res.status(401).json({
          msg: "Sesi telah berakhir atau di-logout. Silakan login kembali.",
          code: "SESSION_REVOKED",
        });
      }
    } catch (redisErr: any) {
      console.warn("⚠️ [AUTH MIDDLEWARE] Redis check failed:", redisErr.message);
    }

    // 3. Verify JWT signature and payload
    let decoded: { id: string | number; role: string; iat?: number };
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || "fallback_secret") as any;
    } catch (jwtErr: any) {
      return res.status(401).json({
        msg: "Token tidak valid atau telah kedaluwarsa.",
        code: "TOKEN_EXPIRED",
        error: jwtErr.message,
      });
    }

    // 4. Check if user logged out globally after this token was issued
    if (decoded?.id && decoded?.iat) {
      try {
        const userLogoutAt = await redisClient.get(`user:logout_at:${decoded.id}`);
        if (userLogoutAt && decoded.iat * 1000 < parseInt(userLogoutAt, 10)) {
          return res.status(401).json({
            msg: "Sesi Anda telah kedaluwarsa karena logout dari sesi lain.",
            code: "SESSION_REVOKED",
          });
        }
      } catch (redisErr: any) {
        console.warn("⚠️ [AUTH MIDDLEWARE] Redis user:logout_at check failed:", redisErr.message);
      }
    }

    // 5. Query user from database to ensure account still exists and is active
    const user = await UserModel.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ msg: "Pengguna tidak ditemukan, unauthorized", code: "USER_NOT_FOUND" });
    }

    if (user.is_active === false) {
      return res.status(403).json({
        msg: "Akun Anda telah dinonaktifkan.",
        code: "USER_DEACTIVATED",
        error: "USER_DEACTIVATED",
      });
    }

    // 6. Mandatory first-login password change security check
    // If account has first_login = true, prevent access to all protected operational features
    if (user.first_login === true) {
      const url = req.originalUrl || req.url;
      const isAllowed =
        url.includes("/users/me/complete-first-login") ||
        url.includes("/auth/me") ||
        url.includes("/auth/logout") ||
        url.includes("/auth/refresh-token");

      if (!isAllowed) {
        return res.status(403).json({
          msg: "Akses Ditolak: Anda wajib mengganti password sementara sebelum mengakses fitur sistem.",
          code: "FIRST_LOGIN_REQUIRED",
          error: "FIRST_LOGIN_REQUIRED",
          first_login: true,
        });
      }
    }

    req.user = user;
    next();
  } catch (error: any) {
    console.error("[AUTH MIDDLEWARE] Internal authentication error:", error);
    return res.status(500).json({ msg: "Internal server error during authentication", error: error.message });
  }
};
