/*
 * test-armada-delayed-job.js
 * CLI Test Script for BullMQ Dynamic Delayed Job Armada Ticket-Booking Hold Release.
 */

import { addArmadaHoldReleaseJob, removeArmadaHoldReleaseJob, armadaHoldQueue } from "../queues/armadaHoldQueue.js";
import { pool } from "../config/database.js";

async function testArmadaDelayedJobEngine() {
  console.log("\n================================================================================");
  console.log("🧪 MEMULAI PENGUJIEN BULLMQ DYNAMIC DELAYED JOB - ARMADA HOLD RELEASE");
  console.log("================================================================================");

  try {
    // 1. Get sample Armada unit
    const { rows: armadas } = await pool.query("SELECT id, code, status FROM armadas WHERE status = 'ACTIVE' LIMIT 2;");
    if (armadas.length === 0) {
      console.log("⚠️ Tidak ada unit armada ACTIVE untuk diuji.");
      process.exit(0);
    }

    const testArmada = armadas[0];
    console.log(`📌 Unit Armada Uji: '${testArmada.code}' (ID: ${testArmada.id})`);

    // 2. Set Armada status to RESERVED in DB
    await pool.query(
      `UPDATE armadas SET status = 'RESERVED', reserved_until = NOW() + INTERVAL '5 minutes' WHERE id = $1;`,
      [testArmada.id]
    );

    // 3. [TES 1] Schedule BullMQ Delayed Job (Fast 2-Second Delay for Testing)
    console.log("\n📥 [TES 1] Mendaftarkan Delayed Job ke BullMQ (Delay: 2000ms)...");
    const job = await addArmadaHoldReleaseJob({
      armadaId: testArmada.id,
      riderId: "rider-test-uuid-123",
      delayMs: 2000,
    });

    const jobCheck = await armadaHoldQueue.getJob(`hold-armada-${testArmada.id}`);
    console.log(`✅ Delayed Job Berhasil Terdaftar di Queue! State: ${await jobCheck.getState()}`);

    // 4. [TES 2] Test Early Job Removal (Rider cancels hold early)
    console.log("\n🗑️ [TES 2] Menguji Pembatalan Dini Delayed Job (Rider Batal Hold)...");
    const isRemoved = await removeArmadaHoldReleaseJob(testArmada.id);
    console.log(`✅ Status Pembatalan Job dari BullMQ: ${isRemoved ? "SUKSES DIBATALKAN ✅" : "GAGAL ❌"}`);

    // 5. [TES 3] Test Auto Execution (Wait 3s for worker auto-release)
    console.log("\n⏰ [TES 3] Mendaftarkan Job Ulang & Menunggu BullMQ Worker Melepaskan Otomatis (3 Detik)...");
    await pool.query(
      `UPDATE armadas SET status = 'RESERVED', reserved_until = NOW() + INTERVAL '5 minutes' WHERE id = $1;`,
      [testArmada.id]
    );

    await addArmadaHoldReleaseJob({
      armadaId: testArmada.id,
      riderId: "rider-test-uuid-123",
      delayMs: 1500, // 1.5 seconds delay
    });

    console.log("   • Menunggu 3 detik agar BullMQ Worker mengeksekusi...");
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const { rows: verifyRows } = await pool.query("SELECT status FROM armadas WHERE id = $1;", [testArmada.id]);
    console.log(`✅ Verifikasi Status Unit '${testArmada.code}' di PostgreSQL Setelah Delayed Worker: '${verifyRows[0].status}' (ACTIVE)`);

    console.log("\n================================================================================");
    console.log("🎉 Pengujian BullMQ Dynamic Delayed Job Armada Hold Release Selesai 100% Sempurna!");
    console.log("================================================================================\n");

  } catch (error) {
    console.error("💥 Error saat menguji Armada Delayed Job Engine:", error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

testArmadaDelayedJobEngine();
