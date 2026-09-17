/*
 * test_first_login_security_and_flow.ts
 * Verifikasi keamanan route protection & flow first-login MOVA.
 *
 * Menguji:
 * 1. Login user dengan first_login = true
 * 2. Cek token diblokir saat akses endpoint operasional (/api/zones) -> HARUS 403 FIRST_LOGIN_REQUIRED
 * 3. Cek endpoint whitelist first-login (/api/auth/me) -> HARUS 200 OK (first_login: true)
 * 4. Submit password baru via /api/users/me/complete-first-login -> HARUS 200 OK
 * 5. Cek database & /api/auth/me -> first_login harus FALSE permanen
 * 6. Akses ulang endpoint operasional (/api/zones) -> HARUS 200 OK
 */

import { pool } from "../config/database.js";
import { hashPassword } from "../utils/crypto.js";
import { redisClient } from "../config/redis.js";

const TEST_EMAIL = "security.audit@kopikeliling.com";
const TEST_USERNAME = "audit_admin";
const TEMP_PASSWORD = "TempPassword123!";
const NEW_PASSWORD = "BrandNewPassword2026!";
const API_BASE = "http://localhost:9099/api";

async function setupTestUser() {
  const hashedTemp = await hashPassword(TEMP_PASSWORD);
  await pool.query(
    `INSERT INTO users (email, username, password, name, role, is_active, first_login)
     VALUES ($1, $2, $3, 'Audit Admin', 'SUPERADMIN'::"Role", true, true)
     ON CONFLICT (email) DO UPDATE SET
       password = EXCLUDED.password,
       is_active = true,
       first_login = true,
       updated_at = CURRENT_TIMESTAMP;`,
    [TEST_EMAIL, TEST_USERNAME, hashedTemp]
  );
  try {
    await redisClient.del([`auth:failed:user:${TEST_EMAIL}`, `auth:failed:user:${TEST_USERNAME}`]);
  } catch {}
}

async function cleanupTestUser() {
  await pool.query("DELETE FROM users WHERE email = $1;", [TEST_EMAIL]);
  await pool.end();
  await redisClient.quit();
}

async function runTests() {
  console.log("══════════════════════════════════════════════════════════");
  console.log("🧪 TESTING FIRST-LOGIN SECURITY & MANDATORY FLOW");
  console.log("══════════════════════════════════════════════════════════\n");

  await setupTestUser();
  console.log("✅ User audit disiapkan (first_login = true)");

  // 1. Login
  console.log("1️⃣ Login dengan temporary password...");
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: TEST_EMAIL, password: TEMP_PASSWORD }),
  });
  const loginData: any = await loginRes.json();
  if (loginRes.status !== 200 || !loginData.token) {
    throw new Error(`Login gagal: ${JSON.stringify(loginData)}`);
  }
  const token = loginData.token;
  console.log(`   ✅ Login sukses. first_login claim: ${loginData.user?.first_login}`);
  if (loginData.user?.first_login !== true) {
    throw new Error("❌ Ekspektasi user.first_login === true!");
  }

  // 2. Server-side Protection: Coba akses protected endpoint operasional (/api/zones)
  console.log("\n2️⃣ Menguji Backend Route Security: Akses /api/zones saat first_login=true...");
  const protectedRes = await fetch(`${API_BASE}/zones`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const protectedData: any = await protectedRes.json();
  console.log(`   Status HTTP : ${protectedRes.status}`);
  console.log(`   Response    :`, protectedData);

  if (protectedRes.status === 403 && protectedData.code === "FIRST_LOGIN_REQUIRED") {
    console.log("   🛡️ [PASS] Backend berhasil memblokir akses ke endpoint operasional!");
  } else {
    throw new Error(`❌ Celah Keamanan! Seharusnya diblokir 403 FIRST_LOGIN_REQUIRED, tapi dapat: ${protectedRes.status}`);
  }

  // 3. Whitelist check: /api/auth/me harus tetap diizinkan untuk validasi session
  console.log("\n3️⃣ Menguji Whitelist Endpoint: Akses /api/auth/me...");
  const meRes = await fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const meData: any = await meRes.json();
  if (meRes.status === 200 && meData.user?.first_login === true) {
    console.log("   ✅ [PASS] /api/auth/me berhasil mengembalikan data server truth (first_login: true)");
  } else {
    throw new Error(`❌ /api/auth/me gagal: ${JSON.stringify(meData)}`);
  }

  // 4. Submit password baru via complete-first-login
  console.log("\n4️⃣ Menguji Change Password: Submit newPassword via PATCH /api/users/me/complete-first-login...");
  const changeRes = await fetch(`${API_BASE}/users/me/complete-first-login`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ newPassword: NEW_PASSWORD }),
  });
  const changeData: any = await changeRes.json();
  console.log(`   Status HTTP : ${changeRes.status}`);
  console.log(`   Response    :`, changeData);

  if (changeRes.status === 200 && changeData.success === true) {
    console.log("   ✅ [PASS] Backend berhasil memproses ganti password baru!");
  } else {
    throw new Error(`❌ Gagal ganti password: ${JSON.stringify(changeData)}`);
  }

  // 5. Verifikasi database permanen
  console.log("\n5️⃣ Verifikasi Status Database & Session Truth...");
  const dbCheck = await pool.query("SELECT id, first_login FROM users WHERE email = $1;", [TEST_EMAIL]);
  const dbUser = dbCheck.rows[0];
  console.log(`   Database first_login value: ${dbUser.first_login}`);
  if (dbUser.first_login === false) {
    console.log("   ✅ [PASS] first_login di PostgreSQL berhasil terupdate menjadi FALSE permanen!");
  } else {
    throw new Error(`❌ first_login di DB masih bernilai ${dbUser.first_login}`);
  }

  const meAfterRes = await fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const meAfterData: any = await meAfterRes.json();
  if (meAfterData.user?.first_login === false) {
    console.log("   ✅ [PASS] /api/auth/me sekarang mengembalikan first_login = FALSE");
  } else {
    throw new Error(`❌ /api/auth/me mengembalikan first_login = ${meAfterData.user?.first_login}`);
  }

  // 6. Verifikasi endpoint operasional sekarang dibuka
  console.log("\n6️⃣ Akses ulang endpoint operasional (/api/zones) setelah first_login=false...");
  const zoneUnlockedRes = await fetch(`${API_BASE}/zones`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (zoneUnlockedRes.status === 200) {
    console.log("   🎉 [PASS] Endpoint operasional sekarang terbuka normal 200 OK!");
  } else {
    throw new Error(`❌ Masih terblokir: status ${zoneUnlockedRes.status}`);
  }

  console.log("\n══════════════════════════════════════════════════════════");
  console.log("✨ ALL 6 SECURITY & FLOW ASSERTIONS PASSED PERFECTLY!");
  console.log("══════════════════════════════════════════════════════════\n");
}

runTests()
  .catch((e) => {
    console.error("\n❌ TEST FAILED:", e.message);
    process.exit(1);
  })
  .finally(async () => {
    await cleanupTestUser();
  });
