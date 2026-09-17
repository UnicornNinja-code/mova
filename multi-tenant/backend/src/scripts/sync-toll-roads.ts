/*
 * sync-toll-roads.ts
 * CLI Script to synchronize Toll Road spatial restrictions from Overpass API to PostGIS in TypeScript
 */

import { roadOverpassSyncService } from "../services/roadOverpassSyncService.js";
import { pool } from "../config/database.js";

async function runSyncTollRoads() {
  console.log("\n================================================================================");
  console.log("🚀 SYNCHRONIZING TOLL ROAD SPATIAL RESTRICTIONS FROM OVERPASS API TO POSTGIS");
  console.log("================================================================================");

  try {
    const result = await roadOverpassSyncService.syncTollRoadsFromOverpass();
    console.log("\n🎉 SYNC COMPLETED SUCCESSFULLY:");
    console.log(`   • Source           : ${result.source}`);
    console.log(`   • Restriction Type : ${result.restriction_type}`);
    console.log(`   • Rows Inserted    : ${result.inserted}`);
    console.log(`   • Message          : ${result.message}`);

    const { rows } = await pool.query(
      "SELECT COUNT(*)::int AS total FROM protocol_roads WHERE restriction_type = 'PROHIBITED_TOLL_ROAD';"
    );
    console.log(`\n📊 Total Toll Road Segments in PostGIS: ${rows[0].total}`);
    console.log("================================================================================\n");
  } catch (err: any) {
    console.error("\n💥 Error syncing Toll Roads:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runSyncTollRoads();
