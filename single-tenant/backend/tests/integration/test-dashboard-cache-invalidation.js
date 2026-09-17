/*
 * test-dashboard-cache-invalidation.js
 * Integration Test for Dashboard Summary Redis Cache Invalidation Invariant.
 *
 * Invariant Tested:
 * 1. Dashboard summary is cached in Redis on GET request.
 * 2. When a new sale is committed, the affected dashboard cache keys are immediately invalidated.
 * 3. Subsequent dashboard summary requests observe fresh PostgreSQL data without waiting for TTL expiration.
 */

import { pool } from "../../src/config/database.js";
import { redisClient } from "../../src/config/redis.js";
import { dashboardService } from "../../src/services/dashboard/DashboardService.js";
import { riderOperationalService } from "../../src/services/rider/RiderOperationalService.js";
import bcrypt from "bcrypt";

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

async function runDashboardCacheRegression() {
  console.log("\n================================================================================");
  console.log("🧪 RUNNING REGRESSION TEST: DASHBOARD CACHE POST-COMMIT INVALIDATION INVARIANT");
  console.log("================================================================================\n");

  const todayJakarta = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const cacheKeyMgt = `cache:dashboard:summary:MANAGEMENT:${todayJakarta}`;
  const cacheKeySpv = `cache:dashboard:summary:SUPERVISOR:${todayJakarta}`;
  const cacheKeySa = `cache:dashboard:summary:SUPERADMIN:${todayJakarta}`;

  let testSaleId = null;
  let testUserId = null;
  let testZoneId = null;
  let testAssignmentId = null;
  let testSessionId = null;

  try {
    // 1. Setup Test Fixture Entities (Rider, Zone, Assignment, Session, Product)
    const defaultHash = await bcrypt.hash("password123", 10);
    const userEmail = `cache_reg_${Date.now()}@mova.test`;
    const userRes = await pool.query(`
      INSERT INTO users (username, name, email, password, role, is_active, first_login)
      VALUES ($1, 'Cache Invalidation Rider', $2, $3, 'RIDER', true, false)
      RETURNING id;
    `, [`rider_cache_${Date.now()}`, userEmail, defaultHash]);
    testUserId = userRes.rows[0].id;

    const testPolygon = {
      type: "Polygon",
      coordinates: [
        [
          [112.7100, -7.4400],
          [112.7300, -7.4400],
          [112.7300, -7.4600],
          [112.7100, -7.4600],
          [112.7100, -7.4400],
        ],
      ],
    };

    const zoneRes = await pool.query(`
      INSERT INTO zones (name, polygon, max_capacity, status)
      VALUES ($1, $2, 5, 'ACTIVE')
      RETURNING id;
    `, [`Zone Cache Invalidation ${Date.now()}`, JSON.stringify(testPolygon)]);
    testZoneId = zoneRes.rows[0].id;

    const assignRes = await pool.query(`
      INSERT INTO zone_assignments (rider_id, zone_id, status, assignment_date)
      VALUES ($1, $2, 'CHECKED_IN', CURRENT_DATE)
      RETURNING id;
    `, [testUserId, testZoneId]);
    testAssignmentId = assignRes.rows[0].id;

    const sessionRes = await pool.query(`
      INSERT INTO operational_sessions (assignment_id, rider_id, zone_id, status, started_at, checked_in_at)
      VALUES ($1, $2, $3, 'OPERATING', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id;
    `, [testAssignmentId, testUserId, testZoneId]);
    testSessionId = sessionRes.rows[0].id;

    const prodRes = await pool.query(`SELECT id, price FROM products WHERE status = 'AVAILABLE' LIMIT 1;`);
    const testProd = prodRes.rows[0];

    // STEP 1: Clear baseline cache
    await redisClient.del(cacheKeyMgt);
    await redisClient.del(cacheKeySpv);
    await redisClient.del(cacheKeySa);

    // STEP 2: Request Dashboard Summary to Populate Redis Cache
    const initialSummary = await dashboardService.getDashboardSummary("MANAGEMENT", { date: todayJakarta });
    const initialRevenue = parseFloat(initialSummary.financials?.total_revenue || 0);

    const cachedRawBefore = await redisClient.get(cacheKeyMgt);
    assertTest("Step 1: Dashboard Summary Cache is Populated on Read", cachedRawBefore !== null);

    // STEP 3: Execute Sale through Production Service Path (RiderOperationalService.recordProductSale)
    const saleQty = 3;
    const expectedSaleDelta = saleQty * parseFloat(testProd.price);

    const saleResult = await riderOperationalService.recordProductSale({
      riderId: testUserId,
      productId: testProd.id,
      quantity: saleQty,
      latitude: -7.4500,
      longitude: 112.7200,
    });
    testSaleId = saleResult.sales_log.id;
    assertTest("Step 2: Sale Committed Successfully through Production Service", !!testSaleId);

    // STEP 4: Verify Redis Cache Key was INVALIDATED immediately post-commit
    const cachedMgtAfter = await redisClient.get(cacheKeyMgt);
    const cachedSpvAfter = await redisClient.get(cacheKeySpv);
    const cachedSaAfter = await redisClient.get(cacheKeySa);
    assertTest(
      "Step 3: Dashboard Cache Keys for All Roles are Invalidated Post-Commit",
      cachedMgtAfter === null && cachedSpvAfter === null && cachedSaAfter === null,
      `Mgt: ${cachedMgtAfter ? "STALE" : "NULL ✅"}, Spv: ${cachedSpvAfter ? "STALE" : "NULL ✅"}, Sa: ${cachedSaAfter ? "STALE" : "NULL ✅"}`
    );

    // STEP 5: Request Dashboard Summary again and verify fresh revenue is returned
    const freshSummary = await dashboardService.getDashboardSummary("MANAGEMENT", { date: todayJakarta });
    const freshRevenue = parseFloat(freshSummary.financials?.total_revenue || 0);
    const expectedRevenue = initialRevenue + expectedSaleDelta;

    assertTest(
      "Step 4: Next Dashboard Read Fetches Fresh PostgreSQL Snapshot without Delay",
      Math.abs(freshRevenue - expectedRevenue) < 0.01,
      `Fresh: Rp${freshRevenue.toLocaleString("id-ID")} | Expected: Rp${expectedRevenue.toLocaleString("id-ID")}`
    );

    console.log("\n================================================================================");
    console.log(`📊 REGRESSION TEST SUMMARY: ${passedCount}/${passedCount + failedCount} PASSED`);
    console.log("================================================================================\n");

  } catch (err) {
    console.error("💥 Error during regression test:", err);
    failedCount++;
  } finally {
    // Clean up test entities safely
    if (testSaleId) {
      await pool.query(`DELETE FROM sales_logs WHERE id = $1;`, [testSaleId]);
    }
    if (testSessionId) {
      await pool.query(`DELETE FROM operational_sessions WHERE id = $1;`, [testSessionId]);
    }
    if (testAssignmentId) {
      await pool.query(`DELETE FROM zone_assignments WHERE id = $1;`, [testAssignmentId]);
    }
    if (testZoneId) {
      await pool.query(`DELETE FROM zones WHERE id = $1;`, [testZoneId]);
    }
    if (testUserId) {
      await pool.query(`DELETE FROM users WHERE id = $1;`, [testUserId]);
    }
    await redisClient.del(cacheKeyMgt);
    await redisClient.del(cacheKeySpv);
    await redisClient.del(cacheKeySa);

    await pool.end();
    await redisClient.quit();
    process.exit(failedCount > 0 ? 1 : 0);
  }
}

runDashboardCacheRegression();
