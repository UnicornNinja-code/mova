/*
 *   Copyright (c) 2026
 *   All rights reserved.
 *   MOVA Single-Tenant Onboarding & User Lifecycle TDD Suite
 */

import "dotenv/config";
import http from "http";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { app } from "../../index.js";
import { pool } from "../../src/config/database.js";

const PORT = process.env.TEST_PORT || 9005;
const BASE_URL = `http://localhost:${PORT}`;

async function runOnboardingTddSuite() {
  console.log(`\n══════════════════════════════════════════════════════════`);
  console.log(`🚀 MOVA SINGLE-TENANT ONBOARDING & LIFECYCLE TDD SUITE`);
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
    // 1. Initialize In-Process Server
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(PORT, resolve));
    console.log(`📡 In-process test server running on ${BASE_URL}\n`);

    // 2. Setup Seed Users in Database
    const defaultPasswordHash = await bcrypt.hash("password123", 10);
    const firstLoginPasswordHash = await bcrypt.hash("initialSeedPass123", 10);

    // Clean test artifacts
    await pool.query("DELETE FROM users WHERE email LIKE '%@onboarding-test.mova.id';");

    // Seed Superadmin (Active)
    const saRes = await pool.query(
      `INSERT INTO users (id, username, email, name, role, password, is_active, first_login)
       VALUES ($1, 'sa_onboarding', 'sa@onboarding-test.mova.id', 'Superadmin Tester', 'SUPERADMIN', $2, true, false)
       RETURNING id, email, role;`,
      [crypto.randomUUID(), defaultPasswordHash]
    );
    const saUser = saRes.rows[0];

    // Seed Management (Active)
    const mgtRes = await pool.query(
      `INSERT INTO users (id, username, email, name, role, password, is_active, first_login)
       VALUES ($1, 'mgmt_onboarding', 'mgmt@onboarding-test.mova.id', 'Management Tester', 'MANAGEMENT', $2, true, false)
       RETURNING id, email, role;`,
      [crypto.randomUUID(), defaultPasswordHash]
    );
    const mgtUser = mgtRes.rows[0];

    // Seed Supervisor (Active)
    const spvRes = await pool.query(
      `INSERT INTO users (id, username, email, name, role, password, is_active, first_login)
       VALUES ($1, 'spv_onboarding', 'spv@onboarding-test.mova.id', 'Supervisor Tester', 'SUPERVISOR', $2, true, false)
       RETURNING id, email, role;`,
      [crypto.randomUUID(), defaultPasswordHash]
    );
    const spvUser = spvRes.rows[0];

    // Seed Rider (Active)
    const rdrRes = await pool.query(
      `INSERT INTO users (id, username, email, name, role, password, is_active, first_login)
       VALUES ($1, 'rider_onboarding', 'rider@onboarding-test.mova.id', 'Rider Tester', 'RIDER', $2, true, false)
       RETURNING id, email, role;`,
      [crypto.randomUUID(), defaultPasswordHash]
    );
    const rdrUser = rdrRes.rows[0];

    // Seed First-Login User (first_login = true)
    const flUserRes = await pool.query(
      `INSERT INTO users (id, username, email, name, role, password, is_active, first_login)
       VALUES ($1, 'fl_onboarding', 'firstlogin@onboarding-test.mova.id', 'First Login User', 'SUPERADMIN', $2, true, true)
       RETURNING id, email, role;`,
      [crypto.randomUUID(), firstLoginPasswordHash]
    );
    const flUser = flUserRes.rows[0];

    // Helper: Authenticate
    const login = async (email, password) => {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: email, password }),
      });
      const data = await res.json();
      return { status: res.status, ...data };
    };

    const saLogin = await login("sa@onboarding-test.mova.id", "password123");
    const saToken = saLogin.token;

    const mgtLogin = await login("mgmt@onboarding-test.mova.id", "password123");
    const mgtToken = mgtLogin.token;

    const spvLogin = await login("spv@onboarding-test.mova.id", "password123");
    const spvToken = spvLogin.token;

    const rdrLogin = await login("rider@onboarding-test.mova.id", "password123");
    const rdrToken = rdrLogin.token;

    // ─────────────────────────────────────────────────────────
    // FASE 1: STRICT NO-PUBLIC-REGISTRATION TEST
    // ─────────────────────────────────────────────────────────
    console.log(`\n📌 [FASE 1] Menolak Pendaftaran Publik Terbuka Tanpa Token...`);
    const publicRegRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "stranger",
        name: "Stranger Public",
        email: "stranger@public.com",
        password: "Password123!",
      }),
    });
    const publicRegData = await publicRegRes.json();
    assert(
      "Public Registration Ditolak (Strict DSS Single-Tenant)",
      publicRegRes.status === 403 || publicRegRes.status === 400,
      `Status: ${publicRegRes.status}, Msg: ${publicRegData.msg || publicRegData.message}`
    );

    // ─────────────────────────────────────────────────────────
    // FASE 2: FIRST-LOGIN PASSWORD RENEWAL LIFECYCLE
    // ─────────────────────────────────────────────────────────
    console.log(`\n📌 [FASE 2] Pengujian First-Login Password Renewal...`);
    // 2.1 Login Initial
    const flLoginRes = await login("firstlogin@onboarding-test.mova.id", "initialSeedPass123");
    assert("Login First-Login User Berhasil", flLoginRes.status === 200);
    assert("Flag first_login === true Terdeteksi", flLoginRes.user?.first_login === true);
    const flToken = flLoginRes.token;

    // 2.2 Attempt short password (min 8 chars required)
    const shortPassRes = await fetch(`${BASE_URL}/api/auth/first-login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${flToken}`,
      },
      body: JSON.stringify({ newPassword: "short" }),
    });
    assert(
      "First-Login Password Pendek (< 8 karakter) Ditolak",
      shortPassRes.status === 400,
      `Status: ${shortPassRes.status}`
    );

    // 2.3 Valid Password Renewal
    const validPassRes = await fetch(`${BASE_URL}/api/auth/first-login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${flToken}`,
      },
      body: JSON.stringify({ newPassword: "SuperSecurePass#2026" }),
    });
    const validPassData = await validPassRes.json();
    assert("First-Login Password Renewal Berhasil (HTTP 200)", validPassRes.status === 200);
    assert("Flag first_login Menjadi false", validPassData.user?.first_login === false);

    // 2.4 Verify Database State & New Login
    const oldLoginAttempt = await login("firstlogin@onboarding-test.mova.id", "initialSeedPass123");
    assert(
      "Login dengan Password Lama Gagal (HTTP 400/401)",
      oldLoginAttempt.status === 400 || oldLoginAttempt.status === 401,
      `Status: ${oldLoginAttempt.status}`
    );

    const newLoginAttempt = await login("firstlogin@onboarding-test.mova.id", "SuperSecurePass#2026");
    assert("Login dengan Password Baru Berhasil (HTTP 200)", newLoginAttempt.status === 200);
    assert("Flag first_login Sekarang Permanen false", newLoginAttempt.user?.first_login === false);

    // ─────────────────────────────────────────────────────────
    // FASE 3: STAFF PROVISIONING & TOKEN ACTIVATION LIFECYCLE
    // ─────────────────────────────────────────────────────────
    console.log(`\n📌 [FASE 3] Staff Provisioning & Activation Token Lifecycle...`);
    // 3.1 Management membuat Supervisor baru tanpa password
    const createStaffRes = await fetch(`${BASE_URL}/api/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${mgtToken}`,
      },
      body: JSON.stringify({
        name: "Budi Supervisor Lapangan",
        email: "budi_spv@onboarding-test.mova.id",
        role: "SUPERVISOR",
      }),
    });
    const createStaffData = await createStaffRes.json();
    const staffUser = createStaffData.data || createStaffData.user || createStaffData;
    const invitationToken = staffUser.invitation_token || createStaffData.invitation_token;

    assert("Management Sukses Provisioning Staf Baru (HTTP 201)", createStaffRes.status === 201);
    assert("Staf Diinisialisasi Status Inactive (is_active: false)", staffUser.is_active === false);
    assert("Invitation Token Terbit", !!invitationToken, `Token: ${invitationToken?.slice(0, 8)}...`);

    // 3.2 Staf Mengaktivasi Akun via Token
    const activateRes = await fetch(`${BASE_URL}/api/auth/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: invitationToken,
        password: "BudiPassword#123",
        name: "Budi Santoso, S.Kom",
        phone: "081234567890",
      }),
    });
    const activateData = await activateRes.json();
    const activatedUser = activateData.data || activateData.user || activateData;
    assert("Aktivasi Akun via Token Sukses (HTTP 201/200)", activateRes.status === 201 || activateRes.status === 200);
    assert("Status User Menjadi Aktif (is_active: true)", activatedUser?.is_active === true);

    // 3.3 Re-activation dengan Token yang Sama Harus Gagal (One-Time Token)
    const reActivateRes = await fetch(`${BASE_URL}/api/auth/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: invitationToken,
        password: "AnotherPassword#123",
      }),
    });
    assert("Token yang Sudah Digunakan Ditolak (HTTP 400)", reActivateRes.status === 400);

    // 3.4 Login Staf yang Baru Diaktivasi
    const staffLogin = await login("budi_spv@onboarding-test.mova.id", "BudiPassword#123");
    assert("Staf Berhasil Login dengan Kredensial Baru", staffLogin.status === 200);
    assert("Role Staf Sesuai (SUPERVISOR)", staffLogin.user?.role === "SUPERVISOR");

    // ─────────────────────────────────────────────────────────
    // FASE 4: ROLE HIERARCHY GUARD & RBAC ENFORCEMENT
    // ─────────────────────────────────────────────────────────
    console.log(`\n📌 [FASE 4] Role Hierarchy Guard & RBAC Enforcement...`);
    // 4.1 Management DILARANG membuat Superadmin
    const mgtCreateSaRes = await fetch(`${BASE_URL}/api/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${mgtToken}`,
      },
      body: JSON.stringify({
        name: "Illegal Superadmin",
        email: "illegal_sa@onboarding-test.mova.id",
        role: "SUPERADMIN",
      }),
    });
    assert(
      "Hierarchy Guard: Management DILARANG membuat SUPERADMIN (HTTP 403)",
      mgtCreateSaRes.status === 403,
      `Status: ${mgtCreateSaRes.status}`
    );

    // 4.2 Supervisor DILARANG membuat Akun
    const spvCreateRes = await fetch(`${BASE_URL}/api/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${spvToken}`,
      },
      body: JSON.stringify({
        name: "Illegal Rider by Spv",
        email: "illegal_rdr@onboarding-test.mova.id",
        role: "RIDER",
      }),
    });
    assert(
      "Hierarchy Guard: Supervisor DILARANG mengakses pembuatan user (HTTP 403)",
      spvCreateRes.status === 403,
      `Status: ${spvCreateRes.status}`
    );

    // 4.3 Rider DILARANG membuat Akun
    const rdrCreateRes = await fetch(`${BASE_URL}/api/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${rdrToken}`,
      },
      body: JSON.stringify({
        name: "Illegal User by Rider",
        email: "illegal_by_rdr@onboarding-test.mova.id",
        role: "RIDER",
      }),
    });
    assert(
      "Hierarchy Guard: Rider DILARANG mengakses pembuatan user (HTTP 403)",
      rdrCreateRes.status === 403,
      `Status: ${rdrCreateRes.status}`
    );

    // 4.4 Superadmin Berhak membuat semua role (termasuk Management & Rider)
    const saCreateMgtRes = await fetch(`${BASE_URL}/api/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${saToken}`,
      },
      body: JSON.stringify({
        name: "Legit Management",
        email: "legit_mgmt@onboarding-test.mova.id",
        role: "MANAGEMENT",
      }),
    });
    assert(
      "Superadmin Berhak membuat akun MANAGEMENT (HTTP 201)",
      saCreateMgtRes.status === 201
    );

    // Cleanup test artifacts
    await pool.query("DELETE FROM users WHERE email LIKE '%@onboarding-test.mova.id';");

    console.log(`\n══════════════════════════════════════════════════════════`);
    console.log(`🏁 TDD SUITE COMPLETED: ${passed} Passed, ${failed} Failed`);
    console.log(`══════════════════════════════════════════════════════════\n`);

    if (failed > 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error("💥 Unhandled Error during TDD Suite Execution:", err);
    process.exitCode = 1;
  } finally {
    if (server) {
      server.close();
    }
    process.exit(failed > 0 ? 1 : 0);
  }
}

runOnboardingTddSuite();
