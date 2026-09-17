/*
 * test-bullmq-sync.js
 * CLI Test Script for BullMQ & Redis Overpass Sync Queue Engine.
 */

import { addRoadSyncJob, getJobStatus } from "../queues/overpassQueue.js";
import { pool } from "../config/database.js";

async function testBullMQEngine() {
  console.log("\n================================================================================");
  console.log("🧪 MEMULAI PENGUJIEN BULLMQ & REDIS ASYNCHRONOUS OVERPASS SYNC QUEUE ENGINE");
  console.log("================================================================================");

  try {
    // 1. Add Road Sync Job to BullMQ Queue
    console.log("\n📥 [TES 1] Menambahkan Job Sinkronisasi Overpass ke Antrean BullMQ...");
    const job = await addRoadSyncJob({ cityName: "Sidoarjo", userId: "superadmin-test-uuid" });
    console.log(`✅ Job Berhasil Dimasukkan ke Queue! ID Job: ${job.id}`);

    // 2. Poll Job Status
    console.log("\n🔄 [TES 2] Memantau Status Pengerjaan Job dari BullMQ Worker...");
    
    let attempts = 0;
    let finalStatus = null;

    while (attempts < 15) {
      attempts++;
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1s
      finalStatus = await getJobStatus(job.id);
      console.log(`   • [Polling #${attempts}] State Job: ${finalStatus.state.toUpperCase()} | Progress: ${finalStatus.progress || 0}%`);

      if (finalStatus.state === "completed" || finalStatus.state === "failed") {
        break;
      }
    }

    console.log("\n================================================================================");
    console.log(`📊 Hasil Akhir Job ID '${job.id}': State = ${finalStatus.state.toUpperCase()}`);
    if (finalStatus.state === "completed") {
      console.log(`✅ Hasil Eksekusi Worker:`, finalStatus.result?.message || "Sukses");
      console.log(`⏱️ Durasi Pengerjaan   : ${finalStatus.result?.durationMs}ms`);
    } else if (finalStatus.state === "failed") {
      console.log(`💥 Pesan Error Worker  : ${finalStatus.error}`);
    }
    console.log("================================================================================\n");

  } catch (error) {
    console.error("💥 Error saat menguji BullMQ Engine:", error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

testBullMQEngine();
