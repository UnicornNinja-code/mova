import "dotenv/config";
import http from "http";
import { app } from "../../index.js";
import { pool } from "../../src/config/database.js";

const PORT = process.env.PORT || 9001;
const BASE_URL = `http://localhost:${PORT}`;

async function runRbacTests() {
  console.log(`\n======================================================`);
  console.log(`Starting Phase 1: Security & RBAC Hardening Test Suite`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`======================================================\n`);

  let passedCount = 0;
  let failedCount = 0;
  let localServer = null;

  try {
    // Check if server is already running, if not start in-process
    try {
      await fetch(`${BASE_URL}/api/poi-categories`, { signal: AbortSignal.timeout(1500) });
    } catch {
      console.log(`Starting test server in-process on port ${PORT}...`);
      localServer = http.createServer(app);
      await new Promise((resolve) => localServer.listen(PORT, resolve));
      console.log(`Test server running at ${BASE_URL}\n`);
    }

    function assertTest(testName, isSuccess, details = "") {
      if (isSuccess) {
        console.log(`  ✓ PASS: ${testName}${details ? ` (${details})` : ""}`);
        passedCount++;
      } else {
        console.log(`  ✗ FAIL: ${testName}${details ? ` (${details})` : ""}`);
        failedCount++;
      }
    }

    // 1. Authenticate users
    console.log(`[1] Authenticating Test Users...`);
    const bcrypt = (await import("bcrypt")).default;
    const defaultHash = await bcrypt.hash("password123", 10);
    await pool.query("UPDATE users SET password = $1 WHERE email = 'superadmin@kopikeliling.com'", [defaultHash]);
    await pool.query("UPDATE users SET password = $1 WHERE email = 'supervisor@kopikeliling.com'", [defaultHash]);
    await pool.query("UPDATE users SET password = $1 WHERE email = 'rider@kopikeliling.com'", [defaultHash]);

    const dbUsers = await pool.query("SELECT id, email, username, role, is_active FROM users;");
    console.log("Existing DB users:", dbUsers.rows.map(u => ({ email: u.email, role: u.role })));

    const login = async (email, password) => {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      return { status: res.status, ...data };
    };

    const saLogin = await login("superadmin@kopikeliling.com", "password123");
    const superadminToken = saLogin.token;
    const superadminUser = saLogin.user;
    assertTest("Superadmin Login", !!superadminToken, `User ID: ${superadminUser?.id}`);

    const spvLogin = await login("supervisor@kopikeliling.com", "password123");
    const supervisorToken = spvLogin.token;
    const supervisorUser = spvLogin.user;
    assertTest("Supervisor Login", !!supervisorToken, `User ID: ${supervisorUser?.id}`);

    const riderLogin = await login("rider@kopikeliling.com", "password123");
    const riderToken = riderLogin.token;
    const riderUser = riderLogin.user;
    assertTest("Rider Login", !!riderToken, `User ID: ${riderUser?.id}`);

    // Ensure Management user exists
    let mgtToken = null;
    let mgtUser = null;
    const mgtLogin = await login("management@kopikeliling.com", "password123");
    if (mgtLogin.token) {
      mgtToken = mgtLogin.token;
      mgtUser = mgtLogin.user;
    } else {
      // Create management user with Superadmin token or direct DB seed
      if (superadminToken) {
        const mgtCreateRes = await fetch(`${BASE_URL}/api/users`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${superadminToken}` },
          body: JSON.stringify({
            username: "management_test",
            name: "Management User",
            email: "management@kopikeliling.com",
            password: "password123",
            role: "MANAGEMENT",
          }),
        });
        console.log("MGT create result:", await mgtCreateRes.json());
      } else {
        // Direct DB insert for test
        const bcrypt = (await import("bcrypt")).default;
        const hash = await bcrypt.hash("password123", 10);
        await pool.query(`
          INSERT INTO users (username, name, email, password, role)
          VALUES ('management_test', 'Management User', 'management@kopikeliling.com', $1, 'MANAGEMENT')
          ON CONFLICT (email) DO NOTHING;
        `, [hash]);
      }
      const mgtRelogin = await login("management@kopikeliling.com", "password123");
      mgtToken = mgtRelogin.token;
      mgtUser = mgtRelogin.user;
    }
    assertTest("Management Login", !!mgtToken, `User ID: ${mgtUser?.id}`);

    // 2. IDOR & User Management RBAC
    console.log(`\n[2] Testing IDOR & User Management Authorization...`);

    // IDOR Test: Rider tries to update Supervisor's name & email
    const idorRes = await fetch(`${BASE_URL}/api/users/${supervisorUser.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${riderToken}` },
      body: JSON.stringify({ name: "Hacked by Rider", email: "hacked@evil.com" }),
    });
    assertTest("IDOR Prevention: Rider modifying another user", idorRes.status === 403, `Status: ${idorRes.status} (Expected 403)`);

    // Self-update Test: Rider updates own profile
    const selfUpdateRes = await fetch(`${BASE_URL}/api/users/${riderUser.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${riderToken}` },
      body: JSON.stringify({ name: "Rider Updated Self" }),
    });
    assertTest("Self-Update: Rider modifying own profile", selfUpdateRes.status === 200, `Status: ${selfUpdateRes.status}`);

    // Privilege Escalation Test: Rider tries to elevate own role to SUPERADMIN
    const riderElevateRes = await fetch(`${BASE_URL}/api/users/${riderUser.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${riderToken}` },
      body: JSON.stringify({ role: "SUPERADMIN" }),
    });
    assertTest("Privilege Escalation: Rider elevating self to SUPERADMIN", riderElevateRes.status === 403, `Status: ${riderElevateRes.status} (Expected 403)`);

    // Supervisor Create User Test (Must be blocked)
    const spvCreateRes = await fetch(`${BASE_URL}/api/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${supervisorToken}` },
      body: JSON.stringify({
        username: `spv_created_${Date.now()}`,
        name: "Illegal User",
        email: `illegal_${Date.now()}@example.com`,
        password: "password123",
        role: "RIDER",
      }),
    });
    assertTest("Supervisor Create User Blocked", spvCreateRes.status === 403, `Status: ${spvCreateRes.status} (Expected 403)`);

    // Supervisor Toggle User Status (Must be blocked)
    const spvStatusRes = await fetch(`${BASE_URL}/api/users/${riderUser.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${supervisorToken}` },
      body: JSON.stringify({ is_active: false }),
    });
    assertTest("Supervisor Deactivate User Blocked", spvStatusRes.status === 403, `Status: ${spvStatusRes.status} (Expected 403)`);

    // Management Creates Allowed Roles (Management, Supervisor, Rider)
    const testMgtEmail = `mgt_sub_${Date.now()}@example.com`;
    const mgtCreateMgtRes = await fetch(`${BASE_URL}/api/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${mgtToken}` },
      body: JSON.stringify({
        username: `mgt_sub_${Date.now()}`,
        name: "Peer Management User",
        email: testMgtEmail,
        password: "password123",
        role: "MANAGEMENT",
      }),
    });
    const mgtCreatedData = await mgtCreateMgtRes.json();
    assertTest("Management Create Peer Management Account", mgtCreateMgtRes.status === 201, `Status: ${mgtCreateMgtRes.status}`);

    const testSpvEmail = `mgt_spv_${Date.now()}@example.com`;
    const mgtCreateSpvRes = await fetch(`${BASE_URL}/api/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${mgtToken}` },
      body: JSON.stringify({
        username: `mgt_spv_${Date.now()}`,
        name: "Subordinate Supervisor",
        email: testSpvEmail,
        password: "password123",
        role: "SUPERVISOR",
      }),
    });
    assertTest("Management Create Supervisor Account", mgtCreateSpvRes.status === 201, `Status: ${mgtCreateSpvRes.status}`);

    // Management Prohibited From Creating Superadmin
    const mgtCreateSaRes = await fetch(`${BASE_URL}/api/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${mgtToken}` },
      body: JSON.stringify({
        username: `illegal_sa_${Date.now()}`,
        name: "Illegal Superadmin",
        email: `illegal_sa_${Date.now()}@example.com`,
        password: "password123",
        role: "SUPERADMIN",
      }),
    });
    assertTest("Management Create Superadmin Blocked", mgtCreateSaRes.status === 403, `Status: ${mgtCreateSaRes.status} (Expected 403)`);

    // Management Prohibited From Modifying Superadmin Account
    const mgtEditSaRes = await fetch(`${BASE_URL}/api/users/${superadminUser.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${mgtToken}` },
      body: JSON.stringify({ name: "Modified by Management" }),
    });
    assertTest("Management Modify Superadmin Blocked", mgtEditSaRes.status === 403, `Status: ${mgtEditSaRes.status} (Expected 403)`);

    // Management Prohibited From Deactivating Superadmin Account
    const mgtDeactSaRes = await fetch(`${BASE_URL}/api/users/${superadminUser.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${mgtToken}` },
      body: JSON.stringify({ is_active: false }),
    });
    assertTest("Management Deactivate Superadmin Blocked", mgtDeactSaRes.status === 403, `Status: ${mgtDeactSaRes.status} (Expected 403)`);

    // Management Prohibited From Deleting Superadmin Account
    const mgtDelSaRes = await fetch(`${BASE_URL}/api/users/${superadminUser.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${mgtToken}` },
    });
    assertTest("Management Delete Superadmin Blocked", mgtDelSaRes.status === 403, `Status: ${mgtDelSaRes.status} (Expected 403)`);

    // Management Allowed to Deactivate Created Management/Supervisor
    if (mgtCreatedData.user?.id) {
      const mgtDeactSubRes = await fetch(`${BASE_URL}/api/users/${mgtCreatedData.user.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${mgtToken}` },
        body: JSON.stringify({ is_active: false }),
      });
      assertTest("Management Deactivate Peer User Allowed", mgtDeactSubRes.status === 200, `Status: ${mgtDeactSubRes.status}`);

      // Management Allowed to Delete Created User
      const mgtDelSubRes = await fetch(`${BASE_URL}/api/users/${mgtCreatedData.user.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${mgtToken}` },
      });
      assertTest("Management Delete Subordinate User Allowed", mgtDelSubRes.status === 200, `Status: ${mgtDelSubRes.status}`);
    }

    // 3. Zone Master RBAC Tests
    console.log(`\n[3] Testing Master Zone Authorization...`);

    const fakeZonePayload = {
      name: "Test Zone",
      code: "ZONE_TEST",
      capacity: 5,
      boundary: {
        type: "Polygon",
        coordinates: [
          [
            [112.7, -7.4],
            [112.71, -7.4],
            [112.71, -7.41],
            [112.7, -7.41],
            [112.7, -7.4],
          ],
        ],
      },
    };

    const mgtZonePostRes = await fetch(`${BASE_URL}/api/zones`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${mgtToken}` },
      body: JSON.stringify(fakeZonePayload),
    });
    assertTest("Zone Master: Management POST /api/zones Blocked", mgtZonePostRes.status === 403, `Status: ${mgtZonePostRes.status} (Expected 403)`);

    const spvZonePostRes = await fetch(`${BASE_URL}/api/zones`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${supervisorToken}` },
      body: JSON.stringify(fakeZonePayload),
    });
    assertTest("Zone Master: Supervisor POST /api/zones Blocked", spvZonePostRes.status === 403, `Status: ${spvZonePostRes.status} (Expected 403)`);

    const mgtZoneDelRes = await fetch(`${BASE_URL}/api/zones/some-random-id`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${mgtToken}` },
    });
    assertTest("Zone Master: Management DELETE /api/zones/:id Blocked", mgtZoneDelRes.status === 403, `Status: ${mgtZoneDelRes.status} (Expected 403)`);

    // 4. DSS & Scoring Engine RBAC Tests
    console.log(`\n[4] Testing DSS & Scoring Engine Authorization...`);

    const mgtBwmCalcRes = await fetch(`${BASE_URL}/api/dss/bwm/calculate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${mgtToken}` },
      body: JSON.stringify({ bestCriterion: "C1", worstCriterion: "C6", othersToWorst: {}, bestToOthers: {} }),
    });
    assertTest("DSS: Management POST /api/dss/bwm/calculate Blocked", mgtBwmCalcRes.status === 403, `Status: ${mgtBwmCalcRes.status} (Expected 403)`);

    const spvBwmCalcRes = await fetch(`${BASE_URL}/api/dss/bwm/calculate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${supervisorToken}` },
      body: JSON.stringify({ bestCriterion: "C1", worstCriterion: "C6" }),
    });
    assertTest("DSS: Supervisor POST /api/dss/bwm/calculate Blocked", spvBwmCalcRes.status === 403, `Status: ${spvBwmCalcRes.status} (Expected 403)`);

    const riderDssEvalRes = await fetch(`${BASE_URL}/api/dss/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${riderToken}` },
      body: JSON.stringify({ zone_ids: [] }),
    });
    assertTest("DSS: Rider POST /api/dss/evaluate Blocked", riderDssEvalRes.status === 403, `Status: ${riderDssEvalRes.status} (Expected 403)`);

    const spvPoiScoreRes = await fetch(`${BASE_URL}/api/poi-categories/some-cat-id/time-scores`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${supervisorToken}` },
      body: JSON.stringify({ score_pagi: 4 }),
    });
    assertTest("Scoring: Supervisor PUT /api/poi-categories/:id/time-scores Blocked", spvPoiScoreRes.status === 403, `Status: ${spvPoiScoreRes.status} (Expected 403)`);

    // 5. System Administration, Audit & Road Sync RBAC Tests
    console.log(`\n[5] Testing System Audit, Cron, Settings & Road Sync Authorization...`);

    const mgtAuditRes = await fetch(`${BASE_URL}/api/audit-logs`, {
      headers: { Authorization: `Bearer ${mgtToken}` },
    });
    assertTest("Audit Logs: Management GET /api/audit-logs Blocked", mgtAuditRes.status === 403, `Status: ${mgtAuditRes.status} (Expected 403)`);

    const saAuditRes = await fetch(`${BASE_URL}/api/audit-logs`, {
      headers: { Authorization: `Bearer ${superadminToken}` },
    });
    assertTest("Audit Logs: Superadmin GET /api/audit-logs Allowed", saAuditRes.status === 200, `Status: ${saAuditRes.status}`);

    const mgtCronRes = await fetch(`${BASE_URL}/api/cron-management/configs`, {
      headers: { Authorization: `Bearer ${mgtToken}` },
    });
    assertTest("Cron: Management GET /api/cron-management/configs Blocked", mgtCronRes.status === 403, `Status: ${mgtCronRes.status} (Expected 403)`);

    const mgtRulesRes = await fetch(`${BASE_URL}/api/system-settings/operational-rules`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${mgtToken}` },
      body: JSON.stringify({ rules: [] }),
    });
    assertTest("System Settings: Management PATCH /operational-rules Blocked", mgtRulesRes.status === 403, `Status: ${mgtRulesRes.status} (Expected 403)`);

    const mgtTollRes = await fetch(`${BASE_URL}/api/roads/sync-toll`, {
      method: "POST",
      headers: { Authorization: `Bearer ${mgtToken}` },
    });
    assertTest("Roads: Management POST /api/roads/sync-toll Blocked", mgtTollRes.status === 403, `Status: ${mgtTollRes.status} (Expected 403)`);

    // 6. Map / LBS Nearby Access for Rider
    console.log(`\n[6] Testing Map & LBS Access for Rider...`);

    // Track rider 1 position in Redis
    await fetch(`${BASE_URL}/api/lbs/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${riderToken}` },
      body: JSON.stringify({ rider_id: riderUser.id, lat: -7.4478, lon: 112.7183 }),
    });

    // Track rider 2 position in Redis
    await fetch(`${BASE_URL}/api/lbs/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${supervisorToken}` },
      body: JSON.stringify({ rider_id: supervisorUser.id, lat: -7.4490, lon: 112.7200 }),
    });

    const riderNearbyRes = await fetch(`${BASE_URL}/api/lbs/nearby?latitude=-7.4478&longitude=112.7183&radiusKm=5`, {
      headers: { Authorization: `Bearer ${riderToken}` },
    });
    assertTest("LBS: Rider GET /api/lbs/nearby Allowed", riderNearbyRes.status === 200, `Status: ${riderNearbyRes.status}`);

    const riderDistRes = await fetch(`${BASE_URL}/api/lbs/distance?rider1=${riderUser.id}&rider2=${supervisorUser.id}`, {
      headers: { Authorization: `Bearer ${riderToken}` },
    });
    assertTest("LBS: Rider GET /api/lbs/distance Allowed", riderDistRes.status === 200, `Status: ${riderDistRes.status}`);

  } catch (err) {
    console.error("FATAL ERROR in RBAC tests:", err);
  } finally {
    if (localServer) {
      localServer.close();
    }
    console.log(`\n======================================================`);
    console.log(`RBAC Hardening Test Results:`);
    console.log(`PASSED: ${passedCount} | FAILED: ${failedCount}`);
    console.log(`======================================================\n`);
    await pool.end();
    process.exit(failedCount > 0 ? 1 : 0);
  }
}

runRbacTests();
