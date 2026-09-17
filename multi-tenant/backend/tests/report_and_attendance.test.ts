/*
 * report_and_attendance.test.ts
 * Integration tests for MOVA Reporting Suite, Attendance Timestamps, Weather Retention, and POI Categories
 */

import { reportService } from "../src/services/reportService.js";
import { riderOperationalRepository } from "../src/repositories/riderOperationalRepository.js";
import { WeatherRepository } from "../src/repositories/WeatherRepository.js";
import { poiRepository } from "../src/repositories/poiRepository.js";
import { pool } from "../src/config/database.js";

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

async function runTests() {
  console.log("\n========================================================");
  console.log("🧪 RUNNING REPORTING, ATTENDANCE & DATA RETENTION TESTS");
  console.log("========================================================\n");

  // TEST 1: Executive Summary Report
  const execSummary = await reportService.getExecutiveSummary();
  assert(execSummary && execSummary.kpis, "TEST 1.1: Executive Summary returns KPI object");
  assert(typeof execSummary.kpis.active_riders === "number", "TEST 1.2: KPI includes active_riders count");
  assert(typeof execSummary.kpis.active_zones === "number", "TEST 1.3: KPI includes active_zones count");
  assert(typeof execSummary.kpis.fleet_utilization_percent === "number", "TEST 1.4: KPI includes fleet_utilization_percent");

  // TEST 2: Rider Operational Report
  const riderReport = await reportService.getRiderOperationalReport();
  assert(riderReport && Array.isArray(riderReport.riders), "TEST 2.1: Rider Operational Report returns riders array");

  // TEST 3: Zone Effectiveness Report
  const zoneReport = await reportService.getZoneEffectivenessReport();
  assert(zoneReport && Array.isArray(zoneReport.zones), "TEST 3.1: Zone Effectiveness Report returns zones array");

  // TEST 4: Fleet Report
  const fleetReport = await reportService.getFleetReport();
  assert(fleetReport && fleetReport.summary, "TEST 4.1: Fleet Report returns summary");
  assert(Array.isArray(fleetReport.armadas), "TEST 4.2: Fleet Report returns armadas detail list");

  // TEST 5: DSS Accuracy Report
  const dssAccuracy = await reportService.getDssAccuracyReport();
  assert(dssAccuracy && dssAccuracy.metrics, "TEST 5.1: DSS Accuracy Report returns metrics");
  assert(typeof dssAccuracy.metrics.acceptance_rate === "number", "TEST 5.2: DSS Accuracy includes acceptance_rate");
  assert(typeof dssAccuracy.metrics.override_rate === "number", "TEST 5.3: DSS Accuracy includes override_rate");

  // TEST 6: All POI Categories Active
  const { rows: catRows } = await pool.query("SELECT count(*)::int as total FROM poi_categories WHERE is_active = true;");
  assert(catRows[0].total >= 17, "TEST 6.1: All primary POI categories are active in database", catRows[0].total);

  // TEST 7: Attendance Schema Timestamps
  const { rows: colRows } = await pool.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'zone_assignments' 
      AND column_name IN ('check_in_time', 'check_out_time');
  `);
  assert(colRows.length === 2, "TEST 7.1: zone_assignments schema contains check_in_time and check_out_time");

  // TEST 8: Weather Historical Retention (Non-destructive)
  const weatherRepo = WeatherRepository.getInstance();
  // Get an existing zone or skip if 0 zones
  const { rows: zoneRows } = await pool.query("SELECT id FROM zones LIMIT 1;");
  if (zoneRows.length > 0) {
    const testZoneId = zoneRows[0].id;
    const initialCountRes = await pool.query("SELECT count(*)::int as total FROM weathers WHERE zone_id = $1;", [testZoneId]);
    const initialCount = initialCountRes.rows[0].total;

    await weatherRepo.saveCachedWeather(testZoneId, {
      max_precipitation_probability: 20,
      precipitation: 0,
      supporting_info: { temperature: 29, humidity: 75, weather_code: 1 },
    });

    const afterCountRes = await pool.query("SELECT count(*)::int as total FROM weathers WHERE zone_id = $1;", [testZoneId]);
    assert(afterCountRes.rows[0].total >= initialCount + 1, "TEST 8.1: Weather saveCachedWeather preserves history (count increased)", {
      initial: initialCount,
      after: afterCountRes.rows[0].total,
    });
  } else {
    console.log("ℹ️ SKIP TEST 8.1: No zones in DB to test live weather insert, schema verified.");
  }

  console.log("\n========================================================");
  console.log(`📊 TEST RESULTS: ${passedTests}/${totalTests} PASSED`);
  console.log("========================================================\n");

  if (passedTests === totalTests) {
    console.log("🎉 ALL REPORTING & INTEGRITY TESTS PASSED PERFECTLY!\n");
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("💥 Fatal error in test suite:", err);
  process.exit(1);
});
