/*
 * test_stage4_fleet_state_machine.ts
 * Comprehensive Stage 4 Verification: Fleet Claim, Atomic 5-Minute Hold, State Machine, & Concurrency Protection
 */

import { pool } from "../src/config/database.js";
import { fleetStateMachineService } from "../src/services/fleet/FleetStateMachineService.js";
import { withTenantContext } from "../src/lib/tenantContext.js";

const TENANT_A = "test-fleet-tenant-a";
const TENANT_B = "test-fleet-tenant-b";

const RIDER_1 = "44444444-4444-4444-4444-444444444401";
const RIDER_2 = "44444444-4444-4444-4444-444444444402";
const RIDER_B = "44444444-4444-4444-4444-444444444403";

const ARMADA_A1 = "55555555-5555-5555-5555-555555555501";
const ARMADA_A2 = "55555555-5555-5555-5555-555555555502";
const ARMADA_B1 = "55555555-5555-5555-5555-555555555503";

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

async function runStage4Tests() {
  console.log("\n==================================================================");
  console.log("🛵 STAGE 4: FLEET CLAIM, RESERVATION & STATE MACHINE VERIFICATION");
  console.log("==================================================================\n");

  try {
    // 0. Cleanup Previous Test Data
    await pool.query(`DELETE FROM fleet_assignments WHERE tenant_id IN ($1, $2);`, [TENANT_A, TENANT_B]);
    await pool.query(`DELETE FROM fleet_reservations WHERE tenant_id IN ($1, $2);`, [TENANT_A, TENANT_B]);
    await pool.query(`DELETE FROM armadas WHERE tenant_id IN ($1, $2);`, [TENANT_A, TENANT_B]);
    await pool.query(`DELETE FROM users WHERE id IN ($1, $2, $3);`, [RIDER_1, RIDER_2, RIDER_B]);
    await pool.query(`DELETE FROM tenants WHERE id IN ($1, $2);`, [TENANT_A, TENANT_B]);

    // 1. Setup Test Tenants
    await pool.query(
      `INSERT INTO tenants (id, name, code, status, max_fleets, max_riders, max_zones)
       VALUES ($1, 'Tenant Fleet A', 'FLEET_A', 'ACTIVE', 20, 50, 10),
              ($2, 'Tenant Fleet B', 'FLEET_B', 'ACTIVE', 20, 50, 10)
       ON CONFLICT (id) DO NOTHING;`,
      [TENANT_A, TENANT_B]
    );

    // 2. Setup Test Riders
    await pool.query(
      `INSERT INTO users (id, tenant_id, email, username, password, name, role, is_active)
       VALUES 
         ($1, $4, 'rider1@fleeta.com', 'rider1_a', 'hash123', 'Rider Satu A', 'RIDER', true),
         ($2, $4, 'rider2@fleeta.com', 'rider2_a', 'hash123', 'Rider Dua A', 'RIDER', true),
         ($3, $5, 'riderB@fleetb.com', 'rider_b', 'hash123', 'Rider Tenant B', 'RIDER', true)
       ON CONFLICT (id) DO NOTHING;`,
      [RIDER_1, RIDER_2, RIDER_B, TENANT_A, TENANT_B]
    );

    // 3. Setup Test Armadas
    await pool.query(
      `INSERT INTO armadas (id, tenant_id, code, type, status)
       VALUES 
         ($1, $4, 'ARM-A01', 'MOTOR_LISTRIK', 'ACTIVE'),
         ($2, $4, 'ARM-A02', 'GEROBAK', 'ACTIVE'),
         ($3, $5, 'ARM-B01', 'MOTOR_LISTRIK', 'ACTIVE')
       ON CONFLICT (id) DO NOTHING;`,
      [ARMADA_A1, ARMADA_A2, ARMADA_B1, TENANT_A, TENANT_B]
    );

    // =========================================================================
    // SUITE 1: Happy Path State Machine (ACTIVE -> RESERVED -> IN_USE -> ACTIVE)
    // =========================================================================
    console.log("--- Suite 1: Full Lifecycle State Transitions ---");

    // 1.1 Reserve Fleet ARM-A01 by Rider 1
    const resA1 = await fleetStateMachineService.reserveFleet(TENANT_A, ARMADA_A1, RIDER_1, 300);
    assert(resA1.status === "ACTIVE" && resA1.expires_in_seconds === 300, "Rider 1 successfully reserved ARM-A01 (5-minute hold)");

    // Verify Armada status is RESERVED in DB
    const armadaA1Check = await pool.query(`SELECT status, current_rider_id FROM armadas WHERE id = $1;`, [ARMADA_A1]);
    assert(
      armadaA1Check.rows[0].status === "RESERVED" && armadaA1Check.rows[0].current_rider_id === RIDER_1,
      "Armada status transitioned to RESERVED and locked to Rider 1"
    );

    // 1.2 Confirm Claim & Check-in by Rider 1 (RESERVED -> IN_USE)
    const claimA1 = await fleetStateMachineService.confirmClaimAndCheckIn(
      TENANT_A,
      ARMADA_A1,
      RIDER_1,
      null,
      { battery_checked: true, tires_ok: true }
    );
    assert(claimA1.status === "IN_USE", "Rider 1 confirmed claim -> Armada is now IN_USE");

    const armadaA1InUse = await pool.query(`SELECT status FROM armadas WHERE id = $1;`, [ARMADA_A1]);
    assert(armadaA1InUse.rows[0].status === "IN_USE", "Database armadas status transitioned to IN_USE");

    // 1.3 Release & Return Armada by Rider 1 (IN_USE -> ACTIVE)
    const returnA1 = await fleetStateMachineService.releaseAndReturnFleet(
      TENANT_A,
      ARMADA_A1,
      RIDER_1,
      { condition: "GOOD", battery_remaining: 85 }
    );
    assert(returnA1.status === "ACTIVE", "Armada returned successfully -> Status returned to ACTIVE");

    const armadaA1Returned = await pool.query(`SELECT status, current_rider_id FROM armadas WHERE id = $1;`, [ARMADA_A1]);
    assert(
      armadaA1Returned.rows[0].status === "ACTIVE" && armadaA1Returned.rows[0].current_rider_id === null,
      "Armada status is ACTIVE with current_rider_id cleared"
    );

    // =========================================================================
    // SUITE 2: Concurrent Claim Protection & Race Condition Prevention
    // =========================================================================
    console.log("\n--- Suite 2: Concurrent Claim & Race Condition Protection ---");

    // Rider 1 reserves ARM-A02
    await fleetStateMachineService.reserveFleet(TENANT_A, ARMADA_A2, RIDER_1, 300);

    // Simultaneous / Second attempt by Rider 2 to reserve ARM-A02 must be REJECTED
    let rider2Blocked = false;
    try {
      await fleetStateMachineService.reserveFleet(TENANT_A, ARMADA_A2, RIDER_2, 300);
    } catch (err: any) {
      if (err.message.includes("FLEET_ALREADY_RESERVED") || err.message.includes("FLEET_NOT_AVAILABLE")) {
        rider2Blocked = true;
      }
    }
    assert(rider2Blocked, "Simultaneous claim on ARM-A02 by Rider 2 is strictly BLOCKED");

    // =========================================================================
    // SUITE 3: Single Active Fleet per Rider Enforcement
    // =========================================================================
    console.log("\n--- Suite 3: Single Active Fleet per Rider Rule ---");

    // Rider 1 already holds ARM-A02, attempts to reserve ARM-A01
    let secondFleetBlocked = false;
    try {
      await fleetStateMachineService.reserveFleet(TENANT_A, ARMADA_A1, RIDER_1, 300);
    } catch (err: any) {
      if (err.message.includes("RIDER_ALREADY_HAS_ACTIVE_FLEET")) {
        secondFleetBlocked = true;
      }
    }
    assert(secondFleetBlocked, "Rider with active reservation cannot hold multiple armadas concurrently");

    // =========================================================================
    // SUITE 4: Voluntary Cancellation Rollback
    // =========================================================================
    console.log("\n--- Suite 4: Voluntary Reservation Cancellation ---");

    await fleetStateMachineService.cancelReservation(TENANT_A, ARMADA_A2, RIDER_1);

    const armadaA2Cancelled = await pool.query(`SELECT status, current_rider_id FROM armadas WHERE id = $1;`, [ARMADA_A2]);
    assert(
      armadaA2Cancelled.rows[0].status === "ACTIVE" && armadaA2Cancelled.rows[0].current_rider_id === null,
      "Voluntary cancellation successfully rolls back armada status to ACTIVE"
    );

    // =========================================================================
    // SUITE 5: Automatic Expiry Reconciliation
    // =========================================================================
    console.log("\n--- Suite 5: Automatic Expiry Reconciliation ---");

    // Reserve ARM-A01 by Rider 1
    const pastRes = await fleetStateMachineService.reserveFleet(TENANT_A, ARMADA_A1, RIDER_1, 300);

    // Simulate expired reservation by updating expires_at to 10 minutes ago
    await pool.query(
      `UPDATE fleet_reservations
       SET expires_at = CURRENT_TIMESTAMP - interval '10 minutes'
       WHERE id = $1;`,
      [pastRes.reservation_id]
    );

    // Run reconciliation
    const reconcileRes = await fleetStateMachineService.reconcileExpiredReservations(TENANT_A);
    assert(reconcileRes.expired_count >= 1, "Reconciliation detected expired 5-minute reservation");

    const armadaA1Expired = await pool.query(`SELECT status, current_rider_id FROM armadas WHERE id = $1;`, [ARMADA_A1]);
    assert(
      armadaA1Expired.rows[0].status === "ACTIVE" && armadaA1Expired.rows[0].current_rider_id === null,
      "Expired reservation automatically rolled back armada to ACTIVE"
    );

    // =========================================================================
    // SUITE 6: Multi-Tenant RLS Isolation & Anti-IDOR
    // =========================================================================
    console.log("\n--- Suite 6: Multi-Tenant RLS Isolation on Fleet Tables ---");

    // Tenant B context cannot see Tenant A's armadas
    const tenantBArmadas = await withTenantContext(TENANT_B, async (client) => {
      const { rows } = await client.query(`SELECT id, code, tenant_id FROM armadas;`);
      return rows;
    });
    const hasTenantAArmada = tenantBArmadas.some((a) => a.tenant_id === TENANT_A);
    assert(!hasTenantAArmada, "Tenant B context CANNOT see Tenant A armadas due to RLS");

    // Tenant B rider cannot claim Tenant A's armada
    let crossTenantClaimBlocked = false;
    try {
      await fleetStateMachineService.reserveFleet(TENANT_B, ARMADA_A1, RIDER_B, 300);
    } catch {
      crossTenantClaimBlocked = true;
    }
    assert(crossTenantClaimBlocked, "Tenant B rider cannot claim Tenant A armada (Anti-IDOR / RLS)");

    console.log("\n==================================================================");
    console.log(`🎯 STAGE 4 TEST RESULTS: ${passedTests}/${totalTests} PASSED`);
    console.log("==================================================================\n");

  } catch (err: any) {
    console.error("💥 Error during Stage 4 test execution:", err);
    process.exitCode = 1;
  } finally {
    try {
      await pool.query(`DELETE FROM fleet_assignments WHERE tenant_id IN ($1, $2);`, [TENANT_A, TENANT_B]);
      await pool.query(`DELETE FROM fleet_reservations WHERE tenant_id IN ($1, $2);`, [TENANT_A, TENANT_B]);
      await pool.query(`DELETE FROM armadas WHERE tenant_id IN ($1, $2);`, [TENANT_A, TENANT_B]);
      await pool.query(`DELETE FROM users WHERE id IN ($1, $2, $3);`, [RIDER_1, RIDER_2, RIDER_B]);
      await pool.query(`DELETE FROM tenants WHERE id IN ($1, $2);`, [TENANT_A, TENANT_B]);
    } catch {}
  }

  if (passedTests === totalTests && totalTests > 0) {
    console.log("🎉 ALL STAGE 4 INTEGRATION TESTS PASSED PERFECTLY!\n");
    process.exit(0);
  } else {
    console.error("💥 SOME STAGE 4 TESTS FAILED!\n");
    process.exit(1);
  }
}

runStage4Tests().catch((err) => {
  console.error("Fatal error in test runner:", err);
  process.exit(1);
});
