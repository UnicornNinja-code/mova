/*
 * captcha.ts
 * Self-Hosted High-Performance SVG CAPTCHA Generator with HMAC-SHA256 & Redis Single-Use
 * MOVA Security Layer (100% first-party, zero external dependencies)
 */

import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "crypto";
import { redisClient } from "../config/redis.js";
import { env } from "../config/env.js";

export interface CaptchaChallenge {
  captcha_id: string;
  svg: string;
  issued_at: number;
  expires_at: number;
  ttl_seconds: number;
}

export interface StoredCaptchaPayload {
  challenge: string;
  issued_at: number;
  expires_at: number;
  signature: string;
  status: "unused" | "consumed";
}

export interface CaptchaVerificationResult {
  valid: boolean;
  reason?: "MISSING" | "EXPIRED" | "REPLAY" | "INVALID_SIGNATURE" | "WRONG_ANSWER";
  msg: string;
}

export class CaptchaUtil {
  private static getSecret(): string {
    return env.SECURITY?.CAPTCHA_SECRET || process.env.CAPTCHA_SECRET || "mova_captcha_hmac_secret_salt_2026";
  }

  private static getTTL(): number {
    return env.SECURITY?.CAPTCHA_TTL_SECONDS || Number(process.env.CAPTCHA_TTL_SECONDS) || 60;
  }

  /**
   * Generate random 5-character alphanumeric text (excluding confusing chars like 0, O, 1, I, l)
   */
  private static generateRandomText(length: number = 5): string {
    const charset = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    let result = "";
    const bytes = randomBytes(length);
    for (let i = 0; i < length; i++) {
      result += charset[bytes[i] % charset.length];
    }
    return result;
  }

  /**
   * Generate distorted SVG image data URL
   */
  private static generateSvg(text: string): string {
    const width = 160;
    const height = 48;
    const colors = ["#FF634A", "#FFA500", "#10B981", "#3B82F6", "#EC4899", "#8B5CF6"];

    let charsSvg = "";
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const x = 20 + i * 26 + (Math.random() * 6 - 3);
      const y = 32 + (Math.random() * 8 - 4);
      const rotate = Math.floor(Math.random() * 30 - 15);
      const color = colors[i % colors.length];
      const fontSize = 24 + Math.floor(Math.random() * 4);

      charsSvg += `
        <text 
          x="${x}" 
          y="${y}" 
          font-family="monospace, Courier, sans-serif" 
          font-size="${fontSize}" 
          font-weight="bold" 
          fill="${color}" 
          transform="rotate(${rotate} ${x} ${y})"
        >${char}</text>
      `;
    }

    // Add noise lines and dots
    let noiseSvg = "";
    for (let i = 0; i < 4; i++) {
      const x1 = Math.floor(Math.random() * width);
      const y1 = Math.floor(Math.random() * height);
      const x2 = Math.floor(Math.random() * width);
      const y2 = Math.floor(Math.random() * height);
      const lineColor = colors[(i + 2) % colors.length];
      noiseSvg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${lineColor}" stroke-width="1.5" stroke-opacity="0.4" />`;
    }

    for (let i = 0; i < 20; i++) {
      const cx = Math.floor(Math.random() * width);
      const cy = Math.floor(Math.random() * height);
      noiseSvg += `<circle cx="${cx}" cy="${cy}" r="1" fill="#71717A" opacity="0.6" />`;
    }

