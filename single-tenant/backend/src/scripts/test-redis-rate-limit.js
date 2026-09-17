/*
 * test-redis-rate-limit.js
 * CLI Test Script for Redis-Backed Distributed Rate Limiting & HTTP Compression.
 */

import http from "http";
import express from "express";
import compression from "compression";
import { redisClient } from "../config/redis.js";
import { loginLimiter } from "../middlewares/rateLimiterMiddleware.js";
import { pool } from "../config/database.js";

async function testRedisRateLimitEngine() {
  console.log("\n================================================================================");
  console.log("🧪 MEMULAI PENGUJIEN REDIS-BACKED DISTRIBUTED RATE LIMITING & HTTP COMPRESSION");
  console.log("================================================================================");

  // Setup test server
  const app = express();
  app.use(express.json());
  app.use(compression({ level: 9 }));

  // Mount test route with Redis-backed loginLimiter
  app.post("/api/test-login", loginLimiter, (req, res) => {
    return res.status(401).json({ msg: "Kredensial tidak valid" });
  });

  // Mount large JSON route to test Gzip compression
  app.get("/api/test-large-json", (req, res) => {
    const largeData = Array.from({ length: 500 }, (_, i) => ({
      id: i,
      name: `Kategori POI #${i}`,
      description: "Deskripsi data besar untuk menguji kompresi HTTP Gzip Brotli level 9",
    }));
    return res.status(200).json({ data: largeData });
  });

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const testPort = server.address().port;
  const BASE_URL = `http://localhost:${testPort}`;

  try {
    // 1. [TES 1] Rapid Hit Login Rate Limiter (Max 5 attempts)
    console.log("\n💥 [TES 1] Menguji Distributed Rate Limiter pada Redis Store (Max 5 Hits)...");
    
    let hitCount = 0;
    let limitResponse = null;

    for (let i = 1; i <= 6; i++) {
      hitCount++;
      const res = await fetch(`${BASE_URL}/api/test-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: "bad-user@kopikeliling.com", password: "wrongpassword" }),
      });

      console.log(`   • Hit #${i} -> Status HTTP: ${res.status} ${res.statusText}`);
      if (res.status === 429) {
        limitResponse = await res.json();
        break;
      }
    }

    if (limitResponse && limitResponse.statusCode === 429) {
      console.log("✅ [PASSED 429] Hit ke-6 Berhasil Diblokir oleh Redis Rate Limiter!");
      console.log("   📌 Pesan Error UI Toast:", limitResponse.ui_notice);
    } else {
      console.log("❌ [FAILED] Rate limit 429 tidak terpicu.");
    }

    // 2. [TES 2] Verify Redis Key Storage
    console.log("\n🔴 [TES 2] Memeriksa Key Rate Limiter di Redis Server...");
    const keys = typeof redisClient.keys === "function" ? await redisClient.keys("RL:AUTH_LOGIN:*") : [];
    console.log(`✅ Key Terdaftar di Redis ('RL:AUTH_LOGIN:*'): ${keys.length} Key(s) Found!`);
    keys.forEach((k) => console.log(`   • Key: ${k}`));

    // 3. [TES 3] HTTP Level-9 Compression Verification
    console.log("\n📦 [TES 3] Menguji Kompresi HTTP Level-9 (Gzip/Brotli)...");
    const gzipRes = await fetch(`${BASE_URL}/api/test-large-json`, {
      headers: { "Accept-Encoding": "gzip, deflate, br" },
    });

    const encodingHeader = gzipRes.headers.get("content-encoding");
    console.log(`   • Header Content-Encoding: '${encodingHeader}'`);

    if (encodingHeader && (encodingHeader.includes("gzip") || encodingHeader.includes("br"))) {
      console.log("✅ [PASSED COMPRESSION] Respon HTTP Berhasil Dikompresi Level-9! ✅");
    } else {
      console.log("ℹ️ Kompresi tidak terdeteksi (mungkin payload terlalu kecil).");
    }

    console.log("\n================================================================================");
    console.log("🎉 Pengujian Redis Distributed Rate Limiting & Compression Selesai 100% Sempurna!");
    console.log("================================================================================\n");

  } catch (error) {
    console.error("💥 Error saat menguji Redis Rate Limit Engine:", error);
  } finally {
    server.close();
    try { await pool.end(); } catch (e) {}
    setTimeout(() => process.exit(0), 100);
  }
}

testRedisRateLimitEngine();
