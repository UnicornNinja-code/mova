/*
 * part03_fleet.test.ts
 * Comprehensive Integration & Verification Test Suite for PART 03:
 * Fleet Inventory CRUD, 3-Minute View-Triggered Hold, Concurrency Mutex, Claim Flow, and Issue Escalation.
 */

import { pool } from "../src/config/database.js";
import { armadaService } from "../src/services/armadaService.js";
import { riderOperationalService } from "../src/services/rider/RiderOperationalService.js";
import { createUserService } from "../src/services/userService.js";

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

async function runPart03Tests() {
  console.log("\n========================================================");
  console.log("🧪 RUNNING PART 03: FLEET & 3-MINUTE HOLD LOCK TESTS");
  console.log("========================================================\n");

  const superadminUser = {
    id: "c9bb1357-5e1f-4d07-bac4-5b7cde8dea89",
    role: "SUPERADMIN",
    email: "superadmin@kopikeliling.com",
  };

  const testSuffix = Date.now();
  const testArmadaCode = `FLT-${testSuffix}`;
  let createdArmadaId: string | number = "";
  let riderA_Id: string | number = "";
  let riderB_Id: string | number = "";

  // -------------------------------------------------------------
  // SETUP: Create 2 Test Riders for Concurrency Testing
  // -------------------------------------------------------------
  const riderA = await createUserService(
    {
      name: `Rider A ${testSuffix}`,
      username: `rider_a_${testSuffix}`,
      email: `rider_a_${testSuffix}@mova.id`,
      role: "RIDER",
      password: "Password123!",
    },
    superadminUser
  );
  riderA_Id = riderA.id;

  const riderB = await createUserService(
    {
      name: `Rider B ${testSuffix}`,
      username: `rider_b_${testSuffix}`,
      email: `rider_b_${testSuffix}@mova.id`,
      role: "RIDER",
      password: "Password123!",
    },
    superadminUser
  );
  riderB_Id = riderB.id;

  // Activate both riders
  await pool.query("UPDATE users SET is_active = true, first_login = false WHERE id IN ($1, $2);", [riderA_Id, riderB_Id]);

  // -------------------------------------------------------------
  // GROUP 1: Fleet Inventory CRUD (FLEET-001, FLEET-002, FLEET-012)
  // -------------------------------------------------------------
  console.log("🛵 [GROUP 1] Fleet Inventory Master CRUD Verification");

  // TEST 1.1: Superadmin creates new Armada unit
  const newArmada = await armadaService.createArmada(
    {
      code: testArmadaCode,
      name: `Unit Kopi Keliling ${testSuffix}`,
      type: "MOTOR_LISTRIK",
      status: "ACTIVE",
    },
    superadminUser
  );

  assert(newArmada && typeof newArmada.id !== "undefined", "TEST 1.1: Superadmin creates Armada successfully");
  assert(newArmada.code === testArmadaCode, "TEST 1.2: Armada code matches formatted input");
  assert(newArmada.status === "ACTIVE", "TEST 1.3: Armada initial status is 'ACTIVE'");
  createdArmadaId = newArmada.id;

  // TEST 1.4: Duplicate armada code rejected
  let duplicateCodeCaught = false;
  try {
    await armadaService.createArmada(
      { code: testArmadaCode, type: "GEROBAK" },
      superadminUser
    );
  } catch (err: any) {
    if (err.statusCode === 400) {
      duplicateCodeCaught = true;
    }
  }
  assert(duplicateCodeCaught, "TEST 1.4: Duplicate armada code safely rejected with 400");

  // TEST 1.5: Read Fleet Catalog
  const { armadas } = await armadaService.getAllArmadas();
  assert(armadas && armadas.some((a: any) => String(a.id) === String(createdArmadaId)), "TEST 1.5: Created armada appears in fleet catalog");

  // -------------------------------------------------------------
  // GROUP 2: 3-Minute View-Triggered Hold & Concurrency Mutex (FLEET-003, FLEET-004)
  // -------------------------------------------------------------
  console.log("\n🔒 [GROUP 2] 3-Minute View-Triggered Hold & Concurrency Mutex");

  // TEST 2.1: Rider A inspects and holds armada
  const holdA = await riderOperationalService.inspectAndHoldArmada({
    riderId: riderA_Id,
    armadaId: createdArmadaId,
  });

  assert(holdA && holdA.armada, "TEST 2.1: Rider A successfully acquires 3-minute hold lock");
  assert(String(holdA.armada.reserved_by_rider_id) === String(riderA_Id), "TEST 2.2: Armada marked as reserved by Rider A");
  assert(holdA.armada.reserved_until !== null, "TEST 2.3: Hold expiration timestamp is set (3-min TTL)");

  // TEST 2.4: Rider B attempts concurrent hold on the same armada -> Conflict (409)
  let riderBConflictCaught = false;
  try {
    await riderOperationalService.inspectAndHoldArmada({
      riderId: riderB_Id,
      armadaId: createdArmadaId,
    });
  } catch (err: any) {
    if (err.statusCode === 409) {
      riderBConflictCaught = true;
    }
  }
  assert(riderBConflictCaught, "TEST 2.4: Concurrent hold by Rider B safely rejected with HTTP 409 Conflict");

  // TEST 2.5: Instant Hold Cancellation (Exit Modal)
  const cancelResult = await riderOperationalService.cancelArmadaHold({
    riderId: riderA_Id,
    armadaId: createdArmadaId,
  });
  assert(cancelResult && cancelResult.armada, "TEST 2.5: Rider A cancels hold and lock is released");

  // TEST 2.6: Rider B can now acquire hold on the released armada
  const holdB = await riderOperationalService.inspectAndHoldArmada({
    riderId: riderB_Id,
    armadaId: createdArmadaId,
  });
  assert(holdB && String(holdB.armada.reserved_by_rider_id) === String(riderB_Id), "TEST 2.6: Rider B successfully holds previously released armada");

  // -------------------------------------------------------------
  // GROUP 3: Final Claiming Flow (FLEET-006)
  // -------------------------------------------------------------
  console.log("\n📋 [GROUP 3] Final Armada Claiming & Status Transition");

  const claimResult = await riderOperationalService.confirmArmadaClaim({
    riderId: riderB_Id,
    armadaId: createdArmadaId,
    checklist: {
      rem_depan_baik: true,
      baterai_penuh: true,
      lampu_nyala: true,
      box_kopi_bersih: true,
    },
    notes: "Semua komponen dalam kondisi prima",
  });

  assert(claimResult && claimResult.armada, "TEST 3.1: Rider B claims armada successfully");
  assert(claimResult.armada.status === "IN_USE", "TEST 3.2: Armada status transitions to 'IN_USE'");
  assert(String(claimResult.armada.current_rider_id) === String(riderB_Id), "TEST 3.3: Armada current_rider_id bound to Rider B");

  // -------------------------------------------------------------
  // GROUP 4: Issue Reporting & Severity Escalation (FLEET-008, FLEET-009, FLEET-010)
  // -------------------------------------------------------------
  console.log("\n⚠️ [GROUP 4] Issue Reporting & Critical Severity Escalation");

  // TEST 4.1: Report Minor Issue (Armada remains in use)
  const minorIssue = await armadaService.reportIssue({
    armadaId: createdArmadaId,
    riderId: riderB_Id,
    severity: "MINOR",
    issueType: "COOLER",
    description: "Karet penutup boks pendingin agak longgar.",
  });
  assert(minorIssue && minorIssue.issue, "TEST 4.1: Minor issue report logged successfully");

  // TEST 4.2: Report Critical Issue (Auto-transitions to MAINTENANCE)
  const criticalIssue = await armadaService.reportIssue({
    armadaId: createdArmadaId,
    riderId: riderB_Id,
    severity: "CRITICAL",
    issueType: "BRAKE",
    description: "Rem belakang blong tiba-tiba saat di turunan.",
  });
  assert(criticalIssue && criticalIssue.issue, "TEST 4.2: Critical issue report logged");

  const maintainedArmada = await armadaService.getArmadaById(createdArmadaId);
  assert(maintainedArmada && maintainedArmada.status === "MAINTENANCE", "TEST 4.3: Critical issue auto-transitions armada to 'MAINTENANCE'");

  // TEST 4.4: Issue Resolution
  const resolveResult = await armadaService.resolveIssue(
    criticalIssue.issue.id,
    "Rem belakang sudah diganti kanvas baru dan di-bleeding.",
    superadminUser
  );
  assert(resolveResult && resolveResult.issue.status === "RESOLVED", "TEST 4.4: Issue resolved successfully");

  // -------------------------------------------------------------
  // CLEANUP
  // -------------------------------------------------------------
  try {
    await pool.query("DELETE FROM fleet_issue_reports WHERE armada_id = $1;", [createdArmadaId]);
    await pool.query("DELETE FROM fleet_assignments WHERE armada_id = $1;", [createdArmadaId]);
    await pool.query("DELETE FROM fleet_reservations WHERE armada_id = $1;", [createdArmadaId]);
    await pool.query("DELETE FROM armadas WHERE id = $1;", [createdArmadaId]);
    await pool.query("DELETE FROM users WHERE id IN ($1, $2);", [riderA_Id, riderB_Id]);
  } catch (err: any) {
    console.warn("Cleanup warning:", err.message);
  }

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log("\n========================================================");
  console.log(`📊 PART 03 TEST RESULTS: ${passedTests}/${totalTests} PASSED`);
  console.log("========================================================\n");

  if (passedTests === totalTests) {
    console.log("🎉 ALL PART 03 TESTS PASSED PERFECTLY!");
    process.exit(0);
  } else {
    console.error("❌ SOME PART 03 TESTS FAILED.");
    process.exit(1);
  }
}

runPart03Tests().catch((err) => {
  console.error("💥 Unhandled error during PART 03 test execution:", err);
  process.exit(1);
});
