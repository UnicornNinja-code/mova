/*
 * test-catalog-sales.js
 * Comprehensive Integration Test Suite for Phase 4: Catalog & Sales Domain Completion
 * Tests Catalog CRUD RBAC, Pricing Snapshots (NUMERIC), Check-In Prerequisite Guards,
 * Discontinued Product Guards, Historical Sales Deletion Guards, Ownership Isolation, & Aggregation.
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

async function runCatalogSalesTests() {
  console.log("\n======================================================");
  console.log("Starting Phase 4: Catalog & Sales Domain Test Suite");
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
      { email: "superadmin_p4@example.com", username: "superadmin_p4", name: "SA Phase 4", role: "SUPERADMIN" },
      { email: "management_p4@example.com", username: "management_p4", name: "Mgt Phase 4", role: "MANAGEMENT" },
      { email: "supervisor_p4@example.com", username: "supervisor_p4", name: "SPV Phase 4", role: "SUPERVISOR" },
      { email: "rider1_p4@example.com", username: "rider1_p4", name: "Rider 1 Phase 4", role: "RIDER" },
      { email: "rider2_p4@example.com", username: "rider2_p4", name: "Rider 2 Phase 4", role: "RIDER" },
    ];

    for (const u of rolesData) {
      await pool.query(
        `INSERT INTO users (username, name, email, password, role)
         VALUES ($1, $2, $3, $4, $5::"Role")
         ON CONFLICT (email) DO UPDATE SET password = $4, role = $5::"Role";`,
        [u.username, u.name, u.email, defaultHash, u.role]
      );
    }

    // Clean historical sales for test riders to ensure idempotent test runs
    await pool.query(
      `DELETE FROM sales_logs WHERE rider_id IN (SELECT id FROM users WHERE email IN ('rider1_p4@example.com', 'rider2_p4@example.com'));`
    );

    console.log("[1] Authenticating Test Users Across All Roles...");

    const saLogin = await login("superadmin_p4@example.com", "password123");
    const mgtLogin = await login("management_p4@example.com", "password123");
    const spvLogin = await login("supervisor_p4@example.com", "password123");
    const r1Login = await login("rider1_p4@example.com", "password123");
    const r2Login = await login("rider2_p4@example.com", "password123");

    assertTest("Superadmin Login", saLogin.status === 200 && !!saLogin.token);
    assertTest("Management Login", mgtLogin.status === 200 && !!mgtLogin.token);
    assertTest("Supervisor Login", spvLogin.status === 200 && !!spvLogin.token);
    assertTest("Rider 1 Login", r1Login.status === 200 && !!r1Login.token);
    assertTest("Rider 2 Login", r2Login.status === 200 && !!r2Login.token);

    const saToken = saLogin.token;
    const mgtToken = mgtLogin.token;
    const spvToken = spvLogin.token;
    const r1Token = r1Login.token;
    const r2Token = r2Login.token;

    // 1. Catalog RBAC Matrix & CRUD
    console.log("\n[2] Testing Catalog RBAC Matrix & CRUD Mutations...");
    const testProductName = `Kopi Test Phase4 ${Date.now()}`;

    // A. Management creates product (Allowed)
    const createRes = await fetch(`${BASE_URL}/api/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${mgtToken}` },
      body: JSON.stringify({
        name: testProductName,
        description: "Kopi robusta kualitas terbaik",
        price: 15000,
        status: "AVAILABLE",
      }),
    });
    const createData = await createRes.json();
    assertTest("Management Can Create Product", createRes.status === 201 && !!createData.data?.id, `Product ID: ${createData.data?.id}`);
    const testProductId = createData.data?.id;

    // B. Supervisor / Rider blocked from creating product (403)
    const spvCreateRes = await fetch(`${BASE_URL}/api/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${spvToken}` },
      body: JSON.stringify({ name: "Illegal Coffee", price: 10000 }),
    });
    assertTest("Supervisor Blocked From Creating Product (403)", spvCreateRes.status === 403);

    const riderCreateRes = await fetch(`${BASE_URL}/api/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${r1Token}` },
      body: JSON.stringify({ name: "Illegal Coffee Rider", price: 10000 }),
    });
    assertTest("Rider Blocked From Creating Product (403)", riderCreateRes.status === 403);

    // C. Validation: Duplicate name & Negative price rejected
    const dupRes = await fetch(`${BASE_URL}/api/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${mgtToken}` },
      body: JSON.stringify({ name: testProductName, price: 20000 }),
    });
    assertTest("Duplicate Product Name Rejected (400)", dupRes.status === 400);

    const negPriceRes = await fetch(`${BASE_URL}/api/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${mgtToken}` },
      body: JSON.stringify({ name: `Neg Coffee ${Date.now()}`, price: -5000 }),
    });
    assertTest("Negative Price Rejected (400)", negPriceRes.status === 400);

    // D. Management updates product
    const updateRes = await fetch(`${BASE_URL}/api/products/${testProductId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${mgtToken}` },
      body: JSON.stringify({ price: 16000, description: "Updated description" }),
    });
    const updateData = await updateRes.json();
    assertTest("Management Can Update Product", updateRes.status === 200 && parseFloat(updateData.data?.price) === 16000);

    // 2. Testing Discontinued Status & Visibility
    console.log("\n[3] Testing Status Toggling & Catalog Visibility...");
    const discontinuedProductRes = await fetch(`${BASE_URL}/api/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${mgtToken}` },
      body: JSON.stringify({
        name: `Discontinued Tea ${Date.now()}`,
        price: 10000,
        status: "DISCONTINUED",
      }),
    });
    const discontinuedProduct = (await discontinuedProductRes.json()).data;
    assertTest("Create DISCONTINUED Product", discontinuedProductRes.status === 201 && discontinuedProduct.status === "DISCONTINUED");

    // Rider views catalog (should only see AVAILABLE)
    const riderCatalogRes = await fetch(`${BASE_URL}/api/products`, {
      headers: { Authorization: `Bearer ${r1Token}` },
    });
    const riderCatalog = await riderCatalogRes.json();
    const hasDiscontinuedInRider = (riderCatalog.data || []).some((p) => p.id === discontinuedProduct.id);
    assertTest("Rider Catalog Only Contains AVAILABLE (Zero DISCONTINUED Leakage)", !hasDiscontinuedInRider);

    // 3. Operational Prerequisites for Sales
    console.log("\n[4] Testing Sales Prerequisites (Check-In & Status Guards)...");
    // Ensure test zone & armada exist
    const { rows: zones } = await pool.query("SELECT id, name FROM zones WHERE status = 'ACTIVE' LIMIT 1;");
    const testZoneId = zones[0].id;
    const { rows: armadas } = await pool.query("SELECT id, code FROM armadas WHERE status = 'ACTIVE' LIMIT 1;");
    const testArmadaId = armadas[0].id;

    // Reset today's assignment for Rider 1
    await pool.query("DELETE FROM sales_logs WHERE rider_id = $1;", [r1Login.user.id]);
    await pool.query("DELETE FROM zone_assignments WHERE rider_id = $1;", [r1Login.user.id]);
    await pool.query("DELETE FROM rider_duty_queues WHERE rider_id = $1;", [r1Login.user.id]);

    // A. Sale without active assignment -> 400
    const noSessionSaleRes = await fetch(`${BASE_URL}/api/rider/record-sale`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${r1Token}` },
      body: JSON.stringify({ product_id: testProductId, qty: 2 }),
    });
    assertTest("Sale Rejected Without Active Session (400)", noSessionSaleRes.status === 400);

    // Create assignment in ASSIGNED status (not yet checked in)
    const assignRes = await pool.query(
      `INSERT INTO zone_assignments (rider_id, zone_id, armada_id, status, assignment_type, assignment_date)
       VALUES ($1, $2, $3, 'ASSIGNED', 'MANUAL', CURRENT_DATE)
       RETURNING *;`,
      [r1Login.user.id, testZoneId, testArmadaId]
    );
    const assignmentId = assignRes.rows[0].id;

    // B. Sale when ASSIGNED but not CHECKED_IN -> 400
    const preCheckInSaleRes = await fetch(`${BASE_URL}/api/rider/record-sale`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${r1Token}` },
      body: JSON.stringify({ product_id: testProductId, qty: 2 }),
    });
    assertTest("Sale Rejected Before CHECKED_IN (400)", preCheckInSaleRes.status === 400);

    // Check-in Rider 1 to zone
    await pool.query(
      "UPDATE zone_assignments SET status = 'CHECKED_IN' WHERE id = $1;",
      [assignmentId]
    );

    // C. Sale of DISCONTINUED product -> 400
    const discSaleRes = await fetch(`${BASE_URL}/api/rider/record-sale`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${r1Token}` },
      body: JSON.stringify({ product_id: discontinuedProduct.id, qty: 1 }),
    });
    assertTest("Sale of DISCONTINUED Product Blocked (400)", discSaleRes.status === 400);

    // 4. Valid Sale & Monetary Snapshot Integrity
    console.log("\n[5] Testing Valid Sale & Monetary Snapshot Integrity (NUMERIC)...");
    // Master price for testProductId is 16000
    const validSaleRes = await fetch(`${BASE_URL}/api/rider/record-sale`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${r1Token}` },
      body: JSON.stringify({
        product_id: testProductId,
        qty: 3,
        // Attempting to spoof unit_price in body (should be ignored by backend)
        unit_price: 100,
        total_price: 300,
      }),
    });
    const validSaleData = await validSaleRes.json();
    if (validSaleRes.status !== 200) {
      console.error("validSaleRes Error:", validSaleRes.status, validSaleData);
    }
    assertTest("Valid Sale Recorded Successfully", validSaleRes.status === 200 && !!validSaleData.sales_log?.id);

    // Verify snapshot in DB
    const { rows: saleDbRows } = await pool.query(
      "SELECT * FROM sales_logs WHERE id = $1;",
      [validSaleData.sales_log?.id]
    );
    const dbSale = saleDbRows[0];
    assertTest("Snapshot unit_price Correctly Set From Master (Rp16.000)", parseFloat(dbSale.unit_price) === 16000);
    assertTest("Snapshot total_price Correctly Calculated (3 x 16.000 = Rp48.000)", parseFloat(dbSale.total_price) === 48000);
    assertTest("Sale Bound to Canonical assignment_id", dbSale.assignment_id === assignmentId);

    // Now change master product price to 25.000
    await pool.query("UPDATE products SET price = 25000 WHERE id = $1;", [testProductId]);

    // Verify historical sale in DB has NOT changed
    const { rows: histDbRows } = await pool.query(
      "SELECT unit_price, total_price FROM sales_logs WHERE id = $1;",
      [validSaleData.sales_log?.id]
    );
    assertTest(
      "Historical Price Integrity Maintained After Master Price Change",
      parseFloat(histDbRows[0].unit_price) === 16000 && parseFloat(histDbRows[0].total_price) === 48000
    );

    // 5. Product Deletion Guard
    console.log("\n[6] Testing Product Deletion Guard (Historial Sales vs Unused)...");
    // A. Product with sales history cannot be deleted (400)
    const delHistRes = await fetch(`${BASE_URL}/api/products/${testProductId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${mgtToken}` },
    });
    assertTest("Product With Sales History Blocked From Hard-Delete (400)", delHistRes.status === 400);

    // B. Temporary product without sales history can be deleted
    const tempProductRes = await fetch(`${BASE_URL}/api/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${mgtToken}` },
      body: JSON.stringify({ name: `Temp Product ${Date.now()}`, price: 5000 }),
    });
    const tempProduct = (await tempProductRes.json()).data;
    const delTempRes = await fetch(`${BASE_URL}/api/products/${tempProduct.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${mgtToken}` },
    });
    assertTest("Unused Product Can Be Deleted Permanently (200)", delTempRes.status === 200);

    // 6. Rider Sales History & Ownership Isolation
    console.log("\n[7] Testing Rider Sales History & Ownership Isolation...");
    const r1SalesRes = await fetch(`${BASE_URL}/api/rider/my-sales?page=1&limit=10`, {
      headers: { Authorization: `Bearer ${r1Token}` },
    });
    const r1SalesData = await r1SalesRes.json();
    assertTest(
      "Rider 1 Personal Sales History Retrieved",
      r1SalesRes.status === 200 && r1SalesData.data?.length >= 1 && r1SalesData.total_revenue >= 48000
    );

    const r2SalesRes = await fetch(`${BASE_URL}/api/rider/my-sales`, {
      headers: { Authorization: `Bearer ${r2Token}` },
    });
    const r2SalesData = await r2SalesRes.json();
    assertTest(
      "Rider 2 Has Zero Leakage From Rider 1 Sales",
      r2SalesRes.status === 200 && r2SalesData.data?.length === 0
    );

    // 7. Sales Overview Aggregated Analytics
    console.log("\n[8] Testing Sales Overview Aggregated Analytics...");
    // Rider blocked from overview (403)
    const riderOverviewRes = await fetch(`${BASE_URL}/api/sales/overview`, {
      headers: { Authorization: `Bearer ${r1Token}` },
    });
    assertTest("Rider Blocked From Sales Overview (403)", riderOverviewRes.status === 403);

    // Management accesses overview (200)
    const mgtOverviewRes = await fetch(`${BASE_URL}/api/sales/overview`, {
      headers: { Authorization: `Bearer ${mgtToken}` },
    });
    const mgtOverview = await mgtOverviewRes.json();
    assertTest("Management Receives Sales Overview (200)", mgtOverviewRes.status === 200);
    assertTest("Overview Contains Summary Metrics", typeof mgtOverview.data?.summary?.total_revenue === "number");
    assertTest("Overview Contains Breakdown By Product", Array.isArray(mgtOverview.data?.sales_by_product));
    assertTest("Overview Contains Breakdown By Zone", Array.isArray(mgtOverview.data?.sales_by_zone));
    assertTest("Overview Contains Breakdown By Rider", Array.isArray(mgtOverview.data?.sales_by_rider));

    console.log("\n======================================================");
    console.log(`Phase 4 Test Results: PASSED: ${passedCount} | FAILED: ${failedCount}`);
    console.log("======================================================\n");

    if (failedCount > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (error) {
    console.error("FATAL ERROR in Phase 4 tests:", error);
    process.exit(1);
  } finally {
    if (localServer && localServer.close) {
      await new Promise((resolve) => localServer.close(resolve));
    }
    await pool.end();
  }
}

runCatalogSalesTests();
