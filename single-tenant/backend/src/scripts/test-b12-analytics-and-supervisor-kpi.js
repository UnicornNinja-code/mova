/*
 * test-b12-analytics-and-supervisor-kpi.js
 * Comprehensive Automated Test Suite for Milestone B-12: Reporting, Supervisor KPI & Plan-vs-Actual Analytics Layer
 * Verifies all 5 Domain Analytics Services, Read-Model Queries, RBAC Projections, and CSV Exports.
 */

import { pool } from "../config/database.js";
import { analyticsRepository } from "../repositories/analyticsRepository.js";
import { operationalAnalyticsService } from "../services/analytics/OperationalAnalyticsService.js";
import { complianceAnalyticsService } from "../services/analytics/ComplianceAnalyticsService.js";
import { salesAnalyticsService } from "../services/analytics/SalesAnalyticsService.js";
import { dssPerformanceService } from "../services/analytics/DSSPerformanceService.js";
import { reportingService } from "../services/analytics/ReportingService.js";
import { DATA_STATUS, POPULATION_SCOPES } from "../services/analytics/AnalyticsContract.js";
import bcrypt from "bcrypt";

let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passedCount++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    failedCount++;
  }
}

async function runB12Tests() {
  console.log("================================================================================");
  console.log("🚀 STARTING MILESTONE B-12 AUTOMATED VERIFICATION TEST SUITE");
  console.log("================================================================================\n");

  const timestamp = Date.now();
  const today = new Date().toISOString().split("T")[0];

  let testUser1 = null;
  let testUser2 = null;
  let testZone1 = null;
  let testZone2 = null;
  let testArmada1 = null;
  let testArmada2 = null;
  let testProduct1 = null;
  let testProduct2 = null;
  let testAssign1 = null;
  let testAssign2 = null;
  let testSession1 = null;
  let testSession2 = null;

  try {
    // -------------------------------------------------------------------------
    // SETUP: Test Fixtures
    // -------------------------------------------------------------------------
    console.log("📦 1. Setting up Test Fixtures for Analytics Aggregations...");

    // Pre-cleanup
    await pool.query("DELETE FROM protocol_roads WHERE external_id LIKE 'road_b12_%';");
    await pool.query("DELETE FROM zones WHERE name LIKE 'Zona B12%';");
    await pool.query("DELETE FROM armadas WHERE code LIKE 'B12-UNIT-%';");
    await pool.query("DELETE FROM products WHERE name LIKE 'Produk B12%';");
    await pool.query("DELETE FROM users WHERE email LIKE 'rider_b12_%';");

    const passwordHash = await bcrypt.hash("password123", 10);

    // Create 2 Test Riders
    const u1 = await pool.query(`
      INSERT INTO users (name, email, username, password, role, is_active)
      VALUES ('Rider B12 Alpha', 'rider_b12_a_${timestamp}@mova.test', 'rider_b12_a_${timestamp}', '${passwordHash}', 'RIDER', true)
      RETURNING *;
    `);
    testUser1 = u1.rows[0];

    const u2 = await pool.query(`
      INSERT INTO users (name, email, username, password, role, is_active)
      VALUES ('Rider B12 Beta', 'rider_b12_b_${timestamp}@mova.test', 'rider_b12_b_${timestamp}', '${passwordHash}', 'RIDER', true)
      RETURNING *;
    `);
    testUser2 = u2.rows[0];

    // Create 2 Zones (Rank 1 and Rank 2)
    const z1 = await pool.query(`
      INSERT INTO zones (name, description, max_capacity, status, polygon, geom)
      VALUES (
        'Zona B12 Rank1 ${timestamp}',
        'Zona Prioritas #1',
        3,
        'ACTIVE',
        '[[112.716,-7.446],[112.721,-7.446],[112.721,-7.451],[112.716,-7.451],[112.716,-7.446]]'::jsonb,
        ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[112.716,-7.446],[112.721,-7.446],[112.721,-7.451],[112.716,-7.451],[112.716,-7.446]]]}'), 4326)
      ) RETURNING *;
    `);
    testZone1 = z1.rows[0];

    const z2 = await pool.query(`
      INSERT INTO zones (name, description, max_capacity, status, polygon, geom)
      VALUES (
        'Zona B12 Rank2 ${timestamp}',
        'Zona Prioritas #2',
        3,
        'ACTIVE',
        '[[112.725,-7.446],[112.730,-7.446],[112.730,-7.451],[112.725,-7.451],[112.725,-7.446]]'::jsonb,
        ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[112.725,-7.446],[112.730,-7.446],[112.730,-7.451],[112.725,-7.451],[112.725,-7.446]]]}'), 4326)
      ) RETURNING *;
    `);
    testZone2 = z2.rows[0];

    // Create 2 Armadas
    const a1 = await pool.query(`
      INSERT INTO armadas (code, type, status)
      VALUES ('B12-UNIT-A-${timestamp.toString().slice(-4)}', 'GEROBAK', 'IN_USE')
      RETURNING *;
    `);
    testArmada1 = a1.rows[0];

    const a2 = await pool.query(`
      INSERT INTO armadas (code, type, status)
      VALUES ('B12-UNIT-B-${timestamp.toString().slice(-4)}', 'MOTOR_LISTRIK', 'ACTIVE')
      RETURNING *;
    `);
    testArmada2 = a2.rows[0];

    // Create 2 Products
    const p1 = await pool.query(`
      INSERT INTO products (name, description, price, status)
      VALUES ('Produk B12 Kopi Susu', 'Signature Coffee', 18000.00, 'AVAILABLE')
      RETURNING *;
    `);
    testProduct1 = p1.rows[0];

    const p2 = await pool.query(`
      INSERT INTO products (name, description, price, status)
      VALUES ('Produk B12 Cold Brew', 'Cold Brew Premium', 22000.00, 'AVAILABLE')
      RETURNING *;
    `);
    testProduct2 = p2.rows[0];

    // Create Zone Assignments with explicit TOPSIS Ranks
    const asg1 = await pool.query(`
      INSERT INTO zone_assignments (
        rider_id, zone_id, armada_id, assignment_date, status, topsis_rank, preference_score
      )
      VALUES ($1, $2, $3, $4::date, 'COMPLETED', 1, 0.8750)
      RETURNING *;
    `, [testUser1.id, testZone1.id, testArmada1.id, today]);
    testAssign1 = asg1.rows[0];

    const asg2 = await pool.query(`
      INSERT INTO zone_assignments (
        rider_id, zone_id, armada_id, assignment_date, status, topsis_rank, preference_score
      )
      VALUES ($1, $2, $3, $4::date, 'CHECKED_IN', 2, 0.6250)
      RETURNING *;
    `, [testUser2.id, testZone2.id, testArmada2.id, today]);
    testAssign2 = asg2.rows[0];

    // Create Operational Sessions (Session 1 Completed: 120 mins duration; Session 2 Operating: active)
    const os1 = await pool.query(`
      INSERT INTO operational_sessions (
        rider_id, assignment_id, armada_id, zone_id, status,
        started_at, checked_in_at, check_in_lat, check_in_lon,
        checked_out_at, completed_at, checkout_lat, checkout_lon, checkout_notes
      )
      VALUES (
        $1, $2, $3, $4, 'COMPLETED',
        NOW() - interval '130 minutes', NOW() - interval '120 minutes', -7.4485, 112.7185,
        NOW() - interval '5 minutes', NOW() - interval '5 minutes', -7.4485, 112.7185, 'Selesai tugas harian'
      )
      RETURNING *;
    `, [testUser1.id, testAssign1.id, testArmada1.id, testZone1.id]);
    testSession1 = os1.rows[0];

    const os2 = await pool.query(`
      INSERT INTO operational_sessions (
        rider_id, assignment_id, armada_id, zone_id, status,
        started_at, checked_in_at, check_in_lat, check_in_lon
      )
      VALUES (
        $1, $2, $3, $4, 'OPERATING',
        NOW() - interval '60 minutes', NOW() - interval '50 minutes', -7.4485, 112.7275
      )
      RETURNING *;
    `, [testUser2.id, testAssign2.id, testArmada2.id, testZone2.id]);
    testSession2 = os2.rows[0];

    // Create Sales Logs (Compliant in Session 1, Compliant + Deviated in Session 2)
    // Sale 1: Rider 1, Session 1, Zone 1 (COMPLIANT): 3x Kopi Susu = Rp 54.000
    await pool.query(`
      INSERT INTO sales_logs (session_id, rider_id, zone_id, actual_zone_id, latitude, longitude, compliance_at_sale, product_id, qty, unit_price, total_price, created_at)
      VALUES ($1, $2, $3, $3, -7.4485, 112.7185, 'COMPLIANT', $4, 3, 18000.00, 54000.00, NOW() - interval '90 minutes');
    `, [testSession1.id, testUser1.id, testZone1.id, testProduct1.id]);

    // Sale 2: Rider 1, Session 1, Zone 1 (COMPLIANT): 2x Cold Brew = Rp 44.000 (Total Session 1 = Rp 98.000)
    await pool.query(`
      INSERT INTO sales_logs (session_id, rider_id, zone_id, actual_zone_id, latitude, longitude, compliance_at_sale, product_id, qty, unit_price, total_price, created_at)
      VALUES ($1, $2, $3, $3, -7.4485, 112.7185, 'COMPLIANT', $4, 2, 22000.00, 44000.00, NOW() - interval '60 minutes');
    `, [testSession1.id, testUser1.id, testZone1.id, testProduct2.id]);

    // Sale 3: Rider 2, Session 2, Zone 2 (COMPLIANT): 1x Kopi Susu = Rp 18.000
    await pool.query(`
      INSERT INTO sales_logs (session_id, rider_id, zone_id, actual_zone_id, latitude, longitude, compliance_at_sale, product_id, qty, unit_price, total_price, created_at)
      VALUES ($1, $2, $3, $3, -7.4485, 112.7275, 'COMPLIANT', $4, 1, 18000.00, 18000.00, NOW() - interval '30 minutes');
    `, [testSession2.id, testUser2.id, testZone2.id, testProduct1.id]);

    // Sale 4: Rider 2, Session 2, Zone 2 (DEVIATED): 1x Cold Brew = Rp 22.000 (Total Session 2 = Rp 40.000)
    await pool.query(`
      INSERT INTO sales_logs (session_id, rider_id, zone_id, actual_zone_id, latitude, longitude, compliance_at_sale, product_id, qty, unit_price, total_price, created_at)
      VALUES ($1, $2, $3, NULL, -7.5000, 112.7500, 'DEVIATED', $4, 1, 22000.00, 22000.00, NOW() - interval '10 minutes');
    `, [testSession2.id, testUser2.id, testZone2.id, testProduct2.id]);

    // Create Telemetry Logs (8 samples in Zone 1: all COMPLIANT; 4 samples in Zone 2: 3 COMPLIANT, 1 DEVIATED, 1 PROHIBITED_ROAD_ALERT)
    for (let i = 0; i < 8; i++) {
      await pool.query(`
        INSERT INTO rider_telemetry_logs (session_id, rider_id, latitude, longitude, actual_zone_id, zone_compliance, road_compliance, recorded_at)
        VALUES ($1, $2, -7.4485, 112.7185, $3, 'COMPLIANT', 'NO_ROAD_ALERT', NOW() - interval '100 minutes');
      `, [testSession1.id, testUser1.id, testZone1.id]);
    }

    for (let i = 0; i < 3; i++) {
      await pool.query(`
        INSERT INTO rider_telemetry_logs (session_id, rider_id, latitude, longitude, actual_zone_id, zone_compliance, road_compliance, recorded_at)
        VALUES ($1, $2, -7.4485, 112.7275, $3, 'COMPLIANT', 'NO_ROAD_ALERT', NOW() - interval '40 minutes');
      `, [testSession2.id, testUser2.id, testZone2.id]);
    }

    await pool.query(`
      INSERT INTO rider_telemetry_logs (session_id, rider_id, latitude, longitude, actual_zone_id, zone_compliance, road_compliance, recorded_at)
      VALUES ($1, $2, -7.5000, 112.7500, NULL, 'DEVIATED', 'PROHIBITED_ROAD_ALERT', NOW() - interval '20 minutes');
    `, [testSession2.id, testUser2.id]);

    // Create Discrete Geofence Logs
    await pool.query(`
      INSERT INTO rider_zone_logs (session_id, rider_id, zone_id, event_type, zone_compliance, latitude, longitude)
      VALUES ($1, $2, $3, 'ENTER', 'COMPLIANT', -7.4485, 112.7185);
    `, [testSession1.id, testUser1.id, testZone1.id]);

    await pool.query(`
      INSERT INTO rider_zone_logs (session_id, rider_id, zone_id, event_type, zone_compliance, latitude, longitude)
      VALUES ($1, $2, $3, 'ENTER', 'COMPLIANT', -7.4485, 112.7275);
    `, [testSession2.id, testUser2.id, testZone2.id]);

    assert(testUser1 && testUser2, "Test riders created");
    assert(testZone1 && testZone2, "Test zones created");
    assert(testSession1 && testSession2, "Test operational sessions created with duration telemetry");

    // -------------------------------------------------------------------------
    // TEST SUITE 1: Operational Analytics Service (B-12.3)
    // -------------------------------------------------------------------------
    console.log("\n📋 2. Testing Operational Analytics Service (B-12.3)...");

    const opsRes = await operationalAnalyticsService.getOperationalSummary({ date: today });
    assert(opsRes.population.total_assigned_sessions >= 2, "Assigned sessions count accurately retrieved");
    assert(opsRes.population.total_checked_in_sessions >= 2, "Checked in sessions count accurately retrieved");
    assert(opsRes.kpis.check_in_rate.data_status === DATA_STATUS.COMPLETE, "Check-in rate status is COMPLETE");
    assert(opsRes.kpis.check_in_rate.denominator_scope === POPULATION_SCOPES.ALL_ASSIGNED, "Check-in rate documents ALL_ASSIGNED scope");
    assert(parseFloat(opsRes.kpis.check_in_rate.value) > 0, "Check-in rate is non-zero and computed");
    assert(parseFloat(opsRes.kpis.overall_checkout_rate.value) > 0, "Overall checkout rate is non-zero and computed");
    assert(opsRes.kpis.avg_operating_duration.unit === "min", "Average operating duration unit is 'min'");
    assert(parseFloat(opsRes.kpis.avg_operating_duration.value) > 0, "Average operating duration is non-zero");

    // Zone-filtered operational summary
    const zone1Ops = await operationalAnalyticsService.getOperationalSummary({ date: today, zoneId: testZone1.id });
    assert(zone1Ops.population.total_assigned_sessions === 1, "Zone 1 has exactly 1 assigned session");
    assert(parseFloat(zone1Ops.kpis.check_in_rate.value) === 100.00, "Zone 1 check-in rate is 100%");
    assert(parseFloat(zone1Ops.kpis.overall_checkout_rate.value) === 100.00, "Zone 1 checkout rate is 100% (completed)");

    const fleetRes = await operationalAnalyticsService.getFleetUtilization();
    assert(fleetRes.total_fleet_units >= 2, "Total fleet units count retrieved");
    assert(fleetRes.currently_deployed_units >= 1, "Deployed fleet units count retrieved");

    // -------------------------------------------------------------------------
    // TEST SUITE 2: Compliance Analytics Service (B-12.4)
    // -------------------------------------------------------------------------
    console.log("\n📍 3. Testing Compliance Analytics Service (B-12.4)...");

    const compRes = await complianceAnalyticsService.getComplianceSummary({ date: today });
    assert(compRes.data_status === DATA_STATUS.COMPLETE, "Compliance summary status is COMPLETE");
    assert(compRes.telemetry_kpis.total_samples >= 12, "Total telemetry samples >= 12");
    assert(compRes.telemetry_kpis.prohibited_road_alerts_count >= 1, "Prohibited road alert count is >= 1");
    assert(parseFloat(compRes.telemetry_kpis.zone_compliance_rate.value) > 0, "Zone compliance rate is computed");
    assert(compRes.discrete_events.enter_events_count >= 2, "Discrete enter events count retrieved");

    // Empty date test (Semantics: NO_DATA instead of fake zero)
    const emptyCompRes = await complianceAnalyticsService.getComplianceSummary({ date: "2020-01-01" });
    assert(emptyCompRes.data_status === DATA_STATUS.NO_DATA, "Empty date returns semantic status NO_DATA");
    assert(emptyCompRes.telemetry_kpis.zone_compliance_rate.formatted === "N/A", "Empty compliance rate formatted as N/A");

    // -------------------------------------------------------------------------
    // TEST SUITE 3: Sales Analytics Service (B-12.5)
    // -------------------------------------------------------------------------
    console.log("\n💰 4. Testing Sales Analytics Service (B-12.5)...");

    const salesRes = await salesAnalyticsService.getSalesPerformance({ date: today });
    assert(salesRes.data_status === DATA_STATUS.COMPLETE, "Sales summary status is COMPLETE");
    // Total Revenue = 54.000 + 44.000 + 18.000 + 22.000 = Rp 138.000
    assert(salesRes.summary.total_revenue.value === 138000.00, "Total revenue calculated accurately (Rp 138.000)");
    assert(salesRes.summary.total_transactions === 4, "Total transactions is 4");
    assert(salesRes.summary.total_units_sold === 7, "Total units sold is 7");
    // In-zone compliant revenue = 54k + 44k + 18k = 116k; Deviated = 22k
    assert(salesRes.spatial_revenue_breakdown.in_zone_compliant_revenue.value === 116000.00, "In-zone compliant revenue is Rp 116.000");
    assert(salesRes.spatial_revenue_breakdown.out_of_zone_deviated_revenue.value === 22000.00, "Out-of-zone deviated revenue is Rp 22.000");
    assert(parseFloat(salesRes.spatial_revenue_breakdown.compliant_revenue_share_pct.value) > 80.0, "Compliant revenue share % is calculated (~84%)");
    assert(salesRes.product_mix.length >= 2, "Product mix breakdown returned");
    assert(salesRes.hourly_trend.length >= 1, "Hourly distribution returned");

    // -------------------------------------------------------------------------
    // TEST SUITE 4: DSS Plan-vs-Actual Effectiveness Service (B-12.6)
    // -------------------------------------------------------------------------
    console.log("\n🎯 5. Testing DSS Plan-vs-Actual Effectiveness Service (B-12.6)...");

    const dssRes = await dssPerformanceService.getPlanVsActualAnalysis({ date: today });
    assert(dssRes.data_status === DATA_STATUS.COMPLETE, "Plan-vs-actual analysis status is COMPLETE");
    assert(dssRes.total_evaluated_ranks >= 2, "Evaluated ranks count is >= 2");

    const rank1 = dssRes.ranks_breakdown.find((r) => r.zone_id === testZone1.id);
    const rank2 = dssRes.ranks_breakdown.find((r) => r.zone_id === testZone2.id);

    assert(rank1 !== undefined, "Rank #1 zone is present in breakdown");
    assert(rank2 !== undefined, "Rank #2 zone is present in breakdown");
    assert(rank1.actual_execution.actual_revenue === 98000.00, "Rank #1 actual revenue is Rp 98.000");
    assert(rank2.actual_execution.actual_revenue === 40000.00, "Rank #2 actual revenue is Rp 40.000");
    assert(rank1.actual_execution.actual_revenue > rank2.actual_execution.actual_revenue, "Rank #1 outperformed Rank #2 in actual revenue");
    assert(dssRes.insights.rank_order_alignment !== undefined, "Rank-order alignment metric computed");

    // -------------------------------------------------------------------------
    // TEST SUITE 5: Reporting Service & RBAC Projections (B-12.7)
    // -------------------------------------------------------------------------
    console.log("\n📊 6. Testing Reporting Service & RBAC Field-Level Projections (B-12.7)...");

    // Management Overview (Full Financials Visible)
    const mgtOverview = await reportingService.getUnifiedDashboardOverview("MANAGEMENT", { date: today });
    assert(mgtOverview.sales.summary.total_revenue.formatted.includes("Rp"), "Management sees unmasked financial figures");
    assert(mgtOverview.operational !== undefined, "Management sees operational metrics");
    assert(mgtOverview.dss_effectiveness !== undefined, "Management sees DSS effectiveness metrics");

    // Supervisor Overview (Macro Financials Masked / Protected)
    const spvOverview = await reportingService.getUnifiedDashboardOverview("SUPERVISOR", { date: today });
    assert(spvOverview.sales.summary.total_revenue.formatted === "PROTECTED_ROLE", "Supervisor has macro financial revenue masked");
    assert(spvOverview.operational.population.total_assigned_sessions >= 2, "Supervisor sees full operational volumes and counts");

    // Tabular Report & CSV Generation
    const dailyReport = await reportingService.getDailyOperationalReport({ targetDate: today });
    assert(dailyReport.total_records >= 2, "Tabular report returns all assignment records");
    assert(dailyReport.records[0].rider_name !== undefined, "Tabular record includes rider name");
    assert(dailyReport.records[0].operating_duration_minutes !== undefined, "Tabular record includes operating duration");

    const csvContent = await reportingService.generateDailyReportCSV({ targetDate: today });
    assert(csvContent.includes("Assignment ID,Tanggal,TOPSIS Rank"), "CSV header formatted properly");
    assert(csvContent.includes("Rider B12 Alpha"), "CSV includes Rider Alpha row");
    assert(csvContent.includes("Rider B12 Beta"), "CSV includes Rider Beta row");

    console.log("\n================================================================================");
    console.log(`🏆 TEST SUITE SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log("================================================================================");

    if (failedCount > 0) {
      throw new Error(`${failedCount} test assertions failed.`);
    }
  } catch (error) {
    console.error("❌ Fatal Test Failure:", error);
    process.exit(1);
  } finally {
    // CLEANUP
    console.log("\n🧹 Cleaning up test fixtures...");
    try {
      if (testUser1) {
        await pool.query("DELETE FROM rider_telemetry_logs WHERE rider_id = $1;", [testUser1.id]);
        await pool.query("DELETE FROM rider_zone_logs WHERE rider_id = $1;", [testUser1.id]);
        await pool.query("DELETE FROM sales_logs WHERE rider_id = $1;", [testUser1.id]);
        await pool.query("DELETE FROM operational_sessions WHERE rider_id = $1;", [testUser1.id]);
        await pool.query("DELETE FROM zone_assignments WHERE rider_id = $1;", [testUser1.id]);
        await pool.query("DELETE FROM users WHERE id = $1;", [testUser1.id]);
      }
      if (testUser2) {
        await pool.query("DELETE FROM rider_telemetry_logs WHERE rider_id = $1;", [testUser2.id]);
        await pool.query("DELETE FROM rider_zone_logs WHERE rider_id = $1;", [testUser2.id]);
        await pool.query("DELETE FROM sales_logs WHERE rider_id = $1;", [testUser2.id]);
        await pool.query("DELETE FROM operational_sessions WHERE rider_id = $1;", [testUser2.id]);
        await pool.query("DELETE FROM zone_assignments WHERE rider_id = $1;", [testUser2.id]);
        await pool.query("DELETE FROM users WHERE id = $1;", [testUser2.id]);
      }
      if (testArmada1) await pool.query("DELETE FROM armadas WHERE id = $1;", [testArmada1.id]);
      if (testArmada2) await pool.query("DELETE FROM armadas WHERE id = $1;", [testArmada2.id]);
      if (testProduct1) await pool.query("DELETE FROM products WHERE id = $1;", [testProduct1.id]);
      if (testProduct2) await pool.query("DELETE FROM products WHERE id = $1;", [testProduct2.id]);
      if (testZone1) await pool.query("DELETE FROM zones WHERE id = $1;", [testZone1.id]);
      if (testZone2) await pool.query("DELETE FROM zones WHERE id = $1;", [testZone2.id]);
      console.log("✅ Cleanup completed.");
    } catch (cleanErr) {
      console.warn("⚠️ Cleanup warning:", cleanErr.message);
    }
    process.exit(failedCount > 0 ? 1 : 0);
  }
}

runB12Tests();
