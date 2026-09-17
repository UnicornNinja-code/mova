/*
 * test_stage5_lbs_ingestion.ts
 * Comprehensive Stage 5 Verification: High-Frequency GPS Ingestion, Spatial Presence & Redis Geospatial
 */

import { pool } from "../src/config/database.js";
import { redisClient } from "../src/config/redis.js";
import { lbsIngestionService } from "../src/services/lbs/LbsIngestionService.js";
import { redisGeoService } from "../src/services/lbs/RedisGeoService.js";
import { withTenantContext } from "../src/lib/tenantContext.js";

const TENANT_A = "test-lbs-tenant-a";
const TENANT_B = "test-lbs-tenant-b";

const RIDER_A1 = "66666666-6666-6666-6666-666666666601";
const RIDER_A2 = "66666666-6666-6666-6666-666666666602";
const RIDER_B1 = "66666666-6666-6666-6666-666666666603";

const ZONE_A1 = "77777777-7777-7777-7777-777777777701";

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

async function runStage5Tests() {
  console.log("\n==================================================================");
  console.log("🛰️  STAGE 5: GPS INGESTION, RATE THROTTLING & SPATIAL PRESENCE");
  console.log("==================================================================\n");

  try {
    // 0. Cleanup Previous Test Data
    await pool.query(`DELETE FROM rider_positions WHERE tenant_id IN ($1, $2);`, [TENANT_A, TENANT_B]);
    await pool.query(`DELETE FROM zones WHERE tenant_id IN ($1, $2);`, [TENANT_A, TENANT_B]);
    await pool.query(`DELETE FROM users WHERE id IN ($1, $2, $3);`, [RIDER_A1, RIDER_A2, RIDER_B1]);
    await pool.query(`DELETE FROM tenants WHERE id IN ($1, $2);`, [TENANT_A, TENANT_B]);
    await redisGeoService.removeRiderLocation(TENANT_A, RIDER_A1);
    await redisGeoService.removeRiderLocation(TENANT_A, RIDER_A2);
    await redisGeoService.removeRiderLocation(TENANT_B, RIDER_B1);
    await (redisClient as any).del(`tenant:${TENANT_A}:rider_seq:${RIDER_A1}:dev-01`);
    await (redisClient as any).del(`tenant:${TENANT_A}:rider_throttle:${RIDER_A1}`);
    await (redisClient as any).del(`tenant:${TENANT_B}:rider_seq:${RIDER_B1}:dev-b1`);
    await (redisClient as any).del(`tenant:${TENANT_B}:rider_throttle:${RIDER_B1}`);

    // 1. Setup Test Tenants
    await pool.query(
      `INSERT INTO tenants (id, name, code, status, max_fleets, max_riders, max_zones)
       VALUES ($1, 'Tenant LBS A', 'LBS_A', 'ACTIVE', 20, 50, 10),
              ($2, 'Tenant LBS B', 'LBS_B', 'ACTIVE', 20, 50, 10)
       ON CONFLICT (id) DO NOTHING;`,
      [TENANT_A, TENANT_B]
    );

    // 2. Setup Test Riders
    await pool.query(
      `INSERT INTO users (id, tenant_id, email, username, password, name, role, is_active)
       VALUES 
         ($1, $4, 'rider1@lbsa.com', 'rider1_lbs', 'hash123', 'Rider LBS 1', 'RIDER', true),
         ($2, $4, 'rider2@lbsa.com', 'rider2_lbs', 'hash123', 'Rider LBS 2', 'RIDER', true),
         ($3, $5, 'rider1@lbsb.com', 'rider1_lbsb', 'hash123', 'Rider LBS B', 'RIDER', true)
       ON CONFLICT (id) DO NOTHING;`,
      [RIDER_A1, RIDER_A2, RIDER_B1, TENANT_A, TENANT_B]
    );

    // 3. Setup Test Zone in Tenant A (Surabaya CBD area)
    // Polygon around (-7.4470, 112.7170) to (-7.4490, 112.7190)
    const polygonGeoJson = {
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

    await withTenantContext(TENANT_A, async (client) => {
      await client.query(
        `INSERT INTO zones (id, tenant_id, name, polygon, status)
         VALUES ($1, $2, 'Zona Bisnis Pusat', $3, 'ACTIVE')
         ON CONFLICT (id) DO NOTHING;`,
        [ZONE_A1, TENANT_A, JSON.stringify(polygonGeoJson)]
      );
    });

    // =========================================================================
    // SUITE 1: Coordinate, Accuracy & Telemetry Validation
    // =========================================================================
    console.log("--- Suite 1: Coordinate, Accuracy & Telemetry Validation ---");

    // 1.1 Invalid Latitude (> 90)
    let latError = false;
    try {
      await lbsIngestionService.ingestGpsPosition(TENANT_A, RIDER_A1, "Rider LBS 1", {
        latitude: 95.0,
        longitude: 112.7183,
        accuracy_meters: 5.0,
        captured_at: new Date().toISOString(),
        device_id: "dev-01",
        sequence: 1,
      });
    } catch (err: any) {
      if (err.code === "GPS_INVALID_LATITUDE") latError = true;
    }
    assert(latError, "Rejects invalid latitude (> 90) with GPS_INVALID_LATITUDE");

    // 1.2 Invalid Longitude (< -180)
    let lonError = false;
    try {
      await lbsIngestionService.ingestGpsPosition(TENANT_A, RIDER_A1, "Rider LBS 1", {
        latitude: -7.4478,
        longitude: -185.0,
        accuracy_meters: 5.0,
        captured_at: new Date().toISOString(),
        device_id: "dev-01",
        sequence: 2,
      });
    } catch (err: any) {
      if (err.code === "GPS_INVALID_LONGITUDE") lonError = true;
    }
    assert(lonError, "Rejects invalid longitude (<-180) with GPS_INVALID_LONGITUDE");

    // 1.3 Accuracy Too Low (> 1000m)
    let accError = false;
    try {
      await lbsIngestionService.ingestGpsPosition(TENANT_A, RIDER_A1, "Rider LBS 1", {
        latitude: -7.4478,
        longitude: 112.7183,
        accuracy_meters: 1500.0,
        captured_at: new Date().toISOString(),
        device_id: "dev-01",
        sequence: 3,
      });
    } catch (err: any) {
      if (err.code === "GPS_ACCURACY_TOO_LOW") accError = true;
    }
    assert(accError, "Rejects low accuracy (> 1000m) with GPS_ACCURACY_TOO_LOW (422)");

    // =========================================================================
    // SUITE 2: Timestamp & Monotonic Anti-Replay Validation
    // =========================================================================
    console.log("\n--- Suite 2: Timestamp & Monotonic Anti-Replay Validation ---");

    // 2.1 Clock Drift in Future (> 30s)
    let futureError = false;
    try {
      const futureTime = new Date(Date.now() + 60_000).toISOString();
      await lbsIngestionService.ingestGpsPosition(TENANT_A, RIDER_A1, "Rider LBS 1", {
        latitude: -7.4478,
        longitude: 112.7183,
        accuracy_meters: 5.0,
        captured_at: futureTime,
        device_id: "dev-01",
        sequence: 4,
      });
    } catch (err: any) {
      if (err.code === "GPS_TIMESTAMP_IN_FUTURE") futureError = true;
    }
    assert(futureError, "Rejects timestamp in future (> 30s) with GPS_TIMESTAMP_IN_FUTURE");

    // 2.2 Stale Timestamp (> 5 minutes old)
    let staleError = false;
    try {
      const staleTime = new Date(Date.now() - 400_000).toISOString();
      await lbsIngestionService.ingestGpsPosition(TENANT_A, RIDER_A1, "Rider LBS 1", {
        latitude: -7.4478,
        longitude: 112.7183,
        accuracy_meters: 5.0,
        captured_at: staleTime,
        device_id: "dev-01",
        sequence: 5,
      });
    } catch (err: any) {
      if (err.code === "GPS_TIMESTAMP_STALE") staleError = true;
    }
    assert(staleError, "Rejects stale timestamp (> 5m old) with GPS_TIMESTAMP_STALE");

    // =========================================================================
    // SUITE 3: Valid Ingestion & Distance Persistence Filter
    // =========================================================================
    console.log("\n--- Suite 3: Valid Ingestion & Distance Persistence Filter ---");

    // 3.1 First Valid GPS Ingestion (Inside Zone A1)
    const pos1 = await lbsIngestionService.ingestGpsPosition(TENANT_A, RIDER_A1, "Rider LBS 1", {
      latitude: -7.4478,
      longitude: 112.7183,
      accuracy_meters: 8.5,
      altitude_meters: 18.2,
      speed_mps: 4.2,
      heading_degrees: 135.5,
      captured_at: new Date().toISOString(),
      device_id: "dev-01",
      sequence: 10,
    });

    assert(pos1.accepted === true && pos1.persisted === true, "First GPS ping is accepted and persisted to DB");
    assert(pos1.presence?.status === "ON_SITE" && pos1.presence?.zone_id === ZONE_A1, "Presence correctly evaluates ON_SITE within Zone A1");

    // 3.2 Anti-Replay / Sequence Check (sequence <= 10 should be rejected)
    let replayError = false;
    try {
      await lbsIngestionService.ingestGpsPosition(TENANT_A, RIDER_A1, "Rider LBS 1", {
        latitude: -7.4479,
        longitude: 112.7184,
        accuracy_meters: 8.0,
        captured_at: new Date().toISOString(),
        device_id: "dev-01",
        sequence: 10, // Same sequence as previous
      });
    } catch (err: any) {
      if (err.code === "GPS_SEQUENCE_REPLAY") replayError = true;
    }
    assert(replayError, "Monotonic sequence check prevents GPS replay attack (GPS_SEQUENCE_REPLAY)");

    // 3.3 Rate Limiting Throttle (Submitting immediately < 5s with higher sequence)
    let rateLimitError = false;
    try {
      await lbsIngestionService.ingestGpsPosition(TENANT_A, RIDER_A1, "Rider LBS 1", {
        latitude: -7.4479,
        longitude: 112.7184,
        accuracy_meters: 8.0,
        captured_at: new Date().toISOString(),
        device_id: "dev-01",
        sequence: 11,
      });
    } catch (err: any) {
      if (err.code === "GPS_RATE_LIMITED") rateLimitError = true;
    }
    assert(rateLimitError, "Rapid GPS ingestion within 5s throttle window is rate limited (GPS_RATE_LIMITED)");

    // 3.4 Distance Filter Simulation (< 5 meters movement)
    // Clear throttle key to simulate passage of 5 seconds
    const throttleKey = `tenant:${TENANT_A}:rider_throttle:${RIDER_A1}`;
    await (redisClient as any).del(throttleKey);
    await redisGeoService.setLastPosition(TENANT_A, RIDER_A1, -7.447800, 112.718300);

    // Ingest location moved only 1 meter (-7.447800, 112.718300 -> -7.447809, 112.718300 ~ 1 meter)
    const posFiltered = await lbsIngestionService.ingestGpsPosition(TENANT_A, RIDER_A1, "Rider LBS 1", {
      latitude: -7.447809,
      longitude: 112.718300,
      accuracy_meters: 5.0,
      captured_at: new Date().toISOString(),
      device_id: "dev-01",
      sequence: 12,
    });

    assert(
      posFiltered.accepted === true && posFiltered.persisted === false && posFiltered.filter === "DISTANCE",
      "Distance filter skips DB persistence when movement < 5m (accepted: true, persisted: false)"
    );

    // =========================================================================
    // SUITE 4: Multi-Tenant Redis Geospatial & PostGIS RLS Isolation
    // =========================================================================
    console.log("\n--- Suite 4: Multi-Tenant Redis Geospatial & PostGIS RLS Isolation ---");

    // Ingest position for Tenant B rider at the exact same coordinates
    const posB = await lbsIngestionService.ingestGpsPosition(TENANT_B, RIDER_B1, "Rider LBS B", {
      latitude: -7.4478,
      longitude: 112.7183,
      accuracy_meters: 6.0,
      captured_at: new Date().toISOString(),
      device_id: "dev-b1",
      sequence: 1,
    });
    assert(posB.accepted === true, "Tenant B rider GPS ingested successfully");

    // Query Nearby Riders for Tenant A (radius 5km around -7.4478, 112.7183)
    const nearbyTenantA = await redisGeoService.getNearbyRiders({
      tenantId: TENANT_A,
      lat: -7.4478,
      lon: 112.7183,
      radiusKm: 5,
    });

    const tenantAHasRiderB = nearbyTenantA.riders.some((r: any) => r.rider_id === RIDER_B1);
    assert(!tenantAHasRiderB, "Tenant A proximity query CANNOT see Tenant B riders in Redis");

    // PostgreSQL RLS isolation check on rider_positions
    const tenantBPositions = await withTenantContext(TENANT_B, async (client) => {
      const { rows } = await client.query(`SELECT id, rider_id, tenant_id FROM rider_positions;`);
      return rows;
    });

    const tenantBHasTenantAPos = tenantBPositions.some((p) => p.tenant_id === TENANT_A);
    assert(!tenantBHasTenantAPos, "PostgreSQL RLS prevents Tenant B from querying Tenant A rider positions");

    console.log("\n==================================================================");
    console.log(`🎯 STAGE 5 TEST RESULTS: ${passedTests}/${totalTests} PASSED`);
    console.log("==================================================================\n");

  } catch (err: any) {
    console.error("💥 Error during Stage 5 test execution:", err);
    process.exitCode = 1;
  } finally {
    try {
      await pool.query(`DELETE FROM rider_positions WHERE tenant_id IN ($1, $2);`, [TENANT_A, TENANT_B]);
      await pool.query(`DELETE FROM zones WHERE tenant_id IN ($1, $2);`, [TENANT_A, TENANT_B]);
      await pool.query(`DELETE FROM users WHERE id IN ($1, $2, $3);`, [RIDER_A1, RIDER_A2, RIDER_B1]);
      await pool.query(`DELETE FROM tenants WHERE id IN ($1, $2);`, [TENANT_A, TENANT_B]);
      await redisGeoService.removeRiderLocation(TENANT_A, RIDER_A1);
      await redisGeoService.removeRiderLocation(TENANT_A, RIDER_A2);
      await redisGeoService.removeRiderLocation(TENANT_B, RIDER_B1);
      await (redisClient as any).del(`tenant:${TENANT_A}:rider_seq:${RIDER_A1}:dev-01`);
      await (redisClient as any).del(`tenant:${TENANT_A}:rider_throttle:${RIDER_A1}`);
      await (redisClient as any).del(`tenant:${TENANT_B}:rider_seq:${RIDER_B1}:dev-b1`);
      await (redisClient as any).del(`tenant:${TENANT_B}:rider_throttle:${RIDER_B1}`);
    } catch {}
  }

  if (passedTests === totalTests && totalTests > 0) {
    console.log("🎉 ALL STAGE 5 INTEGRATION TESTS PASSED PERFECTLY!\n");
    process.exit(0);
  } else {
    console.error("💥 SOME STAGE 5 TESTS FAILED!\n");
    process.exit(1);
  }
}

runStage5Tests().catch((err) => {
  console.error("Fatal error in test runner:", err);
  process.exit(1);
});
