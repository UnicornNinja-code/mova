/*
 * test-b11-operational-execution-and-lbs.js
 * End-to-End Verification Test Suite for Milestone B-11:
 * - Operational Sessions & State Machine (CLAIMED -> CHECKED_IN -> OPERATING -> CHECKED_OUT -> COMPLETED)
 * - Armada 5-Minute Hold & Claim Locks
 * - PostGIS ST_Covers Spatial Check-In & Boundary Validation
 * - LBS GPS Telemetry Ingestion (latest_rider_positions vs rider_telemetry_logs vs rider_zone_logs)
 * - Multi-dimensional Spatial Compliance (Zone Compliance vs Road Restriction Alert)
 * - Field Sales Logging with Provenance & Server-Side Pricing
 * - Session Checkout, Fleet Return, and Invariant Security Constraints
 */

import { pool } from "../config/database.js";
import { operationalSessionRepository } from "../repositories/operationalSessionRepository.js";
import { riderOperationalRepository } from "../repositories/riderOperationalRepository.js";
import { riderOperationalService } from "../services/rider/RiderOperationalService.js";
import { lbsGeofenceService } from "../services/lbs/LbsGeofenceService.js";
import { distributionRepository } from "../repositories/distributionRepository.js";
import { zoneRepository } from "../repositories/zoneRepository.js";
import { armadaRepository } from "../repositories/armadaRepository.js";
import { productRepository } from "../repositories/productRepository.js";
import bcrypt from "bcrypt";

let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failedCount++;
  }
}

