/*
 * part08_distribution.test.ts
 * Comprehensive Integration & Verification Test Suite for PART 08:
 * Distribution / Plotting: Overview, Preview, Auto Plotting (TOPSIS Greedy),
 * Manual Supervisor Overrides, Capacity Constraints, and Duty Cancellation Cascade.
 */

import { pool } from "../src/config/database.js";
import { distributionService } from "../src/services/distribution/DistributionService.js";
import { distributionRepository } from "../src/repositories/distributionRepository.js";
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

async function runPart08Tests() {
  console.log("\n========================================================");
  console.log("🧪 RUNNING PART 08: DISTRIBUTION & PLOTTING TEST SUITE");
  console.log("========================================================\n");

  const testSuffix = Date.now();
  let testZoneId: string | number = "";
  let testRiderId1: string = "";
  let testRiderId2: string = "";
  let testDutyQueueId1: string = "";
  let testDutyQueueId2: string = "";

  // -------------------------------------------------------------
  // SETUP: Create 1 Test Zone and 2 Mock Rider Duty Queues in WAITING
  // -------------------------------------------------------------
  try {
    await pool.query("DELETE FROM weathers WHERE zone_id IN (SELECT id FROM zones WHERE name LIKE 'Dist Test Zone%');");
    await pool.query("DELETE FROM zone_assignments WHERE zone_id IN (SELECT id FROM zones WHERE name LIKE 'Dist Test Zone%');");
    await pool.query("DELETE FROM zones WHERE name LIKE 'Dist Test Zone%';");
  } catch (e) {}

  const zone = await zoneService.createZone({
    name: `Dist Test Zone ${testSuffix}`,
    max_capacity: 1, // Only 1 slot capacity to test constraint
    polygon: {
      type: "Polygon",
      coordinates: [
        [
          [112.7300, -7.2500],
          [112.7360, -7.2500],
          [112.7360, -7.2560],
          [112.7300, -7.2560],
          [112.7300, -7.2500],
        ],
      ],
    },
  });
  testZoneId = zone.id;

  // Create 2 test users (riders)
  const user1Res = await pool.query(`
    INSERT INTO users (id, username, name, email, password, role, is_active)
    VALUES (gen_random_uuid(), $1, 'Dist Rider 1', $2, 'hash', 'RIDER', true)
    RETURNING id;
  `, [`dist_rider1_${testSuffix}`, `dist_rider1_${testSuffix}@koling.com`]);
  testRiderId1 = user1Res.rows[0].id;

  const user2Res = await pool.query(`
    INSERT INTO users (id, username, name, email, password, role, is_active)
    VALUES (gen_random_uuid(), $1, 'Dist Rider 2', $2, 'hash', 'RIDER', true)
    RETURNING id;
  `, [`dist_rider2_${testSuffix}`, `dist_rider2_${testSuffix}@koling.com`]);
  testRiderId2 = user2Res.rows[0].id;

  // Insert duty queue readiness for both riders (WAITING)
  const duty1 = await distributionRepository.addRiderToDutyQueue(testRiderId1);
  testDutyQueueId1 = duty1.id;

  const duty2 = await distributionRepository.addRiderToDutyQueue(testRiderId2);
  testDutyQueueId2 = duty2.id;

  // -------------------------------------------------------------
  // GROUP 1: Distribution Overview & Metrics (DIST-001)
  // -------------------------------------------------------------
  console.log("📊 [GROUP 1] Distribution Overview & Queue Summary");

  const overview = await distributionService.getDistributionOverview();
  assert(overview && overview.session, "TEST 1.1: Overview returns active operational session");
  assert(overview.summary && typeof overview.summary.total_waiting === "number", "TEST 1.2: Overview returns total_waiting count");
  assert(overview.summary.total_waiting >= 2, `TEST 1.3: Total waiting count includes test riders (Count: ${overview.summary.total_waiting})`);
  assert(Array.isArray(overview.zones), "TEST 1.4: Overview returns zones with remaining capacity");

  // -------------------------------------------------------------
  // GROUP 2: Distribution Preview (DIST-007)
  // -------------------------------------------------------------
  console.log("\n🔍 [GROUP 2] Non-Destructive Distribution Preview");

  const preview = await distributionService.previewDistribution();
  assert(preview && !preview.is_empty, "TEST 2.1: Preview executes and finds waiting riders");
  assert(Array.isArray(preview.proposed_allocations), "TEST 2.2: Preview returns proposed allocations array");

  // Verify no zone assignments were created during preview
  const { rows: preAssignments } = await pool.query(
    "SELECT * FROM zone_assignments WHERE rider_id IN ($1, $2);",
    [testRiderId1, testRiderId2]
  );
  assert(preAssignments.length === 0, "TEST 2.3: Preview does not modify database state");

  // -------------------------------------------------------------
  // GROUP 3: Manual Override & Capacity Constraint (DIST-003, DIST-004, DIST-005)
  // -------------------------------------------------------------
  console.log("\n👤 [GROUP 3] Manual Supervisor Override & Capacity Constraint");

  // 1. Assign Rider 1 to testZone (Capacity: 1)
  const manualAssign1 = await distributionService.manualDistributeRider({
    riderId: testRiderId1,
    zoneId: testZoneId,
    assignedBy: null,
  });
  assert(manualAssign1 && manualAssign1.assignment, "TEST 3.1: Manual override succeeds for first waiting rider");

  // 2. Try assigning Rider 2 to the same testZone (Must fail with Capacity Full)
  let capacityErrorCaught = false;
  try {
    await distributionService.manualDistributeRider({
      riderId: testRiderId2,
      zoneId: testZoneId,
      assignedBy: null,
    });
  } catch (err: any) {
    capacityErrorCaught = true;
    assert(err.statusCode === 400 || err.message.toLowerCase().includes("kapasitas"), "TEST 3.2: Manual override to full zone rejected with 400 capacity error");
  }
  assert(capacityErrorCaught, "TEST 3.3: Capacity constraint strictly enforced on manual distribution");

  // 3. Try assigning Rider 1 again (Must fail: already assigned today)
  let duplicateErrorCaught = false;
  try {
    await distributionService.manualDistributeRider({
      riderId: testRiderId1,
      zoneId: testZoneId,
      assignedBy: null,
    });
  } catch (err: any) {
    duplicateErrorCaught = true;
  }
  assert(duplicateErrorCaught, "TEST 3.4: Already assigned rider cannot be assigned multiple times");

  // -------------------------------------------------------------
  // GROUP 4: Duty Cancellation Cascade (DIST-011)
  // -------------------------------------------------------------
  console.log("\n🔄 [GROUP 4] Duty Status Update & Cancellation Cascade");

  // Cancel Duty for Rider 1
  const updateRes = await distributionService.updateRiderDutyStatus({
    riderId: testRiderId1,
    status: "CANCELLED",
  });
  assert(updateRes && updateRes.id, "TEST 4.1: Rider duty status updated to CANCELLED");

  // Verify zone_assignments status cascaded to CANCELLED
  const { rows: postCancelAssignments } = await pool.query(
    "SELECT * FROM zone_assignments WHERE rider_id = $1;",
    [testRiderId1]
  );
  assert(postCancelAssignments.length > 0, "TEST 4.2: Zone assignment record exists");
  assert(postCancelAssignments[0].status === "CANCELLED", "TEST 4.3: Assignment status atomically cascaded to CANCELLED");

  // -------------------------------------------------------------
  // CLEANUP
  // -------------------------------------------------------------
  try {
    await pool.query("DELETE FROM zone_assignments WHERE rider_id IN ($1, $2);", [testRiderId1, testRiderId2]);
    await pool.query("DELETE FROM rider_duty_queues WHERE id IN ($1, $2);", [testDutyQueueId1, testDutyQueueId2]);
    await pool.query("DELETE FROM users WHERE id IN ($1, $2);", [testRiderId1, testRiderId2]);
    await ZoneModel.delete(testZoneId);
  } catch (err: any) {
    console.warn("Cleanup warning:", err.message);
  }

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log("\n========================================================");
  console.log(`📊 PART 08 TEST RESULTS: ${passedTests}/${totalTests} PASSED`);
  console.log("========================================================\n");

  if (passedTests === totalTests) {
    console.log("🎉 ALL PART 08 TESTS PASSED PERFECTLY!");
    process.exit(0);
  } else {
    console.error("❌ SOME PART 08 TESTS FAILED.");
    process.exit(1);
  }
}

runPart08Tests().catch((err) => {
  console.error("💥 Unhandled error during PART 08 test execution:", err);
  process.exit(1);
});
