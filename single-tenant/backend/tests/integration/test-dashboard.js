/*
 * test-dashboard.js
 * Comprehensive Integration Test Suite for Phase 5: Dashboard Analytics & Aggregated Reporting
 * Tests Executive Summary KPIs, Operational Scoping, Time-Series Trends, Zone & Product Performance,
 * Canonical Divergence Prevention, Zero-Data State Resilience, & RBAC Field-Level Isolation.
 */

import { pool } from "../../src/config/database.js";
import { server } from "../../index.js";
import bcrypt from "bcrypt";

const PORT = process.env.PORT || 9000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

let passedCount = 0;
let failedCount = 0;

function assertTest(name, condition, extraInfo = "") {
  if (condition) {
    console.log(`  ✓ PASS: ${name}${extraInfo ? ` (${extraInfo})` : ""}`);
    passedCount++;
  } else {
    console.error(`  ✗ FAIL: ${name}${extraInfo ? ` (${extraInfo})` : ""}`);
    failedCount++;
  }
}

async function login(email, password) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: email, password }),
  });
  const data = await res.json();
  return { status: res.status, token: data.token, user: data.user, data };
}

async function runDashboardTests() {
  console.log("\n======================================================");
  console.log("Starting Phase 5: Dashboard Analytics & Reporting Test Suite");
  console.log(`Target: ${BASE_URL}`);
  console.log("======================================================\n");

  let localServer = null;

  try {
    try {
      await fetch(`${BASE_URL}/api/poi-categories`, { signal: AbortSignal.timeout(1200) });
    } catch {
      console.log(`Starting test server on port ${PORT}...`);
      await new Promise((resolve) => server.listen(PORT, resolve));
      localServer = server;
      console.log(`Test server running at ${BASE_URL}\n`);
    }

    // 0. Setup Users for all 4 roles
    const defaultHash = await bcrypt.hash("password123", 10);

    const rolesData = [
      { email: "superadmin_p5@example.com", username: "superadmin_p5", name: "SA Phase 5", role: "SUPERADMIN" },
      { email: "management_p5@example.com", username: "management_p5", name: "Mgt Phase 5", role: "MANAGEMENT" },
      { email: "supervisor_p5@example.com", username: "supervisor_p5", name: "SPV Phase 5", role: "SUPERVISOR" },
      { email: "rider_p5@example.com", username: "rider_p5", name: "Rider Phase 5", role: "RIDER" },
    ];

    for (const u of rolesData) {
      await pool.query(
        `INSERT INTO users (username, name, email, password, role)
         VALUES ($1, $2, $3, $4, $5::"Role")
         ON CONFLICT (email) DO UPDATE SET password = $4, role = $5::"Role";`,
        [u.username, u.name, u.email, defaultHash, u.role]
      );
    }

    console.log("[1] Authenticating Test Users Across All 4 Roles...");
    const saLogin = await login("superadmin_p5@example.com", "password123");
    const mgtLogin = await login("management_p5@example.com", "password123");
    const spvLogin = await login("supervisor_p5@example.com", "password123");
    const riderLogin = await login("rider_p5@example.com", "password123");

    assertTest("Superadmin Login", saLogin.status === 200 && !!saLogin.token);
    assertTest("Management Login", mgtLogin.status === 200 && !!mgtLogin.token);
    assertTest("Supervisor Login", spvLogin.status === 200 && !!spvLogin.token);
    assertTest("Rider Login", riderLogin.status === 200 && !!riderLogin.token);

    const saToken = saLogin.token;
    const mgtToken = mgtLogin.token;
    const spvToken = spvLogin.token;
    const riderToken = riderLogin.token;

    // 1. RBAC & Access Blockades
    console.log("\n[2] Testing RBAC Security & Rider Access Blockades...");
    const riderSummaryRes = await fetch(`${BASE_URL}/api/dashboard/summary`, {
      headers: { Authorization: `Bearer ${riderToken}` },
    });
    assertTest("Rider Blocked From GET /summary (403)", riderSummaryRes.status === 403);

    const riderTrendRes = await fetch(`${BASE_URL}/api/dashboard/sales-trend`, {
      headers: { Authorization: `Bearer ${riderToken}` },
    });
    assertTest("Rider Blocked From GET /sales-trend (403)", riderTrendRes.status === 403);

    const riderZoneRes = await fetch(`${BASE_URL}/api/dashboard/zone-performance`, {
      headers: { Authorization: `Bearer ${riderToken}` },
    });
    assertTest("Rider Blocked From GET /zone-performance (403)", riderZoneRes.status === 403);

    const riderProdRes = await fetch(`${BASE_URL}/api/dashboard/product-performance`, {
      headers: { Authorization: `Bearer ${riderToken}` },
    });
    assertTest("Rider Blocked From GET /product-performance (403)", riderProdRes.status === 403);

    // Supervisor blocked from /product-performance
    const spvProdRes = await fetch(`${BASE_URL}/api/dashboard/product-performance`, {
      headers: { Authorization: `Bearer ${spvToken}` },
    });
    assertTest("Supervisor Blocked From Product Financial Performance (403)", spvProdRes.status === 403);

    // 2. Executive Management Dashboard Summary
    console.log("\n[3] Testing Executive Dashboard Summary (Management / Superadmin)...");
    const mgtSummaryRes = await fetch(`${BASE_URL}/api/dashboard/summary`, {
      headers: { Authorization: `Bearer ${mgtToken}` },
    });
    const mgtSummary = await mgtSummaryRes.json();
    assertTest("Management Receives Dashboard Summary (200)", mgtSummaryRes.status === 200);

    const finData = mgtSummary.data?.financials;
    const opsData = mgtSummary.data?.operations;
    const fleetData = mgtSummary.data?.fleet;

    assertTest("Summary Contains Financial KPIs", finData && typeof finData.total_revenue === "number" && typeof finData.total_transactions === "number");
    assertTest("Summary Contains Operations KPIs", opsData && typeof opsData.registered_riders === "number" && typeof opsData.waiting_riders === "number");
    assertTest("Summary Contains Fleet Metrics", fleetData && typeof fleetData.utilization_rate_percentage === "number");
    assertTest("Summary Contains Top DSS Zone", !!mgtSummary.data?.top_dss_zone?.zone_name);

    // 3. Operational Scoping for Supervisor
    console.log("\n[4] Testing Role-Based Field-Level Data Scoping for Supervisor...");
    const spvSummaryRes = await fetch(`${BASE_URL}/api/dashboard/summary`, {
      headers: { Authorization: `Bearer ${spvToken}` },
    });
    const spvSummary = await spvSummaryRes.json();
    assertTest("Supervisor Receives Operational Dashboard Summary (200)", spvSummaryRes.status === 200);
    assertTest("Supervisor Payload Scoped to 'OPERATIONAL_SUPERVISOR'", spvSummary.data?.role_scope === "OPERATIONAL_SUPERVISOR");
    assertTest("Supervisor Receives Operational Sales (Transactions/Units)", spvSummary.data?.operational_sales && typeof spvSummary.data.operational_sales.total_transactions === "number");
    assertTest("Supervisor Excluded From Financial Revenue/AOV (Zero Field Leakage)", spvSummary.data?.financials === undefined);

    // 4. Canonical Divergence Prevention
    console.log("\n[5] Testing Canonical Data Consistency (Divergence Prevention)...");
    // Query direct database canonical figures for comparison
    const { rows: canonicalRevenueRows } = await pool.query(
      `SELECT COALESCE(SUM(total_price), 0)::numeric(14,2) AS total_revenue, COUNT(id)::int AS total_trans
       FROM sales_logs
       WHERE (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date = CURRENT_DATE;`
    );
    const dbRevenue = parseFloat(canonicalRevenueRows[0].total_revenue);
    const dbTransactions = canonicalRevenueRows[0].total_trans;

    assertTest(
      "Dashboard Revenue Matches Canonical SUM(sales_logs.total_price)",
      Math.abs(finData.total_revenue - dbRevenue) < 0.01,
      `Dashboard: ${finData.total_revenue} | DB: ${dbRevenue}`
    );
    assertTest(
      "Dashboard Transactions Match Canonical COUNT(sales_logs.id)",
      finData.total_transactions === dbTransactions,
      `Dashboard: ${finData.total_transactions} | DB: ${dbTransactions}`
    );

    const { rows: canonicalRiderRows } = await pool.query(
      `SELECT COUNT(*)::int AS checked_in FROM zone_assignments WHERE assignment_date = CURRENT_DATE AND status = 'CHECKED_IN';`
    );
    const dbCheckedIn = canonicalRiderRows[0].checked_in;
    assertTest(
      "Dashboard Checked-In Riders Match Canonical zone_assignments",
      opsData.checked_in_riders === dbCheckedIn,
      `Dashboard: ${opsData.checked_in_riders} | DB: ${dbCheckedIn}`
    );

    // 5. Zero-Data State Resilience
    console.log("\n[6] Testing Zero-Data State Resilience (Far Future Date)...");
    const zeroDataRes = await fetch(`${BASE_URL}/api/dashboard/summary?date=2099-12-31`, {
      headers: { Authorization: `Bearer ${mgtToken}` },
    });
    const zeroData = await zeroDataRes.json();
    assertTest("Zero-Data Date Request Succeeds (200)", zeroDataRes.status === 200);
    assertTest("Zero-Data Financials Return 0 (Not null or NaN)", zeroData.data?.financials?.total_revenue === 0 && zeroData.data?.financials?.total_transactions === 0);

    // 6. Time-Series Sales Trend
    console.log("\n[7] Testing Sales Trend Time-Series Analytics (7d / 30d)...");
    const trendRes = await fetch(`${BASE_URL}/api/dashboard/sales-trend?range=7d`, {
      headers: { Authorization: `Bearer ${mgtToken}` },
    });
    const trendData = await trendRes.json();
    assertTest("Sales Trend Query Succeeds (200)", trendRes.status === 200);
    assertTest("Sales Trend Contains Array Data", Array.isArray(trendData.data?.data));

    // 7. Zone Performance Breakdown
    console.log("\n[8] Testing Zone Performance & Occupancy Metrics...");
    const zonePerfRes = await fetch(`${BASE_URL}/api/dashboard/zone-performance`, {
      headers: { Authorization: `Bearer ${mgtToken}` },
    });
    const zonePerfData = await zonePerfRes.json();
    assertTest("Zone Performance Query Succeeds (200)", zonePerfRes.status === 200);
    assertTest("Zone Performance Contains Zones List", Array.isArray(zonePerfData.data?.zones));
    if (zonePerfData.data?.zones?.length > 0) {
      const sampleZone = zonePerfData.data.zones[0];
      assertTest("Zone Contains Capacity & Occupancy Rates", typeof sampleZone.max_capacity === "number" && typeof sampleZone.occupancy_rate_percentage === "number");
    }

    // 8. Product Performance & Contribution (Management / SA)
    console.log("\n[9] Testing Product Performance & Contribution Analytics...");
    const prodPerfRes = await fetch(`${BASE_URL}/api/dashboard/product-performance?range=30d`, {
      headers: { Authorization: `Bearer ${mgtToken}` },
    });
    const prodPerfData = await prodPerfRes.json();
    assertTest("Product Performance Query Succeeds (200)", prodPerfRes.status === 200);
    assertTest("Product Performance Contains Product List", Array.isArray(prodPerfData.data?.products));
    if (prodPerfData.data?.products?.length > 0) {
      const sampleProd = prodPerfData.data.products[0];
      assertTest("Product Contains Revenue & Units Sold", typeof sampleProd.total_revenue === "number" && typeof sampleProd.total_units_sold === "number");
    }

    console.log("\n======================================================");
    console.log(`Phase 5 Test Results: PASSED: ${passedCount} | FAILED: ${failedCount}`);
    console.log("======================================================\n");

    if (failedCount > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (error) {
    console.error("FATAL ERROR in Phase 5 tests:", error);
    process.exit(1);
  } finally {
    if (localServer && localServer.close) {
      await new Promise((resolve) => localServer.close(resolve));
    }
    await pool.end();
  }
}

runDashboardTests();
