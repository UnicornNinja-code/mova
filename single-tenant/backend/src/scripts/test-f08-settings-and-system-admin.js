/**
 * test-f08-settings-and-system-admin.js
 * 
 * Automated Verification Test Suite for Milestone F-08:
 * System Settings, Central Hub Configuration, Map Tile Preferences & System Administration.
 */

import http from "http";
import jwt from "jsonwebtoken";
import { app } from "../../index.js";
import { pool } from "../config/database.js";
import { env } from "../config/env.js";

let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
  if (!condition) {
    failedCount++;
    console.error(`  ❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  passedCount++;
  console.log(`  ✅ [PASS] ${message}`);
}

async function request(server, method, reqPath, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(reqPath, "http://localhost:9000");
    const req = http.request(
      {
        hostname: "localhost",
        port: server.address().port,
        path: url.pathname + url.search,
        method: method,
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = data ? JSON.parse(data) : {};
            resolve({ status: res.statusCode, headers: res.headers, body: parsed });
          } catch (e) {
            resolve({ status: res.statusCode, headers: res.headers, body: data });
          }
        });
      }
    );
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runF08Tests() {
  console.log("\n================================================================================");
  console.log("🚀 STARTING MILESTONE F-08: SYSTEM SETTINGS & ADMINISTRATION VERIFICATION");
  console.log("================================================================================\n");

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));

  try {
    // 1. Prepare JWT Tokens
    const { rows: superadminUser } = await pool.query(
      `SELECT id, username, email, role FROM users WHERE role = 'SUPERADMIN' LIMIT 1;`
    );
    const { rows: supervisorUser } = await pool.query(
      `SELECT id, username, email, role FROM users WHERE role = 'SUPERVISOR' LIMIT 1;`
    );

    const superadminToken = jwt.sign(
      { id: superadminUser[0].id, role: "SUPERADMIN", username: superadminUser[0].username },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    const supervisorToken = jwt.sign(
      { id: supervisorUser[0].id, role: "SUPERVISOR", username: supervisorUser[0].username },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // -------------------------------------------------------------------------
    // TEST 1: GET /api/system-settings/operational-rules
    // -------------------------------------------------------------------------
    console.log("📌 TEST 1: Operational Rules Endpoint Verification...");
    const resRules = await request(server, "GET", "/api/system-settings/operational-rules", {
      Authorization: `Bearer ${superadminToken}`,
    });
    assert(resRules.status === 200, "GET /api/system-settings/operational-rules returns 200");
    assert(resRules.body.data !== undefined, "Operational rules data object is present");
    assert(typeof resRules.body.data.protocol_road_prohibited === "boolean", "protocol_road_prohibited is boolean");

    // -------------------------------------------------------------------------
    // TEST 2: GET /api/system-settings/readiness
    // -------------------------------------------------------------------------
    console.log("\n📌 TEST 2: System Readiness Evaluation Endpoint...");
    const resReadiness = await request(server, "GET", "/api/system-settings/readiness", {
      Authorization: `Bearer ${superadminToken}`,
    });
    assert(resReadiness.status === 200, "GET /api/system-settings/readiness returns 200");
    const readiness = resReadiness.body.data;
    assert(readiness.overall_status === "READY" || readiness.overall_status === "NEEDS_CONFIGURATION", "overall_status is valid enum");
    assert(typeof readiness.readiness_percentage === "number", "readiness_percentage is numeric");
    assert(Array.isArray(readiness.items) && readiness.items.length >= 6, "Checklist items array populated (≥ 6 items)");
    assert(readiness.hub_config !== undefined, "hub_config is present in readiness report");

    // -------------------------------------------------------------------------
    // TEST 3: GET /api/system-settings/hub
    // -------------------------------------------------------------------------
    console.log("\n📌 TEST 3: Central Hub Spatial Configuration...");
    const resHub = await request(server, "GET", "/api/system-settings/hub", {
      Authorization: `Bearer ${superadminToken}`,
    });
    assert(resHub.status === 200, "GET /api/system-settings/hub returns 200");
    assert(typeof resHub.body.data.latitude === "number", "Hub latitude is numeric");
    assert(typeof resHub.body.data.longitude === "number", "Hub longitude is numeric");
    assert(typeof resHub.body.data.radius_km === "number", "Hub operational radius is numeric");

    // -------------------------------------------------------------------------
    // TEST 4: PUT /api/system-settings/hub (SUPERADMIN ONLY)
    // -------------------------------------------------------------------------
    console.log("\n📌 TEST 4: Update Central Hub Spatial Configuration (RBAC & Persistence)...");
    const updatePayload = {
      hub_name: "Central Hub Sidoarjo Utama",
      hub_city_name: "Sidoarjo",
      hub_address: "Jl. Pahlawan No. 1, Sidoarjo, Jawa Timur",
      hub_latitude: -7.447812,
      hub_longitude: 112.718345,
      operational_radius_km: 15,
    };

    const resUpdateHub = await request(server, "PUT", "/api/system-settings/hub", {
      Authorization: `Bearer ${superadminToken}`,
    }, updatePayload);
    assert(resUpdateHub.status === 200, "PUT /api/system-settings/hub as SUPERADMIN returns 200");
    assert(resUpdateHub.body.data.name === updatePayload.hub_name, "Hub name updated in response");
    assert(resUpdateHub.body.data.radius_km === 15, "Operational radius updated to 15 km");

    // Verify RBAC: Supervisor must receive 403 Forbidden
    const resForbiddenUpdate = await request(server, "PUT", "/api/system-settings/hub", {
      Authorization: `Bearer ${supervisorToken}`,
    }, updatePayload);
    assert(resForbiddenUpdate.status === 403, "PUT /api/system-settings/hub as SUPERVISOR returns 403 Forbidden");

    // -------------------------------------------------------------------------
    // TEST 5: GET /api/system-settings/map-config
    // -------------------------------------------------------------------------
    console.log("\n📌 TEST 5: Map Tile Configuration Metadata...");
    const resMapConfig = await request(server, "GET", "/api/system-settings/map-config", {
      Authorization: `Bearer ${superadminToken}`,
    });
    assert(resMapConfig.status === 200, "GET /api/system-settings/map-config returns 200");
    assert(Array.isArray(resMapConfig.body.data.providers), "Providers array present");
    assert(resMapConfig.body.data.providers.length >= 5, "At least 5 map providers supported");

    // -------------------------------------------------------------------------
    // TEST 6: Data Freshness & Sync Endpoints (/api/sync)
    // -------------------------------------------------------------------------
    console.log("\n📌 TEST 6: Data Freshness & Sync Endpoints...");
    const resSyncStatus = await request(server, "GET", "/api/sync/status", {
      Authorization: `Bearer ${superadminToken}`,
    });
    assert(resSyncStatus.status === 200, "GET /api/sync/status returns 200");

    const resSyncRuns = await request(server, "GET", "/api/sync/runs", {
      Authorization: `Bearer ${superadminToken}`,
    });
    assert(resSyncRuns.status === 200, "GET /api/sync/runs returns 200");

    // -------------------------------------------------------------------------
    // TEST 7: Audit & Cron Endpoints
    // -------------------------------------------------------------------------
    console.log("\n📌 TEST 7: Audit Logs & Cron Management...");
    const resAudit = await request(server, "GET", "/api/audit-logs", {
      Authorization: `Bearer ${superadminToken}`,
    });
    assert(resAudit.status === 200, "GET /api/audit-logs returns 200");

    const resCron = await request(server, "GET", "/api/cron-management/configs", {
      Authorization: `Bearer ${superadminToken}`,
    });
    assert(resCron.status === 200, "GET /api/cron-management/configs returns 200");

    console.log("\n================================================================================");
    console.log(`🎉 ALL ${passedCount} F-08 SYSTEM SETTINGS & ADMINISTRATION ASSERTIONS PASSED!`);
    console.log("================================================================================\n");
  } catch (error) {
    console.error("\n❌ Test Suite Failed:", error);
    process.exitCode = 1;
  } finally {
    server.close();
  }
}

runF08Tests()
  .then(() => process.exit(process.exitCode || 0))
  .catch((e) => {
    console.error("Execution error:", e);
    process.exit(1);
  });
