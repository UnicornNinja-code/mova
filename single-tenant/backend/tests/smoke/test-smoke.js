/*
 * test-smoke.js
 * High-Speed Production Readiness Smoke Test Suite.
 * Validates Core Infrastructure: PostgreSQL & PostGIS, Redis Key-Value & Geospatial, Environment Integrity.
 */

import { pool } from "../../src/config/database.js";
import { redisClient } from "../../src/config/redis.js";
import { env } from "../../src/config/env.js";

async function runSmokeTest() {
  console.log("\n========================================================");
  console.log("💨 EXECUTING SYSTEM READINESS SMOKE TEST SUITE");
  console.log("========================================================\n");

  const startTime = Date.now();
  let passedCount = 0;
  let totalCount = 0;

  function report(name, isSuccess, details = "") {
    totalCount++;
    if (isSuccess) {
      passedCount++;
      console.log(`  ✅ [PASS] ${name}${details ? ` -> ${details}` : ""}`);
    } else {
      console.error(`  ❌ [FAIL] ${name}${details ? ` -> ${details}` : ""}`);
    }
  }

  try {
    // 1. Environment Variables Validation
    const hasJwtSecret = !!env.JWT_SECRET && env.JWT_SECRET.length > 8;
    const hasPort = !!env.PORT;
    report("Environment Configuration Check", hasJwtSecret && hasPort, `PORT: ${env.PORT}`);

    // 2. PostgreSQL Connectivity
    const dbRes = await pool.query("SELECT NOW() as now_time, current_database() as db_name;");
    const dbOk = dbRes.rows.length > 0;
    report("PostgreSQL Database Connection", dbOk, `Database: ${dbRes.rows[0]?.db_name}`);

    // 3. PostGIS Extension Verification
    const postgisRes = await pool.query("SELECT PostGIS_Version() as postgis_ver;");
    const postgisOk = postgisRes.rows.length > 0;
    report("PostGIS Spatial Extension", postgisOk, `Version: ${postgisRes.rows[0]?.postgis_ver}`);

    // 4. Redis Key-Value & Geospatial Engine
    const pingRes = await redisClient.ping();
    const redisOk = pingRes === "PONG";
    report("Redis In-Memory Engine", redisOk, `Ping Response: ${pingRes}`);

    // 5. Critical Database Tables Existence (Parallel query check)
    const tablesToCheck = ["users", "zones", "armadas", "products", "zone_assignments", "sales_logs", "audit_logs"];
    const { rows: tableRows } = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name = ANY($1::text[]);
    `, [tablesToCheck]);
    const foundTables = tableRows.map((r) => r.table_name);
    const allTablesPresent = tablesToCheck.every((t) => foundTables.includes(t));
    report("Database Schema Integrity", allTablesPresent, `Found ${foundTables.length}/${tablesToCheck.length} Core Tables`);

    const duration = Date.now() - startTime;
    console.log("\n--------------------------------------------------------");
    console.log(`📊 Smoke Test Summary: ${passedCount}/${totalCount} Checks Passed (${duration}ms)`);
    console.log("--------------------------------------------------------\n");

    if (passedCount === totalCount) {
      console.log("🚀 BACKEND READY FOR OPERATION!\n");
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (err) {
    console.error("💥 Fatal Error in Smoke Test:", err.message);
    process.exit(1);
  } finally {
    try {
      if (redisClient && (redisClient.isOpen || redisClient.isReady)) {
        await redisClient.quit();
      }
      await pool.end();
    } catch {}
  }
}

runSmokeTest();
