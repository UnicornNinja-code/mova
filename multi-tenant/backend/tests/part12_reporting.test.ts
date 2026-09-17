/*
 * part12_reporting.test.ts
 * Comprehensive Integration & Verification Test Suite for PART 12:
 * Domain Reports across Operations, DSS Accuracy, Fleet Lifecycle, and Executive Macro KPIs.
 */

import { pool } from "../src/config/database.js";
import { reportService } from "../src/services/reportService.js";

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

async function runPart12Tests() {
  console.log("\n========================================================");
  console.log("🧪 RUNNING PART 12: REPORTING & ANALYTICS TEST SUITE");
  console.log("========================================================\n");

  // -------------------------------------------------------------
  // GROUP 1: Executive Macro KPIs (REPORT-006)
  // -------------------------------------------------------------
  console.log("📊 [GROUP 1] Executive Summary Macro KPIs");

  const executiveSummary = await reportService.getExecutiveSummary();
  assert(executiveSummary && executiveSummary.kpis, "TEST 1.1: Executive summary returns KPI object");
  assert(typeof executiveSummary.kpis.active_riders === "number", "TEST 1.2: Active riders count is a valid number");
  assert(typeof executiveSummary.kpis.active_zones === "number", "TEST 1.3: Active zones count is a valid number");
  assert(typeof executiveSummary.kpis.fleet_utilization_percent === "number", "TEST 1.4: Fleet utilization is a valid percentage");
  assert(executiveSummary.kpis.revenue_today !== undefined, "TEST 1.5: Today revenue is present in KPI summary");

  // -------------------------------------------------------------
  // GROUP 2: Rider Operational Report (REPORT-001)
  // -------------------------------------------------------------
  console.log("\n🚴 [GROUP 2] Rider Operational Report");

  const riderReport = await reportService.getRiderOperationalReport({});
  assert(riderReport && Array.isArray(riderReport.riders), "TEST 2.1: Rider report returns riders array");
  assert(typeof riderReport.total_riders_analyzed === "number", "TEST 2.2: Total riders analyzed is a valid number");
  if (riderReport.riders.length > 0) {
    const rider = riderReport.riders[0];
    assert(rider.rider_id !== undefined, "TEST 2.3: Rider record contains rider_id");
    assert(typeof rider.total_assignments === "number", "TEST 2.4: Rider record contains numeric total_assignments");
    assert(typeof rider.total_check_ins === "number", "TEST 2.5: Rider record contains numeric total_check_ins");
  }

  // -------------------------------------------------------------
  // GROUP 3: Zone Effectiveness Report (REPORT-002)
  // -------------------------------------------------------------
  console.log("\n📍 [GROUP 3] Zone Effectiveness & Conversion Report");

  const zoneReport = await reportService.getZoneEffectivenessReport({});
  assert(zoneReport && Array.isArray(zoneReport.zones), "TEST 3.1: Zone effectiveness report returns zones array");
  assert(typeof zoneReport.total_zones_analyzed === "number", "TEST 3.2: Total zones analyzed is a valid number");
  if (zoneReport.zones.length > 0) {
    const zone = zoneReport.zones[0];
    assert(zone.zone_id !== undefined, "TEST 3.3: Zone record contains zone_id");
    assert(typeof zone.execution_compliance_rate === "number", "TEST 3.4: Zone compliance rate is a numeric percentage");
  }

  // -------------------------------------------------------------
  // GROUP 4: Fleet Lifecycle Report (REPORT-003)
  // -------------------------------------------------------------
  console.log("\n🛵 [GROUP 4] Fleet Lifecycle & Availability Report");

  const fleetReport = await reportService.getFleetReport();
  assert(fleetReport && fleetReport.summary, "TEST 4.1: Fleet report returns summary");
  assert(typeof fleetReport.summary.total_fleet === "number", "TEST 4.2: Total fleet count is numeric");
  assert(typeof fleetReport.summary.utilization_rate === "number", "TEST 4.3: Fleet utilization rate is numeric");
  assert(Array.isArray(fleetReport.armadas), "TEST 4.4: Fleet report returns armadas detail list");

  // -------------------------------------------------------------
  // GROUP 5: DSS Accuracy & Decision Intelligence (REPORT-004)
  // -------------------------------------------------------------
  console.log("\n🧠 [GROUP 5] DSS Accuracy & Supervisor Override Report");

  const dssReport = await reportService.getDssAccuracyReport({});
  assert(dssReport && dssReport.metrics, "TEST 5.1: DSS accuracy report returns metrics");
  assert(typeof dssReport.metrics.acceptance_rate === "number", "TEST 5.2: Acceptance rate is a numeric percentage");
  assert(typeof dssReport.metrics.override_rate === "number", "TEST 5.3: Override rate is a numeric percentage");
  assert(Array.isArray(dssReport.recent_runs), "TEST 5.4: DSS recent runs list is returned");

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log("\n========================================================");
  console.log(`📊 PART 12 TEST RESULTS: ${passedTests}/${totalTests} PASSED`);
  console.log("========================================================\n");

  if (passedTests === totalTests) {
    console.log("🎉 ALL PART 12 TESTS PASSED PERFECTLY!");
    process.exit(0);
  } else {
    console.error("❌ SOME PART 12 TESTS FAILED.");
    process.exit(1);
  }
}

runPart12Tests().catch((err) => {
  console.error("💥 Unhandled error during PART 12 test execution:", err);
  process.exit(1);
});