async function runTests() {
  console.log("================================================================================");
  console.log("🚀 STARTING MILESTONE B-11 COMPREHENSIVE VERIFICATION TEST SUITE");
  console.log("================================================================================\n");

  const timestamp = Date.now();
  let testUser1 = null;
  let testUser2 = null;
  let testZone1 = null;
  let testZone2 = null;
  let testArmada1 = null;
  let testProduct1 = null;
  let testRoad1 = null;
  let testAssignment1 = null;

  try {
    // -------------------------------------------------------------------------
    // SETUP: Test Fixtures
    // -------------------------------------------------------------------------
    console.log("📦 1. Setting up Test Fixtures (Users, Zones, Armadas, Products, Roads)...");

    // Pre-cleanup any leftover fixtures
    await pool.query("DELETE FROM protocol_roads WHERE external_id LIKE 'road_%';");
    await pool.query("DELETE FROM zones WHERE name LIKE 'Zona B11%';");
    await pool.query("DELETE FROM armadas WHERE code LIKE 'B11-UNIT-%';");
    await pool.query("DELETE FROM products WHERE name LIKE 'Kopi Susu Aren B11%';");
    await pool.query("DELETE FROM users WHERE email LIKE 'rider_b11_%';");

    const passwordHash = await bcrypt.hash("password123", 10);

    // Create 2 Test Riders
    const userRes1 = await pool.query(`
      INSERT INTO users (name, email, username, password, role, is_active)
      VALUES ('Rider B11 Alpha', 'rider_b11_a_${timestamp}@mova.test', 'rider_b11_a_${timestamp}', '${passwordHash}', 'RIDER', true)
      RETURNING *;
    `);
    testUser1 = userRes1.rows[0];

    const userRes2 = await pool.query(`
      INSERT INTO users (name, email, username, password, role, is_active)
      VALUES ('Rider B11 Beta', 'rider_b11_b_${timestamp}@mova.test', 'rider_b11_b_${timestamp}', '${passwordHash}', 'RIDER', true)
      RETURNING *;
    `);
    testUser2 = userRes2.rows[0];

    // Create Zone 1 (Alun-Alun Polygon approx [112.716, -7.446] to [112.721, -7.451])
    const zonePolygon1 = [
      [112.716, -7.446],
      [112.721, -7.446],
      [112.721, -7.451],
      [112.716, -7.451],
      [112.716, -7.446],
    ];
    const zoneRes1 = await pool.query(`
      INSERT INTO zones (name, description, max_capacity, status, polygon, geom)
      VALUES (
        'Zona B11 Primary ${timestamp}',
        'Zona Pengujian B11',
        3,
        'ACTIVE',
        '${JSON.stringify(zonePolygon1)}'::jsonb,
        ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[112.716,-7.446],[112.721,-7.446],[112.721,-7.451],[112.716,-7.451],[112.716,-7.446]]]}'), 4326)
      )
      RETURNING *;
    `);
    testZone1 = zoneRes1.rows[0];

    // Create Zone 2 (Secondary Zone [112.725, -7.446] to [112.730, -7.451])
    const zonePolygon2 = [
      [112.725, -7.446],
      [112.730, -7.446],
      [112.730, -7.451],
      [112.725, -7.451],
      [112.725, -7.446],
    ];
    const zoneRes2 = await pool.query(`
      INSERT INTO zones (name, description, max_capacity, status, polygon, geom)
      VALUES (
        'Zona B11 Secondary ${timestamp}',
        'Zona Pengujian B11 Deviasi',
        3,
        'ACTIVE',
        '${JSON.stringify(zonePolygon2)}'::jsonb,
        ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[112.725,-7.446],[112.730,-7.446],[112.730,-7.451],[112.725,-7.451],[112.725,-7.446]]]}'), 4326)
      )
      RETURNING *;
    `);
    testZone2 = zoneRes2.rows[0];

    // Create Test Armada
    const armadaRes = await pool.query(`
      INSERT INTO armadas (code, type, status)
      VALUES ('B11-UNIT-${timestamp.toString().slice(-4)}', 'GEROBAK', 'ACTIVE')
      RETURNING *;
    `);
    testArmada1 = armadaRes.rows[0];

    // Create Test Product
    const productRes = await pool.query(`
      INSERT INTO products (name, description, price, status)
      VALUES ('Kopi Susu Aren B11', 'Menu pengujian field sales', 15000.00, 'AVAILABLE')
      RETURNING *;
    `);
    testProduct1 = productRes.rows[0];

    // Create Test Prohibited Road near (112.7185, -7.4485)
    const roadRes = await pool.query(`
      INSERT INTO protocol_roads (external_id, name, highway_type, restriction_type, geom)
      VALUES (
        'road_${timestamp}',
        'Jl. Protokol Terlarang B11',
        'trunk',
        'PROHIBITED_ROAD',
        ST_SetSRID(ST_GeomFromGeoJSON('{"type":"LineString","coordinates":[[112.7180,-7.4485],[112.7190,-7.4485]]}'), 4326)
      )
      RETURNING *;
    `);
    testRoad1 = roadRes.rows[0];

    assert(testUser1 && testUser2, "Test riders created successfully");
    assert(testZone1 && testZone2, "Test zones with PostGIS geom created successfully");
    assert(testArmada1 && testProduct1 && testRoad1, "Armada, Product, and Restricted Road created successfully");

    // -------------------------------------------------------------------------
    // TEST SUITE 1: Assignment to Operational Session Lifecycle
    // -------------------------------------------------------------------------
    console.log("\n📋 2. Testing Assignment to Operational Session Lifecycle...");

    testAssignment1 = await distributionRepository.createAssignment({
      riderId: testUser1.id,
      zoneId: testZone1.id,
      assignedBy: testUser1.id,
      assignmentType: "AUTO",
      assignmentDate: new Date().toISOString().split("T")[0],
      topsisRank: 1,
      preferenceScore: 0.854,
    });
    assert(testAssignment1 && testAssignment1.id, "Assignment created in zone_assignments with TOPSIS rank #1");

    // Fetch active session
    const sessionRes1 = await riderOperationalService.getRiderActiveSession(testUser1.id);
    assert(sessionRes1.has_active_session === true, "Rider active session resolved successfully");
    assert(sessionRes1.session.assignment_id === testAssignment1.id, "Session links directly to assignment ID");
    assert(sessionRes1.session.zone_name === testZone1.name, "Session contains assigned zone details");

    // -------------------------------------------------------------------------
    // TEST SUITE 2: Armada 5-Minute Hold Lock and Claim
    // -------------------------------------------------------------------------
    console.log("\n🔒 3. Testing Armada 5-Minute Ticket-Booking Hold and Claim...");

    // Rider 1 holds armada
    const holdRes = await riderOperationalService.inspectAndHoldArmada({
      riderId: testUser1.id,
      armadaId: testArmada1.id,
    });
    assert(holdRes.armada.status === "RESERVED", "Armada status changed to RESERVED on hold");
    assert(holdRes.armada.reserved_by_rider_id === testUser1.id, "Armada reserved_by_rider_id matches Rider 1");

    // Rider 2 attempts to hold same armada -> Must be rejected (400)
    let holdConflictCaught = false;
    try {
      await riderOperationalService.inspectAndHoldArmada({
        riderId: testUser2.id,
        armadaId: testArmada1.id,
      });
    } catch (e) {
      holdConflictCaught = true;
      assert(e.statusCode === 400, "Second rider hold attempt rejected with 400 Bad Request");
    }
    assert(holdConflictCaught, "Row-level lock prevents concurrent hold on same armada unit");

    // Rider 1 confirms claim
    const claimRes = await riderOperationalService.confirmArmadaClaim({
      riderId: testUser1.id,
      armadaId: testArmada1.id,
    });
    assert(claimRes.armada.status === "IN_USE", "Armada status becomes IN_USE permanently");
    assert(claimRes.armada.current_rider_id === testUser1.id, "Armada bound to Rider 1");

    // Verify session updated with claimed armada
    const sessionAfterClaim = await riderOperationalService.getRiderActiveSession(testUser1.id);
    assert(sessionAfterClaim.session.armada_id === testArmada1.id, "Operational session updated with armada_id");

    // -------------------------------------------------------------------------
    // TEST SUITE 3: PostGIS ST_Covers Spatial Check-In
    // -------------------------------------------------------------------------
    console.log("\n📍 4. Testing PostGIS ST_Covers Spatial Check-In...");

    // Attempt Check-In OUTSIDE Zone (e.g. lon 112.750, lat -7.500)
    let outsideCheckInCaught = false;
    try {
      await riderOperationalService.checkInToZone({
        riderId: testUser1.id,
        lat: -7.500,
        lon: 112.750,
      });
    } catch (e) {
      outsideCheckInCaught = true;
      assert(e.statusCode === 400, "Out-of-zone check-in rejected with 400");
      assert(e.message.includes("di luar batas polygon"), "Rejection message informs rider to enter assigned zone");
    }
    assert(outsideCheckInCaught, "Spatial check-in strictly enforces boundary check");

    // Successful Check-In INSIDE Zone Centroid (lon 112.7185, lat -7.4485)
    const checkInRes = await riderOperationalService.checkInToZone({
      riderId: testUser1.id,
      lat: -7.4485,
      lon: 112.7185,
    });
    assert(checkInRes.check_in.status === "OPERATING", "Session explicitly transitions to OPERATING upon check-in");
    assert(checkInRes.check_in.zone_name === testZone1.name, "Check-in matches assigned zone name");
    assert(checkInRes.check_in.check_in_lat === -7.4485, "check_in_lat recorded in database");
    assert(checkInRes.check_in.check_in_lon === 112.7185, "check_in_lon recorded in database");

    // Verify PostgreSQL state
    const sessionDbCheck = await operationalSessionRepository.findSessionById(sessionRes1.session.session_id);
    assert(sessionDbCheck.status === "OPERATING", "Database operational_sessions table has status OPERATING");
    assert(sessionDbCheck.checked_in_at !== null, "checked_in_at timestamp recorded");

    // -------------------------------------------------------------------------
    // TEST SUITE 4: LBS GPS Telemetry Ingestion & Invariance
    // -------------------------------------------------------------------------
    console.log("\n📡 5. Testing LBS GPS Ingestion, Telemetry History & Discrete Geofence Logs...");

    // Validation: Invalid latitude/longitude
    let invalidGpsCaught = false;
    try {
      await lbsGeofenceService.processRiderGpsPing({
        riderId: testUser1.id,
        latitude: 105.0, // Invalid lat > 90
        longitude: 112.7185,
      });
    } catch (e) {
      invalidGpsCaught = true;
      assert(e.statusCode === 400, "Invalid latitude rejected with 400");
    }
    assert(invalidGpsCaught, "GPS ingestion enforces strict coordinate validation");

    // Validation: Rider without active session is gracefully accepted with session_id: null
    const unassignedPing = await lbsGeofenceService.processRiderGpsPing({
      riderId: testUser2.id,
      latitude: -7.4485,
      longitude: 112.7185,
    });
    assert(unassignedPing.session_id === null, "Rider without active session has session_id: null");
    assert(unassignedPing.location.latitude === -7.4485, "Telemetry coordinates recorded for unassigned rider");

    // Ping #1: Inside Assigned Zone (COMPLIANT)
    const ping1 = await lbsGeofenceService.processRiderGpsPing({
      riderId: testUser1.id,
      latitude: -7.4485,
      longitude: 112.7185,
      speed: 10.5,
      heading: 90,
      recorded_at: new Date().toISOString(),
    });
    assert(ping1.compliance.zone_compliance === "COMPLIANT", "Ping #1 inside assigned zone is COMPLIANT");
    assert(ping1.geofence.is_inside_zone === true, "is_inside_zone is true");
    assert(ping1.geofence.event_type === "ENTER", "Discrete geofence event is ENTER");

    // Verify latest_rider_positions SSOT
    const livePos1 = (await lbsGeofenceService.getLiveRiderPositions()).find((r) => r.rider_id === testUser1.id);
    assert(livePos1.zone_compliance === "COMPLIANT", "latest_rider_positions stores COMPLIANT status");
    assert(livePos1.latitude === -7.4485, "latest_rider_positions stores latest latitude");

    // Ping #2: Second Ping at Same Compliant Position (Continuous Telemetry vs Discrete State)
    const ping2 = await lbsGeofenceService.processRiderGpsPing({
      riderId: testUser1.id,
      latitude: -7.4486,
      longitude: 112.7186,
      speed: 12.0,
      heading: 95,
    });
    assert(ping2.compliance.zone_compliance === "COMPLIANT", "Ping #2 remains COMPLIANT");
    assert(ping2.geofence.event_type === "NONE", "Discrete event is NONE (No redundant ENTER log created)");

    // Ping #3: Moved into Zone 2 (DEVIATED)
    const ping3 = await lbsGeofenceService.processRiderGpsPing({
      riderId: testUser1.id,
      latitude: -7.4485,
      longitude: 112.7275, // Inside Zone 2
      speed: 15.0,
      heading: 180,
    });
    assert(ping3.compliance.zone_compliance === "DEVIATED", "Ping #3 inside Zone 2 is DEVIATED from assigned Zone 1");
    assert(ping3.geofence.is_inside_zone === true, "is_inside_zone is true for deviated zone");
    assert(ping3.geofence.event_type === "DEVIATED_ENTER", "Discrete transition event DEVIATED_ENTER created");

    // Ping #4: Moved outside all operational zones (OUTSIDE_ZONE)
    const ping4 = await lbsGeofenceService.processRiderGpsPing({
      riderId: testUser1.id,
      latitude: -7.5000,
      longitude: 112.7500,
      speed: 20.0,
      heading: 270,
    });
    assert(ping4.compliance.zone_compliance === "OUTSIDE_ZONE", "Ping #4 outside all zones is OUTSIDE_ZONE");
    assert(ping4.geofence.event_type === "EXIT", "Discrete transition event EXIT created");

    // Verify Telemetry History Count in PostgreSQL
    const { rows: telemetryRows } = await pool.query(
      "SELECT COUNT(*)::int AS count FROM rider_telemetry_logs WHERE rider_id = $1;",
      [testUser1.id]
    );
    assert(telemetryRows[0].count === 4, "Continuous telemetry recorded all 4 GPS pings in rider_telemetry_logs");

    // -------------------------------------------------------------------------
    // TEST SUITE 5: Prohibited Road Restriction Compliance (PostGIS ST_DWithin)
    // -------------------------------------------------------------------------
    console.log("\n🚫 6. Testing Prohibited Road Restriction Spatial Detection (50m PostGIS ST_DWithin)...");

    // Ping at road coordinate (112.7185, -7.4485) -> within 10m of prohibited road
    const roadPingAlert = await lbsGeofenceService.processRiderGpsPing({
      riderId: testUser1.id,
      latitude: -7.4485,
      longitude: 112.7185,
    });
    assert(roadPingAlert.compliance.road_compliance === "PROHIBITED_ROAD_ALERT", "road_compliance is PROHIBITED_ROAD_ALERT");
    assert(roadPingAlert.road_violation.is_violating === true, "road_violation.is_violating is true");
    assert(roadPingAlert.road_violation.road_name === testRoad1.name, "road_violation identifies prohibited road name");

    // Ping far away from prohibited road (>500m away)
    const roadPingClean = await lbsGeofenceService.processRiderGpsPing({
      riderId: testUser1.id,
      latitude: -7.4461,
      longitude: 112.7161,
    });
    assert(roadPingClean.compliance.road_compliance === "NO_ROAD_ALERT", "road_compliance is NO_ROAD_ALERT when clear");
    assert(roadPingClean.road_violation.is_violating === false, "road_violation.is_violating is false");

    // -------------------------------------------------------------------------
    // TEST SUITE 6: Field Sales Recording with Provenance & Pricing Snapshot
    // -------------------------------------------------------------------------
    console.log("\n💰 7. Testing Field Sales Recording with Provenance...");

    // Record sale with quantity = 3
    const saleRes = await riderOperationalService.recordProductSale({
      riderId: testUser1.id,
      productId: testProduct1.id,
      quantity: 3,
      latitude: -7.4485,
      longitude: 112.7185,
    });
    assert(saleRes.sales_log.product_name === testProduct1.name, "Product name populated in response");
    assert(saleRes.sales_log.qty === 3, "Quantity recorded as 3");
    assert(saleRes.sales_log.unit_price === 15000.00, "Server-side unit price snapshot recorded as 15000");
    assert(saleRes.sales_log.total_price === 45000.00, "Server-side total price calculated as 45000");
    assert(saleRes.sales_log.session_id === sessionRes1.session.session_id, "Sale linked to operational session ID");
    assert(saleRes.sales_log.compliance_at_sale === "COMPLIANT", "Compliance at sale recorded as COMPLIANT");

    // Fetch personal sales history
    const mySalesRes = await riderOperationalService.getMySalesHistory({
      riderId: testUser1.id,
    });
    assert(mySalesRes.sales.length >= 1, "Rider sales history returns recorded transaction");
    assert(mySalesRes.total_revenue === 45000.00, "Total revenue calculated accurately (Rp45.000)");

    // -------------------------------------------------------------------------
    // TEST SUITE 7: Session Checkout, Armada Return & Post-Shift Invariants
    // -------------------------------------------------------------------------
    console.log("\n🏁 8. Testing Session Checkout, Armada Return, and Post-Shift Invariants...");

    const checkoutRes = await riderOperationalService.checkoutAndReturnArmada({
      riderId: testUser1.id,
      returnStatus: "ACTIVE",
      notes: "Selesai operasi hari ini, unit aman dan bersih.",
    });
    assert(checkoutRes.checkout.status === "COMPLETED", "Session status transitioned to COMPLETED");

    // Verify Armada returned to ACTIVE status in database
    const armadaCheck = await armadaRepository.findById(testArmada1.id);
    assert(armadaCheck.status === "ACTIVE", "Armada status returned to ACTIVE");
    assert(armadaCheck.current_rider_id === null, "Armada current_rider_id cleared");

    // Invariant: Rider without active session cannot record sales
    let postCheckoutSaleCaught = false;
    try {
      await riderOperationalService.recordProductSale({
        riderId: testUser1.id,
        productId: testProduct1.id,
        quantity: 1,
      });
    } catch (e) {
      postCheckoutSaleCaught = true;
      assert(e.statusCode === 400, "Sale attempt after checkout rejected with 400");
    }
    assert(postCheckoutSaleCaught, "Completed operational sessions reject new sale transactions");

    // -------------------------------------------------------------------------
    // TEST SUITE 8: LBS Monitoring & Spatial Discovery Queries
    // -------------------------------------------------------------------------
    console.log("\n🗺️ 9. Testing LBS Monitoring & Nearby Spatial Radius Search...");

    // Nearby riders search
    const nearbyRes = await lbsGeofenceService.getNearbyRiders({
      lon: 112.7185,
      lat: -7.4485,
      radiusKm: 5,
    });
    assert(nearbyRes.riders.length >= 1, "Nearby riders search found active rider in radius");
    assert(nearbyRes.riders[0].distance_km !== undefined, "Distance in km is computed via PostGIS");

    // Geofence transition logs
    const zoneLogsRes = await lbsGeofenceService.getZoneLogs({
      riderId: testUser1.id,
    });
    assert(zoneLogsRes.logs.length >= 1, "Geofence transition logs retrieved for audit trail");
    assert(zoneLogsRes.pagination.total >= 1, "Zone logs pagination total count is valid");

    console.log("\n================================================================================");
    console.log(`📊 TEST SUITE SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log("================================================================================");

    if (failedCount > 0) {
      throw new Error(`${failedCount} test assertions failed.`);
    }
  } catch (error) {
    console.error("❌ Fatal Test Failure:", error);
    process.exit(1);
  } finally {
    // CLEANUP Test Fixtures
    console.log("\n🧹 Cleaning up test fixtures...");
    try {
      if (testUser1) {
        await pool.query("DELETE FROM rider_telemetry_logs WHERE rider_id = $1;", [testUser1.id]);
        await pool.query("DELETE FROM rider_zone_logs WHERE rider_id = $1;", [testUser1.id]);
        await pool.query("DELETE FROM latest_rider_positions WHERE rider_id = $1;", [testUser1.id]);
        await pool.query("DELETE FROM sales_logs WHERE rider_id = $1;", [testUser1.id]);
        await pool.query("DELETE FROM operational_sessions WHERE rider_id = $1;", [testUser1.id]);
        await pool.query("DELETE FROM zone_assignments WHERE rider_id = $1;", [testUser1.id]);
        await pool.query("DELETE FROM users WHERE id = $1;", [testUser1.id]);
      }
      if (testUser2) {
        await pool.query("DELETE FROM users WHERE id = $1;", [testUser2.id]);
      }
      if (testArmada1) {
        await pool.query("DELETE FROM armadas WHERE id = $1;", [testArmada1.id]);
      }
      if (testProduct1) {
        await pool.query("DELETE FROM products WHERE id = $1;", [testProduct1.id]);
      }
      if (testRoad1) {
        await pool.query("DELETE FROM protocol_roads WHERE id = $1;", [testRoad1.id]);
      }
      if (testZone1) {
        await pool.query("DELETE FROM zones WHERE id = $1;", [testZone1.id]);
      }
      if (testZone2) {
        await pool.query("DELETE FROM zones WHERE id = $1;", [testZone2.id]);
      }
      console.log("✅ Cleanup completed.");
    } catch (cleanErr) {
      console.warn("⚠️ Cleanup warning:", cleanErr.message);
    }
    process.exit(failedCount > 0 ? 1 : 0);
  }
}

runTests();
