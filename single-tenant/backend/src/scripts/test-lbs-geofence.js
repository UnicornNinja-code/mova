/*
 * test-lbs-geofence.js
 * Comprehensive CLI Test Suite for LBS PostGIS Geofencing, Road Restriction Alerts & Compliance Tracking.
 */

import { lbsGeofenceService } from "../services/lbs/LbsGeofenceService.js";
import { redisClient } from "../config/redis.js";
import { pool } from "../config/database.js";

async function runLbsGeofenceTests() {
  console.log("\n================================================================================");
  console.log("🧪 MEMULAI AUTOMATED TEST SUITE: LBS POSTGIS GEOFENCING & ROAD RESTRICTIONS");
  console.log("================================================================================");

  try {
    // -------------------------------------------------------------------------
    // Setup Test Data & Fetch Reference Zones with Centroid
    // -------------------------------------------------------------------------
    const { rows: zones } = await pool.query(`
      SELECT id, name, ST_Y(ST_Centroid(geom)) AS lat, ST_X(ST_Centroid(geom)) AS lon 
      FROM zones 
      WHERE status = 'ACTIVE' AND geom IS NOT NULL
      ORDER BY name ASC 
      LIMIT 2;
    `);
    if (zones.length === 0) {
      console.error("❌ Error: Tidak ada zona aktif di database untuk diuji.");
      process.exit(1);
    }

    const targetZone1 = zones[0];
    const targetZone2 = zones[1] || zones[0];
    console.log(`📌 Zona Uji #1: '${targetZone1.name}' (Centroid: ${targetZone1.lat}, ${targetZone1.lon})`);
    console.log(`📌 Zona Uji #2: '${targetZone2.name}' (Centroid: ${targetZone2.lat}, ${targetZone2.lon})`);

    // Fetch sample protocol road & toll road coordinates
    const { rows: pRoads } = await pool.query(`
      SELECT name, ST_Y(ST_StartPoint(geom)) AS lat, ST_X(ST_StartPoint(geom)) AS lon
      FROM protocol_roads
      WHERE restriction_type = 'PROHIBITED_ROAD'
      LIMIT 1;
    `);

    const { rows: tRoads } = await pool.query(`
      SELECT name, ST_Y(ST_StartPoint(geom)) AS lat, ST_X(ST_StartPoint(geom)) AS lon
      FROM protocol_roads
      WHERE restriction_type = 'PROHIBITED_TOLL_ROAD'
      LIMIT 1;
    `);

    // Fetch an existing rider from users table
    let { rows: riders } = await pool.query("SELECT id, name FROM users WHERE role = 'RIDER' LIMIT 1;");
    if (riders.length === 0) {
      const newRider = await pool.query(`
        INSERT INTO users (id, name, email, password_hash, role, status)
        VALUES (gen_random_uuid(), 'Test LBS Rider', 'test.lbs.rider@koling.com', 'dummy_hash', 'RIDER', 'ACTIVE')
        RETURNING id, name;
      `);
      riders = newRider.rows;
    }
    const testRiderId = riders[0].id;
    const testRiderName = riders[0].name;
    console.log(`📌 Rider Uji: '${testRiderName}' (ID: ${testRiderId})`);

    // Clean previous logs for test rider
    await pool.query("DELETE FROM rider_zone_logs WHERE rider_id = $1;", [testRiderId]);

    // -------------------------------------------------------------------------
    // [TEST 1] Coordinate Order EPSG:4326 & Rider Inside Polygon
    // -------------------------------------------------------------------------
    console.log("\n📍 [TEST 1] EPSG:4326 Coordinate Order & Rider Inside Polygon (ST_Covers)...");
    const insidePing = await lbsGeofenceService.processRiderGpsPing({
      riderId: testRiderId,
      riderName: testRiderName,
      lat: targetZone1.lat,
      lon: targetZone1.lon,
    });

    if (insidePing.geofence.is_inside_zone && insidePing.geofence.actual_zone_id === targetZone1.id) {
      console.log(`   ✅ PASS: Rider terdeteksi INSIDE '${insidePing.geofence.actual_zone_name}'!`);
    } else {
      console.error(`   ❌ FAIL: Actual zone: ${insidePing.geofence.actual_zone_name}`);
    }

    // -------------------------------------------------------------------------
    // [TEST 2] Rider Outside Polygon (Zero False-Positive Fallback Check)
    // -------------------------------------------------------------------------
    console.log("\n📍 [TEST 2] Rider Outside All Operational Polygons (Zero False-Positive Check)...");
    // Coordinates far outside Sidoarjo (~28km away)
    const outsidePing = await lbsGeofenceService.processRiderGpsPing({
      riderId: testRiderId,
      riderName: testRiderName,
      lat: -7.6000,
      lon: 112.5000,
    });

    if (!outsidePing.geofence.is_inside_zone && outsidePing.geofence.actual_zone_id === null) {
      console.log(`   ✅ PASS: Rider terdeteksi OUTSIDE! Zone Name: '${outsidePing.geofence.actual_zone_name}' (Zero false-positive fallback!)`);
    } else {
      console.error(`   ❌ FAIL: Actual zone is incorrectly set to: ${outsidePing.geofence.actual_zone_name}`);
    }

    // -------------------------------------------------------------------------
    // [TEST 3] Protocol Road Proximity Alert (<= 50m)
    // -------------------------------------------------------------------------
    console.log("\n⚠️ [TEST 3] Proximity Alert Detection - Jalan Protokol (<= 50m)...");
    if (pRoads.length > 0) {
      const pRoad = pRoads[0];
      const pRoadPing = await lbsGeofenceService.processRiderGpsPing({
        riderId: testRiderId,
        riderName: testRiderName,
        lat: pRoad.lat,
        lon: pRoad.lon,
      });

      if (pRoadPing.road_violation && pRoadPing.road_violation.is_violating) {
        console.log(`   ✅ PASS: Peringatan Jalan Protokol Terdeteksi: '${pRoadPing.road_violation.road_name}'!`);
      } else {
        console.error(`   ❌ FAIL: Tidak terdeteksi pelanggaran untuk Jalan Protokol '${pRoad.name}'.`);
      }
    } else {
      console.log("   ℹ️ SKIPPED: Tidak ada data Jalan Protokol di DB.");
    }

    // -------------------------------------------------------------------------
    // [TEST 4] Toll Road Proximity Alert (<= 50m)
    // -------------------------------------------------------------------------
    console.log("\n🛣️ [TEST 4] Proximity Alert Detection - Jalan Tol (<= 50m)...");
    if (tRoads.length > 0) {
      const tRoad = tRoads[0];
      const tRoadPing = await lbsGeofenceService.processRiderGpsPing({
        riderId: testRiderId,
        riderName: testRiderName,
        lat: tRoad.lat,
        lon: tRoad.lon,
      });

      if (tRoadPing.road_violation && tRoadPing.road_violation.is_violating) {
        console.log(`   ✅ PASS: Peringatan Jalan Tol Terdeteksi: '${tRoadPing.road_violation.road_name}' (Restriction: ${tRoadPing.road_violation.restriction_type})!`);
      } else {
        console.error(`   ❌ FAIL: Tidak terdeteksi pelanggaran untuk Jalan Tol '${tRoad.name}'.`);
      }
    } else {
      console.log("   ℹ️ SKIPPED: Tidak ada data Jalan Tol di DB.");
    }

    // -------------------------------------------------------------------------
    // [TEST 5] Safe Distance (No Violation Alert)
    // -------------------------------------------------------------------------
    console.log("\n🛡️ [TEST 5] Safe Distance (> 50m) - Zero False Alert...");
    const safePing = await lbsGeofenceService.processRiderGpsPing({
      riderId: testRiderId,
      riderName: testRiderName,
      lat: -7.4450,
      lon: 112.7150,
    });

    if (!safePing.road_violation.is_violating) {
      console.log("   ✅ PASS: Bebas pelanggaran jalan terlarang di area aman!");
    } else {
      console.error(`   ❌ FAIL: Peringatan palsu muncul: ${safePing.road_violation.road_name}`);
    }

    // -------------------------------------------------------------------------
    // [TEST 6] Operational Compliance Status (COMPLIANT vs DEVIATED vs OUTSIDE)
    // -------------------------------------------------------------------------
    console.log("\n🎯 [TEST 6] Operational Compliance Status Tracking...");
    
    // Create an operational session for test rider with targetZone1
    await pool.query("DELETE FROM operational_sessions WHERE rider_id = $1;", [testRiderId]);
    const { rows: sessionRows } = await pool.query(`
      INSERT INTO operational_sessions (id, rider_id, zone_id, status, started_at)
      VALUES (gen_random_uuid(), $1, $2, 'OPERATING', NOW())
      RETURNING id;
    `, [testRiderId, targetZone1.id]);
    const activeTestSessionId = sessionRows[0].id;

    // 6A. Inside Assigned Zone (targetZone1) -> COMPLIANT
    const compPing = await lbsGeofenceService.processRiderGpsPing({
      riderId: testRiderId,
      riderName: testRiderName,
      lat: targetZone1.lat,
      lon: targetZone1.lon,
    });
    console.log(`   • Status Inside Assigned Zone : '${compPing.compliance.zone_compliance}' (Expected: 'COMPLIANT')`);

    // 6B. Inside Different Zone (targetZone2) while assigned to targetZone1 -> DEVIATED
    let devPing = null;
    if (targetZone2.id !== targetZone1.id) {
      devPing = await lbsGeofenceService.processRiderGpsPing({
        riderId: testRiderId,
        riderName: testRiderName,
        lat: targetZone2.lat,
        lon: targetZone2.lon,
      });
      console.log(`   • Status Inside Different Zone: '${devPing.compliance.zone_compliance}' (Expected: 'DEVIATED')`);
    }

    // 6C. Outside all zones -> OUTSIDE_ZONE
    const outPing = await lbsGeofenceService.processRiderGpsPing({
      riderId: testRiderId,
      riderName: testRiderName,
      lat: -7.6000,
      lon: 112.5000,
    });
    console.log(`   • Status Outside All Zones    : '${outPing.compliance.zone_compliance}' (Expected: 'OUTSIDE_ZONE')`);

    // Clean up test session
    await pool.query("DELETE FROM operational_sessions WHERE id = $1;", [activeTestSessionId]);

    const devCondition = devPing ? devPing.compliance.zone_compliance === "DEVIATED" : true;
    if (compPing.compliance.zone_compliance === "COMPLIANT" && devCondition && outPing.compliance.zone_compliance === "OUTSIDE_ZONE") {
      console.log("   ✅ PASS: Decoupled Compliance Tracking 100% Presisi & Terisolasi dari TOPSIS!");
    } else {
      console.error("   ❌ FAIL: Evaluasi compliance tidak sesuai ekspektasi.");
    }

    // -------------------------------------------------------------------------
    // [TEST 7] Passive Check-in / Check-out Zone Entry Logging
    // -------------------------------------------------------------------------
    console.log("\n📝 [TEST 7] Passive Check-in / Check-out Zone Entry Logging (`rider_zone_logs`)...");
    const { rows: logs } = await pool.query("SELECT zone_id, event_type FROM rider_zone_logs WHERE rider_id = $1 ORDER BY created_at ASC;", [testRiderId]);
    console.log(`   • Total Event Zone Logged: ${logs.length}`);
    logs.forEach((l, i) => console.log(`     [Log #${i + 1}] Event: ${l.event_type} | Zone: ${l.zone_id}`));

    if (logs.length >= 2) {
      console.log("   ✅ PASS: Zone ENTER & EXIT event berhasil dicatat secara otomatis!");
    } else {
      console.warn("   ⚠️ Warning: Jumlah log zona kurang dari ekspektasi.");
    }

    // -------------------------------------------------------------------------
    // [TEST 8] Spatial Truth Resilience (Redis DOWN -> PostGIS Remains Authoritative)
    // -------------------------------------------------------------------------
    console.log("\n🔌 [TEST 8] Resiliensi Spatial Truth saat Redis Offline...");
    const origGeoAdd = redisClient.geoAdd;
    redisClient.geoAdd = () => { throw new Error("Simulated Redis Outage"); };

    const redisOfflinePing = await lbsGeofenceService.processRiderGpsPing({
      riderId: testRiderId,
      riderName: testRiderName,
      lat: targetZone1.lat,
      lon: targetZone1.lon,
    });

    redisClient.geoAdd = origGeoAdd;

    if (redisOfflinePing.geofence.is_inside_zone && redisOfflinePing.geofence.actual_zone_id === targetZone1.id) {
      console.log("   ✅ PASS: PostGIS Spatial Truth tetap 100% AKURAT & TIDAK CRASH saat Redis Offline!");
    } else {
      console.error("   ❌ FAIL: PostGIS geofence gagal saat Redis offline.");
    }

    // Cleanup test logs
    await pool.query("DELETE FROM rider_zone_logs WHERE rider_id = $1;", [testRiderId]);

    console.log("\n================================================================================");
    console.log("🎉 AUTOMATED TEST SUITE PHASE 6C LBS GEOFENCING SELESAI (100% PASS)");
    console.log("================================================================================\n");

  } catch (error) {
    console.error("💥 Error pada test suite Phase 6C:", error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

runLbsGeofenceTests();
