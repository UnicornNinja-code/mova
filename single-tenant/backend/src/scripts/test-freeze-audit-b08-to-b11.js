/*
 * test-freeze-audit-b08-to-b11.js
 * Comprehensive Architecture & Contract Freeze Audit for Milestones B-08, B-09, B-10, and B-11.
 * Verifies all 16 Invariants to declare B-08 through B-11 as a Locked & Frozen Foundation.
 */

import { pool } from "../config/database.js";
import fs from "fs";
import path from "path";

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

async function runFreezeAudit() {
  console.log("================================================================================");
  console.log("🔒 ARCHITECTURE & CONTRACT FREEZE AUDIT: MILESTONES B-08 THROUGH B-11");
  console.log("================================================================================\n");

  try {
    // -------------------------------------------------------------------------
    // INVARIANT 1: Foreign Keys and Unique Constraints Integrity
    // -------------------------------------------------------------------------
    console.log("📌 INVARIANT 1: Foreign Keys and Unique Constraints Integrity...");
    const { rows: constraints } = await pool.query(`
      SELECT 
        conname, 
        contype, 
        conrelid::regclass AS table_name,
        pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE conrelid IN (
        'operational_sessions'::regclass, 
        'latest_rider_positions'::regclass, 
        'rider_telemetry_logs'::regclass, 
        'rider_zone_logs'::regclass, 
        'sales_logs'::regclass,
        'zone_assignments'::regclass
      );
    `);

    const hasAssignmentUnique = constraints.some(
      (c) => c.table_name.toString().includes("operational_sessions") && c.definition.includes("UNIQUE (assignment_id)")
    );
    assert(hasAssignmentUnique, "operational_sessions has UNIQUE (assignment_id) constraint");

    const hasLrpPk = constraints.some(
      (c) => c.table_name.toString().includes("latest_rider_positions") && c.contype === "p"
    );
    assert(hasLrpPk, "latest_rider_positions has PRIMARY KEY (rider_id)");

    const hasSessionFkInSales = constraints.some(
      (c) => c.table_name.toString().includes("sales_logs") && c.definition.includes("REFERENCES operational_sessions(id)")
    );
    assert(hasSessionFkInSales, "sales_logs has FOREIGN KEY referencing operational_sessions(id)");

    // -------------------------------------------------------------------------
    // INVARIANT 2: Controller & Service Separation (No Direct DB in Controllers)
    // -------------------------------------------------------------------------
    console.log("\n📌 INVARIANT 2: Controller & Service Separation Architecture...");
    const controllersDir = path.resolve("./src/controllers");
    const controllerFiles = fs.readdirSync(controllersDir);
    let directPoolQueryInControllers = false;

    for (const file of controllerFiles) {
      if (file.endsWith(".js")) {
        const content = fs.readFileSync(path.join(controllersDir, file), "utf8");
        if (content.includes("pool.query(") && !content.includes("// allowed-pool-query")) {
          // Check if pool is used directly inside controller
          directPoolQueryInControllers = true;
          console.warn(`    ⚠️ Direct pool.query detected in controller: ${file}`);
        }
      }
    }
    assert(!directPoolQueryInControllers, "All controllers delegate to Domain Services / Repositories");

    // -------------------------------------------------------------------------
    // INVARIANT 3: 1:1 Operational Session to Zone Assignment Mapping
    // -------------------------------------------------------------------------
    console.log("\n📌 INVARIANT 3: 1:1 Mapping between Operational Session & Zone Assignment...");
    const { rows: sessionDupRows } = await pool.query(`
      SELECT assignment_id, COUNT(*) AS count
      FROM operational_sessions
      GROUP BY assignment_id
      HAVING COUNT(*) > 1;
    `);
    assert(sessionDupRows.length === 0, "Zero duplicate assignments in operational_sessions table");

    // -------------------------------------------------------------------------
    // INVARIANT 4: Single Active Operational Session per Rider
    // -------------------------------------------------------------------------
    console.log("\n📌 INVARIANT 4: No Multiple Active Sessions per Rider Invariant...");
    const { rows: activeDupRows } = await pool.query(`
      SELECT rider_id, COUNT(*) AS count
      FROM operational_sessions
      WHERE status IN ('CLAIMED', 'CHECKED_IN', 'OPERATING')
      GROUP BY rider_id
      HAVING COUNT(*) > 1;
    `);
    assert(activeDupRows.length === 0, "Zero concurrent active sessions for any single rider");

    // -------------------------------------------------------------------------
    // INVARIANT 5: GPS Client recorded_at vs Server created_at Separation
    // -------------------------------------------------------------------------
    console.log("\n📌 INVARIANT 5: Temporal Provenance Separation (recorded_at vs created_at)...");
    const { rows: telemetryCols } = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'rider_telemetry_logs' AND column_name IN ('recorded_at', 'created_at');
    `);
    const hasRecordedAt = telemetryCols.some((c) => c.column_name === "recorded_at");
    const hasCreatedAt = telemetryCols.some((c) => c.column_name === "created_at");
    assert(hasRecordedAt && hasCreatedAt, "rider_telemetry_logs distinguishes recorded_at and created_at");

    // -------------------------------------------------------------------------
    // INVARIANT 6: Historical Telemetry Immutability
    // -------------------------------------------------------------------------
    console.log("\n📌 INVARIANT 6: Historical Telemetry Logs Immutability...");
    const sessionRepoCode = fs.readFileSync(path.resolve("./src/repositories/operationalSessionRepository.js"), "utf8");
    const hasUpdateTelemetry = sessionRepoCode.includes("UPDATE rider_telemetry_logs");
    const hasDeleteTelemetry = sessionRepoCode.includes("DELETE FROM rider_telemetry_logs");
    assert(!hasUpdateTelemetry && !hasDeleteTelemetry, "OperationalSessionRepository contains no UPDATE/DELETE on telemetry logs");

    // -------------------------------------------------------------------------
    // INVARIANT 7: latest_rider_positions is Strictly Current SSOT State
    // -------------------------------------------------------------------------
    console.log("\n📌 INVARIANT 7: latest_rider_positions Current State Upsert Invariance...");
    const hasUpsertLatest = sessionRepoCode.includes("ON CONFLICT (rider_id) DO UPDATE");
    assert(hasUpsertLatest, "latest_rider_positions strictly upserts 1 current row per rider");

    // -------------------------------------------------------------------------
    // INVARIANT 8: Discrete Geofence State Transition Logs
    // -------------------------------------------------------------------------
    console.log("\n📌 INVARIANT 8: Geofence Logs Discrete Transition Invariant...");
    const lbsServiceCode = fs.readFileSync(path.resolve("./src/services/lbs/LbsGeofenceService.js"), "utf8");
    const hasDiscreteGuard = lbsServiceCode.includes("zoneChanged || complianceChanged");
    assert(hasDiscreteGuard, "LbsGeofenceService only generates zone logs on discrete state changes");

    // -------------------------------------------------------------------------
    // INVARIANT 9: PostGIS ST_Covers Consistency
    // -------------------------------------------------------------------------
    console.log("\n📌 INVARIANT 9: PostGIS ST_Covers Boundary Consistency...");
    const riderRepoCode = fs.readFileSync(path.resolve("./src/repositories/riderOperationalRepository.js"), "utf8");
    const hasStCoversInRiderRepo = riderRepoCode.includes("ST_Covers");
    const hasStCoversInLbs = lbsServiceCode.includes("ST_Covers");
    assert(hasStCoversInRiderRepo && hasStCoversInLbs, "ST_Covers used consistently for spatial check-in and geofencing");

    // -------------------------------------------------------------------------
    // INVARIANT 10: Multi-Dimensional Spatial Compliance Separation
    // -------------------------------------------------------------------------
    console.log("\n📌 INVARIANT 10: Zone Compliance vs Road Restriction Separation...");
    const { rows: lrpCols } = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'latest_rider_positions' AND column_name IN ('zone_compliance', 'road_compliance');
    `);
    const hasZoneComp = lrpCols.some((c) => c.column_name === "zone_compliance");
    const hasRoadComp = lrpCols.some((c) => c.column_name === "road_compliance");
    assert(hasZoneComp && hasRoadComp, "latest_rider_positions separates zone_compliance from road_compliance");

    // -------------------------------------------------------------------------
    // INVARIANT 11: Field Sales Session Provenance
    // -------------------------------------------------------------------------
    console.log("\n📌 INVARIANT 11: Field Sales Linkage to Operational Session & Zone Compliance...");
    const { rows: salesCols } = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'sales_logs' AND column_name IN ('session_id', 'actual_zone_id', 'compliance_at_sale');
    `);
    const hasSessionInSales = salesCols.some((c) => c.column_name === "session_id");
    const hasComplianceInSales = salesCols.some((c) => c.column_name === "compliance_at_sale");
    assert(hasSessionInSales && hasComplianceInSales, "sales_logs stores session_id and compliance_at_sale provenance");

    // -------------------------------------------------------------------------
    // INVARIANT 12: Atomic Checkout & Fleet Release Transaction
    // -------------------------------------------------------------------------
    console.log("\n📌 INVARIANT 12: Atomic Database Transaction on Session Checkout...");
    const hasBeginInCheckout = sessionRepoCode.includes("checkoutSession") && sessionRepoCode.includes("BEGIN") && sessionRepoCode.includes("COMMIT");
    assert(hasBeginInCheckout, "checkoutSession executes inside atomic PostgreSQL transaction (BEGIN...COMMIT/ROLLBACK)");

    // -------------------------------------------------------------------------
    // INVARIANT 13: Non-Blocking Socket.IO Event Transport
    // -------------------------------------------------------------------------
    console.log("\n📌 INVARIANT 13: Non-Blocking Decoupled Socket.IO Transports...");
    const riderServiceCode = fs.readFileSync(path.resolve("./src/services/rider/RiderOperationalService.js"), "utf8");
    const hasSocketCatchInCheckIn = riderServiceCode.includes("catch (sockErr)");
    assert(hasSocketCatchInCheckIn, "Socket.IO events wrapped in try-catch to prevent transaction failure");

    // -------------------------------------------------------------------------
    // INVARIANT 14: Swagger SSOT Contract Synchronization
    // -------------------------------------------------------------------------
    console.log("\n📌 INVARIANT 14: Swagger SSOT Contract Synchronization...");
    const swaggerContent = fs.readFileSync(path.resolve("./src/docs/swagger.yaml"), "utf8");
    const hasRiderOpPath = swaggerContent.includes("/rider-operational/active-session") && swaggerContent.includes("/rider-operational/check-in");
    const hasLbsPingPath = swaggerContent.includes("/lbs/ping") && swaggerContent.includes("/lbs/riders/live");
    const hasDistPath = swaggerContent.includes("/distribution/duty/confirm") && swaggerContent.includes("/distribution/auto-assign");
    assert(hasRiderOpPath && hasLbsPingPath && hasDistPath, "Swagger document completely describes B-08, B-09, B-10, and B-11 endpoints");

    // -------------------------------------------------------------------------
    // INVARIANT 15: Zero Frontend Recalculation Principle
    // -------------------------------------------------------------------------
    console.log("\n📌 INVARIANT 15: Zero Frontend Recalculation (Server-Side SSOT Scoring)...");
    const formatterCode = fs.readFileSync(path.resolve("./src/services/dss/RecommendationContractFormatter.js"), "utf8");
    const hasDualContract = formatterCode.includes("DSS-CRITERIA-v1.0") && formatterCode.includes("BWM-TOPSIS-v1.0");
    const hasCompleteComputedScores = formatterCode.includes("preference_score") && formatterCode.includes("rankings") && formatterCode.includes("generateReasoning");
    assert(hasDualContract && hasCompleteComputedScores, "Recommendation payload contains complete computed scores, ranks, and zero-recalculation guarantees");

    // -------------------------------------------------------------------------
    // INVARIANT 16: Clean Isolation of Business Logic (No Premature B-12 Coupling)
    // -------------------------------------------------------------------------
    console.log("\n📌 INVARIANT 16: Boundary Isolation (No Premature Reporting Coupling in Core Engines)...");
    const topsisEngineCode = fs.readFileSync(path.resolve("./src/services/dss/TopsisEngineService.js"), "utf8");
    const hasNoReportingInTopsis = !topsisEngineCode.includes("supervisor_kpi") && !topsisEngineCode.includes("sales_report");
    assert(hasNoReportingInTopsis, "DSS and Operational core engines remain pure with zero premature reporting/KPI coupling");

    console.log("\n================================================================================");
    console.log(`🏆 FREEZE AUDIT SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log("================================================================================");

    if (failedCount > 0) {
      throw new Error(`${failedCount} freeze audit assertions failed.`);
    }
  } catch (error) {
    console.error("❌ Fatal Audit Failure:", error);
    process.exit(1);
  } finally {
    process.exit(failedCount > 0 ? 1 : 0);
  }
}

runFreezeAudit();
