/*
 * part13_audit_cron.test.ts
 * Comprehensive Integration & Verification Test Suite for PART 13:
 * Audit Logging (Append-Only, IP & UA tracking), Cron Manager & Redis Distributed Locks,
 * Notification Lifecycle (Create, Read, Mark All, Delete), and BullMQ Queue Readiness.
 */

import { pool } from "../src/config/database.js";
import { redisClient } from "../src/config/redis.js";
import { auditService } from "../src/services/auditService.js";
import { cronManagerService } from "../src/services/cron/CronManagerService.js";
import { notificationRepository } from "../src/repositories/notificationRepository.js";
import { armadaHoldQueue } from "../src/queues/armadaHoldQueue.js";
import { notificationQueue } from "../src/queues/notificationQueue.js";
import { dssBatchQueue } from "../src/queues/dssBatchQueue.js";
import { overpassSyncQueue } from "../src/queues/overpassQueue.js";

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

async function runPart13Tests() {
  console.log("\n========================================================");
  console.log("🧪 RUNNING PART 13: AUDIT, CRON, QUEUES & NOTIFICATIONS");
  console.log("========================================================\n");

  const testSuffix = Date.now();
  let testUserId = "";

  // Create a temporary test user
  const userRes = await pool.query(`
    INSERT INTO users (id, username, name, email, password, role, is_active)
    VALUES (gen_random_uuid(), $1, 'Audit Test User', $2, 'hash', 'SUPERVISOR', true)
    RETURNING id;
  `, [`audit_user_${testSuffix}`, `audit_user_${testSuffix}@koling.com`]);
  testUserId = userRes.rows[0].id;

  // -------------------------------------------------------------
  // GROUP 1: Security Audit Logging (AUDIT-001, AUDIT-002, AUDIT-003)
  // -------------------------------------------------------------
  console.log("🛡️ [GROUP 1] Security & Operational Audit Logging");

  await auditService.logAction({
    userId: testUserId,
    userRole: "SUPERVISOR",
    action: "OVERRIDE_DISTRIBUTION",
    entityType: "ZONE_ASSIGNMENT",
    entityId: "test-entity-uuid",
    details: { reason: "Special operational request" },
    ipAddress: "192.168.1.100",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    status: "SUCCESS",
  });

  const auditRes = await auditService.getAuditLogs({
    userId: testUserId,
    action: "OVERRIDE_DISTRIBUTION",
  });

  assert(auditRes && Array.isArray(auditRes.logs), "TEST 1.1: Audit logs returned as array");
  assert(auditRes.logs.length >= 1, "TEST 1.2: Audit log successfully written and queried");
  assert(auditRes.logs[0].ip_address === "192.168.1.100", "TEST 1.3: Audit log preserves IP address");
  assert(auditRes.logs[0].user_agent.includes("Mozilla"), "TEST 1.4: Audit log preserves User-Agent");

  // -------------------------------------------------------------
  // GROUP 2: Cron Manager & Redis Distributed Locking (CRON-002, CRON-003)
  // -------------------------------------------------------------
  console.log("\n⏰ [GROUP 2] Cron Management & Redis Distributed Locks");

  const cronRes = await cronManagerService.getCronConfigs();
  assert(cronRes && Array.isArray(cronRes.configs), "TEST 2.1: Cron manager returns registered cron configurations");

  // Test Redis mutex lock
  const lockKey = `lock:cron:test_job_${testSuffix}`;
  const lockAcquired = await redisClient.set(lockKey, "LOCKED", { NX: true, EX: 10 });
  assert(lockAcquired === "OK", "TEST 2.2: First attempt acquires Redis mutex lock");

  const secondAttempt = await redisClient.set(lockKey, "LOCKED", { NX: true, EX: 10 });
  assert(secondAttempt === null, "TEST 2.3: Duplicate execution correctly blocked by Redis mutex lock");

  await redisClient.del(lockKey);
  const reacquireAfterRelease = await redisClient.set(lockKey, "LOCKED", { NX: true, EX: 10 });
  assert(reacquireAfterRelease === "OK", "TEST 2.4: Mutex lock re-acquirable after explicit release");
  await redisClient.del(lockKey);

  // -------------------------------------------------------------
  // GROUP 3: Notification System Lifecycle (NOTIF-001, NOTIF-002, NOTIF-003)
  // -------------------------------------------------------------
  console.log("\n🔔 [GROUP 3] User Notification Lifecycle");

  // 1. Create notification
  const notif = await notificationRepository.createNotification({
    user_id: testUserId,
    title: "Tugas Baru Dialokasikan",
    message: "Anda telah ditugaskan ke Zona Surabaya Timur",
  });
  assert(notif && notif.id, "TEST 3.1: Notification successfully created in database");
  assert(notif.is_read === false, "TEST 3.2: Newly created notification is unread (is_read=false)");

  // 2. Query user notifications
  const userNotifs = await notificationRepository.getNotificationsByUserId(testUserId);
  assert(userNotifs.length >= 1, "TEST 3.3: User can retrieve personal notification feed");

  // 3. Mark single notification as read
  const markReadSuccess = await notificationRepository.markAsRead(notif.id, testUserId);
  assert(markReadSuccess === true, "TEST 3.4: Single notification marked as read");

  // 4. Mark all as read
  const markAllCount = await notificationRepository.markAllAsRead(testUserId);
  assert(typeof markAllCount === "number", "TEST 3.5: Mark all as read executes cleanly");

  // 5. Delete notification
  const deleteSuccess = await notificationRepository.deleteNotification(notif.id, testUserId);
  assert(deleteSuccess === true, "TEST 3.6: Notification deleted successfully");

  // -------------------------------------------------------------
  // GROUP 4: BullMQ Background Queue Instances Readiness (CRON-001)
  // -------------------------------------------------------------
  console.log("\n⚡ [GROUP 4] BullMQ Background Queues Readiness");

  assert(armadaHoldQueue !== null && armadaHoldQueue.name !== undefined, "TEST 4.1: armadaHoldQueue is initialized");
  assert(notificationQueue !== null && notificationQueue.name !== undefined, "TEST 4.2: notificationQueue is initialized");
  assert(dssBatchQueue !== null && dssBatchQueue.name !== undefined, "TEST 4.3: dssBatchQueue is initialized");
  assert(overpassSyncQueue !== null && overpassSyncQueue.name !== undefined, "TEST 4.4: overpassSyncQueue is initialized");

  // -------------------------------------------------------------
  // CLEANUP
  // -------------------------------------------------------------
  try {
    await pool.query("DELETE FROM audit_logs WHERE user_id = $1;", [testUserId]);
    await pool.query("DELETE FROM notifications WHERE user_id = $1;", [testUserId]);
    await pool.query("DELETE FROM users WHERE id = $1;", [testUserId]);
  } catch (err: any) {
    console.warn("Cleanup warning:", err.message);
  }

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log("\n========================================================");
  console.log(`📊 PART 13 TEST RESULTS: ${passedTests}/${totalTests} PASSED`);
  console.log("========================================================\n");

  if (passedTests === totalTests) {
    console.log("🎉 ALL PART 13 TESTS PASSED PERFECTLY!");
    process.exit(0);
  } else {
    console.error("❌ SOME PART 13 TESTS FAILED.");
    process.exit(1);
  }
}

runPart13Tests().catch((err) => {
  console.error("💥 Unhandled error during PART 13 test execution:", err);
  process.exit(1);
});
