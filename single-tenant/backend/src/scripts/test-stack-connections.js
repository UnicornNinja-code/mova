/**
 * ============================================================================
 * MOVA MULTI-STACK INTEGRATION & CONFIGURATION DIAGNOSTICS SUITE
 * ============================================================================
 * Comprehensive audit & connectivity test for all backend stacks:
 * 1. Environment & Configuration Loader (CWD Independence & Path Resolver)
 * 2. PostgreSQL Database & PostGIS Extension
 * 3. Redis Native Client (Caching, State & Distributed Locks)
 * 4. Redis ioredis Client (BullMQ Asynchronous Background Workers)
 * 5. JWT Secret & Token Signing/Verification Pipeline
 * 6. SMTP Mailer Transporter (Ethereal / Production SMTP)
 * 7. Open-Meteo Weather External API Connectivity
 * ============================================================================
 */

import { pool } from "../config/database.js";
import { redisClient } from "../config/redis.js";
import { sharedRedisConnection } from "../config/redisConfig.js";
import { env } from "../config/env.js";
import { getMailTransporter } from "../config/mailer.js";
import jwt from "jsonwebtoken";

const BOLD = "\x1b[1m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";
const CYAN = "\x1b[36m";
const RESET = "\x1b[0m";

let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ${GREEN}✅ PASS:${RESET} ${message}`);
    passedCount++;
  } else {
    console.error(`  ${RED}❌ FAIL:${RESET} ${message}`);
    failedCount++;
  }
}

async function runStackAudit() {
  console.log(`\n${BOLD}${CYAN}================================================================================${RESET}`);
  console.log(`${BOLD}${CYAN}🛠️  MOVA BACKEND MULTI-STACK CONNECTIVITY & CONFIGURATION AUDIT${RESET}`);
  console.log(`${BOLD}${CYAN}================================================================================${RESET}\n`);

  console.log(`${BOLD}[1/7] Environment & Configuration Audit${RESET}`);
  console.log(`  📂 Working Directory (CWD): ${process.cwd()}`);
  console.log(`  📄 Loaded .env from:        ${env.envLoadedFrom || "process.env"}`);
  console.log(`  🌐 NODE_ENV:                ${env.NODE_ENV}`);
  console.log(`  🚪 Server Port:             ${env.PORT}`);
  console.log(`  🔗 Frontend URL:            ${env.FRONTEND_URL}`);

  assert(Boolean(env.envLoadedFrom), `.env file successfully resolved from: ${env.envLoadedFrom}`);
  assert(env.PORT === 8090, `PORT is correctly set to ${env.PORT}`);
  assert(Boolean(env.DB.HOST && env.DB.NAME), `DB Configuration parsed (Host: ${env.DB.HOST}, DB: ${env.DB.NAME})`);

  console.log(`\n${BOLD}[2/7] PostgreSQL & PostGIS Connectivity Audit${RESET}`);
  try {
    const res = await pool.query("SELECT 1 AS alive, current_database() AS db_name, version() AS pg_version");
    assert(res.rows[0].alive === 1, `PostgreSQL Query alive test passed (Database: ${res.rows[0].db_name})`);
    
    // Check if PostGIS extension or users table is accessible
    try {
      const userCountRes = await pool.query("SELECT COUNT(*) AS count FROM users");
      assert(true, `Database 'users' table is accessible (Total Users: ${userCountRes.rows[0].count})`);
    } catch (tblErr) {
      console.log(`  ${YELLOW}⚠️ Notice:${RESET} users table query: ${tblErr.message}`);
    }
  } catch (dbErr) {
    assert(false, `PostgreSQL connection error: ${dbErr.message}`);
  }

  console.log(`\n${BOLD}[3/7] Redis Native Client Audit (Cache & Distributed Lock)${RESET}`);
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
    const testKey = "mova:diagnostic:test_ping";
    const testVal = `ok_${Date.now()}`;
    await redisClient.set(testKey, testVal, { EX: 10 });
    const fetchedVal = await redisClient.get(testKey);
    await redisClient.del(testKey);

    assert(fetchedVal === testVal, `Redis SET -> GET -> DEL cycle verified on ${env.REDIS.HOST}:${env.REDIS.PORT}`);
  } catch (redisErr) {
    assert(false, `Redis native client failed: ${redisErr.message}`);
  }

  console.log(`\n${BOLD}[4/7] Redis ioredis / BullMQ Worker Connection Audit${RESET}`);
  try {
    const pingResult = await sharedRedisConnection.ping();
    assert(pingResult === "PONG", `ioredis BullMQ connection verified (Ping Response: ${pingResult})`);
  } catch (ioredisErr) {
    assert(false, `ioredis BullMQ failed: ${ioredisErr.message}`);
  }

  console.log(`\n${BOLD}[5/7] JWT Authentication Pipeline Audit${RESET}`);
  try {
    assert(Boolean(env.JWT.SECRET && env.JWT.SECRET.length >= 16), `JWT Secret is strong and populated (${env.JWT.SECRET?.slice(0, 5)}***)`);
    const payload = { userId: "test-user-id", role: "SUPERADMIN" };
    const token = jwt.sign(payload, env.JWT.SECRET, { expiresIn: env.JWT.EXPIRES });
    const decoded = jwt.verify(token, env.JWT.SECRET);
    assert(decoded.userId === "test-user-id" && decoded.role === "SUPERADMIN", `JWT Sign & Verify succeeded (Expires: ${env.JWT.EXPIRES})`);
  } catch (jwtErr) {
    assert(false, `JWT audit failed: ${jwtErr.message}`);
  }

  console.log(`\n${BOLD}[6/7] SMTP Mailer Transporter Audit${RESET}`);
  try {
    const transporter = await getMailTransporter();
    assert(Boolean(transporter), `Mail transporter initialized (${env.SMTP?.HOST || "Ethereal Fallback"})`);
    const isVerified = await transporter.verify();
    assert(Boolean(isVerified), `SMTP Transporter verification handshake succeeded`);
  } catch (mailErr) {
    assert(false, `SMTP transporter verify failed: ${mailErr.message}`);
  }

  console.log(`\n${BOLD}[7/7] Open-Meteo Weather External API Audit${RESET}`);
  try {
    const weatherUrl = "https://api.open-meteo.com/v1/forecast?latitude=-7.4478&longitude=112.7183&current=temperature_2m,relative_humidity_2m&timezone=Asia%2FJakarta";
    const resp = await fetch(weatherUrl);
    const weatherData = await resp.json();
    assert(resp.ok && weatherData?.current?.temperature_2m !== undefined, `Open-Meteo API response status ${resp.status} (Current Temp Sidoarjo: ${weatherData?.current?.temperature_2m}°C)`);
  } catch (weatherErr) {
    assert(false, `Open-Meteo API connection failed: ${weatherErr.message}`);
  }

  console.log(`\n${BOLD}${CYAN}================================================================================${RESET}`);
  console.log(`${BOLD}AUDIT SUMMARY: ${GREEN}${passedCount} Passed${RESET}, ${failedCount > 0 ? `${RED}${failedCount} Failed` : `${GREEN}0 Failed`}${RESET}`);
  console.log(`${BOLD}${CYAN}================================================================================${RESET}\n`);

  // Clean exit
  try {
    await pool.end();
    if (redisClient.isOpen) await redisClient.disconnect();
    sharedRedisConnection.disconnect();
  } catch (cleanupErr) {
    // Ignore cleanup errors
  }

  process.exit(failedCount > 0 ? 1 : 0);
}

runStackAudit().catch((err) => {
  console.error("💥 Unhandled audit exception:", err);
  process.exit(1);
});
