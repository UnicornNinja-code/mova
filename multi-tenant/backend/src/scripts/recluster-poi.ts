/*
 * recluster-poi.ts
 * In-Place Database POI Re-clustering & Cleaning Script in TypeScript
 */

import { pool } from "../config/database.js";
import { reclusterExistingPoisService } from "../services/poiService.js";

async function runRecluster() {
  console.log("==================================================");
  console.log("🔄 MEMULAI IN-PLACE RE-CLUSTERING DATA POI DI DATABASE");
  console.log("==================================================\n");

  try {
    const result = await reclusterExistingPoisService();
    console.log(`✅ Status: ${result.message}`);
    console.log(`📊 Total POI Diproses di DB   : ${result.totalProcessed || 0}`);
    console.log(`✏️  Total POI Diperbarui (Classified): ${result.updatedCount || 0}`);
    console.log(`🗑️  Total Titik Hantu Dibuang (Deleted): ${result.deletedCount || 0}`);

    console.log("\n==================================================");
    console.log("🎉 RE-CLUSTERING DATABASE SELESAI!");
    console.log("==================================================\n");
  } catch (error: any) {
    console.error("💥 Terjadi kesalahan saat Re-clustering:", error.message);
  } finally {
    await pool.end();
  }
}

runRecluster();
