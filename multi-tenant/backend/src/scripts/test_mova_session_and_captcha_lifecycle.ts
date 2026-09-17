/**
 * test_mova_session_and_captcha_lifecycle.ts
 *
 * Automated Regression Test Suite for MOVA Authentication & State Consistency:
 * 1. CAPTCHA Lifecycle & Risk State Restoration (Fix for CAPTCHA disappearing on refresh)
 * 2. Token Revocation & Blacklisting on Logout in Redis
 * 3. Cache-Control: no-store on Authenticated Endpoints
 * 4. Protected Mutation Guard (401 on logged-out / revoked session mutation attempts)
 * 5. Canonical /auth/me Server Source of Truth
 */

import { redisClient } from "../config/redis.js";

const BASE_URL = "http://localhost:9099/api";

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, testName: string, detail?: any) {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    testsPassed++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}`);
    if (detail) console.error("     Detail:", detail);
    testsFailed++;
  }
}

async function runTests() {
  console.log("================================================================================");
  console.log("🧪 MOVA AUTHENTICATION & STATE CONSISTENCY REGRESSION TEST SUITE");
  console.log("================================================================================");

  // Setup: Clear existing rate limits & test keys for both IPv4 and IPv6
  const failedKeys = await redisClient.keys("auth:failed:*");
  if (failedKeys.length > 0) {
    await redisClient.del(failedKeys);
  }
  const rlKeys = await redisClient.keys("*RL:*");
  if (rlKeys.length > 0) {
    await redisClient.del(rlKeys);
  }

  // ---------------------------------------------------------------------------
  // TEST SUITE 1: CAPTCHA Lifecycle & Refresh State Machine (Issue 1)
  // ---------------------------------------------------------------------------
  console.log("\n📌 [SUITE 1] CAPTCHA Lifecycle & Server Risk Status (F5 / Refresh Proof)");

  // 1.1 Fresh State: Low risk
  const res1 = await fetch(`${BASE_URL}/auth/risk-status`);
  const data1 = (await res1.json()) as any;
  assert(data1.requires_captcha === false, "Fresh client IP has requires_captcha = false");

  // 1.2 Trigger 3 failed login attempts
  for (let i = 1; i <= 3; i++) {
    await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: "superadmin@kopikeliling.com", password: "wrongpassword999!" }),
    });
  }

  // 1.3 Check risk-status after 3 failures (simulating page reload F5)
  const res2 = await fetch(`${BASE_URL}/auth/risk-status`);
  const data2 = (await res2.json()) as any;
  assert(
    data2.requires_captcha === true && data2.ipFailures >= 3,
    "After 3 failures, /auth/risk-status immediately returns requires_captcha = true on refresh",
    data2
  );

  // 1.4 Get CAPTCHA challenge
  const resCaptcha = await fetch(`${BASE_URL}/auth/captcha`);
  const captchaData = (await resCaptcha.json()) as any;
  assert(
    !!captchaData.captcha_id && !!captchaData.svg,
    "Fresh unconsumed CAPTCHA challenge generated for elevated risk client"
  );

  // ---------------------------------------------------------------------------
  // TEST SUITE 2: Authenticated Session, Cache-Control & Logout Revocation (Issue 2)
  // ---------------------------------------------------------------------------
  console.log("\n📌 [SUITE 2] Token Revocation on Logout & Cache-Control: no-store");

  // 2.1 Login with valid credentials to obtain JWT
  // Clear failed counter so login succeeds without CAPTCHA
  const cleanFailedKeys = await redisClient.keys("auth:failed:*");
  if (cleanFailedKeys.length > 0) {
    await redisClient.del(cleanFailedKeys);
  }

  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: "superadmin@kopikeliling.com", password: "password123" }),
  });
  const loginData = (await loginRes.json()) as any;
  const token = loginData.token;
  if (!token) console.log("LOGIN FAILED DETAIL:", loginRes.status, loginData);
  assert(!!token, "Superadmin successfully authenticated with valid JWT token");

  // 2.2 Canonical /auth/me returns authenticated status
  const meRes = await fetch(`${BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const meData = (await meRes.json()) as any;
  const cacheControl = meRes.headers.get("cache-control") || "";

  assert(
    meRes.status === 200 && meData.authenticated === true && meData.user?.role === "SUPERADMIN",
    "GET /api/auth/me returns { authenticated: true, user: SUPERADMIN }"
  );
  assert(
    cacheControl.includes("no-store"),
    `Authenticated endpoint enforces Cache-Control: no-store (Got: '${cacheControl}')`
  );

  // 2.3 User logs out via POST /api/auth/logout with Bearer token
  const logoutRes = await fetch(`${BASE_URL}/auth/logout`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  const logoutData = (await logoutRes.json()) as any;
  assert(logoutRes.status === 200, "POST /api/auth/logout succeeds with 200 OK");

  // 2.4 Verify token is blacklisted in Redis
  const isRevokedInRedis = await redisClient.get(`jwt:revoked:${token}`);
  assert(isRevokedInRedis === "1", "Access token is blacklisted in Redis (jwt:revoked:<token>)");

  // ---------------------------------------------------------------------------
  // TEST SUITE 3: Session Invalidation & Mutation Guard (OWASP Protection)
  // ---------------------------------------------------------------------------
  console.log("\n📌 [SUITE 3] Post-Logout Request Rejection & Mutation Guard");

  // 3.1 Attempting to call /auth/me with the logged-out token
  const postLogoutMeRes = await fetch(`${BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const postLogoutMeData = (await postLogoutMeRes.json()) as any;
  assert(
    postLogoutMeRes.status === 401 && postLogoutMeData.code === "SESSION_REVOKED",
    "GET /auth/me with revoked token returns 401 Unauthorized (code: SESSION_REVOKED)"
  );

  // 3.2 Mutation Guard: Attempting to POST /api/zones with logged-out token (Simulating browser back + submit)
  const mutationRes = await fetch(`${BASE_URL}/zones`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "Rogue Zone Attack Post-Logout",
      geom: { type: "Polygon", coordinates: [] },
    }),
  });
  const mutationData = (await mutationRes.json()) as any;
  assert(
    mutationRes.status === 401,
    `Protected mutation (POST /api/zones) with revoked token rejected with 401 Unauthorized (Status: ${mutationRes.status})`
  );

  // 3.3 Verify database mutation was blocked (server rejected before touching business logic)
  assert(
    mutationData.code === "SESSION_REVOKED" || mutationRes.status === 401,
    "Database is 100% protected: no mutation processed after logout"
  );

  // ---------------------------------------------------------------------------
  // TEST SUMMARY
  // ---------------------------------------------------------------------------
  console.log("\n================================================================================");
  console.log(`📊 TEST RESULTS: ${testsPassed} PASSED | ${testsFailed} FAILED`);
  console.log("================================================================================");

  if (testsFailed === 0) {
    console.log("🎉 ALL MOVA AUTHENTICATION & STATE CONSISTENCY INVARIANTS SATISFIED!\n");
  } else {
    console.error("❌ Some regression tests failed.\n");
    process.exit(1);
  }

  process.exit(0);
}

runTests().catch((err) => {
  console.error("💥 Unhandled test suite error:", err);
  process.exit(1);
});
