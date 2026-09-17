/*
 * part02_user_rider.test.ts
 * Comprehensive Integration & Verification Test Suite for PART 02:
 * User Management CRUD, RBAC Creation Hierarchy, Rider Operational Lifecycle & Duty Queue Idempotency.
 */

import { pool } from "../src/config/database.js";
import {
  createUserService,
  updateUserService,
  setUserStatusService,
  deleteUserService,
  completeFirstLoginService,
} from "../src/services/userService.js";
import { distributionService } from "../src/services/distribution/DistributionService.js";
import { riderOperationalService } from "../src/services/rider/RiderOperationalService.js";
import { UserModel } from "../src/models/userModel.js";

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

async function runPart02Tests() {
  console.log("\n========================================================");
  console.log("🧪 RUNNING PART 02: USER & RIDER OPERATIONAL STATE TESTS");
  console.log("========================================================\n");

  const superadminUser = {
    id: "c9bb1357-5e1f-4d07-bac4-5b7cde8dea89",
    role: "SUPERADMIN",
    email: "superadmin@kopikeliling.com",
  };

  const managementUser = {
    id: "management-mock-id",
    role: "MANAGEMENT",
    email: "management@system.local",
  };

  const testSuffix = Date.now();
  const testRiderEmail = `test_rider_${testSuffix}@mova.id`;
  const testRiderUsername = `rider_${testSuffix}`;

  let createdRiderId: string | number = "";

  // -------------------------------------------------------------
  // GROUP 1: User CRUD & RBAC Hierarchy (USER-001 - USER-003, USER-010)
  // -------------------------------------------------------------
  console.log("👤 [GROUP 1] User CRUD & RBAC Hierarchy Verification");

  // TEST 1.1: Superadmin creates Rider account
  const newRider = await createUserService(
    {
      name: `Rider Test ${testSuffix}`,
      username: testRiderUsername,
      email: testRiderEmail,
      role: "RIDER",
      password: "InitialPassword123!",
    },
    superadminUser
  );

  assert(newRider && typeof newRider.id !== "undefined", "TEST 1.1: Superadmin creates Rider account successfully");
  createdRiderId = newRider.id;

  // TEST 1.2: Email uniqueness enforcement (USER-002)
  let duplicateEmailCaught = false;
  try {
    await createUserService(
      {
        name: "Duplicate Email Test",
        email: testRiderEmail,
        role: "RIDER",
      },
      superadminUser
    );
  } catch (err: any) {
    if (err.statusCode === 400 || err.statusCode === 409) {
      duplicateEmailCaught = true;
    }
  }
  assert(duplicateEmailCaught, "TEST 1.2: Duplicate email registration safely rejected with 400/409");

  // TEST 1.3: Management attempting to create SUPERADMIN is forbidden (RBAC)
  let managementSuperadminCaught = false;
  try {
    await createUserService(
      {
        name: "Unauthorized Superadmin",
        email: `unauth_admin_${testSuffix}@mova.id`,
        role: "SUPERADMIN",
      },
      managementUser
    );
  } catch (err: any) {
    if (err.statusCode === 403) {
      managementSuperadminCaught = true;
    }
  }
  assert(managementSuperadminCaught, "TEST 1.3: Management role forbidden from creating SUPERADMIN (HTTP 403)");

  // TEST 1.4: Update User Profile (USER-004)
  const updatedRider = await updateUserService(
    createdRiderId,
    { name: `Updated Rider Name ${testSuffix}` },
    superadminUser
  );
  assert(updatedRider && updatedRider.name.includes("Updated Rider Name"), "TEST 1.4: Superadmin can update user profile");

  // TEST 1.5: First Login Password Setup (USER-011)
  const firstLoginResult = await completeFirstLoginService(createdRiderId, {
    newPassword: "BrandNewSecurePassword2026!",
  });
  assert(firstLoginResult && firstLoginResult.success === true, "TEST 1.5: First login password setup succeeds");

  const verifiedUser = await UserModel.findById(createdRiderId);
  assert(verifiedUser && verifiedUser.first_login === false && verifiedUser.is_active === true, "TEST 1.6: First login clears first_login flag and activates account");

  // -------------------------------------------------------------
  // GROUP 2: Inactive Rider Account Protection (USER-010, RIDER-001)
  // -------------------------------------------------------------
  console.log("\n🚫 [GROUP 2] Inactive User Guard & Duty Protection");

  // Deactivate Rider
  await setUserStatusService(createdRiderId, false, superadminUser);
  const inactiveUser = await UserModel.findById(createdRiderId);
  assert(inactiveUser && inactiveUser.is_active === false, "TEST 2.1: User successfully deactivated (is_active = false)");

  // Inactive rider attempting duty confirmation must throw 403 RIDER_INACTIVE
  let inactiveDutyBlocked = false;
  try {
    await distributionService.confirmRiderDuty(createdRiderId);
  } catch (err: any) {
    if (err.statusCode === 403) {
      inactiveDutyBlocked = true;
    }
  }
  assert(inactiveDutyBlocked, "TEST 2.2: Inactive rider blocked from duty confirm (HTTP 403 RIDER_INACTIVE)");

  // Re-activate Rider for subsequent tests
  await setUserStatusService(createdRiderId, true, superadminUser);
  const activeUser = await UserModel.findById(createdRiderId);
  assert(activeUser && activeUser.is_active === true, "TEST 2.3: Rider re-activated successfully");

  // -------------------------------------------------------------
  // GROUP 3: Rider Daily Readiness & Idempotency (RIDER-002, RIDER-003, CONTRA-001)
  // -------------------------------------------------------------
  console.log("\n⚡ [GROUP 3] Rider Daily Readiness Confirmation & Idempotency");

  // TEST 3.1: First duty confirmation
  const firstDuty = await distributionService.confirmRiderDuty(createdRiderId);
  assert(firstDuty && typeof firstDuty.id !== "undefined", "TEST 3.1: First duty confirm creates queue record");
  assert(firstDuty.status === "WAITING", "TEST 3.2: Queue record status is initially 'WAITING'");
  assert(firstDuty.already_confirmed === false, "TEST 3.3: First confirm indicates already_confirmed = false");

  // TEST 3.4: Canonical Status Enum Check (CONTRA-001)
  const canonicalStatuses = ["WAITING", "PLOTTED", "CHECKED_IN", "COMPLETED", "NO_SHOW", "CANCELLED"];
  assert(canonicalStatuses.includes(firstDuty.status), "TEST 3.4: Status belongs to canonical enum (CONTRA-001)", firstDuty.status);

  // TEST 3.5: Idempotent Second Confirmation (same day)
  const secondDuty = await distributionService.confirmRiderDuty(createdRiderId);
  assert(secondDuty && secondDuty.id === firstDuty.id, "TEST 3.5: Second confirm returns the same queue entry ID (idempotent)");
  assert(secondDuty.already_confirmed === true, "TEST 3.6: Second confirm indicates already_confirmed = true");
  assert(secondDuty.status === "WAITING", "TEST 3.7: Queue status remains unchanged ('WAITING')");

  // TEST 3.8: Active Session Query (RIDER-004)
  const activeSession = await riderOperationalService.getRiderActiveSession(createdRiderId);
  assert(activeSession && typeof activeSession.has_active_session === "boolean", "TEST 3.8: Active session query returns structured response");

  // -------------------------------------------------------------
  // CLEANUP
  // -------------------------------------------------------------
  try {
    await pool.query("DELETE FROM rider_duty_queues WHERE rider_id = $1;", [createdRiderId]);
    await pool.query("DELETE FROM password_reset_tokens WHERE user_id = $1;", [createdRiderId]);
    await pool.query("DELETE FROM users WHERE id = $1;", [createdRiderId]);
  } catch (err: any) {
    console.warn("Cleanup warning:", err.message);
  }

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log("\n========================================================");
  console.log(`📊 PART 02 TEST RESULTS: ${passedTests}/${totalTests} PASSED`);
  console.log("========================================================\n");

  if (passedTests === totalTests) {
    console.log("🎉 ALL PART 02 TESTS PASSED PERFECTLY!");
    process.exit(0);
  } else {
    console.error("❌ SOME PART 02 TESTS FAILED.");
    process.exit(1);
  }
}

runPart02Tests().catch((err) => {
  console.error("💥 Unhandled error during PART 02 test execution:", err);
  process.exit(1);
});
