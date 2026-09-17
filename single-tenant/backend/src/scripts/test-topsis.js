/*
 * test-topsis.js
 * Manual Test Script for TOPSIS Recommendation Engine using Live Actual Database & Current Time Slot.
 */

import { topsisEngineService } from "../services/dss/TopsisEngineService.js";
import { TimeSlotEvaluator } from "../utils/TimeSlotEvaluator.js";
import { pool } from "../config/database.js";
import { redisClient } from "../config/redis.js";

async function testTopsisEngine() {
  const currentActualSlot = TimeSlotEvaluator.getSlot(new Date());

  console.log("🧪 Memulai Pengujian Manual TOPSIS Recommendation Engine dengan DATA AKTUAL...\n");
  console.log(`⏰ Time Slot Lokal Saat Ini : ${currentActualSlot.toUpperCase()} (${new Date().toLocaleTimeString('id-ID')})`);

  try {
    const result = await topsisEngineService.calculateTopsisRecommendations({
      timeSlot: currentActualSlot,
      riderLat: -7.397402,
      riderLon: 112.711958,
    });

    console.log("\n🎉 Pengujian Manual TOPSIS dengan Data Aktual Selesai! Hasil Ringkas JSON:");
    console.log(
      JSON.stringify(
        {
          message: result.message,
          time_slot: result.time_slot,
          total_evaluated_zones: result.total_evaluated_zones,
          rankings: result.rankings,
        },
        null,
        2
      )
    );
  } catch (error) {
    console.error("💥 Error testing TOPSIS Engine:", error);
  } finally {
    try { await pool.end(); } catch (e) {}
    try { if (redisClient.isOpen) await redisClient.quit(); } catch (e) {}
    setTimeout(() => process.exit(0), 100);
  }
}

testTopsisEngine();
