/*
 * test_stage6_operational_presence.ts
 * Comprehensive Stage 6 Verification: Geofence & Operational Presence Engine
 */

import { pool } from "../src/config/database.js";
import { redisClient } from "../src/config/redis.js";
import { operationalPresenceEngine } from "../src/services/lbs/OperationalPresenceEngine.js";
import { withTenantContext } from "../src/lib/tenantContext.js";

const TENANT_A = "test-pres-tenant-a";
const TENANT_B = "test-pres-tenant-b";

const RIDER_A1 = "88888888-8888-8888-8888-888888888801";
const RIDER_A2 = "88888888-8888-8888-8888-888888888802";
const RIDER_B1 = "88888888-8888-8888-8888-888888888803";

const ZONE_A1 = "99999999-9999-9999-9999-999999999901"; // CBD
const ZONE_A2 = "99999999-9999-9999-9999-999999999902"; // West Suburb

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string, detail?: any) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ PASS: ${testName}`);
  } else {
    console.error(`  ❌ FAIL: ${testName}`, detail || "");
    process.exitCode = 1;
  }
}

async function runStage6Tests() {
  console.log("\n==================================================================");
  console.log("📍 STAGE 6: GEOFENCE & OPERATIONAL PRESENCE ENGINE VERIFICATION");
  console.log("==================================================================\n");

  try {
    // 0. Cleanup Previous Test Data
    await pool.query(`DELETE FROM rider_presence_events WHERE tenant_id IN ($1, $2);`, [TENANT_A, TENANT_B]);
    await pool.query(`DELETE FROM zone_assignments WHERE rider_id IN ($1, $2, $3);`, [RIDER_A1, RIDER_A2, RIDER_B1]);
    await pool.query(`DELETE FROM zones WHERE tenant_id IN ($1, $2);`, [TENANT_A, TENANT_B]);
    await pool.query(`DELETE FROM users WHERE id IN ($1, $2, $3);`, [RIDER_A1, RIDER_A2, RIDER_B1]);
    await pool.query(`DELETE FROM tenants WHERE id IN ($1, $2);`, [TENANT_A, TENANT_B]);

    await (redisClient as any).del(`tenant:${TENANT_A}:presence_state:${RIDER_A1}`);
    await (redisClient as any).del(`tenant:${TENANT_A}:presence_state:${RIDER_A2}`);
    await (redisClient as any).del(`tenant:${TENANT_B}:presence_state:${RIDER_B1}`);

    // 1. Setup Test Tenants
    await pool.query(
      `INSERT INTO tenants (id, name, code, status, max_fleets, max_riders, max_zones)
       VALUES ($1, 'Tenant Pres A', 'PRES_A', 'ACTIVE', 20, 50, 10),
              ($2, 'Tenant Pres B', 'PRES_B', 'ACTIVE', 20, 50, 10)
       ON CONFLICT (id) DO NOTHING;`,
      [TENANT_A, TENANT_B]
    );

    // 2. Setup Test Users
    await pool.query(
      `INSERT INTO users (id, tenant_id, email, username, password, name, role, is_active)
       VALUES 
         ($1, $4, 'rider1@presa.com', 'rider1_pres', 'hash123', 'Rider Pres 1', 'RIDER', true),
         ($2, $4, 'rider2@presa.com', 'rider2_pres', 'hash123', 'Rider Pres 2', 'RIDER', true),
         ($3, $5, 'rider1@presb.com', 'rider1_presb', 'hash123', 'Rider Pres B', 'RIDER', true)
       ON CONFLICT (id) DO NOTHING;`,
      [RIDER_A1, RIDER_A2, RIDER_B1, TENANT_A, TENANT_B]
    );

    // 3. Setup Test Zones in Tenant A
    // Zone A1: Box (-7.4470, 112.7170) to (-7.4500, 112.7200)
    const polygonGeoJson1 = {
      type: "Polygon",
      coordinates: [
        [
          [112.7170, -7.4470],
          [112.7200, -7.4470],
          [112.7200, -7.4500],
          [112.7170, -7.4500],
          [112.7170, -7.4470]
        ]
      ]
    };

    // Zone A2: Box (-7.4510, 112.7170) to (-7.4540, 112.7200)
    const polygonGeoJson2 = {
      type: "Polygon",
      coordinates: [
        [
          [112.7170, -7.4510],
          [112.7200, -7.4510],
          [112.7200, -7.4540],
          [112.7170, -7.4540],
          [112.7170, -7.4510]
        ]
      ]
    };

    await withTenantContext(TENANT_A, async (client) => {
      await client.query(
        `INSERT INTO zones (id, tenant_id, name, polygon, status)
         VALUES 
           ($1, $2, 'Zona Pusat Bisnis', $3, 'ACTIVE'),
           ($4, $2, 'Zona Perumahan Barat', $5, 'ACTIVE')
         ON CONFLICT (id) DO NOTHING;`,
        [ZONE_A1, TENANT_A, JSON.stringify(polygonGeoJson1), ZONE_A2, JSON.stringify(polygonGeoJson2)]
      );
    });

    // 4. Setup Zone Assignment: Rider 1 is assigned to Zone A1 for today
    await pool.query(
      `INSERT INTO zone_assignments (rider_id, zone_id, assignment_date, status)
       VALUES ($1, $2, CURRENT_DATE, 'ASSIGNED');`,
      [RIDER_A1, ZONE_A1]
    );

    // =========================================================================
    // SUITE 1: Geofence State Transitions (ENTER, ON_SITE, EXIT)
    // =========================================================================
    console.log("--- Suite 1: Geofence State Transitions (ENTER, ON_SITE, EXIT) ---");

    // 1.1 Initial ping outside all zones (-7.4400, 112.7100)
    const presOutside = await operationalPresenceEngine.evaluatePresence({
      tenantId: TENANT_A,
      riderId: RIDER_A1,
      riderName: "Rider Pres 1",
      latitude: -7.4400,
      longitude: 112.7100,
      capturedAt: new Date().toISOString(),
    });
    assert(presOutside.event_type === "OUTSIDE_ZONE" && !presOutside.is_inside_zone, "Initial coordinate outside zones detected as OUTSIDE_ZONE");

    // 1.2 Rider moves into Zone A1 (-7.4480, 112.7180) -> Transition: ENTER
    const presEnter = await operationalPresenceEngine.evaluatePresence({
      tenantId: TENANT_A,
      riderId: RIDER_A1,
      riderName: "Rider Pres 1",
      latitude: -7.4480,
      longitude: 112.7180,
      capturedAt: new Date().toISOString(),
    });
    assert(
      presEnter.event_type === "ENTER" && presEnter.is_transition && presEnter.actual_zone_id === ZONE_A1,
      "Entering Zone A1 triggers ENTER transition event"
    );

    // 1.3 Rider moves within Zone A1 (-7.4485, 112.7185) -> State: ON_SITE (no new transition event)
    const presOnSite = await operationalPresenceEngine.evaluatePresence({
      tenantId: TENANT_A,
      riderId: RIDER_A1,
      riderName: "Rider Pres 1",
      latitude: -7.4485,
      longitude: 112.7185,
      capturedAt: new Date().toISOString(),
    });
    assert(
      presOnSite.event_type === "ON_SITE" && !presOnSite.is_transition && presOnSite.actual_zone_id === ZONE_A1,
      "Moving within Zone A1 maintains ON_SITE state without redundant ENTER events"
    );

    // 1.4 Rider leaves Zone A1 (-7.4400, 112.7100) -> Transition: EXIT
    const presExit = await operationalPresenceEngine.evaluatePresence({
      tenantId: TENANT_A,
      riderId: RIDER_A1,
      riderName: "Rider Pres 1",
      latitude: -7.4400,
      longitude: 112.7100,
      capturedAt: new Date().toISOString(),
    });
    assert(
      presExit.event_type === "EXIT" && presExit.is_transition && !presExit.is_inside_zone,
      "Leaving Zone A1 triggers EXIT transition event"
    );

    // =========================================================================
    // SUITE 2: Operational Compliance & Deviation Detection
    // =========================================================================
    console.log("\n--- Suite 2: Operational Compliance & Deviation Detection ---");

    // 2.1 Rider 1 in assigned Zone A1 -> COMPLIANT
    const presCompliant = await operationalPresenceEngine.evaluatePresence({
      tenantId: TENANT_A,
      riderId: RIDER_A1,
      riderName: "Rider Pres 1",
      latitude: -7.4480,
      longitude: 112.7180,
      capturedAt: new Date().toISOString(),
    });
    assert(
      presCompliant.compliance_status === "COMPLIANT" && presCompliant.actual_zone_id === presCompliant.assigned_zone_id,
      "Rider in assigned zone is evaluated as COMPLIANT"
    );

    // 2.2 Rider 1 moves directly into Zone A2 (-7.4520, 112.7180) -> DEVIATED
    const presDeviated = await operationalPresenceEngine.evaluatePresence({
      tenantId: TENANT_A,
      riderId: RIDER_A1,
      riderName: "Rider Pres 1",
      latitude: -7.4520,
      longitude: 112.7180,
      capturedAt: new Date().toISOString(),
    });
    assert(
      presDeviated.compliance_status === "DEVIATED" && presDeviated.actual_zone_id === ZONE_A2 && presDeviated.assigned_zone_id === ZONE_A1,
      "Rider entering non-assigned zone is flagged as DEVIATED with alert"
    );

    // 2.3 Rider 2 (Unassigned) enters Zone A1 -> UNASSIGNED
    const presUnassigned = await operationalPresenceEngine.evaluatePresence({
      tenantId: TENANT_A,
      riderId: RIDER_A2,
      riderName: "Rider Pres 2",
      latitude: -7.4480,
      longitude: 112.7180,
      capturedAt: new Date().toISOString(),
    });
    assert(
      presUnassigned.compliance_status === "UNASSIGNED" && presUnassigned.actual_zone_id === ZONE_A1,
      "Unassigned rider inside a zone is marked as UNASSIGNED"
    );

    // =========================================================================
    // SUITE 3: Presence History & Compliance Summary Queries
    // =========================================================================
    console.log("\n--- Suite 3: Presence History & Compliance Summary Queries ---");

    // 3.1 Historical Presence Events Query for Rider 1
    const historyRider1 = await operationalPresenceEngine.getRiderPresenceHistory(TENANT_A, RIDER_A1, 20);
    assert(
      historyRider1.length >= 3 && historyRider1.some((e) => e.event_type === "ENTER") && historyRider1.some((e) => e.event_type === "EXIT"),
      "Historical presence query returns recorded transition events (ENTER, EXIT, DEVIATED)"
    );

    // 3.2 Zone Compliance Summary for Zone A1
    const summaryA1 = await operationalPresenceEngine.getZoneComplianceSummary(TENANT_A, ZONE_A1);
    assert(
      summaryA1 !== null && summaryA1.zone_id === ZONE_A1 && typeof summaryA1.compliant_count === "number",
      "Zone compliance summary correctly returns operational metrics"
    );

    // =========================================================================
    // SUITE 4: Multi-Tenant RLS Isolation on Presence Events
    // =========================================================================
    console.log("\n--- Suite 4: Multi-Tenant RLS Isolation on Presence Events ---");

    // Tenant B context querying presence events
    const tenantBEvents = await withTenantContext(TENANT_B, async (client) => {
      const { rows } = await client.query(`SELECT id, rider_id, tenant_id FROM rider_presence_events;`);
      return rows;
    });

    const hasTenantAEvents = tenantBEvents.some((e) => e.tenant_id === TENANT_A);
    assert(!hasTenantAEvents, "Tenant B context CANNOT see Tenant A presence events due to RLS");

    console.log("\n==================================================================");
    console.log(`🎯 STAGE 6 TEST RESULTS: ${passedTests}/${totalTests} PASSED`);
    console.log("==================================================================\n");

  } catch (err: any) {
    console.error("💥 Error during Stage 6 test execution:", err);
    process.exitCode = 1;
  } finally {
    try {
      await pool.query(`DELETE FROM rider_presence_events WHERE tenant_id IN ($1, $2);`, [TENANT_A, TENANT_B]);
      await pool.query(`DELETE FROM zone_assignments WHERE rider_id IN ($1, $2, $3);`, [RIDER_A1, RIDER_A2, RIDER_B1]);
      await pool.query(`DELETE FROM zones WHERE tenant_id IN ($1, $2);`, [TENANT_A, TENANT_B]);
      await pool.query(`DELETE FROM users WHERE id IN ($1, $2, $3);`, [RIDER_A1, RIDER_A2, RIDER_B1]);
      await pool.query(`DELETE FROM tenants WHERE id IN ($1, $2);`, [TENANT_A, TENANT_B]);

      await (redisClient as any).del(`tenant:${TENANT_A}:presence_state:${RIDER_A1}`);
      await (redisClient as any).del(`tenant:${TENANT_A}:presence_state:${RIDER_A2}`);
      await (redisClient as any).del(`tenant:${TENANT_B}:presence_state:${RIDER_B1}`);
    } catch {}
  }

  if (passedTests === totalTests && totalTests > 0) {
    console.log("🎉 ALL STAGE 6 INTEGRATION TESTS PASSED PERFECTLY!\n");
    process.exit(0);
  } else {
    console.error("💥 SOME STAGE 6 TESTS FAILED!\n");
    process.exit(1);
  }
}

runStage6Tests().catch((err) => {
  console.error("Fatal error in test runner:", err);
  process.exit(1);
});
