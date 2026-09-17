import "dotenv/config";
import http from "http";
import { app } from "../../index.js";
import { pool } from "../../src/config/database.js";

const PORT = process.env.PORT || 9000;
const BASE_URL = `http://localhost:${PORT}`;

async function runTests() {
  console.log(`Starting API integration tests on: ${BASE_URL}`);
  let passedCount = 0;
  let failedCount = 0;
  let localServer = null;

  try {
    // Check if server is already running, if not start in-process
    try {
      const ping = await fetch(`${BASE_URL}/api/poi-categories`, { signal: AbortSignal.timeout(1500) });
    } catch (err) {
      console.log(`Server not active on port ${PORT}, starting test server in-process...`);
      localServer = http.createServer(app);
      await new Promise((resolve) => localServer.listen(PORT, resolve));
      console.log(`Test server running at ${BASE_URL}`);
    }

    function logResult(testName, isSuccess, details = "") {
      if (isSuccess) {
        console.log(`PASS ${testName}${details ? ` - ${details}` : ""}`);
        passedCount++;
      } else {
        console.log(`FAIL ${testName}${details ? ` - ${details}` : ""}`);
        failedCount++;
      }
    }

    // 0. Setup Deterministic Test Fixtures (Users & Zones)
    const bcrypt = (await import("bcrypt")).default;
    const defaultHash = await bcrypt.hash("password123", 10);
    await pool.query(`
      INSERT INTO users (username, name, email, password, role, is_active, first_login)
      VALUES ('superadmin', 'Super Admin System', 'superadmin@kopikeliling.com', $1, 'SUPERADMIN', true, false)
      ON CONFLICT (email) DO UPDATE SET password = $1, first_login = false, is_active = true;
    `, [defaultHash]);

    await pool.query(`
      INSERT INTO users (username, name, email, password, role, is_active, first_login)
      VALUES ('supervisor1', 'Supervisor Test', 'supervisor@kopikeliling.com', $1, 'SUPERVISOR', true, false)
      ON CONFLICT (email) DO UPDATE SET password = $1, first_login = false, is_active = true;
    `, [defaultHash]);

    await pool.query(`
      INSERT INTO users (username, name, email, password, role, is_active, first_login)
      VALUES ('rider1', 'Rider Test', 'rider@kopikeliling.com', $1, 'RIDER', true, false)
      ON CONFLICT (email) DO UPDATE SET password = $1, first_login = false, is_active = true;
    `, [defaultHash]);

    const { rows: existingZones } = await pool.query("SELECT id FROM zones LIMIT 1;");
    if (existingZones.length === 0) {
      const testPoly = JSON.stringify({
        type: "Polygon",
        coordinates: [
          [
            [112.7160, -7.4460],
            [112.7210, -7.4460],
            [112.7210, -7.4510],
            [112.7160, -7.4510],
            [112.7160, -7.4460]
          ]
        ]
      });
      await pool.query(`
        INSERT INTO zones (name, description, max_capacity, status, polygon, geom)
        VALUES ('Zona API Test', 'Zona untuk pengujian API', 3, 'ACTIVE', $1::jsonb, ST_SetSRID(ST_GeomFromGeoJSON($1), 4326));
      `, [testPoly]);
    }

    // Authentication tests
    const resSuperadmin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "superadmin@kopikeliling.com", password: "password123" }),
    });
    const dataSuperadmin = await resSuperadmin.json();
    const superadminToken = dataSuperadmin.token;
    logResult("Login Superadmin", resSuperadmin.status === 200 && superadminToken, `Role: ${dataSuperadmin.user?.role}`);

    const resSupervisor = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "supervisor@kopikeliling.com", password: "password123" }),
    });
    const dataSupervisor = await resSupervisor.json();
    const supervisorToken = dataSupervisor.token;
    logResult("Login Supervisor", resSupervisor.status === 200 && supervisorToken, `Role: ${dataSupervisor.user?.role}`);

    const resRider = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "rider@kopikeliling.com", password: "password123" }),
    });
    const dataRider = await resRider.json();
    const riderToken = dataRider.token;
    logResult("Login Rider", resRider.status === 200 && riderToken, `Role: ${dataRider.user?.role}`);

    // Zones
    const resZones = await fetch(`${BASE_URL}/api/zones`, { headers: { Authorization: `Bearer ${superadminToken}` } });
    const dataZones = await resZones.json();
    const zonesCount = Array.isArray(dataZones.zones) ? dataZones.zones.length : 0;
    const testZoneId = zonesCount > 0 ? dataZones.zones[0].id : null;
    logResult("GET /api/zones", resZones.status === 200 && zonesCount >= 1, `Status: ${resZones.status}, Total Zones: ${zonesCount}`);

    // POI categories
    const resCategories = await fetch(`${BASE_URL}/api/poi-categories`);
    const dataCategories = await resCategories.json();
    const categoriesCount = Array.isArray(dataCategories.categories) ? dataCategories.categories.length : 0;
    const sampleCategoryId = categoriesCount > 0 ? dataCategories.categories[0].id : null;
    const hasTimeScores = dataCategories.categories?.[0]?.score_pagi !== undefined;
    logResult("GET /api/poi-categories", resCategories.status === 200 && categoriesCount >= 1 && hasTimeScores, `Status: ${resCategories.status}, Total Categories: ${categoriesCount}`);

    // Example RBAC guard test
    if (sampleCategoryId) {
      const resScoreRider = await fetch(`${BASE_URL}/api/poi-categories/${sampleCategoryId}/time-scores`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${riderToken}` },
        body: JSON.stringify({ score_pagi: 5 }),
      });
      logResult("RBAC Guard PUT time-scores (Rider -> 403)", resScoreRider.status === 403, `Status: ${resScoreRider.status}`);
    }

    // Weather sync
    const resWeatherSync = await fetch(`${BASE_URL}/api/weathers/sync`, { method: "POST", headers: { Authorization: `Bearer ${supervisorToken}` } });
    const dataWeatherSync = await resWeatherSync.json();
    logResult("POST /api/weathers/sync", resWeatherSync.status === 200 && dataWeatherSync.count >= 0, `Synced: ${dataWeatherSync.count}`);

    // Verification 1: Password Sanitization Tests
    const resMe = await fetch(`${BASE_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${superadminToken}` } });
    const dataMe = await resMe.json();
    const isMeSanitized = resMe.status === 200 && dataMe.user && dataMe.user.password === undefined;
    logResult("GET /api/auth/me Password Sanitization", isMeSanitized, `Password Exists: ${dataMe.user?.password !== undefined}`);

    const resProfile = await fetch(`${BASE_URL}/api/users/profile`, { headers: { Authorization: `Bearer ${superadminToken}` } });
    const dataProfile = await resProfile.json();
    const isProfileSanitized = resProfile.status === 200 && dataProfile.user && dataProfile.user.password === undefined;
    logResult("GET /api/users/profile Password Sanitization", isProfileSanitized, `Password Exists: ${dataProfile.user?.password !== undefined}`);

    if (dataSuperadmin.user?.id) {
      const resUserById = await fetch(`${BASE_URL}/api/users/${dataSuperadmin.user.id}`, { headers: { Authorization: `Bearer ${superadminToken}` } });
      const dataUserById = await resUserById.json();
      const isUserByIdSanitized = resUserById.status === 200 && dataUserById.user && dataUserById.user.password === undefined;
      logResult("GET /api/users/:id Password Sanitization", isUserByIdSanitized, `Password Exists: ${dataUserById.user?.password !== undefined}`);
    }

    // Verification 2: Delete User Integration Test
    const testUserReg = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: `deltest_${Date.now()}`,
        name: "Delete Test Rider",
        email: `deltest_${Date.now()}@example.com`,
        password: "password123",
      }),
    });
    const dataTestReg = await testUserReg.json();
    const testUserId = dataTestReg.user?.id;

    if (testUserId) {
      // Login test user to create refresh token
      await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: dataTestReg.user.email, password: "password123" }),
      });

      // Delete test user
      const resDelete = await fetch(`${BASE_URL}/api/users/${testUserId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${superadminToken}` },
      });
      const dataDelete = await resDelete.json();
      const isDeleteSuccessful = resDelete.status === 200 && dataDelete.msg !== undefined;
      logResult("DELETE /api/users/:id Execution", isDeleteSuccessful, `Status: ${resDelete.status}, Msg: ${dataDelete.msg}`);

      // Verify deleted user can no longer log in
      const resRelogin = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: dataTestReg.user.email, password: "password123" }),
      });
      logResult("Deleted User Re-authentication Lock", resRelogin.status === 400, `Status: ${resRelogin.status} (Expected: 400)` );
    }

  } catch (error) {
    console.error("ERROR executing API tests:", error && error.message ? error.message : error);
  } finally {
    if (typeof localServer !== "undefined" && localServer) {
      localServer.close();
    }
    console.log(`Results: PASSED: ${passedCount}  FAILED: ${failedCount}`);
    await pool.end();
    process.exit(failedCount > 0 ? 1 : 0);
  }
}

runTests();
