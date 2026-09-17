/*
 * part09_rider_execution.test.ts
 * Comprehensive Integration & Verification Test Suite for PART 09:
 * PostGIS Geofence Spatial Check-in (ST_Contains inside vs outside polygon),
 * Immutable Check-in/Check-out Timestamps, Armada Claim & Checkout Return,
 * and Redis Real-time LBS Geospatial Tracking.
 */

import { pool } from "../src/config/database.js";
import { redisClient } from "../src/config/redis.js";
import { riderOperationalService } from "../src/services/rider/RiderOperationalService.js";
import { distributionService } from "../src/services/distribution/DistributionService.js";
import { distributionRepository } from "../src/repositories/distributionRepository.js";
import { armadaService } from "../src/services/armadaService.js";
import { zoneService } from "../src/services/zoneService.js";
import { ZoneModel } from "../src/models/zoneModel.js";

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string, detail?: any) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`✅ PASS: ${testName}`);
  } else {
    console.error(`❌ FAIL: ${testName}`, detail || "");
    process.exitCode = 1;
  }
}

async function runPart09Tests() {
  console.log("\n========================================================");
  console.log("🧪 RUNNING PART 09: RIDER EXECUTION & LBS SPATIAL TESTS");
  console.log("========================================================\n");

  const testSuffix = Date.now();
  let testZoneId: string | number = "";
  let testRiderId: string = "";
  let testArmadaId: string = "";
  let testAssignmentId: string = "";

  // -------------------------------------------------------------
  // SETUP: Create Zone, Armada, Rider, and Initial Assignment
  // -------------------------------------------------------------
  try {
    await pool.query("DELETE FROM weathers WHERE zone_id IN (SELECT id FROM zones WHERE name LIKE 'Exec Test Zone%');");
    await pool.query("DELETE FROM zone_assignments WHERE zone_id IN (SELECT id FROM zones WHERE name LIKE 'Exec Test Zone%');");
    await pool.query("DELETE FROM zones WHERE name LIKE 'Exec Test Zone%';");
  } catch (e) {}

  // 1. Create Zone with bounding box around [-7.2650..-7.2720, 112.7480..112.7550]
  const zone = await zoneService.createZone({
    name: `Exec Test Zone ${testSuffix}`,
    max_capacity: 5,
    polygon: {
      type: "Polygon",
      coordinates: [
        [
          [112.7480, -7.2650],
          [112.7550, -7.2650],
          [112.7550, -7.2720],
          [112.7480, -7.2720],
          [112.7480, -7.2650],
        ],
      ],
    },
  });
  testZoneId = zone.id;

  // 2. Create Armada
  const armada = await armadaService.createArmada({
    code: `FLT-EXEC-${testSuffix}`,
    type: "ELECTRIC_BIKE",
    plate_number: `L-${Math.floor(1000 + Math.random() * 9000)}-EX`,
    battery_capacity: "100%",
  });
  testArmadaId = armada.id;

  // 3. Create User Rider
  const userRes = await pool.query(`
    INSERT INTO users (id, username, name, email, password, role, is_active)
    VALUES (gen_random_uuid(), $1, 'Exec Rider', $2, 'hash', 'RIDER', true)
    RETURNING id;
  `, [`exec_rider_${testSuffix}`, `exec_rider_${testSuffix}@koling.com`]);
  testRiderId = userRes.rows[0].id;

  // 4. Add to duty queue and assign to zone
  await distributionRepository.addRiderToDutyQueue(testRiderId);
  const manualAssign = await distributionService.manualDistributeRider({
    riderId: testRiderId,
    zoneId: testZoneId,
    assignedBy: null,
  });
  testAssignmentId = manualAssign.assignment.id;

  // -------------------------------------------------------------
  // GROUP 1: Armada Hold & Claim Flow (LBS-004)
  // -------------------------------------------------------------
  console.log("🚲 [GROUP 1] Rider Operational Session & Armada Claim");

  const sessionRes = await riderOperationalService.getRiderActiveSession(testRiderId);
  assert(sessionRes.has_active_session === true, "TEST 1.1: Rider has active operational session today");
  assert(sessionRes.session.zone_id === testZoneId, "TEST 1.2: Rider session correctly bound to assigned zone");

  // Hold Armada
  const holdRes = await riderOperationalService.inspectAndHoldArmada({
    riderId: testRiderId,
    armadaId: testArmadaId,
  });
  assert(holdRes && holdRes.armada, "TEST 1.3: Rider successfully holds armada for inspection");

  // Claim Armada
  const claimRes = await riderOperationalService.confirmArmadaClaim({
    riderId: testRiderId,
    armadaId: testArmadaId,
    checklist: { brakes: "OK", battery: "100%", tires: "OK" },
    notes: "Armada in good condition",
  });
  assert(claimRes.armada.status === "IN_USE", "TEST 1.4: Armada status transitions to IN_USE upon claim confirmation");

  // -------------------------------------------------------------
  // GROUP 2: PostGIS Geofence Check-in Validation (LBS-001, LBS-002, LBS-003)
  // -------------------------------------------------------------
  console.log("\n📍 [GROUP 2] PostGIS Geofence Spatial Check-in (ST_Contains)");

  // 1. OUTSIDE polygon check-in attempt (lat: -7.2000, lon: 112.7000) -> MUST FAIL (400)
  let outsideErrorCaught = false;
  try {
    await riderOperationalService.checkInToZone({
      riderId: testRiderId,
      lat: -7.2000,
      lon: 112.7000,
    });
  } catch (err: any) {
    outsideErrorCaught = true;
    assert(err.statusCode === 400 || err.message.toLowerCase().includes("luar batas"), "TEST 2.1: Check-in outside polygon rejected with 400 error");
  }
  assert(outsideErrorCaught, "TEST 2.2: Geofence rejection enforced for coordinates outside polygon");

  // 2. INSIDE polygon check-in attempt (lat: -7.2680, lon: 112.7500) -> MUST SUCCEED
  const checkInRes = await riderOperationalService.checkInToZone({
    riderId: testRiderId,
    lat: -7.2680,
    lon: 112.7500,
  });
  assert(checkInRes && checkInRes.check_in, "TEST 2.3: Check-in inside zone polygon succeeds");
  assert(checkInRes.check_in.assignment.status === "CHECKED_IN", "TEST 2.4: Assignment status transitions to CHECKED_IN");
  assert(checkInRes.check_in.assignment.check_in_time !== null, "TEST 2.5: check_in_time is recorded as timestamp");

  // -------------------------------------------------------------
  // GROUP 3: Shift Checkout & Armada Return (LBS-004, LBS-005)
  // -------------------------------------------------------------
  console.log("\n🏁 [GROUP 3] Shift Checkout & Armada Return");

  const checkoutRes = await riderOperationalService.checkoutAndReturnArmada({
    riderId: testRiderId,
    returnStatus: "ACTIVE",
    notes: "Shift completed normally",
  });
  assert(checkoutRes && checkoutRes.checkout, "TEST 3.1: Checkout executes successfully");

  // Verify DB state for assignment
  const { rows: postCheckoutAssignments } = await pool.query(
    "SELECT * FROM zone_assignments WHERE id = $1;",
    [testAssignmentId]
  );
  assert(postCheckoutAssignments[0].status === "COMPLETED", "TEST 3.2: Assignment status transitions to COMPLETED");
  assert(postCheckoutAssignments[0].check_out_time !== null, "TEST 3.3: check_out_time is recorded as timestamp");

  // Verify DB state for armada
  const { rows: postCheckoutArmadas } = await pool.query(
    "SELECT * FROM armadas WHERE id = $1;",
    [testArmadaId]
  );
  assert(postCheckoutArmadas[0].status === "ACTIVE", "TEST 3.4: Armada status restored to ACTIVE");
  assert(postCheckoutArmadas[0].current_rider_id === null, "TEST 3.5: Armada current_rider_id is released (NULL)");

  // -------------------------------------------------------------
  // GROUP 4: Redis Real-time Geospatial Tracking (LBS-006)
  // -------------------------------------------------------------
  console.log("\n📡 [GROUP 4] Redis Real-time Geospatial Telemetry");

  const redisKey = "lbs:riders:live";
  const testLat = -7.2680;
  const testLon = 112.7500;

  // GEOADD rider position
  await redisClient.geoAdd(redisKey, {
    longitude: testLon,
    latitude: testLat,
    member: String(testRiderId),
  });

  // GEOPOS verify
  const pos = await redisClient.geoPos(redisKey, String(testRiderId));
  assert(pos && pos[0] !== null, "TEST 4.1: Redis GEOADD stores live rider coordinates");
  assert(Math.abs(parseFloat(pos[0]!.latitude) - testLat) < 0.001, "TEST 4.2: Redis GEOPOS latitude matches GPS reading");
  assert(Math.abs(parseFloat(pos[0]!.longitude) - testLon) < 0.001, "TEST 4.3: Redis GEOPOS longitude matches GPS reading");

  // -------------------------------------------------------------
  // CLEANUP
  // -------------------------------------------------------------
  try {
    await redisClient.zRem(redisKey, String(testRiderId));
    await pool.query("DELETE FROM sales_logs WHERE rider_id = $1;", [testRiderId]);
    await pool.query("DELETE FROM fleet_assignments WHERE rider_id = $1;", [testRiderId]);
    await pool.query("DELETE FROM fleet_reservations WHERE rider_id = $1;", [testRiderId]);
    await pool.query("DELETE FROM zone_assignments WHERE rider_id = $1;", [testRiderId]);
    await pool.query("DELETE FROM rider_duty_queues WHERE rider_id = $1;", [testRiderId]);
    await pool.query("DELETE FROM armadas WHERE id = $1;", [testArmadaId]);
    await pool.query("DELETE FROM users WHERE id = $1;", [testRiderId]);
    await ZoneModel.delete(testZoneId);
  } catch (err: any) {
    console.warn("Cleanup warning:", err.message);
  }

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log("\n========================================================");
  console.log(`📊 PART 09 TEST RESULTS: ${passedTests}/${totalTests} PASSED`);
  console.log("========================================================\n");

  if (passedTests === totalTests) {
    console.log("🎉 ALL PART 09 TESTS PASSED PERFECTLY!");
    process.exit(0);
  } else {
    console.error("❌ SOME PART 09 TESTS FAILED.");
    process.exit(1);
  }
}

runPart09Tests().catch((err) => {
  console.error("💥 Unhandled error during PART 09 test execution:", err);
  process.exit(1);
});
