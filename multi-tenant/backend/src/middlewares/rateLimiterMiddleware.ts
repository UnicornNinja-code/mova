/*
 * rateLimiterMiddleware.ts
 * Redis-Backed Distributed Rate Limiter with Custom UI Toast Notices in TypeScript
 */

import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import { redisClient } from "../config/redis.js";
import type { Request, Response } from "express";

/**
 * Helper to build RedisStore instance
 */
const createRedisStore = (prefix: string) => {
  return new RedisStore({
    sendCommand: (...args: string[]) => (redisClient as any).sendCommand(args),
    prefix: `RL:${prefix}:`,
  });
};

/**
 * Standardized 429 Too Many Requests JSON response builder with ui_notice toast metadata
 */
const build429Response = (title: string, message: string) => (req: Request, res: Response) => {
  return res.status(429).json({
    status: "error",
    statusCode: 429,
    msg: message,
    ui_notice: {
      type: "warning",
      title: title || "Batas Request Terlampaui",
      message,
    },
  });
};

/**
 * General API rate limiter
 */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === "production" ? 1000 : 10000,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore("GLOBAL_API"),
  handler: build429Response(
    "Trafik Terlalu Tinggi",
    "Batas penggunaan API tercapai. Harap tunggu beberapa saat sebelum mencoba lagi."
  ),
  skip: (req) => process.env.NODE_ENV === "test" || req.headers["x-test-suite"] === "true",
});

/**
 * Rate Limiter for CAPTCHA generation (GET /api/auth/captcha)
 */
export const captchaLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.AUTH_CAPTCHA_IP_LIMIT || 60),
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
  store: createRedisStore("AUTH_CAPTCHA"),
  handler: build429Response(
    "Batas Permintaan CAPTCHA",
    "Terlalu banyak permintaan pembuatan kode CAPTCHA. Harap tunggu 1 menit sebelum mencoba kembali."
  ),
});

/**
 * Rate Limiter for Refresh Token (POST /api/auth/refresh-token)
 */
export const refreshTokenLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
  store: createRedisStore("AUTH_REFRESH"),
  handler: build429Response(
    "Batas Refresh Token",
    "Batas request pembaruan token terlampaui. Harap tunggu beberapa saat sebelum mencoba kembali."
  ),
});

/**
 * Dimension 1: IP-Based Login Rate Limiter (prevents 1 IP -> many accounts brute-force)
 */
export const loginIpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: Number(process.env.AUTH_LOGIN_IP_LIMIT || 20),
  standardHeaders: true,
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false, ip: false },
  skip: () => process.env.NODE_ENV === "test",
  keyGenerator: (req) => {
    return (req.ip || req.socket.remoteAddress || "127.0.0.1").replace(/::ffff:/, "");
  },
  store: createRedisStore("AUTH_LOGIN_IP"),
  handler: build429Response(
    "Batas Percobaan Login IP",
    "Terlalu banyak percobaan masuk dari alamat IP ini. Harap tunggu 5 menit sebelum mencoba kembali."
  ),
});

/**
 * Dimension 2: Account-Based Login Rate Limiter (prevents many IPs -> 1 account credential stuffing)
 */
export const loginAccountLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: Number(process.env.AUTH_LOGIN_ACCOUNT_LIMIT || 10),
  standardHeaders: true,
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false, ip: false },
  skip: () => process.env.NODE_ENV === "test",
  keyGenerator: (req) => {
    const rawId = req.body?.identifier || req.body?.email || req.body?.username || "anonymous";
    return String(rawId).trim().toLowerCase();
  },
  store: createRedisStore("AUTH_LOGIN_ACCOUNT"),
  handler: build429Response(
    "Batas Percobaan Akun Terlampaui",
    "Terlalu banyak percobaan masuk untuk akun ini. Harap tunggu 5 menit demi keamanan kredensial akun Anda."
  ),
});

/**
 * Unified Two-Dimensional Login Limiter Middleware
 */
export const loginLimiter = [loginIpLimiter, loginAccountLimiter];

/**
 * Rate Limiter for Password Reset
 */
export const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
  store: createRedisStore("AUTH_FORGOT"),
  handler: build429Response(
    "Batas Reset Password",
    "Batas pengajuan reset password tercapai. Harap coba lagi dalam beberapa saat."
  ),
});

/**
 * Dedicated Rate Limiter for Account Status Checking
 */
export const checkAccountStatusLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
  store: createRedisStore("AUTH_CHECK_STATUS"),
  handler: build429Response(
    "Batas Pengecekan Akun",
    "Terlalu banyak permintaan pengecekan status akun. Harap tunggu beberapa saat sebelum mencoba kembali."
  ),
});

/**
 * Rate Limiter for User Registration
 */
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
  store: createRedisStore("AUTH_REGISTER"),
  handler: build429Response(
    "Batas Pendaftaran Akun",
    "Batas pendaftaran akun baru terlampaui. Harap tunggu 1 jam."
  ),
});

/**
 * Rate Limiter for Overpass Road Sync
 */
export const overpassSyncLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 2,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
  store: createRedisStore("OVERPASS_ROAD"),
  handler: build429Response(
    "Batas Sinkronisasi Jalan",
    "Batas sinkronisasi jalan Overpass tercapai. Maksimal 2 request per menit."
  ),
});

/**
 * Rate Limiter for Full City POI Sync
 */
export const citySyncLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 1,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
  store: createRedisStore("OVERPASS_CITY"),
  handler: build429Response(
    "Batas Sinkronisasi POI Kota",
    "Batas sinkronisasi POI skala kota tercapai. Maksimal 1 kali request per 10 menit."
  ),
});
