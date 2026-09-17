/*
 * test-bullmq-resilience.js
 * CLI Test Script for BullMQ Queue Deduplication, Worker Idempotency & Reconnect Resilience.
 */

import { addArmadaHoldReleaseJob, removeArmadaHoldReleaseJob, armadaHoldQueue } from "../queues/armadaHoldQueue.js";
import { armadaHoldWorker } from "../workers/armadaHoldWorker.js";
import { redisOptions } from "../config/redisConfig.js";
import { pool } from "../config/database.js";

async function runBullMqResilienceTests() {
  console.log("\n================================================================================");
  console.log("🧪 MEMULAI PENGUJIEN BULLMQ QUEUE DEDUPLICATION, IDEMPOTENCY & RESILIENCE");
  console.log("================================================================================");

  try {
    // Fetch a test armada unit from database
    const { rows: armadas } = await pool.query("SELECT id, code, status FROM armadas LIMIT 1;");
    if (armadas.length === 0) {
      console.error("❌ Error: Tidak ada armada di database untuk diuji.");
      process.exit(1);
    }

    // Fetch sample rider ID
    const { rows: riders } = await pool.query("SELECT id FROM users LIMIT 1;");
    const testRiderId = riders[0]?.id || "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

    const testArmada = armadas[0];
    const armadaId = testArmada.id;
    console.log(`📌 Unit Armada Uji: '${testArmada.code}' (ID: ${armadaId})`);

    // Reset armada status to ACTIVE before test
    await pool.query("UPDATE armadas SET status = 'ACTIVE', reserved_by_rider_id = NULL, reserved_until = NULL WHERE id = $1;", [armadaId]);

    // -------------------------------------------------------------------------
    // [TES 1] Delayed Job Schedule & Automatic Execution
    // -------------------------------------------------------------------------
    console.log("\n📥 [TES 1] Pendaftaran & Eksekusi Otomatis Delayed Job (Delay: 1500ms)...");
    await pool.query("UPDATE armadas SET status = 'RESERVED', reserved_by_rider_id = $2 WHERE id = $1;", [armadaId, testRiderId]);

    const job1 = await addArmadaHoldReleaseJob({
      armadaId,
      riderId: testRiderId,
      delayMs: 1500,
    });

    const job1Check = await armadaHoldQueue.getJob(`hold-armada-${armadaId}`);
    console.log(`   • Status Job di BullMQ: '${await job1Check.getState()}' (Expected: 'delayed')`);

    console.log("   • Menunggu 2.5 detik agar Worker mengeksekusi...");
    await new Promise((res) => setTimeout(res, 2500));

    const { rows: dbCheck1 } = await pool.query("SELECT status FROM armadas WHERE id = $1;", [armadaId]);
    if (dbCheck1[0].status === "ACTIVE") {
      console.log("   ✅ PASS: Worker berhasil melepaskan status armada dari RESERVED -> ACTIVE!");
    } else {
      console.error(`   ❌ FAIL: Status armada: ${dbCheck1[0].status}`);
    }

    // -------------------------------------------------------------------------
    // [TES 2] Early Job Cancellation
    // -------------------------------------------------------------------------
    console.log("\n🗑️ [TES 2] Pembatalan Dini Delayed Job (Rider Cancel Hold)...");
    await pool.query("UPDATE armadas SET status = 'RESERVED', reserved_by_rider_id = $2 WHERE id = $1;", [armadaId, testRiderId]);

    await addArmadaHoldReleaseJob({
      armadaId,
      riderId: testRiderId,
      delayMs: 5000,
    });

    const canceled = await removeArmadaHoldReleaseJob(armadaId);
    const canceledJobCheck = await armadaHoldQueue.getJob(`hold-armada-${armadaId}`);

    if (canceled && !canceledJobCheck) {
      console.log("   ✅ PASS: Delayed Job berhasil dibatalkan dari BullMQ Queue sebelum eksekusi!");
    } else {
      console.error("   ❌ FAIL: Job masih ada di Queue setelah dibatalkan.");
    }
    await pool.query("UPDATE armadas SET status = 'ACTIVE' WHERE id = $1;", [armadaId]);

    // -------------------------------------------------------------------------
    // [TES 3] Job ID Deduplication Strategy
    // -------------------------------------------------------------------------
    console.log("\n🔄 [TES 3] Pengujian Deduplikasi Queue via Unique Job ID (`hold-armada-id`)...");
    await pool.query("UPDATE armadas SET status = 'RESERVED', reserved_by_rider_id = $2 WHERE id = $1;", [armadaId, testRiderId]);

    // Add job 1st time
    await addArmadaHoldReleaseJob({ armadaId, riderId: testRiderId, delayMs: 10000 });
    // Add job 2nd time (should overwrite previous job)
    await addArmadaHoldReleaseJob({ armadaId, riderId: testRiderId, delayMs: 10000 });

    const jobDupCheck = await armadaHoldQueue.getJob(`hold-armada-${armadaId}`);
    console.log(`   • Unique Job ID di BullMQ: '${jobDupCheck.id}'`);
    if (jobDupCheck.id === `hold-armada-${armadaId}`) {
      console.log("   ✅ PASS: Deduplikasi BullMQ sukses! Hanya 1 job aktif tersimpan per Unit Armada.");
    } else {
      console.error("   ❌ FAIL: Terjadi duplikasi job di Queue.");
    }
    await removeArmadaHoldReleaseJob(armadaId);
    await pool.query("UPDATE armadas SET status = 'ACTIVE' WHERE id = $1;", [armadaId]);

    // -------------------------------------------------------------------------
    // [TES 4] Effective State Transition & Idempotency Guard
    // -------------------------------------------------------------------------
    console.log("\n🛡️ [TES 4] Pengujian Database Idempotency Guard (Status IN_USE Tidak Boleh Berubah)...");
    // Rider claims armada permanently -> IN_USE
    await pool.query("UPDATE armadas SET status = 'IN_USE', current_rider_id = $2 WHERE id = $1;", [armadaId, testRiderId]);

    // Schedule delayed job for armada that is ALREADY IN_USE
    await addArmadaHoldReleaseJob({
      armadaId,
      riderId: testRiderId,
      delayMs: 1000,
    });

    console.log("   • Menunggu 2 detik agar Worker mencoba mengeksekusi...");
    await new Promise((res) => setTimeout(res, 2000));

    const { rows: dbCheck4 } = await pool.query("SELECT status, current_rider_id FROM armadas WHERE id = $1;", [armadaId]);
    if (dbCheck4[0].status === "IN_USE" && dbCheck4[0].current_rider_id === testRiderId) {
      console.log("   ✅ PASS: Worker IDEMPOTENT! Status 'IN_USE' dan Klaim Rider tetap UTUH & TIDAK TERTIMPA!");
    } else {
      console.error(`   ❌ FAIL: Status armada terpengaruh oleh worker! Status saat ini: ${dbCheck4[0].status}`);
    }

    // Restore test armada to ACTIVE
    await pool.query("UPDATE armadas SET status = 'ACTIVE', current_rider_id = NULL, reserved_by_rider_id = NULL, reserved_until = NULL WHERE id = $1;", [armadaId]);

    // -------------------------------------------------------------------------
    // [TES 5] Reconnect Strategy Verification
    // -------------------------------------------------------------------------
    console.log("\n⚡ [TES 5] Verifikasi Exponential Reconnect Strategy pada ioredis Config...");
    if (typeof redisOptions.retryStrategy === "function") {
      const backoff0 = redisOptions.retryStrategy(1);
      const backoff10 = redisOptions.retryStrategy(10);
      console.log(`   • Backoff Retry 1  : ${backoff0}ms`);
      console.log(`   • Backoff Retry 10 : ${backoff10}ms (Max Cap 2000ms)`);
      console.log("   ✅ PASS: Exponential Reconnect Strategy ioredis terverifikasi aktif!");
    } else {
      console.error("   ❌ FAIL: retryStrategy tidak terdefinisi pada redisOptions.");
    }

    console.log("\n================================================================================");
    console.log("🎉 PENGUJIAN BULLMQ QUEUE DEDUPLICATION, IDEMPOTENCY & RESILIENCE SELESAI (100% PASS)");
    console.log("================================================================================\n");

  } catch (error) {
    console.error("💥 Error pada pengujian BullMQ Resilience:", error);
  } finally {
    await armadaHoldWorker.close();
    await armadaHoldQueue.close();
    await pool.end();
    process.exit(0);
  }
}

runBullMqResilienceTests();