    const rawSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <rect width="${width}" height="${height}" rx="12" fill="#18181D" stroke="#2C2C36" stroke-width="1"/>
        ${noiseSvg}
        ${charsSvg}
      </svg>
    `.trim();

    return `data:image/svg+xml;utf8,${encodeURIComponent(rawSvg)}`;
  }

  /**
   * Compute HMAC-SHA256 signature for canonical challenge payload
   * canonical: captcha_id.challenge.issued_at.expires_at
   */
  public static computeSignature(
    captchaId: string,
    challenge: string,
    issuedAt: number,
    expiresAt: number,
    secretOverride?: string
  ): string {
    const secret = secretOverride || this.getSecret();
    const canonicalPayload = `${captchaId}.${challenge.toUpperCase()}.${issuedAt}.${expiresAt}`;
    return createHmac("sha256", secret).update(canonicalPayload).digest("hex");
  }

  /**
   * Generate a fresh Single-Use CAPTCHA challenge backed by Redis
   */
  public static async generate(oldCaptchaId?: string): Promise<CaptchaChallenge> {
    // Invalidate old challenge if requested (refresh flow)
    if (oldCaptchaId) {
      await this.invalidate(oldCaptchaId);
    }

    const captchaId = randomUUID();
    const challenge = this.generateRandomText(5);
    const ttlSeconds = this.getTTL();
    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresAt = issuedAt + ttlSeconds;

    const signature = this.computeSignature(captchaId, challenge, issuedAt, expiresAt);
    const svg = this.generateSvg(challenge);

    const payload: StoredCaptchaPayload = {
      challenge: challenge.toUpperCase(),
      issued_at: issuedAt,
      expires_at: expiresAt,
      signature,
      status: "unused",
    };

    // Store in Redis with TTL matching expiration
    try {
      await redisClient.set(`captcha:${captchaId}`, JSON.stringify(payload), {
        EX: ttlSeconds,
      });
    } catch (err: any) {
      console.warn("⚠️ Gagal menyimpan CAPTCHA ke Redis:", err.message);
    }

    return {
      captcha_id: captchaId,
      svg,
      issued_at: issuedAt,
      expires_at: expiresAt,
      ttl_seconds: ttlSeconds,
    };
  }

  /**
   * Verify provided CAPTCHA answer with single-use consumption and replay protection
   */
  public static async verify(captchaId?: string, answer?: string): Promise<CaptchaVerificationResult> {
    if (!captchaId || !answer) {
      return {
        valid: false,
        reason: "MISSING",
        msg: "Kode CAPTCHA dan ID tantangan wajib diisi.",
      };
    }

    const cleanId = String(captchaId).trim();
    const cleanAnswer = String(answer).trim().toUpperCase();

    // 1. Replay Check: Check if previously consumed
    try {
      const isConsumed = await redisClient.get(`captcha:consumed:${cleanId}`);
      if (isConsumed) {
        return {
          valid: false,
          reason: "REPLAY",
          msg: "Kode CAPTCHA telah digunakan sebelumnya. Silakan muat kode baru.",
        };
      }
    } catch (err: any) {
      console.warn("⚠️ Gagal memeriksa tombstone consumed CAPTCHA:", err.message);
    }

    // 2. Atomic Get and Delete to prevent concurrent double-consumption
    let rawData: string | null = null;
    try {
      if (typeof (redisClient as any).getDel === "function") {
        rawData = await (redisClient as any).getDel(`captcha:${cleanId}`);
      } else {
        const luaScript = `
          local val = redis.call('GET', KEYS[1])
          if val then
            redis.call('DEL', KEYS[1])
          end
          return val
        `;
        rawData = (await (redisClient as any).eval(luaScript, { keys: [`captcha:${cleanId}`] })) as string | null;
      }
    } catch (err: any) {
      console.warn("⚠️ Gagal mengambil CAPTCHA dari Redis:", err.message);
    }

    // If key not found in Redis, it is expired or never existed
    if (!rawData) {
      return {
        valid: false,
        reason: "EXPIRED",
        msg: "Kode CAPTCHA tidak valid atau telah kedaluwarsa.",
      };
    }

    // Immediately register tombstone for the remaining TTL window to explicitly flag replays
    try {
      await redisClient.set(`captcha:consumed:${cleanId}`, "1", { EX: this.getTTL() });
    } catch (err: any) {
      console.warn("⚠️ Gagal menyetel tombstone CAPTCHA:", err.message);
    }

    let stored: StoredCaptchaPayload;
    try {
      stored = JSON.parse(rawData);
    } catch {
      return {
        valid: false,
        reason: "EXPIRED",
        msg: "Format payload CAPTCHA rusak.",
      };
    }

    // 3. Expiration Check
    const nowSec = Math.floor(Date.now() / 1000);
    if (nowSec > stored.expires_at) {
      return {
        valid: false,
        reason: "EXPIRED",
        msg: "Kode CAPTCHA telah kedaluwarsa. Silakan refresh CAPTCHA.",
      };
    }

    // 4. Constant-Time HMAC Signature Verification
    const expectedSig = this.computeSignature(cleanId, stored.challenge, stored.issued_at, stored.expires_at);
    const sigBuf = Buffer.from(stored.signature, "hex");
    const expSigBuf = Buffer.from(expectedSig, "hex");

    if (sigBuf.length !== expSigBuf.length || !timingSafeEqual(sigBuf, expSigBuf)) {
      return {
        valid: false,
        reason: "INVALID_SIGNATURE",
        msg: "Tanda tangan kriptografi CAPTCHA tidak valid.",
      };
    }

    // 5. Constant-Time Answer Comparison
    const storedChallenge = String(stored.challenge || "").trim().toUpperCase();
    const ansBuf = Buffer.from(cleanAnswer);
    const storedBuf = Buffer.from(storedChallenge);

    if (ansBuf.length !== storedBuf.length || !timingSafeEqual(ansBuf, storedBuf)) {
      return {
        valid: false,
        reason: "WRONG_ANSWER",
        msg: "Kode CAPTCHA yang Anda masukkan salah.",
      };
    }

    return {
      valid: true,
      msg: "Verifikasi CAPTCHA berhasil.",
    };
  }

  /**
   * Explicitly invalidate a CAPTCHA challenge (e.g. on client refresh)
   */
  public static async invalidate(captchaId?: string): Promise<void> {
    if (!captchaId) return;
    try {
      const cleanId = String(captchaId).trim();
      await redisClient.del(`captcha:${cleanId}`);
      await redisClient.set(`captcha:consumed:${cleanId}`, "1", { EX: this.getTTL() });
    } catch (err: any) {
      console.warn("⚠️ Gagal membatalkan CAPTCHA:", err.message);
    }
  }
}
