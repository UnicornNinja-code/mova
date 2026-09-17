/*
 * part01_auth_onboarding.test.ts
 * Comprehensive Integration & Verification Test Suite for PART 01:
 * Auth Lifecycle, Security Policies, Operational Geographic Context SSOT, and Setup Wizard.
 */

import { pool } from "../src/config/database.js";
import { loginService, refreshTokenService, logoutService } from "../src/services/authService.js";
import {
  OperationalContextService,
  OperationalConfigurationError,
} from "../src/services/spatial/OperationalContextService.js";
import { systemReadinessService } from "../src/services/system/systemReadinessService.js";
import { SystemSettingModel } from "../src/models/systemSettingModel.js";

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

async function runPart01Tests() {
  console.log("\n========================================================");
  console.log("🧪 RUNNING PART 01: AUTH & ONBOARDING VERIFICATION SUITE");
  console.log("========================================================\n");

  // -------------------------------------------------------------
  // GROUP 1: Operational Geographic Context SSOT (ONB-001 - ONB-009)
  // -------------------------------------------------------------
  console.log("📍 [GROUP 1] OperationalContextService & Geographic SSOT Verification");
  const opContextService = OperationalContextService.getInstance();
  const context = await opContextService.getOperationalContext(true);

  assert(context !== null, "TEST 1.1: Operational context is loaded from system_settings");
  assert(context.hubCityName === "Surabaya", "TEST 1.2: Hub city name is 'Surabaya'");
  assert(typeof context.latitude === "number" && Math.abs(context.latitude - (-7.2575)) < 0.1, "TEST 1.3: Hub latitude matches Surabaya");
  assert(typeof context.longitude === "number" && Math.abs(context.longitude - 112.7521) < 0.1, "TEST 1.4: Hub longitude matches Surabaya");
  assert(context.radiusKm > 0, "TEST 1.5: Operational radius is positive KM", context.radiusKm);
  assert(context.bbox && context.bbox.minLat < context.bbox.maxLat, "TEST 1.6: Dynamic Bounding Box is valid");

  // TEST 1.7: In-memory Caching & Cache Invalidation
  const cached = await opContextService.getOperationalContext(false);
  assert(cached === context, "TEST 1.7: OperationalContext returns cached reference within TTL");
  opContextService.invalidateCache();

  // TEST 1.8: Fail-safe 422 on Missing Hub Configuration
  const mockEmptyPool = {
    query: async () => ({ rows: [] }),
  };
  const isolatedService = new (OperationalContextService as any)();
  isolatedService.setDbPool(mockEmptyPool);
  let threw422 = false;
  try {
    await isolatedService.getOperationalContext(true);
  } catch (err: any) {
    if (err instanceof OperationalConfigurationError && err.statusCode === 422 && err.code === "OPERATIONAL_SCOPE_NOT_CONFIGURED") {
      threw422 = true;
    }
  }
  assert(threw422, "TEST 1.8: Missing operational configuration safely throws HTTP 422 OPERATIONAL_SCOPE_NOT_CONFIGURED");

  // -------------------------------------------------------------
  // GROUP 2: System Readiness & Setup Status (ONB-010 - ONB-011)
  // -------------------------------------------------------------
  console.log("\n⚙️ [GROUP 2] System Readiness & Onboarding Setup Status");
  const readiness = await systemReadinessService.evaluateSystemReadiness();
  assert(readiness !== null && typeof readiness.readiness_percentage === "number", "TEST 2.1: System readiness evaluation returns structured report");
  assert(readiness.hub_config && readiness.hub_config.city_name === "Surabaya", "TEST 2.2: Readiness report confirms hub city is Surabaya");
  assert(readiness.items && Array.isArray(readiness.items) && readiness.items.length > 0, "TEST 2.3: Readiness items array is populated");

  const setupState = await SystemSettingModel.getInitializationState();
  assert(setupState && typeof setupState.status === "string", "TEST 2.4: Setup state returns initialization status (status: " + setupState.status + ")");
  assert(setupState.hub_config && setupState.hub_config.hub_city_name === "Surabaya", "TEST 2.5: Setup state confirms Surabaya hub");

  // -------------------------------------------------------------
  // GROUP 3: Authentication Lifecycle (AUTH-001 - AUTH-005)
  // -------------------------------------------------------------
  console.log("\n🔐 [GROUP 3] Authentication Lifecycle (Login, Refresh, Logout, Status)");

  // Find active superadmin user
  const { rows: adminRows } = await pool.query(
    "SELECT id, email, username, role, is_active FROM users WHERE role = 'SUPERADMIN' AND is_active = true LIMIT 1;"
  );
  assert(adminRows.length > 0, "TEST 3.1: Active SUPERADMIN user exists in database");

  if (adminRows.length > 0) {
    const adminUser = adminRows[0];

    // TEST 3.2: Login with Valid Credentials
    const loginResult = await loginService({
      identifier: adminUser.email,
      password: "password123",
      ip_address: "127.0.0.1",
      user_agent: "Bun-Test-Agent",
    });

    assert(loginResult && typeof loginResult.token === "string", "TEST 3.2: Valid login issues JWT access token");
    assert(typeof loginResult.refreshToken === "string", "TEST 3.3: Valid login issues refresh token");
    assert(loginResult.user && loginResult.user.email === adminUser.email, "TEST 3.4: Login returns sanitized user object");
    assert(loginResult.user.role === "SUPERADMIN", "TEST 3.5: User role matches SUPERADMIN");

    // TEST 3.6: Refresh Token Rotation
    const refreshed = await refreshTokenService(
      loginResult.refreshToken,
      "127.0.0.1",
      "Bun-Test-Agent"
    );
    assert(refreshed && typeof refreshed.token === "string", "TEST 3.6: Refresh token rotation issues new access token");
    assert(typeof refreshed.refreshToken === "string", "TEST 3.7: Refresh token rotation issues new refresh token");

    // TEST 3.8: Logout and Token Invalidation
    const logoutResult = await logoutService(
      refreshed.refreshToken,
      refreshed.token,
      adminUser.id,
      adminUser.role
    );
    assert(logoutResult && logoutResult.success === true, "TEST 3.8: Logout successfully invalidates session");

    // TEST 3.9: Old Refresh Token is now Revoked
    let refreshFailed = false;
    try {
      await refreshTokenService(refreshed.refreshToken, "127.0.0.1", "Bun-Test-Agent");
    } catch {
      refreshFailed = true;
    }
    assert(refreshFailed, "TEST 3.9: Revoked refresh token cannot be reused");
  }

  // TEST 3.10: Invalid Credentials Rejected (AUTH-001)
  let invalidCredsRejected = false;
  try {
    await loginService({
      identifier: "nonexistent_user@system.local",
      password: "WrongPassword!",
      ip_address: "127.0.0.1",
      user_agent: "Bun-Test-Agent",
    });
  } catch (err: any) {
    if (err.statusCode === 400 || err.statusCode === 401) {
      invalidCredsRejected = true;
    }
  }
  assert(invalidCredsRejected, "TEST 3.10: Login with invalid credentials safely rejected with 400/401");

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log("\n========================================================");
  console.log(`📊 PART 01 TEST RESULTS: ${passedTests}/${totalTests} PASSED`);
  console.log("========================================================\n");

  if (passedTests === totalTests) {
    console.log("🎉 ALL PART 01 TESTS PASSED PERFECTLY!");
    process.exit(0);
  } else {
    console.error("❌ SOME PART 01 TESTS FAILED.");
    process.exit(1);
  }
}

runPart01Tests().catch((err) => {
  console.error("💥 Unhandled error during PART 01 test execution:", err);
  process.exit(1);
});
