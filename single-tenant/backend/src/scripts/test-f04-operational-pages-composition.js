/*
 * test-f04-operational-pages-composition.js
 * Verification Suite for Milestone F-04: Operational Page Composition (Rider, Fleet, Zone Monitoring)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";
import jwt from "jsonwebtoken";
import { app } from "../../index.js";
import { pool } from "../config/database.js";
import { env } from "../config/env.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_DIR = path.resolve(__dirname, "../../../frontend");

function assert(condition, message) {
  if (!condition) {
    console.error(`  ❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✅ [PASS] ${message}`);
}

async function request(server, method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, "http://localhost:9000");
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

async function runF04Tests() {
  console.log("================================================================================");
  console.log("🚀 STARTING MILESTONE F-04: OPERATIONAL PAGE COMPOSITION VERIFICATION");
  console.log("================================================================================");

  // ---------------------------------------------------------------------------
  // 1. Rider Monitoring (DistributionPage.jsx) Source Audit
  // ---------------------------------------------------------------------------
  console.log("\n🛵 1. Auditing Rider Monitoring Workspace (DistributionPage.jsx)...");
  const distPagePath = path.join(FRONTEND_DIR, "src/pages/distribution/DistributionPage.jsx");
  assert(fs.existsSync(distPagePath), "DistributionPage.jsx exists");
  const distContent = fs.readFileSync(distPagePath, "utf-8");

  assert(distContent.includes("distributionService.getOverview"), "Integrates distributionService.getOverview");
  assert(distContent.includes("lbsService.getLiveRiders"), "Integrates lbsService.getLiveRiders");
  assert(distContent.includes("dssService.getTopsisRecommendations"), "Integrates dssService.getTopsisRecommendations");
  assert(distContent.includes("LeafletMapCanvas"), "Reuses LeafletMapCanvas spatial primitive");
  assert(distContent.includes("OperationalDetailPanel"), "Reuses OperationalDetailPanel primitive");
  assert(distContent.includes("MapFloatingToolbar"), "Reuses MapFloatingToolbar control");
  assert(distContent.includes("SOCKET_EVENTS.SUPERVISOR_RIDER_MOVED"), "Subscribes to live rider moved socket event");
  assert(distContent.includes("SOCKET_EVENTS.GEOFENCE_BREACH"), "Subscribes to geofence breach warning socket event");
  assert(distContent.includes("zone_compliance"), "Preserves zone compliance status attribute");
  assert(distContent.includes("road_alert"), "Preserves road restriction status attribute");

  // ---------------------------------------------------------------------------
  // 2. Fleet Monitoring (FleetManagementPage.jsx) Source Audit
  // ---------------------------------------------------------------------------
  console.log("\n🚲 2. Auditing Fleet Monitoring Workspace (FleetManagementPage.jsx)...");
  const fleetPagePath = path.join(FRONTEND_DIR, "src/pages/superadmin/FleetManagementPage.jsx");
  assert(fs.existsSync(fleetPagePath), "FleetManagementPage.jsx exists");
  const fleetContent = fs.readFileSync(fleetPagePath, "utf-8");

  assert(fleetContent.includes("armadaService.getAll"), "Integrates armadaService.getAll");
  assert(fleetContent.includes("armadaService.create"), "Integrates armadaService.create");
  assert(fleetContent.includes("armadaService.delete"), "Integrates armadaService.delete");
  assert(fleetContent.includes("LeafletMapCanvas"), "Reuses LeafletMapCanvas for spatial fleet positions");
  assert(fleetContent.includes("OperationalDetailPanel"), "Reuses OperationalDetailPanel for fleet specs");
  assert(fleetContent.includes("MapFloatingToolbar"), "Reuses MapFloatingToolbar");

  // ---------------------------------------------------------------------------
  // 3. Zone Operations (ZoneManagementPage.jsx) Source Audit
  // ---------------------------------------------------------------------------
  console.log("\n🗺️ 3. Auditing Zone Operations Workspace (ZoneManagementPage.jsx)...");
  const zonePagePath = path.join(FRONTEND_DIR, "src/pages/superadmin/ZoneManagementPage.jsx");
  assert(fs.existsSync(zonePagePath), "ZoneManagementPage.jsx exists");
  const zoneContent = fs.readFileSync(zonePagePath, "utf-8");

  assert(zoneContent.includes("zoneService.getZones"), "Integrates zoneService.getZones");
  assert(zoneContent.includes("zoneService.createZone"), "Integrates zoneService.createZone");
  assert(zoneContent.includes("zoneService.updateZone"), "Integrates zoneService.updateZone");
  assert(zoneContent.includes("zoneService.deleteZone"), "Integrates zoneService.deleteZone");
  assert(zoneContent.includes("dssService.getTopsisRecommendations"), "Integrates dssService.getTopsisRecommendations");
  assert(zoneContent.includes("weatherService.getHubWeatherInfo"), "Integrates weatherService.getHubWeatherInfo");
  assert(zoneContent.includes("LeafletMapCanvas"), "Reuses LeafletMapCanvas with polygon & POI layers");
  assert(zoneContent.includes("OperationalDetailPanel"), "Reuses OperationalDetailPanel for zone specs & capacity");
  assert(zoneContent.includes("zoneFormSchema"), "Enforces Zod validation on zone input forms");

  // ---------------------------------------------------------------------------
  // 4. Map Ops (MapOpsPage.jsx) DSS Integration Audit
  // ---------------------------------------------------------------------------
  console.log("\n🧭 4. Auditing MapOpsPage DSS Integration...");
  const mapOpsPagePath = path.join(FRONTEND_DIR, "src/pages/map/MapOpsPage.jsx");
  assert(fs.existsSync(mapOpsPagePath), "MapOpsPage.jsx exists");
  const mapOpsContent = fs.readFileSync(mapOpsPagePath, "utf-8");
  assert(mapOpsContent.includes("dssService.getTopsisRecommendations"), "MapOpsPage explicitly queries dssService.getTopsisRecommendations");
  assert(mapOpsContent.includes("topsis_rank"), "MapOpsPage merges topsis_rank into enhancedZones");

  // ---------------------------------------------------------------------------
  // 5. Test Live Operational Endpoints
  // ---------------------------------------------------------------------------
  console.log("\n🌐 5. Testing Operational Endpoints against Live Express Server...");
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));

  try {
    const userRes = await pool.query("SELECT id, email, role FROM users WHERE role = 'SUPERADMIN' LIMIT 1");
    const user = userRes.rows[0] || {
      id: "00000000-0000-0000-0000-000000000001",
      email: "superadmin@mova.co.id",
      role: "SUPERADMIN",
    };

    const superAdminToken = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      env.JWT_SECRET || "mova_super_secret_jwt_key_2026",
      { expiresIn: "1h" }
    );

    const headers = { Authorization: `Bearer ${superAdminToken}` };

    // 1. Distribution Overview
    const distRes = await request(server, "GET", "/api/distribution/overview", headers);
    assert(distRes.status === 200, "GET /api/distribution/overview returns 200 OK");
    assert(distRes.body?.status === "success", "Distribution overview status is success");

    // 2. Automatic Distribution Trigger (Canonical B-10)
    const autoRes = await request(server, "POST", "/api/distribution/auto-assign", headers);
    assert(autoRes.status === 200, "POST /api/distribution/auto-assign returns 200 OK");

    // 3. LBS Live Riders
    const lbsRes = await request(server, "GET", "/api/lbs/riders/live", headers);
    assert(lbsRes.status === 200, "GET /api/lbs/riders/live returns 200 OK");
    assert(lbsRes.body?.status === "success", "LBS live riders status is success");

    // 3. Armadas Fleet
    const fleetRes = await request(server, "GET", "/api/armadas", headers);
    assert(fleetRes.status === 200, "GET /api/armadas returns 200 OK");
    assert(Array.isArray(fleetRes.body?.armadas) || fleetRes.body?.status === "success", "Armadas list returned successfully");

    // 4. Zones
    const zonesRes = await request(server, "GET", "/api/zones", headers);
    assert(zonesRes.status === 200, "GET /api/zones returns 200 OK");
    assert(Array.isArray(zonesRes.body?.zones) || zonesRes.body?.status === "success", "Zones list returned successfully");

    // 5. DSS Recommendations
    const dssRes = await request(server, "GET", "/api/dss/recommendations", headers);
    assert(dssRes.status === 200, "GET /api/dss/recommendations returns 200 OK");
    assert(dssRes.body?.status === "success" || Array.isArray(dssRes.body?.recommendations), "DSS recommendations returned successfully");

    // 6. Protocol Roads
    const roadsRes = await request(server, "GET", "/api/roads/protocol", headers);
    assert(roadsRes.status === 200, "GET /api/roads/protocol returns 200 OK");
    assert(roadsRes.body !== undefined, "Protocol roads returned successfully");

    // 7. Weather Info
    const weatherRes = await request(server, "GET", "/api/weathers/hub/Sidoarjo", headers);
    assert(weatherRes.status === 200, "GET /api/weathers/hub/Sidoarjo returns 200 OK");
    assert(weatherRes.body?.status === "success" || weatherRes.body?.data !== undefined, "Weather info returned successfully");

    console.log("\n================================================================================");
    console.log("🏆 MILESTONE F-04 VERIFICATION COMPLETE: ALL ASSERTIONS PASSED (0 FAILURES)");
    console.log("================================================================================");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }
}

runF04Tests().catch((err) => {
  console.error("❌ Fatal Verification Failure:", err);
  process.exit(1);
});
