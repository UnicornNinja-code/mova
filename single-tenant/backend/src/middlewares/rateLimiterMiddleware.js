/*
 *   Copyright (c) 2026 
 *   All rights reserved.
 *   rateLimiterMiddleware.js (Redis-Backed Distributed Rate Limiter with Custom UI Toast Notices)
 */

import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import { redisClient } from "../config/redis.js";

/**
 * Helper to build RedisStore instance or fallback to MemoryStore
 */
const getStore = (prefix) => {
  if (redisClient && (redisClient.isOpen || redisClient.isReady)) {
    return new RedisStore({
      sendCommand: (...args) => redisClient.sendCommand(args),
      prefix: `RL:${prefix}:`,
    });
  }
  return undefined;
};

/**
 * Standardized 429 Too Many Requests JSON response builder with ui_notice toast metadata
 */
const build429Response = (title, message) => (req, res) => {
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
 * Helper to determine whether a request can skip rate limiting.
 * STRICT SECURITY INVARIANT: Absolute lockout of bypass in production under any circumstance.
 */
const shouldSkipRateLimiter = (req) => {
  if (process.env.NODE_ENV === "production") {
    return false;
  }
  return process.env.NODE_ENV === "test" || req.headers["x-test-suite"] === "true";
};

/**
 * General API rate limiter (5000 requests per 1 minute window in dev/test, production protects against DDoS)
 */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === "production" ? 1000 : 10000,
  standardHeaders: true,
  legacyHeaders: false,
  store: getStore("GLOBAL_API"),
  handler: build429Response(
    "Trafik Terlalu Tinggi",
    "Batas penggunaan API tercapai. Harap tunggu beberapa saat sebelum mencoba lagi."
  ),
  skip: shouldSkipRateLimiter,
});

/**
 * Strict Rate Limiter for Login (5 failed requests per 1 minute per IP + User Account)
 */
const loginLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: process.env.NODE_ENV === "production" ? 5 : 500,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  skip: shouldSkipRateLimiter,
  keyGenerator: (req, res) => {
    const clientIp = ipKeyGenerator(req, res);
    const identifier = req.body?.identifier || req.body?.email || "anonymous";
    return `${clientIp}:${identifier}`;
  },
  store: getStore("AUTH_LOGIN"),
  handler: build429Response(
    "Batas Login Terlampaui",
    "Batas percobaan login gagal terlampaui. Harap tunggu 1 menit sebelum mencoba kembali."
  ),
});

const FORGOT_PW_COOLDOWN_SECONDS = 120; // 2 minutes cooldown per email
const memoryForgotCooldown = new Map(); // Memory fallback if Redis not active

/**
 * Cooldown Lock Rate Limiter for Forgot Password (2 Minutes Cooldown per Email + IP Guard)
 */
const forgotPasswordLimiter = async (req, res, next) => {
  try {
    const email = req.body?.email?.trim().toLowerCase();
    const clientIp = req.ip || req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "127.0.0.1";

    if (!email) {
      return res.status(400).json({ error: "Email wajib diisi", msg: "Email wajib diisi" });
    }

    if (redisClient && (redisClient.isOpen || redisClient.isReady)) {
      const emailKey = `rate-limit:forgot-pw:email:${email}`;
      const ipKey = `rate-limit:forgot-pw:ip:${clientIp}`;

      // 1. Cek sisa cooldown berdasarkan email
      const ttlEmail = await redisClient.ttl(emailKey);
      if (ttlEmail > 0) {
        return res.status(429).json({
          status: "error",
          statusCode: 429,
          error: "Terlalu banyak permintaan.",
          retryAfter: ttlEmail,
          message: `Silakan tunggu ${ttlEmail} detik sebelum meminta tautan baru.`,
          msg: `Silakan tunggu ${ttlEmail} detik sebelum meminta tautan baru.`,
          ui_notice: {
            type: "warning",
            title: "Batas Permintaan",
            message: `Silakan tunggu ${ttlEmail} detik sebelum meminta tautan baru.`,
          },
        });
      }

      // 2. Cek akumulasi request dari satu IP (mencegah bot spamming banyak email)
      const ipRequests = await redisClient.incr(ipKey);
      if (ipRequests === 1) {
        await redisClient.expire(ipKey, 600); // Window 10 menit
      }
      if (ipRequests > 10) {
        const ttlIp = await redisClient.ttl(ipKey);
        return res.status(429).json({
          status: "error",
          statusCode: 429,
          error: "Terlalu banyak permintaan dari jaringan ini.",
          retryAfter: ttlIp > 0 ? ttlIp : 600,
          message: "Terlalu banyak permintaan dari jaringan ini. Harap coba lagi nanti.",
          msg: "Terlalu banyak permintaan dari jaringan ini. Harap coba lagi nanti.",
        });
      }

      // Pasang lock 2 menit untuk email yang ditargetkan
      await redisClient.set(emailKey, "locked", { EX: FORGOT_PW_COOLDOWN_SECONDS });
    } else {
      // In-memory fallback
      const now = Date.now();
      const existing = memoryForgotCooldown.get(email);
      if (existing && existing > now) {
        const remainingSec = Math.ceil((existing - now) / 1000);
        return res.status(429).json({
          status: "error",
          statusCode: 429,
          error: "Terlalu banyak permintaan.",
          retryAfter: remainingSec,
          message: `Silakan tunggu ${remainingSec} detik sebelum meminta tautan baru.`,
          msg: `Silakan tunggu ${remainingSec} detik sebelum meminta tautan baru.`,
        });
      }
      memoryForgotCooldown.set(email, now + FORGOT_PW_COOLDOWN_SECONDS * 1000);
    }

    next();
  } catch (err) {
    console.warn("[RateLimiter] Error in forgotPasswordLimiter:", err.message);
    next();
  }
};

/**
 * Rate Limiter for User Registration (5 requests per 1 hour)
 */
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: process.env.NODE_ENV === "production" ? 5 : 500,
  standardHeaders: true,
  legacyHeaders: false,
  skip: shouldSkipRateLimiter,
  store: getStore("AUTH_REGISTER"),
  handler: build429Response(
    "Batas Pendaftaran Akun",
    "Batas pendaftaran akun baru terlampaui. Harap tunggu 1 jam."
  ),
});

/**
 * Rate Limiter for Overpass Road Sync (2 requests per minute)
 */
const overpassSyncLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === "production" ? 2 : 500,
  standardHeaders: true,
  legacyHeaders: false,
  skip: shouldSkipRateLimiter,
  store: getStore("OVERPASS_ROAD"),
  handler: build429Response(
    "Batas Sinkronisasi Jalan",
    "Batas sinkronisasi jalan Overpass tercapai. Maksimal 2 request per menit."
  ),
});

/**
 * Rate Limiter for Full City POI Sync (1 request per 10 minutes)
 */
const citySyncLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: process.env.NODE_ENV === "production" ? 1 : 500,
  standardHeaders: true,
  legacyHeaders: false,
  skip: shouldSkipRateLimiter,
  store: getStore("OVERPASS_CITY"),
  handler: build429Response(
    "Batas Sinkronisasi POI Kota",
    "Batas sinkronisasi POI skala kota tercapai. Maksimal 1 kali request per 10 menit."
  ),
});

export {
  apiLimiter,
  loginLimiter,
  forgotPasswordLimiter,
  registerLimiter,
  overpassSyncLimiter,
  citySyncLimiter,
};