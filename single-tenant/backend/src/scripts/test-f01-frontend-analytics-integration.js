import jwt from "jsonwebtoken";
import { app } from "../../index.js";
import { env } from "../config/env.js";
import { queryKeys } from "../../../frontend/src/lib/queryKeys.js";
import { getAnalyticsValue, getAnalyticsFormatted, isNoData } from "../../../frontend/src/services/analyticsService.js";

function assert(condition, message) {
  if (!condition) {
    console.error(`  ❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✅ [PASS] ${message}`);
}

async function runF01Tests() {
  console.log("================================================================================");
  console.log("🚀 STARTING MILESTONE F-01: FRONTEND ANALYTICS SERVICE & QUERY KEYS VERIFICATION");
  console.log("================================================================================");

  let passed = 0;

  // 1. Query Keys Verification
  console.log("\n🔑 1. Testing TanStack Query Keys Factory...");
  assert(queryKeys.analytics, "queryKeys.analytics namespace exists");
  assert(typeof queryKeys.analytics.overview === "function", "queryKeys.analytics.overview is a function");
  assert(typeof queryKeys.analytics.operational === "function", "queryKeys.analytics.operational is a function");
  assert(typeof queryKeys.analytics.compliance === "function", "queryKeys.analytics.compliance is a function");
  assert(typeof queryKeys.analytics.sales === "function", "queryKeys.analytics.sales is a function");
  assert(typeof queryKeys.analytics.dssPerformance === "function", "queryKeys.analytics.dssPerformance is a function");
  assert(typeof queryKeys.analytics.dailyReport === "function", "queryKeys.analytics.dailyReport is a function");
  assert(typeof queryKeys.dss.c3CrowdScores === "function", "queryKeys.dss.c3CrowdScores is a function");

  // Query Key Structure Validation
  const overviewKey = queryKeys.analytics.overview({ date: "2026-09-09" });
  assert(overviewKey[0] === "analytics" && overviewKey[1] === "overview", "analytics.overview key matches ['analytics', 'overview', ...]");
  
  const c3Key = queryKeys.dss.c3CrowdScores();
  assert(c3Key[0] === "dss" && c3Key[1] === "c3-crowd-scores", "dss.c3CrowdScores key matches ['dss', 'c3-crowd-scores']");

  // 2. Semantic Metadata Helpers Verification
  console.log("\n🛡️ 2. Testing Semantic Metadata Preservation Helpers...");
  const noDataMetric = { value: null, formatted: "N/A", data_status: "NO_DATA", unit: "%" };
  const zeroMetric = { value: 0.0, formatted: "0.00%", data_status: "COMPLETE", unit: "%" };
  const validMetric = { value: 85.5, formatted: "85.50%", data_status: "COMPLETE", unit: "%" };

  assert(isNoData(noDataMetric) === true, "isNoData correctly identifies NO_DATA status");
  assert(isNoData(zeroMetric) === false, "isNoData DOES NOT falsely flag numeric 0 as NO_DATA");
  assert(isNoData(validMetric) === false, "isNoData correctly identifies valid metric");

  assert(getAnalyticsValue(noDataMetric) === null, "getAnalyticsValue preserves null without converting to 0");
  assert(getAnalyticsValue(zeroMetric) === 0.0, "getAnalyticsValue preserves valid numeric zero");
  assert(getAnalyticsValue(validMetric) === 85.5, "getAnalyticsValue extracts numeric value");

  assert(getAnalyticsFormatted(noDataMetric) === "N/A", "getAnalyticsFormatted preserves 'N/A' string");
  assert(getAnalyticsFormatted(zeroMetric) === "0.00%", "getAnalyticsFormatted preserves '0.00%' string");

  // 3. Analytics Service Method & API Mapping Verification
  console.log("\n📊 3. Testing Analytics Service API Mapping Against Live Backend...");

  const testServer = app.listen(0);
  const testPort = testServer.address().port;
  const API_BASE_URL = `http://localhost:${testPort}/api`;

  const { pool } = await import("../config/database.js");
  const userRes = await pool.query(
    "SELECT id, role, email FROM users WHERE role IN ('MANAGEMENT', 'SUPERADMIN') AND is_active = true LIMIT 1;"
  );
  if (!userRes.rows.length) {
    throw new Error("No active MANAGEMENT/SUPERADMIN user found in database");
  }
  const activeUser = userRes.rows[0];

  const managementToken = jwt.sign(
    { id: activeUser.id, role: activeUser.role, email: activeUser.email },
    env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  async function apiGet(path, options = {}) {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${managementToken}`, ...options.headers },
    });
    const status = res.status;
    const contentType = res.headers.get("content-type") || "";
    let data;
    if (contentType.includes("application/json")) {
      data = await res.json();
    } else {
      data = await res.text();
    }
    return { status, data, headers: res.headers };
  }

  async function apiPut(path, body) {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${managementToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const status = res.status;
    const data = await res.json();
    return { status, data };
  }

  // Test Analytics Overview
  const overviewRes = await apiGet("/analytics/overview");
  assert(overviewRes.status === 200, "GET /api/analytics/overview returns 200 OK");
  assert(overviewRes.data.status === "success", "Overview response contains status 'success'");
  assert(overviewRes.data.data.role_projection !== undefined, "Overview returns role_projection");
  assert(overviewRes.data.data.operational !== undefined, "Overview contains operational domain");
  assert(overviewRes.data.data.compliance !== undefined, "Overview contains compliance domain");
  assert(overviewRes.data.data.sales !== undefined, "Overview contains sales domain");
  assert(overviewRes.data.data.dss_effectiveness !== undefined, "Overview contains dss_effectiveness domain");

  // Test Analytics Operational
  const opRes = await apiGet("/analytics/operational/summary");
  assert(opRes.status === 200, "GET /api/analytics/operational/summary returns 200 OK");
  assert(opRes.data.data.kpis.check_in_rate !== undefined, "Operational returns check_in_rate metric");

  // Test Analytics Compliance
  const compRes = await apiGet("/analytics/compliance/summary");
  assert(compRes.status === 200, "GET /api/analytics/compliance/summary returns 200 OK");
  assert(compRes.data.data.telemetry_kpis !== undefined, "Compliance returns telemetry_kpis");

  // Test Analytics Sales
  const salesRes = await apiGet("/analytics/sales/performance");
  assert(salesRes.status === 200, "GET /api/analytics/sales/performance returns 200 OK");
  assert(salesRes.data.data.spatial_revenue_breakdown !== undefined, "Sales returns spatial_revenue_breakdown");

  // Test Analytics DSS Performance
  const dssRes = await apiGet("/analytics/dss/plan-vs-actual");
  assert(dssRes.status === 200, "GET /api/analytics/dss/plan-vs-actual returns 200 OK");
  assert(dssRes.data.data.ranks_breakdown !== undefined, "DSS Performance returns ranks_breakdown");

  // Test Analytics Daily Report
  const reportRes = await apiGet("/analytics/reports/daily-summary");
  assert(reportRes.status === 200, "GET /api/analytics/reports/daily-summary returns 200 OK");
  assert(Array.isArray(reportRes.data.data.records), "Daily report returns records array");

  // Test Analytics Daily Report CSV Export
  const exportRes = await apiGet("/analytics/reports/daily-summary?format=csv");
  assert(exportRes.status === 200, "GET /api/analytics/reports/daily-summary?format=csv returns 200 OK");
  assert(exportRes.headers.get("content-type").includes("text/csv"), "CSV Export returns Content-Type text/csv");
  assert(exportRes.data.includes("Assignment ID,Tanggal,TOPSIS Rank"), "CSV content contains expected headers");

  // 4. C3 Master Data POI Service Verification
  console.log("\n🗺️ 4. Testing POI C3 Master Data Service API Mapping...");

  const c3Res = await apiGet("/poi-categories/crowd-scores");
  assert(c3Res.status === 200, "GET /api/poi-categories/crowd-scores returns 200 OK");
  assert(c3Res.data.status === "success", "C3 Crowd Scores response contains status 'success'");
  assert(Array.isArray(c3Res.data.categories), "C3 categories is an array");
  assert(c3Res.data.categories.length === 58, "C3 categories contains all 58 POI master categories");

  // Test Bulk Update C3 Crowd Scores
  const sampleCat = c3Res.data.categories[0];
  const bulkUpdatePayload = {
    categories: [
      {
        id: sampleCat.id,
        scores: { pagi: 4, siang: 5, sore: 4, malam: 3 },
      },
    ],
  };
  const bulkRes = await apiPut("/poi-categories/crowd-scores", bulkUpdatePayload);
  assert(bulkRes.status === 200, "PUT /api/poi-categories/crowd-scores returns 200 OK");
  assert(bulkRes.data.status === "success", "Bulk C3 update succeeded");

  // Test Single Update C3 Crowd Scores
  const singleUpdatePayload = {
    score_pagi: 3,
    score_siang: 4,
    score_sore: 5,
    score_malam: 2,
  };
  const singleRes = await apiPut(`/poi-categories/${sampleCat.id}/crowd-scores`, singleUpdatePayload);
  assert(singleRes.status === 200, `PUT /api/poi-categories/${sampleCat.id}/crowd-scores returns 200 OK`);
  assert(singleRes.data.status === "success", "Single C3 category update succeeded");

  testServer.close();

  console.log("\n================================================================================");
  console.log("🏆 MILESTONE F-01 VERIFICATION COMPLETE: ALL ASSERTIONS PASSED (0 FAILURES)");
  console.log("================================================================================");
  process.exit(0);
}

runF01Tests().catch((err) => {
  console.error("❌ Fatal Verification Failure:", err);
  process.exit(1);
});
