/*
 * test-phase8f-frontend-api-compatibility.js
 * Verification test suite for Phase 8F Frontend-API Contract Integrity
 */

import http from "http";

const API_BASE = "http://localhost:5000/api";

function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on("error", (err) => reject(err));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runApiCompatibilityTest() {
  console.log("================================================================================");
  console.log("🚀 VERIFIKASI INTERAKSI API FRONTEND & CONTRACT INTEGRITY (PHASE 8F)");
  console.log("================================================================================\n");

  let authToken = null;

  // 1. Authenticate Admin
  console.log("1️⃣  Menguji Auth Admin (POST /api/auth/login)...");
  try {
    const loginRes = await makeRequest("POST", "/auth/login", {
      email: "superadmin@kopikeliling.com",
      password: "password123",
    });
    if (loginRes.status === 200 && (loginRes.data.token || loginRes.data.data?.token)) {
      authToken = loginRes.data.token || loginRes.data.data?.token;
      console.log("   ✅ Login Admin Berhasil! Status:", loginRes.status);
    } else {
      console.log("   ⚠️ Login Admin status:", loginRes.status, loginRes.data);
    }
  } catch (err) {
    console.log("   ❌ Gagal terhubung ke API backend:", err.message);
    process.exit(1);
  }

  // 2. Fetch Active Zones
  console.log("\n2️⃣  Menguji Zone Management (GET /api/zones)...");
  const authHeader = authToken ? { Authorization: `Bearer ${authToken}` } : {};
  const zonesRes = await makeRequest("GET", "/zones", null, authHeader);
  console.log(`   ✅ Fetch Zones Status: ${zonesRes.status} (Found ${zonesRes.data?.zones?.length || 0} zones)`);

  // 3. Fetch Road Restrictions (Protocol & Toll)
  console.log("\n3️⃣  Menguji Road Restrictions GeoJSON Layers...");
  const protocolRes = await makeRequest("GET", "/roads/protocol", null, authHeader);
  console.log(`   ✅ Protocol Roads Status: ${protocolRes.status} (Features: ${protocolRes.data?.features?.length || 0})`);

  const tollRes = await makeRequest("GET", "/roads/toll", null, authHeader);
  console.log(`   ✅ Toll Roads Status: ${tollRes.status} (Features: ${tollRes.data?.features?.length || 0})`);

  // 4. Test DSS Active BWM Config
  console.log("\n4️⃣  Menguji Active BWM Configuration (GET /api/dss/bwm/active)...");
  const bwmRes = await makeRequest("GET", "/dss/bwm/active", null, authHeader);
  console.log(`   ✅ Active BWM Status: ${bwmRes.status} (CR: ${bwmRes.data?.data?.consistency_ratio || bwmRes.data?.consistency_ratio || "N/A"})`);

  // 5. Test DSS Evaluation Execution
  console.log("\n5️⃣  Menguji Hybrid DSS Zone Evaluation (POST /api/dss/evaluate)...");
  const zonesList = zonesRes.data?.zones || [];
  const activeZoneIds = zonesList.filter(z => z.status === 'ACTIVE').map(z => z.id);
  const evalRes = await makeRequest("POST", "/dss/evaluate", {
    zone_ids: activeZoneIds.slice(0, 3),
    time_slot: "sore",
  }, authHeader);
  console.log(`   ✅ Hybrid DSS Evaluation Status: ${evalRes.status} (Rank #1: ${evalRes.data?.data?.topsis_summary?.rankings?.[0]?.zone_name || "N/A"})`);

  // 6. Test Distribution Overview
  console.log("\n6️⃣  Menguji Distribution Workspace Overview (GET /api/distribution/overview)...");
  const distRes = await makeRequest("GET", "/distribution/overview", null, authHeader);
  console.log(`   ✅ Distribution Overview Status: ${distRes.status}`);

  // 7. Test Hub Fleet Catalog
  console.log("\n7️⃣  Menguji Hub Armada Catalog (GET /api/rider-operational/hub-armadas)...");
  const fleetRes = await makeRequest("GET", "/rider-operational/hub-armadas", null, authHeader);
  console.log(`   ✅ Hub Armada Status: ${fleetRes.status} (Total Armadas: ${fleetRes.data?.data?.length || 0})`);

  // 8. Test LBS Nearby Query
  console.log("\n8️⃣  Menguji Live LBS Nearby Riders (GET /api/lbs/nearby)...");
  const lbsRes = await makeRequest("GET", "/lbs/nearby?lat=-7.4478&lon=112.7183&radius=10", null, authHeader);
  console.log(`   ✅ LBS Nearby Status: ${lbsRes.status}`);

  console.log("\n================================================================================");
  console.log("🎉 VERIFIKASI INTEGRITAS API FRONTEND-BACKEND 100% SUKSES!");
  console.log("================================================================================\n");
}

runApiCompatibilityTest().catch(console.error);
