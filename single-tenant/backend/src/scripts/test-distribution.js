/*
 * test-distribution.js
 * Manual Test Script for Use Case 7: Rider Distribution Engine (FIFO Queue + TOPSIS Rank Matching).
 */

import { distributionService } from "../services/distribution/DistributionService.js";
import { distributionRepository } from "../repositories/distributionRepository.js";
import { pool } from "../config/database.js";

async function testDistributionEngine() {
  console.log("\n================================================================================");
  console.log("🧪 MEMULAI PENGUJIEN MANUAL ENGINE DISTRIBUSI RIDER (USE CASE 7)");
  console.log("================================================================================");

  try {
    // 1. Reset Today's Distribution Data
    await distributionRepository.resetTodayDistribution();
    console.log("🧹 Reset data antrean & penugasan hari ini berhasil.");

    // 2. Fetch existing Rider users from database
    const { rows: riders } = await pool.query("SELECT id, name, username FROM users WHERE role = 'RIDER' LIMIT 5;");

    if (riders.length === 0) {
      console.log("⚠️ Tidak ada user berpangkat RIDER di database. Menjalankan db:seed...");
      process.exit(0);
    }

    console.log(`📌 Ditemukan ${riders.length} Rider untuk pengujian antrean FIFO:`);

    // 3. Simulate Riders Confirming Duty Availability (FIFO Order)
    for (let i = 0; i < riders.length; i++) {
      const r = riders[i];
      await distributionService.confirmRiderDuty(r.id);
      console.log(`   ⏱️ [FIFO Queue ${i + 1}] Rider '${r.name}' (${r.username}) telah mengonfirmasi kesediaan bertugas.`);
    }

    // 4. Fetch Initial Distribution Overview
    console.log("\n📋 Overview Antrean FIFO & Kuota Kapasitas Zona:");
    const overview = await distributionService.getDistributionOverview();
    console.log(`   • Total Rider Antrean (FIFO) : ${overview.total_waiting_riders}`);
    console.log(`   • Total Sisa Kuota Zona      : ${overview.total_remaining_capacity}`);
    console.log(`   • Status Kecukupan Kuota     : ${overview.is_capacity_sufficient ? 'CUKUP ✅' : 'TIDAK MENCUKUPI ⚠️'}`);

    // 5. Execute Auto Distribution Engine (FIFO + TOPSIS Rank)
    const result = await distributionService.autoDistributeRiders();

    console.log("\n🎉 Pengujian Distribusi Rider Selesai! Hasil Ringkas JSON:");
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error("💥 Error testing Distribution Engine:", error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

testDistributionEngine();
