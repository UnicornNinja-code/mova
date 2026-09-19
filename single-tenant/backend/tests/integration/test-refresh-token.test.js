import "dotenv/config";
import http from "http";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { app } from "../../index.js";
import { pool } from "../../src/config/database.js";

const PORT = process.env.TEST_PORT || 9006;
const BASE_URL = `http://localhost:${PORT}`;

async function runRefreshTokenSuite() {
  console.log(`\n══════════════════════════════════════════════════════════`);
  console.log(`🔄 MOVA SINGLE-TENANT REFRESH TOKEN TDD SUITE`);
  console.log(`══════════════════════════════════════════════════════════\n`);

  let passed = 0;
  let failed = 0;
  let server = null;

  const assert = (name, condition, details = "") => {
    if (condition) {
      console.log(`  ✅ PASS: ${name}${details ? ` (${details})` : ""}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${name}${details ? ` (${details})` : ""}`);
      failed++;
    }
  };

  try {
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(PORT, resolve));
    console.log(`📡 In-process test server running on ${BASE_URL}\n`);

    const passwordHash = await bcrypt.hash("password123", 10);
    await pool.query("DELETE FROM users WHERE email LIKE '%@refresh-test.mova.id';");

    const userId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO users (id, username, email, name, role, password, is_active, first_login)
       VALUES ($1, 'refreshtest_user', 'user@refresh-test.mova.id', 'Refresh Test User', 'SUPERVISOR', $2, true, false);`,
      [userId, passwordHash]
    );

    // 1. Login to obtain access token, refresh token, and cookie
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: "user@refresh-test.mova.id", password: "password123" }),
    });
    const loginData = await loginRes.json();
    const setCookieHeader = loginRes.headers.get("set-cookie") || "";

    assert("Login succeeds with HTTP 200", loginRes.status === 200);
    assert("Login returns access token", Boolean(loginData.token));
    assert("Login returns refresh token", Boolean(loginData.refreshToken));
    assert("Login sets refreshToken cookie", setCookieHeader.includes("refreshToken="));
    assert("Login returns user data", loginData.user?.role === "SUPERVISOR");

    // 2. Call /api/auth/me with Bearer token
    const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${loginData.token}` },
    });
    const meData = await meRes.json();
    assert("/api/auth/me returns status 200", meRes.status === 200);
    assert("/api/auth/me returns valid user object", meData.user?.id === userId && meData.user?.role === "SUPERVISOR");

    // 3. Call /api/auth/refresh-token with cookie or body
    const cookieValue = setCookieHeader.split(";")[0];
    const refreshRes = await fetch(`${BASE_URL}/api/auth/refresh-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieValue,
      },
      body: JSON.stringify({ refreshToken: loginData.refreshToken }),
    });
    const refreshData = await refreshRes.json();

    assert("Refresh token succeeds with HTTP 200", refreshRes.status === 200);
    assert("Refresh token returns new access token", Boolean(refreshData.token));
    assert("Refresh token returns new refresh token", Boolean(refreshData.refreshToken));
    assert("Refresh token includes sanitized user object", refreshData.user && refreshData.user.id === userId && refreshData.user.role === "SUPERVISOR");

    // Cleanup
    await pool.query("DELETE FROM users WHERE email LIKE '%@refresh-test.mova.id';");
  } catch (err) {
    console.error("Test execution error:", err);
    failed++;
  } finally {
    if (server) {
      server.close();
    }
  }

  console.log(`\n══════════════════════════════════════════════════════════`);
  console.log(`🏁 REFRESH TOKEN SUITE COMPLETED: ${passed} Passed, ${failed} Failed`);
  console.log(`══════════════════════════════════════════════════════════\n`);

  setTimeout(() => process.exit(failed > 0 ? 1 : 0), 100);
}

runRefreshTokenSuite();
