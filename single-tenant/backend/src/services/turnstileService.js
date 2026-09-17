/*
 *   Copyright (c) 2026
 *   All rights reserved.
 *   turnstileService.js — Cloudflare Turnstile Anti-Abuse Token Verification
 *   Implements First Principles Defense-in-Depth verification against Cloudflare Siteverify API.
 */

import { env } from "../config/env.js";

const TURNSTILE_VERIFY_ENDPOINT = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Verify Cloudflare Turnstile CAPTCHA token against Cloudflare Siteverify API.
 * 
 * @param {Object} params
 * @param {string} params.token - Token returned by Cloudflare Turnstile widget
 * @param {string} [params.remoteIp] - Client IP address
 * @param {string} [params.idempotencyKey] - Optional idempotency key for replay prevention
 * @returns {Promise<{ success: boolean, hostname?: string, errorCodes?: string[], raw?: any }>}
 */
export async function verifyTurnstileToken({ token, remoteIp, idempotencyKey }) {
  // If Turnstile is explicitly disabled in non-prod
  if (!env.TURNSTILE?.ENABLED) {
    return { success: true, bypassed: true };
  }

  const secretKey = env.TURNSTILE?.SECRET_KEY;
  if (!secretKey) {
    console.warn("⚠️ [Turnstile] TURNSTILE_SECRET_KEY is not configured. Permitting request in development.");
    return { success: true, bypassed: true };
  }

  if (!token || typeof token !== "string" || !token.trim()) {
    return {
      success: false,
      errorCodes: ["missing-input-response"],
      message: "Token verifikasi CAPTCHA Turnstile wajib disertakan.",
    };
  }

  try {
    const formData = new URLSearchParams();
    formData.append("secret", secretKey);
    formData.append("response", token.trim());
    if (remoteIp) {
      formData.append("remoteip", remoteIp);
    }
    if (idempotencyKey) {
      formData.append("idempotency_key", idempotencyKey);
    }

    const response = await fetch(TURNSTILE_VERIFY_ENDPOINT, {
      method: "POST",
      body: formData,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    if (!response.ok) {
      console.error(`❌ [Turnstile] HTTP error from siteverify API: ${response.status}`);
      return {
        success: false,
        errorCodes: [`http-error-${response.status}`],
        message: "Gagal berkomunikasi dengan server verifikasi Cloudflare.",
      };
    }

    const data = await response.json();

    if (data.success) {
      return {
        success: true,
        challenge_ts: data.challenge_ts,
        hostname: data.hostname,
        action: data.action,
        cdata: data.cdata,
      };
    }

    console.warn("⚠️ [Turnstile] Token verification failed:", data["error-codes"]);
    return {
      success: false,
      errorCodes: data["error-codes"] || ["invalid-token"],
      message: "Verifikasi keamanan Turnstile tidak valid atau token telah kedaluwarsa.",
      raw: data,
    };
  } catch (error) {
    console.error("❌ [Turnstile] Exception during token verification:", error.message);
    // In development or network errors, we can log and evaluate
    if (env.NODE_ENV !== "production") {
      console.warn("⚠️ [Turnstile] Development network fallback — permitting request.");
      return { success: true, bypassed: true };
    }

    return {
      success: false,
      errorCodes: ["verification-error"],
      message: "Terjadi kesalahan saat memvalidasi CAPTCHA.",
    };
  }
}
