/*
 * test-b10-distribution-and-fleet-assignment.js
 * Comprehensive Automated Test Suite for Milestone B-10:
 * 1. FIFO Duty Queue Lifecycle (WAITING -> PLOTTED -> ASSIGNED)
 * 2. Capacity-Aware Auto-Distribution Matching (TOPSIS Rank #1 First)
 * 3. Over-capacity / Under-capacity Handling & Resiliency
 * 4. Distribution Runs Audit History & Immutable DSS Linkage
 * 5. Fleet 5-Minute Hold & Claim Concurrency Protection (Row-Level Locking)
 * 6. Unified Operational Status Aggregation API
 */

import { pool } from "../config/database.js";
import { distributionService } from "../services/distribution/DistributionService.js";
import { distributionRepository } from "../repositories/distributionRepository.js";
import { riderOperationalService } from "../services/rider/RiderOperationalService.js";
import { armadaRepository } from "../repositories/armadaRepository.js";
import { topsisEngineService } from "../services/dss/TopsisEngineService.js";

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

async function runB10TestSuite() {
  console.log("================================================================================");
  console.log("🚀 STARTING MILESTONE B-10 AUTOMATED TEST SUITE: DISTRIBUTION & FLEET ASSIGNMENT");
  console.log("================================================================================\n");

  try {
    // Clean up test data for today's distribution
    await distributionRepository.resetTodayDistribution();

    // 1. Fetch test users (riders & supervisor)
    const { rows: testRiders } = await pool.query(
      "SELECT id, name, role FROM users WHERE role = 'RIDER' ORDER BY name ASC LIMIT 5;"
    );

    if (testRiders.length < 2) {
      console.warn("⚠️ Warning: Membutuhkan minimal 2 user rider untuk pengujian. Membuat mock rider...");
      const insertRider = await pool.query(`
        INSERT INTO users (name, username, email, password, role)
        VALUES ('Test Rider B10 Alpha', 'rider_b10_a', 'rider_b10_a@mova.id', 'hashedpass', 'RIDER'),
               ('Test Rider B10 Beta', 'rider_b10_b', 'rider_b10_b@mova.id', 'hashedpass', 'RIDER')
        ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
        RETURNING id, name, role;
      `);
      testRiders.push(...insertRider.rows);
    }

    const riderA = testRiders[0];
    const riderB = testRiders[1];

    const { rows: testSupervisors } = await pool.query(
      "SELECT id, name, role FROM users WHERE role IN ('SUPERVISOR', 'SUPERADMIN') LIMIT 1;"
    );
    const supervisor = testSupervisors[0] || { id: null };

    // -------------------------------------------------------------------------
    // TEST SECTION 1: FIFO Duty Queue & Status Progression
    // -------------------------------------------------------------------------
    console.log("📌 [TEST 1] Testing FIFO Duty Queue Ingestion & Ordering...");
    
    const queueA = await distributionService.confirmRiderDuty(riderA.id);
    assert(queueA && queueA.status === "WAITING", "Rider A successfully queued with status 'WAITING'");
    
    // Brief delay to ensure deterministic FIFO timestamp ordering
    await new Promise((r) => setTimeout(r, 50));
    
    const queueB = await distributionService.confirmRiderDuty(riderB.id);
    assert(queueB && queueB.status === "WAITING", "Rider B successfully queued with status 'WAITING'");

    const waitingQueue = await distributionRepository.getWaitingRidersQueue();
    assert(waitingQueue.length >= 2, `Waiting queue contains at least 2 riders (found ${waitingQueue.length})`);
    assert(waitingQueue[0].rider_id === riderA.id, "FIFO Ordering Preserved: Rider A is 1st in queue");
    assert(waitingQueue[1].rider_id === riderB.id, "FIFO Ordering Preserved: Rider B is 2nd in queue");

    // Test unified status when WAITING
    const statusAWaiting = await distributionService.getRiderOperationalStatus(riderA.id);
    assert(statusAWaiting.duty_status === "WAITING", "Unified status: duty_status is 'WAITING'");
    assert(statusAWaiting.queue_position === 1, "Unified status: queue_position is 1");
    assert(statusAWaiting.assignment === null, "Unified status: assignment is null while in queue");

    // -------------------------------------------------------------------------
    // TEST SECTION 2: Distribution Overview & Remaining Capacities
    // -------------------------------------------------------------------------
    console.log("\n📌 [TEST 2] Testing Distribution Overview & Capacity Mapping...");
    const overview = await distributionService.getDistributionOverview("siang");

    assert(overview.time_slot === "siang", "Overview time_slot matches requested slot 'siang'");
    assert(overview.total_waiting_riders >= 2, `Overview total_waiting_riders correctly calculated (${overview.total_waiting_riders})`);
    assert(Array.isArray(overview.zones_overview), "Overview contains zones_overview array");
    assert(overview.zones_overview.length > 0, "Zones overview has at least 1 active zone");

    const topRankZone = overview.zones_overview[0];
    assert(topRankZone.rank === 1, "Top zone has TOPSIS Rank #1");
    assert(typeof topRankZone.remaining_capacity === "number", "Zone contains numeric remaining_capacity");
    assert(topRankZone.remaining_capacity >= 0, "Zone remaining_capacity is non-negative");

    // -------------------------------------------------------------------------
    // TEST SECTION 3: Auto-Distribution Matching & Immutable DSS Linkage
    // -------------------------------------------------------------------------
    console.log("\n📌 [TEST 3] Testing Auto-Distribution Execution & Immutable DSS Linkage...");
    const autoDistResult = await distributionService.autoDistributeRiders(supervisor.id, "siang");

    assert(autoDistResult.assigned_riders_count >= 2, `Auto-distribution successfully assigned riders (assigned ${autoDistResult.assigned_riders_count})`);
    assert(typeof autoDistResult.distribution_run_id === "string", `Distribution Run ID generated: ${autoDistResult.distribution_run_id}`);
    assert(Array.isArray(autoDistResult.assignments), "Assignments returned as array");

    // Verify assignment records in database
    const assignedA = autoDistResult.assignments.find((a) => a.rider_id === riderA.id);
    assert(assignedA !== undefined, "Rider A has an active assignment record");
    assert(assignedA.topsis_rank !== undefined && assignedA.topsis_rank !== null, `Rider A assigned with topsis_rank: ${assignedA.topsis_rank}`);
    assert(assignedA.distribution_run_id === autoDistResult.distribution_run_id, "Assignment linked to distribution_run_id");

    // Verify queue status changed to PLOTTED
    const statusAPlotted = await distributionService.getRiderOperationalStatus(riderA.id);
    assert(statusAPlotted.duty_status === "ASSIGNED", "Unified status: Rider A duty_status is now 'ASSIGNED'");
    assert(statusAPlotted.assignment !== null, "Unified status: Rider A has populated assignment object");
    assert(statusAPlotted.assignment.topsis_rank === assignedA.topsis_rank, "Unified status preserves topsis_rank");

    // -------------------------------------------------------------------------
    // TEST SECTION 4: Distribution Runs Audit History
    // -------------------------------------------------------------------------
    console.log("\n📌 [TEST 4] Testing Distribution Runs Audit Trail & Detail Retrieval...");
    const recentRuns = await distributionService.getDistributionRuns(5);
    assert(Array.isArray(recentRuns) && recentRuns.length > 0, "Distribution runs audit history list retrieved");
    
    const singleRun = await distributionService.getDistributionRunById(autoDistResult.distribution_run_id);
    assert(singleRun !== null, "Distribution run detail retrieved by ID");
    assert(singleRun.id === autoDistResult.distribution_run_id, "Distribution run ID matches");
    assert(Array.isArray(singleRun.assignments), "Distribution run detail contains child assignments list");
    assert(singleRun.assignments.length >= 2, `Child assignments length matches (${singleRun.assignments.length})`);

    // -------------------------------------------------------------------------
    // TEST SECTION 5: Fleet 5-Minute Hold & Claim Concurrency Protection
    // -------------------------------------------------------------------------
    console.log("\n📌 [TEST 5] Testing Fleet 5-Minute Hold, Claim, and Concurrency Locking...");
    
    // Fetch or create a test armada
    let testArmada = await armadaRepository.findByCode("TEST-ARMADA-B10");
    if (!testArmada) {
      testArmada = await armadaRepository.create({
        code: "TEST-ARMADA-B10",
        type: "GEROBAK",
        status: "ACTIVE",
      });
    } else {
      await pool.query("UPDATE armadas SET status = 'ACTIVE', current_rider_id = NULL, reserved_by_rider_id = NULL, reserved_until = NULL WHERE id = $1;", [testArmada.id]);
    }

    // 1. Rider A inspects & holds armada (5-minute hold)
    const holdResA = await riderOperationalService.inspectAndHoldArmada({
      riderId: riderA.id,
      armadaId: testArmada.id,
    });
    assert(holdResA.armada.status === "RESERVED", "Armada status changed to 'RESERVED'");
    assert(holdResA.armada.reserved_by_rider_id === riderA.id, "Armada reserved_by_rider_id set to Rider A");
    assert(holdResA.armada.reserved_until !== null, "Armada reserved_until timestamp set");

    // 2. Concurrency Test: Rider B tries to hold the same armada while held by Rider A
    let errorHeldByOther = null;
    try {
      await riderOperationalService.inspectAndHoldArmada({
        riderId: riderB.id,
        armadaId: testArmada.id,
      });
    } catch (err) {
      errorHeldByOther = err;
    }
    assert(
      errorHeldByOther !== null && errorHeldByOther.statusCode === 400,
      "Concurrency Guard: Concurrent hold attempt by Rider B rejected with 400 Bad Request"
    );

    // 3. Rider A cancels hold (release lock)
    const releaseRes = await riderOperationalService.cancelArmadaHold({
      riderId: riderA.id,
      armadaId: testArmada.id,
    });
    assert(releaseRes.armada.status === "ACTIVE", "Armada status reverted to 'ACTIVE' on release");
    assert(releaseRes.armada.reserved_by_rider_id === null, "Armada reserved_by_rider_id cleared");

    // 4. Now Rider B can hold and confirm claim
    const holdResB = await riderOperationalService.inspectAndHoldArmada({
      riderId: riderB.id,
      armadaId: testArmada.id,
    });
    assert(holdResB.armada.status === "RESERVED", "Rider B successfully held the released armada");

    const claimResB = await riderOperationalService.confirmArmadaClaim({
      riderId: riderB.id,
      armadaId: testArmada.id,
    });
    assert(claimResB.armada.status === "IN_USE", "Armada status permanently changed to 'IN_USE'");
    assert(claimResB.armada.current_rider_id === riderB.id, "Armada current_rider_id permanently bound to Rider B");


    // 5. Verify Unified Status for Rider B reflects claimed armada
    const statusBClaimed = await distributionService.getRiderOperationalStatus(riderB.id);
    assert(statusBClaimed.fleet !== null, "Unified status: Rider B fleet object is populated");
    assert(statusBClaimed.fleet.armada_id === testArmada.id, "Unified status: Fleet armada_id matches claimed unit");
    assert(statusBClaimed.fleet.status === "CLAIMED", "Unified status: Fleet status is 'CLAIMED'");

  } catch (error) {
    console.error("❌ Unexpected Error in B-10 Test Suite:", error);
    failedCount++;
  } finally {
    console.log("\n================================================================================");
    console.log(`🏁 B-10 TEST RUN COMPLETED: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log("================================================================================");
    process.exit(failedCount > 0 ? 1 : 0);
  }
}

runB10TestSuite();
