/*
 * test-f05-intelligence-workspace.js
 * Automated Verification Test Suite for Milestone F-05: MOVA Intelligence Workspace
 * Tests DSS Recommendations, C3 Crowd Score Configuration, Weather Intelligence,
 * Plan-vs-Actual Analytics, Semantic Data Preservation, and Invariant Verification.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";
import jwt from "jsonwebtoken";
import { app } from "../../index.js";
import { pool } from "../config/database.js";
import { env } from "../config/env.js";
import { topsisEngineService } from "../services/dss/TopsisEngineService.js";
import { poiTimeCrowdService } from "../services/poi/POITimeCrowdService.js";
import { dssPerformanceService } from "../services/analytics/DSSPerformanceService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_DIR = path.resolve(__dirname, "../../../frontend");

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

async function runF05Tests() {
  console.log("\n================================================================================");
  console.log("🚀 STARTING MILESTONE F-05: MOVA INTELLIGENCE WORKSPACE VERIFICATION");
  console.log("================================================================================\n");

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));

  const adminUserRes = await pool.query("SELECT id, email, role FROM users WHERE role = 'SUPERADMIN' LIMIT 1");
  const adminUser = adminUserRes.rows[0];

  const spvUserRes = await pool.query("SELECT id, email, role FROM users WHERE role = 'SUPERVISOR' LIMIT 1");
  const spvUser = spvUserRes.rows[0];

  const superadminToken = jwt.sign(
    { id: adminUser.id, email: adminUser.email, role: adminUser.role },
    env.JWT_SECRET || "mova_super_secret_jwt_key_2026",
    { expiresIn: "1h" }
  );
  const supervisorToken = jwt.sign(
    { id: spvUser.id, email: spvUser.email, role: spvUser.role },
    env.JWT_SECRET || "mova_super_secret_jwt_key_2026",
    { expiresIn: "1h" }
  );

  try {
    // -------------------------------------------------------------------------
    // 1. Static Source Code & UI Architecture Inspection
    // -------------------------------------------------------------------------
    console.log("🔍 1. Inspecting DssManagementPage Component Composition & Invariants...");
    const dssPagePath = path.resolve(FRONTEND_DIR, "src/pages/superadmin/DssManagementPage.jsx");
    const dssPageCode = fs.readFileSync(dssPagePath, "utf-8");

    // Invariant: Zero Frontend DSS / BWM / TOPSIS Recalculation
    assert(!dssPageCode.includes("Math.sqrt(sumSq)"), "Zero frontend calculation: No in-browser TOPSIS norm calculation");
    assert(!dssPageCode.includes("calculateBwmWeights("), "Zero frontend calculation: No in-browser BWM calculation");
    assert(!dssPageCode.includes("d_plus / (d_plus + d_minus)"), "Zero frontend calculation: No in-browser preference score math");

    // Check Tabs integration
    assert(dssPageCode.includes('value="recommendations"'), "Contains DSS Recommendations tab");
    assert(dssPageCode.includes('value="c3_config"'), "Contains C3 Crowd Score Config tab");
    assert(dssPageCode.includes('value="weather"'), "Contains Weather Intelligence tab");
    assert(dssPageCode.includes('value="plan_vs_actual"'), "Contains Plan vs Actual tab");

    // Check Component reuse
    assert(dssPageCode.includes("TableContainer"), "Reuses TableContainer primitive");
    assert(dssPageCode.includes("Drawer"), "Reuses Drawer primitive for provenance inspection");
    assert(dssPageCode.includes("StatusBadge"), "Reuses StatusBadge primitive");
    assert(dssPageCode.includes("PageHeader"), "Reuses PageHeader primitive");

    // -------------------------------------------------------------------------
    // 2. Testing DSS Recommendation SSOT Contract & Live Endpoint
    // -------------------------------------------------------------------------
    console.log("\n🧠 2. Testing DSS Recommendation Contract & Live Endpoint...");
    const dssRes = await request(server, "GET", "/api/dss/recommendations", {
      Authorization: `Bearer ${superadminToken}`,
    });
    assert(dssRes.status === 200, "GET /api/dss/recommendations returns 200 OK");
    const dssResult = dssRes.body;

    assert(dssResult.model_version === "BWM-TOPSIS-v1.0", "Model version must be BWM-TOPSIS-v1.0");
    assert(dssResult.evaluation_version === "DSS-CRITERIA-v1.0", "Evaluation version must be DSS-CRITERIA-v1.0");
    assert(dssResult.evaluated_at, "Evaluated timestamp must be present");
    assert(Array.isArray(dssResult.rankings) && dssResult.rankings.length > 0, "Rankings must be non-empty array");

    const topRank = dssResult.rankings[0];
    assert(topRank.rank === 1, "Top ranking zone must have rank 1");
    assert(typeof topRank.preference_score === "number", "Preference score must be numeric");
    assert(topRank.preference_score >= 0 && topRank.preference_score <= 1, "Preference score in [0, 1]");
    assert(topRank.data_quality === "VALID" || topRank.data_quality === "DEGRADED", "Data quality must be VALID or DEGRADED");
    assert(topRank.provenance, "Provenance map must exist in ranking item");
    assert(topRank.provenance.C1, "C1 POI Densitas provenance exists");
    assert(topRank.provenance.C4, "C4 Weather provenance exists");
    assert(topRank.reasoning, "Deterministic reasoning summary exists");

    // -------------------------------------------------------------------------
    // 3. Testing C3 Crowd Score Configuration Endpoints
    // -------------------------------------------------------------------------
    console.log("\n📊 3. Testing C3 Crowd Score Configuration Endpoints...");
    const c3Res = await request(server, "GET", "/api/poi-categories/crowd-scores", {
      Authorization: `Bearer ${superadminToken}`,
    });
    assert(c3Res.status === 200, "GET /api/poi-categories/crowd-scores returns 200 OK");
    const c3Categories = c3Res.body.categories || [];
    assert(c3Categories.length >= 50, `C3 categories contains ${c3Categories.length} master categories`);

    const sampleCat = c3Categories[0];
    const scorePagi = sampleCat.scores?.pagi ?? sampleCat.score_pagi;
    const scoreSiang = sampleCat.scores?.siang ?? sampleCat.score_siang;
    const scoreSore = sampleCat.scores?.sore ?? sampleCat.score_sore;
    const scoreMalam = sampleCat.scores?.malam ?? sampleCat.score_malam;
    assert(scorePagi >= 1 && scorePagi <= 5, "Score pagi in range [1, 5]");
    assert(scoreSiang >= 1 && scoreSiang <= 5, "Score siang in range [1, 5]");
    assert(scoreSore >= 1 && scoreSore <= 5, "Score sore in range [1, 5]");
    assert(scoreMalam >= 1 && scoreMalam <= 5, "Score malam in range [1, 5]");

    // Test single update
    const singleUpdateRes = await request(
      server,
      "PUT",
      `/api/poi-categories/${sampleCat.id}/crowd-scores`,
      { Authorization: `Bearer ${superadminToken}` },
      { score_pagi: 3, score_siang: 4, score_sore: 5, score_malam: 2 }
    );
    assert(singleUpdateRes.status === 200, "PUT /api/poi-categories/:id/crowd-scores returns 200 OK");
    assert(singleUpdateRes.body.category.score_sore === 5, "Single C3 update verified with score_sore = 5");

    // Test bulk update
    const bulkRes = await request(
      server,
      "PUT",
      "/api/poi-categories/crowd-scores",
      { Authorization: `Bearer ${superadminToken}` },
      { scores: [{ id: sampleCat.id, score_pagi: 2, score_siang: 3, score_sore: 4, score_malam: 1 }] }
    );
    assert(bulkRes.status === 200, "PUT /api/poi-categories/crowd-scores (bulk) returns 200 OK");

    // -------------------------------------------------------------------------
    // 4. Testing Weather Intelligence Context
    // -------------------------------------------------------------------------
    console.log("\n⛅ 4. Testing Weather Intelligence Context...");
    const weatherRes = await request(server, "GET", "/api/weathers/hub/Sidoarjo", {
      Authorization: `Bearer ${superadminToken}`,
    });
    assert(weatherRes.status === 200, "GET /api/weathers/hub/Sidoarjo returns 200 OK");
    const weatherInfo = weatherRes.body.data || weatherRes.body;
    assert(
      weatherInfo.hub_city_name === "SIDOARJO" || weatherInfo.city === "Sidoarjo" || weatherInfo.hub === "Sidoarjo",
      "Hub weather city is Sidoarjo"
    );
    assert(
      weatherInfo.hub_overview?.weather_condition || weatherInfo.condition || weatherInfo.weather_description,
      "Weather condition is present"
    );
    assert(
      weatherInfo.freshness === "FRESH" || weatherInfo.freshness === "CACHED" || weatherInfo.freshness === "STATIC" || weatherInfo.status === "success",
      "Freshness / status metadata preserved"
    );

    // -------------------------------------------------------------------------
    // 5. Testing Plan vs Actual Analytics Endpoint
    // -------------------------------------------------------------------------
    console.log("\n📈 5. Testing Plan vs Actual Analytics Service...");
    const today = new Date().toISOString().split("T")[0];
    const pvaRes = await request(server, "GET", `/api/analytics/dss/plan-vs-actual?date=${today}`, {
      Authorization: `Bearer ${superadminToken}`,
    });
    assert(pvaRes.status === 200, "GET /api/analytics/dss/plan-vs-actual returns 200 OK");
    const pvaData = pvaRes.body.data || pvaRes.body;
    assert(pvaData.insights, "Insights object exists in Plan vs Actual analysis");
    assert(pvaData.insights.rank_order_alignment, "rank_order_alignment metric exists");
    assert(Array.isArray(pvaData.ranks_breakdown), "ranks_breakdown is an array");

    // -------------------------------------------------------------------------
    // 6. RBAC & Data Masking Invariance
    // -------------------------------------------------------------------------
    console.log("\n🛡️ 6. Testing RBAC Field-Level Projections & Masking...");
    const supervisorOverviewRes = await request(server, "GET", "/api/analytics/overview", {
      Authorization: `Bearer ${supervisorToken}`,
    });
    assert(supervisorOverviewRes.status === 200, "SUPERVISOR overview returns 200 OK");
    assert(supervisorOverviewRes.body.data.role_projection === "SUPERVISOR", "SUPERVISOR role projection verified");
    assert(
      supervisorOverviewRes.body.data.sales.summary.total_revenue.formatted === "PROTECTED_ROLE",
      "Supervisor financial total_revenue masked to PROTECTED_ROLE"
    );

    console.log("\n================================================================================");
    console.log(`🏆 MILESTONE F-05 VERIFICATION COMPLETE: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log("================================================================================\n");
  } catch (err) {
    console.error("Test execution encountered an error:", err);
    process.exitCode = 1;
  } finally {
    server.close();
    await pool.end();
  }
}

runF05Tests();
