/*
 * part16_e2e_workflow.test.ts
 * Master E2E Operational Workflow & Resilience Integration Test Suite (E2E_WORKFLOW_MAP 2.0)
 * Validates Golden Path, Concurrency Locking, PostGIS Spatials, POS Sales, Emergency Swap & Nightly Cleanup.
 */

import { describe, it, beforeAll, afterAll } from "bun:test";
import { pool } from "../src/config/database.js";
import { redisClient } from "../src/config/redis.js";
import { distributionService } from "../src/services/distribution/DistributionService.js";
import { riderOperationalService } from "../src/services/rider/RiderOperationalService.js";
import { topsisEngineService } from "../src/services/dss/TopsisEngineService.js";
import { redisGeoService } from "../src/services/lbs/RedisGeoService.js";
import { systemReadinessService } from "../src/services/system/SystemReadinessService.js";
import bcrypt from "bcryptjs";

const assert = (condition: boolean, testName: string, detail?: any) => {
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
  } else {
    console.error(`❌ FAIL: ${testName}`, detail || "");
    throw new Error(`Test assertion failed: ${testName}`);
  }
};

describe("🧪 PART 16: E2E OPERATIONAL WORKFLOW & RESILIENCE SUITE", () => {
  let superadminId: string;
  let rider1Id: string;
  let rider2Id: string;
  let testZoneId: string;
  let testArmadaId: string;
  let testProductId: string;

  beforeAll(async () => {
    console.log("\n========================================================");
    console.log("🚀 INITIALIZING E2E WORKFLOW 2.0 TEST ENVIRONMENT");
    console.log("========================================================");

    const hashedPassword = await bcrypt.hash("Password123!", 10);
    const timestamp = Date.now();

    // 1. Create Superadmin User
    const { rows: adminRows } = await pool.query(
      `INSERT INTO users (email, username, password, name, role, is_active, first_login)
       VALUES ($1, $2, $3, 'E2E Supervisor', 'SUPERVISOR', true, false)
       RETURNING id;`,
      [`spv_${timestamp}@mantakopi.id`, `spv_${timestamp}`, hashedPassword]
    );
    superadminId = adminRows[0].id;

    // 2. Create Test Rider 1 & Rider 2
    const { rows: r1Rows } = await pool.query(
      `INSERT INTO users (email, username, password, name, role, is_active, first_login)
       VALUES ($1, $2, $3, 'Rider Alpha E2E', 'RIDER', true, false)
       RETURNING id;`,
      [`rider1_${timestamp}@mantakopi.id`, `rider1_${timestamp}`, hashedPassword]
    );
    rider1Id = r1Rows[0].id;

    const { rows: r2Rows } = await pool.query(
      `INSERT INTO users (email, username, password, name, role, is_active, first_login)
       VALUES ($1, $2, $3, 'Rider Beta E2E', 'RIDER', true, false)
       RETURNING id;`,
      [`rider2_${timestamp}@mantakopi.id`, `rider2_${timestamp}`, hashedPassword]
    );
    rider2Id = r2Rows[0].id;

    // 3. Create Valid Test Zone (Surabaya City Center)
    const polygonGeoJson = {
      type: "Polygon",
      coordinates: [
        [
          [112.748, -7.255],
          [112.756, -7.255],
          [112.756, -7.262],
          [112.748, -7.262],
          [112.748, -7.255],
        ],
      ],
    };

    const { rows: zoneRows } = await pool.query(
      `INSERT INTO zones (name, description, max_capacity, status, polygon)
       VALUES ($1, 'Zona Pusat Bisnis Tunjungan', 5, 'ACTIVE', $2)
       RETURNING id;`,
      [`Zona E2E Tunjungan ${timestamp}`, JSON.stringify(polygonGeoJson)]
    );
    testZoneId = zoneRows[0].id;

    // 4. Create Test Fleet / Armada
    const { rows: armadaRows } = await pool.query(
      `INSERT INTO armadas (code, type, status, battery_level)
       VALUES ($1, 'GEROBAK', 'ACTIVE', 95)
       RETURNING id;`,
      [`GBK-E2E-${timestamp}`]
    );
    testArmadaId = armadaRows[0].id;

    // 5. Create Test Product
    const { rows: prodRows } = await pool.query(
      `INSERT INTO products (name, sku, category, base_price, price, status)
       VALUES ($1, $2, 'KOPI', 8000, 18000, 'AVAILABLE')
       RETURNING id;`,
      [`Kopi Susu E2E ${timestamp}`, `SKU-E2E-${timestamp}`]
    );
    testProductId = prodRows[0].id;

    console.log("✅ Seeded test users, zone, fleet & product successfully.");
  });

  afterAll(async () => {
    // Cleanup created test records
    await pool.query("DELETE FROM sales_logs WHERE rider_id IN ($1, $2);", [rider1Id, rider2Id]);
    await pool.query("DELETE FROM shift_settlements WHERE rider_id IN ($1, $2);", [rider1Id, rider2Id]);
    await pool.query("DELETE FROM duty_incident_logs WHERE previous_rider_id IN ($1, $2) OR new_rider_id IN ($1, $2);", [rider1Id, rider2Id]);
    await pool.query("DELETE FROM zone_assignments WHERE zone_id = $1;", [testZoneId]);
    await pool.query("DELETE FROM rider_duty_queues WHERE rider_id IN ($1, $2);", [rider1Id, rider2Id]);
    await pool.query("DELETE FROM armadas WHERE id = $1;", [testArmadaId]);
    await pool.query("DELETE FROM zones WHERE id = $1;", [testZoneId]);
    await pool.query("DELETE FROM products WHERE id = $1;", [testProductId]);
    await pool.query("DELETE FROM users WHERE id IN ($1, $2, $3);", [superadminId, rider1Id, rider2Id]);
    console.log("🧹 Cleaned up E2E test records from database.");
  });

  // -------------------------------------------------------------
  // GROUP 1: SYSTEM READINESS & JURISDICTION GUARD
  // -------------------------------------------------------------
  it("GROUP 1: System Readiness & Hub Surabaya Setup", async () => {
    console.log("\n🏛️ [GROUP 1] System Readiness & Hub Setup Verification");

    const readiness = await systemReadinessService.evaluateSystemReadiness();
    assert(readiness && typeof readiness.overall_status === "string", "TEST 1.1: System readiness returns overall_status");
    assert(Array.isArray(readiness.items), "TEST 1.2: Items readiness evaluation array is populated");
  });

  // -------------------------------------------------------------
  // GROUP 2: MORNING PRE-OPS (PRESENSI -> DSS -> PLOTTING -> FLEET CLAIM)
  // -------------------------------------------------------------
  it("GROUP 2: Morning Pre-Ops Flow (Duty Confirm -> TOPSIS -> Plotting -> Armada Claim)", async () => {
    console.log("\n🌅 [GROUP 2] Morning Pre-Ops Sequence (Presensi -> DSS -> Plotting -> Claim)");

    // 2.1 Presensi Rider 1 (Idempotent WAITING Queue)
    const duty1 = await distributionService.confirmRiderDuty(rider1Id);
    assert(duty1 && duty1.status === "WAITING", "TEST 2.1: Rider 1 confirms duty and enters WAITING queue");

    const duty1Dup = await distributionService.confirmRiderDuty(rider1Id);
    assert(duty1Dup.already_confirmed === true, "TEST 2.2: Rider duty confirmation is strictly idempotent");

    // 2.2 DSS TOPSIS Evaluation
    const dssEval = await topsisEngineService.calculateTopsisRecommendations({
      timeSlot: "PAGI",
    });
    assert(dssEval && Array.isArray(dssEval.rankings), "TEST 2.3: TOPSIS engine generates zone rankings");

    // 2.3 Supervisor Confirms Plotting (Transitions Rider 1 to PLOTTED)
    const plottingResult = await distributionService.confirmDistributionRun({
      executionType: "AUTO",
      executedBy: superadminId,
      allocations: [
        {
          rider_id: rider1Id,
          zone_id: testZoneId,
          zone_name: "Zona Pusat Bisnis Tunjungan",
          topsis_rank: 1,
        },
      ],
    });
    assert(plottingResult && plottingResult.assignments.length === 1, "TEST 2.4: Plotting creates active zone assignment");
    assert(plottingResult.assignments[0].status === "ASSIGNED", "TEST 2.5: Assignment status initialized to ASSIGNED");

    // 2.4 Rider 1 Holds Armada (180s Ticket-Booking Lock)
    const holdRes = await riderOperationalService.inspectAndHoldArmada({
      riderId: rider1Id,
      armadaId: testArmadaId,
    });
    assert(holdRes && holdRes.armada.status === "RESERVED", "TEST 2.6: Armada transitions to RESERVED upon hold");

    // 2.5 Rider 1 Confirms Physical Checklist & Claims Armada (Transitions to IN_USE)
    const claimRes = await riderOperationalService.confirmArmadaClaim({
      riderId: rider1Id,
      armadaId: testArmadaId,
      checklist: { brakes: true, battery: true, tires: true },
    });
    assert(claimRes && claimRes.armada.status === "IN_USE", "TEST 2.7: Armada transitions to IN_USE upon physical claim");
  });

  // -------------------------------------------------------------
  // GROUP 3: FIELD EXECUTION (GEOFENCING CHECK-IN + LBS + POS SALES)
  // -------------------------------------------------------------
  it("GROUP 3: Field Execution (Spatial Geofence Check-in + LBS + POS Recording)", async () => {
    console.log("\n☀️ [GROUP 3] Field Execution (Geofencing PostGIS ST_Covers + POS)");

    // 3.1 Check-in Outside Zone Polygon (Expect 400 OUTSIDE_ZONE with distance)
    try {
      await riderOperationalService.checkInToZone({
        riderId: rider1Id,
        lat: -7.3200, // Sidoarjo / far south
        lon: 112.7500,
      });
      assert(false, "TEST 3.1: Should fail check-in when far outside zone polygon");
    } catch (err: any) {
      assert(err.statusCode === 400 && err.code === "OUTSIDE_ZONE", "TEST 3.1: Rejects outside zone with OUTSIDE_ZONE code");
      assert(typeof err.distance_meters === "number" && err.distance_meters > 1000, `TEST 3.2: Returns accurate distance in meters (${err.distance_meters}m)`);
    }

    // 3.2 Check-in Inside Zone Polygon (PostGIS ST_Covers Buffer)
    const checkInRes = await riderOperationalService.checkInToZone({
      riderId: rider1Id,
      lat: -7.2580, // Inside Tunjungan polygon
      lon: 112.7520,
    });
    assert(checkInRes && checkInRes.check_in.assignment.status === "CHECKED_IN", "TEST 3.3: Successfully checks in inside zone polygon (CHECKED_IN)");

    // 3.3 LBS Location Update to Redis
    await redisGeoService.updateRiderLocation({
      riderId: rider1Id,
      lat: -7.2580,
      lon: 112.7520,
      speed: 15,
      heading: 180,
    });
    const riderLoc = await redisGeoService.getRiderLocation(rider1Id);
    assert(riderLoc && Math.abs(riderLoc.location.latitude - (-7.2580)) < 0.001, "TEST 3.4: Live LBS coordinates indexed in Redis");

    // 3.4 Record POS Sale (CASH + QRIS with Idempotency Key)
    const saleCash = await riderOperationalService.recordProductSale({
      riderId: rider1Id,
      productId: testProductId,
      quantity: 2,
      paymentMethod: "CASH",
      idempotencyKey: "e2e-idemp-001",
    });
    assert(saleCash && saleCash.sales_log.total_price === 36000, "TEST 3.5: Records CASH sale (2x Rp 18.000 = Rp 36.000)");
    assert(saleCash.sales_log.payment_method === "CASH", "TEST 3.6: Correctly locks payment_method = CASH");

    const saleQris = await riderOperationalService.recordProductSale({
      riderId: rider1Id,
      productId: testProductId,
      quantity: 1,
      paymentMethod: "QRIS",
      idempotencyKey: "e2e-idemp-002",
    });
    assert(saleQris && saleQris.sales_log.payment_method === "QRIS", "TEST 3.7: Records QRIS sale with payment_method = QRIS");
  });

  // -------------------------------------------------------------
  // GROUP 4: MID-DAY EMERGENCY INCIDENT & RIDER SWAP
  // -------------------------------------------------------------
  it("GROUP 4: Mid-Day Emergency Incident & Rider Swap Protocol", async () => {
    console.log("\n🚨 [GROUP 4] Mid-Day Emergency Swap (Incident Handover Flow)");

    const swapRes = await distributionService.emergencySwap({
      previousRiderId: rider1Id,
      newRiderId: rider2Id,
      supervisorId: superadminId,
      incidentType: "FLAT_TIRE",
      notes: "Ban gerobak bocor di Jl Tunjungan, digantikan Rider Beta",
      armadaAction: "KEEP_ARMADA",
    });

    assert(swapRes && swapRes.new_assignment, "TEST 4.1: Emergency swap transfers assignment to new rider");
    assert(swapRes.new_assignment.rider_id === rider2Id, "TEST 4.2: New assignment bound to Rider 2");
    assert(swapRes.new_assignment.armada_id === testArmadaId, "TEST 4.3: Armada retained and bound to Rider 2");
    assert(swapRes.incident_log && swapRes.incident_log.incident_type === "FLAT_TIRE", "TEST 4.4: Incident log recorded in database");

    // Verify Rider 1's previous assignment is locked with incident timestamp
    const { rows: r1AssignRows } = await pool.query(
      "SELECT * FROM zone_assignments WHERE id = $1;",
      [swapRes.previous_assignment_id]
    );
    assert(r1AssignRows[0].incident_locked_at !== null, "TEST 4.5: Previous rider assignment timestamped with incident_locked_at");
  });

  // -------------------------------------------------------------
  // GROUP 5: EVENING POST-OPS (CHECKOUT -> AVAILABLE -> SETTLEMENT -> REDIS CLEANUP)
  // -------------------------------------------------------------
  it("GROUP 5: Evening Checkout (Return to AVAILABLE, Cash Discrepancy & Redis Purge)", async () => {
    console.log("\n🌆 [GROUP 5] Evening Checkout & Settlement (Discrepancy, Redis Purge)");

    // 5.1 Rider 2 Check-in & Checkout and Cash Discrepancy
    await pool.query(
      "UPDATE zone_assignments SET status = 'CHECKED_IN' WHERE rider_id = $1 AND assignment_date = CURRENT_DATE;",
      [rider2Id]
    );

    const checkoutRes = await riderOperationalService.checkoutAndReturnArmada({
      riderId: rider2Id,
      returnStatus: "ACTIVE",
      inspectionCondition: { cleanliness: "GOOD" },
      remainingCups: 12,
      actualCashSubmitted: 35000,
      discrepancyAmount: -1000,
      discrepancyReason: "Salah kembalian 1x (Rp 1.000)",
      notes: "Selesai shift operasional sore",
    });

    assert(checkoutRes && checkoutRes.checkout.armada_status === "AVAILABLE", "TEST 5.1: Armada status set to AVAILABLE upon normal return");
    assert(checkoutRes.checkout.status === "COMPLETED", "TEST 5.2: Zone assignment marked as COMPLETED");

    // 5.2 Verify Shift Settlement Record in Database
    const { rows: settlementRows } = await pool.query(
      "SELECT * FROM shift_settlements WHERE rider_id = $1;",
      [rider2Id]
    );
    assert(settlementRows.length > 0, "TEST 5.3: Shift settlement recorded in database");
    assert(settlementRows[0].status === "SETTLED_WITH_DISCREPANCY", "TEST 5.4: Settlement status flagged as SETTLED_WITH_DISCREPANCY");
    assert(parseFloat(settlementRows[0].discrepancy_amount) === -1000, "TEST 5.5: Discrepancy amount accurately recorded (-Rp 1.000)");

    // 5.3 Verify Live LBS Redis Radar Cleanup (ZREM)
    const locAfterCheckout = await redisGeoService.getRiderLocation(rider2Id);
    assert(locAfterCheckout === null, "TEST 5.6: Rider live coordinates completely purged from Redis radar (ZREM)");
  });

  // -------------------------------------------------------------
  // GROUP 6: ROLLBACK CASCADE ON NO_SHOW / CANCELLED
  // -------------------------------------------------------------
  it("GROUP 6: Cascade Rollback on NO_SHOW / CANCELLED", async () => {
    console.log("\n🛡️ [GROUP 6] Cascade Rollback on NO_SHOW / CANCELLED");

    // Seed dummy rider with waiting queue and reserved armada
    const timestamp = Date.now();
    const hashedPassword = await bcrypt.hash("Password123!", 10);
    const { rows: r3Rows } = await pool.query(
      `INSERT INTO users (email, username, password, name, role, is_active)
       VALUES ($1, $2, $3, 'Rider Gamma Rollback', 'RIDER', true)
       RETURNING id;`,
      [`rider3_${timestamp}@mantakopi.id`, `rider3_${timestamp}`, hashedPassword]
    );
    const rider3Id = r3Rows[0].id;

    // Confirm duty
    await distributionService.confirmRiderDuty(rider3Id);

    // Bind armada to rider 3
    await pool.query(
      "UPDATE armadas SET status = 'RESERVED', current_rider_id = $1 WHERE id = $2;",
      [rider3Id, testArmadaId]
    );

    // Supervisor marks rider as NO_SHOW
    const updatedDuty = await distributionService.updateRiderDutyStatus({
      riderId: rider3Id,
      status: "NO_SHOW",
      notes: "Rider tidak hadir saat apel pagi",
      updatedBy: superadminId,
    });

    assert(updatedDuty && updatedDuty.status === "NO_SHOW", "TEST 6.1: Duty queue updated to NO_SHOW");

    // Verify Armada is auto-released to ACTIVE with nullified rider
    const { rows: checkArmadaRows } = await pool.query(
      "SELECT status, current_rider_id FROM armadas WHERE id = $1;",
      [testArmadaId]
    );
    assert(checkArmadaRows[0].status === "ACTIVE", "TEST 6.2: Armada rolled back to ACTIVE upon rider NO_SHOW");
    assert(checkArmadaRows[0].current_rider_id === null, "TEST 6.3: current_rider_id successfully nullified");

    // Clean up dummy rider 3
    await pool.query("DELETE FROM rider_duty_queues WHERE rider_id = $1;", [rider3Id]);
    await pool.query("DELETE FROM users WHERE id = $1;", [rider3Id]);
  });
});
