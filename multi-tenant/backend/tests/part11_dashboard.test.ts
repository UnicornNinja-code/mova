/*
 * part11_dashboard.test.ts
 * Comprehensive Integration & Verification Test Suite for PART 11:
 * Real-time SQL Executive KPI Aggregation, Zero Mock Values, Role-Scoped Views,
 * Sales Trends, Zone Performance Metrics, and Product Performance Analytics.
 */

import { pool } from "../src/config/database.js";
import { dashboardService } from "../src/services/dashboard/DashboardService.js";
import { dashboardRepository } from "../src/repositories/dashboardRepository.js";

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string, detail?: any) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`✅ PASS: ${testName}`);
  } else {
    console.error(`❌ FAIL: ${testName}`, detail || "");
    process.exitCode = 1;
  }
}

async function runPart11Tests() {
  console.log("\n========================================================");
  console.log("🧪 RUNNING PART 11: DASHBOARD & KPI AGGREGATION TESTS");
  console.log("========================================================\n");

  // -------------------------------------------------------------
  // GROUP 1: Executive KPI Aggregation (DASH-001, DASH-002, DASH-007)
  // -------------------------------------------------------------
  console.log("📊 [GROUP 1] Executive Dashboard Summary (Zero Mock Data)");

  const superadminSummary = await dashboardService.getDashboardSummary("SUPERADMIN");
  assert(superadminSummary && superadminSummary.financials, "TEST 1.1: Superadmin dashboard summary contains financials");
  assert(superadminSummary.operations && typeof superadminSummary.operations.registered_riders === "number", "TEST 1.2: Operations metrics return numeric registered_riders");
  assert(typeof superadminSummary.operations.total_active_zones === "number", "TEST 1.3: Operations metrics return numeric total_active_zones");
  assert(superadminSummary.fleet && typeof superadminSummary.fleet.total_units === "number", "TEST 1.4: Fleet metrics return numeric total_units");
  assert(typeof superadminSummary.fleet.utilization_rate_percentage === "number", "TEST 1.5: Fleet utilization rate returns numeric percentage");
  assert(typeof superadminSummary.financials.total_revenue === "number", "TEST 1.6: Financials return numeric total_revenue (zero-safe)");

  // -------------------------------------------------------------
  // GROUP 2: Role-Scoped Dashboard Views & Access Control (DASH-006)
  // -------------------------------------------------------------
  console.log("\n🔒 [GROUP 2] Role-Scoped Views & Access Control");

  // 1. Supervisor summary (Must NOT contain financials)
  const supervisorSummary = await dashboardService.getDashboardSummary("SUPERVISOR");
  assert(supervisorSummary && supervisorSummary.operations, "TEST 2.1: Supervisor summary contains operational data");
  assert(supervisorSummary.financials === undefined, "TEST 2.2: Supervisor summary omits confidential financials");

  // 2. Rider role (Must be rejected with 403 Forbidden)
  let riderAccessBlocked = false;
  try {
    await dashboardService.getDashboardSummary("RIDER");
  } catch (err: any) {
    riderAccessBlocked = true;
    assert(err.statusCode === 403, "TEST 2.3: Rider access to dashboard summary rejected with 403 Forbidden");
  }
  assert(riderAccessBlocked, "TEST 2.4: Rider role access strictly forbidden on executive dashboard");

  // -------------------------------------------------------------
  // GROUP 3: Sales Trend Time-Series Analytics (DASH-003)
  // -------------------------------------------------------------
  console.log("\n📈 [GROUP 3] Time-Series Sales Trend Analytics");

  const salesTrend = await dashboardService.getSalesTrend("SUPERADMIN", { range: "7d" });
  assert(salesTrend && Array.isArray(salesTrend.data), "TEST 3.1: Sales trend returns time series array");
  assert(salesTrend.range === "7d", "TEST 3.2: Sales trend respects requested 7d range parameter");

  // -------------------------------------------------------------
  // GROUP 4: Zone & Product Performance SQL Breakdowns (DASH-004, DASH-005)
  // -------------------------------------------------------------
  console.log("\n🏢 [GROUP 4] Zone & Product Performance SQL Breakdowns");

  const { startTimestamp, endTimestamp, targetDate } = dashboardService.getJakartaDateBoundaries();

  const zonePerformance = await dashboardRepository.getZonePerformanceMetrics({
    startTimestamp,
    endTimestamp,
    targetDate,
  });
  assert(Array.isArray(zonePerformance), "TEST 4.1: Zone performance query returns array of active zones");
  if (zonePerformance.length > 0) {
    assert(typeof zonePerformance[0].occupancy_rate_percentage === "number", "TEST 4.2: Zone occupancy rate is a numeric percentage");
    assert(typeof zonePerformance[0].remaining_capacity === "number", "TEST 4.3: Zone remaining capacity is a numeric count");
  }

  const productPerformance = await dashboardRepository.getProductPerformanceMetrics({
    startTimestamp,
    endTimestamp,
  });
  assert(Array.isArray(productPerformance), "TEST 4.4: Product performance query returns array of products");
  if (productPerformance.length > 0) {
    assert(typeof productPerformance[0].total_units_sold === "number", "TEST 4.5: Product units sold is a numeric count");
    assert(typeof productPerformance[0].total_revenue === "number", "TEST 4.6: Product revenue is a numeric amount");
  }

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log("\n========================================================");
  console.log(`📊 PART 11 TEST RESULTS: ${passedTests}/${totalTests} PASSED`);
  console.log("========================================================\n");

  if (passedTests === totalTests) {
    console.log("🎉 ALL PART 11 TESTS PASSED PERFECTLY!");
    process.exit(0);
  } else {
    console.error("❌ SOME PART 11 TESTS FAILED.");
    process.exit(1);
  }
}

runPart11Tests().catch((err) => {
  console.error("💥 Unhandled error during PART 11 test execution:", err);
  process.exit(1);
});
