/*
 * test-reports-suite.js
 * Integration & Unit Tests for MOVA Reporting Suite, Export Engine & Attendance Metrics (Single-Tenant)
 */

import { reportService } from "../services/reportService.js";
import { ReportExportService } from "../services/reportExportService.js";
import { pool } from "../config/database.js";

let totalTests = 0;
let passedTests = 0;

function assert(condition, testName, detail) {
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
  console.log("🧪 RUNNING SINGLE-TENANT REPORTING SUITE & EXPORT TESTS");
  console.log("========================================================\n");

  try {
    // TEST 1: Executive Summary Report
    const execSummary = await reportService.getExecutiveSummary();
    assert(execSummary && execSummary.kpis, "TEST 1.1: Executive Summary returns KPI object");
    assert(typeof execSummary.kpis.active_riders === "number", "TEST 1.2: KPI includes active_riders count");
    assert(typeof execSummary.kpis.active_zones === "number", "TEST 1.3: KPI includes active_zones count");
    assert(typeof execSummary.kpis.fleet_utilization_percent === "number", "TEST 1.4: KPI includes fleet_utilization_percent");
    assert(typeof execSummary.kpis.revenue_today === "number", "TEST 1.5: KPI includes revenue_today");

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
    assert(typeof fleetReport.summary.utilization_rate === "number", "TEST 4.3: Fleet Report includes utilization_rate");

    // TEST 5: DSS Accuracy Report
    const dssAccuracy = await reportService.getDssAccuracyReport();
    assert(dssAccuracy && dssAccuracy.metrics, "TEST 5.1: DSS Accuracy Report returns metrics");
    assert(typeof dssAccuracy.metrics.acceptance_rate === "number", "TEST 5.2: DSS Accuracy includes acceptance_rate");
    assert(typeof dssAccuracy.metrics.override_rate === "number", "TEST 5.3: DSS Accuracy includes override_rate");

    // TEST 6: Audit Logs Report
    const auditLogs = await reportService.getAuditLogsReport({ limit: 10 });
    assert(auditLogs && Array.isArray(auditLogs.logs), "TEST 6.1: Audit Logs Report returns logs array");
    assert(typeof auditLogs.total === "number", "TEST 6.2: Audit Logs includes total count");

    // TEST 7: Attendance Schema Timestamps in zone_assignments
    const { rows: colRows } = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'zone_assignments' 
        AND column_name IN ('check_in_time', 'check_out_time');
    `);
    assert(colRows.length === 2, "TEST 7.1: zone_assignments schema contains check_in_time and check_out_time");

    // TEST 8: Export Engine (CSV & Printable HTML)
    const csvExecutive = ReportExportService.generateCsv("EXECUTIVE_SUMMARY", execSummary);
    assert(csvExecutive.includes("Rider Aktif") && csvExecutive.includes("Indikator KPI"), "TEST 8.1: CSV Export produces valid Executive Summary content");

    const csvRider = ReportExportService.generateCsv("RIDER_OPERATIONAL", riderReport);
    assert(csvRider.includes("ID Rider") && csvRider.includes("Nama Rider"), "TEST 8.2: CSV Export produces valid Rider Operational content");

    const htmlOutput = ReportExportService.generatePrintableHtml("EXECUTIVE_SUMMARY", execSummary, "Ringkasan Eksekutif Testing");
    assert(htmlOutput.includes("<!DOCTYPE html>") && htmlOutput.includes("Ringkasan Eksekutif Testing"), "TEST 8.3: Printable HTML Export produces valid standalone document");

    console.log("\n========================================================");
    console.log(`📊 TEST RESULTS: ${passedTests}/${totalTests} PASSED`);
    console.log("========================================================\n");

    if (passedTests === totalTests) {
      console.log("🎉 ALL REPORTING SUITE & EXPORT TESTS PASSED PERFECTLY!\n");
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (err) {
    console.error("💥 Fatal error in report test suite:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTests();
