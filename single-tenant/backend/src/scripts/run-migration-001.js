import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pool } from "../config/database.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration001() {
  console.log("\n================================================================================");
  console.log("🚀 MEMULAI EKSEKUSI MIGRASI 001: POI ELIGIBILITY, LOGICAL POI & CANDIDATE SPOTS");
  console.log("================================================================================");

  try {
    // STEP 1: Pre-Migration Metrics Audit
    console.log("📊 [LANGKAH 1] MENGAMBIL METRIK AUDIT PRE-MIGRATION...");
    const preCountRes = await pool.query("SELECT COUNT(*)::int AS total_pois FROM pois;");
    const preStatusRes = await pool.query(`
      SELECT status, COUNT(*)::int AS count 
      FROM pois 
      GROUP BY status;
    `);

    const totalPoisBefore = preCountRes.rows[0].total_pois;
    console.log(`   • Total Raw POI Sebelum Migrasi : ${totalPoisBefore}`);
    preStatusRes.rows.forEach(r => {
      console.log(`   • Status Existing '${r.status}' : ${r.count}`);
    });

    // STEP 2: Execute Migration SQL Script
    console.log("\n⏳ [LANGKAH 2] MENJALANKAN FILE MIGRATION 001 SQL...");
    const sqlPath = path.join(__dirname, "../db/migrations/001_poi_eligibility_and_candidate_spots.sql");
    const migrationSql = fs.readFileSync(sqlPath, "utf8");
    await pool.query(migrationSql);
    console.log("   ✅ Skenario SQL Migrasi 001 & Backfill Berhasil Dieksekusi!");

    // STEP 3: Post-Migration Audit & Zero Data Loss Verification
    console.log("\n🔍 [LANGKAH 3] MENGUJI INTEGRITAS DATA POST-MIGRATION (ZERO DATA LOSS CHECK)...");
    const postCountRes = await pool.query("SELECT COUNT(*)::int AS total_pois FROM pois;");
    const nullExternalRes = await pool.query("SELECT COUNT(*)::int AS count FROM pois WHERE external_id IS NULL;");
    const nullLogicalRes = await pool.query("SELECT COUNT(*)::int AS count FROM pois WHERE logical_poi_id IS NULL;");
    const nullGeomRes = await pool.query("SELECT COUNT(*)::int AS count FROM pois WHERE latitude IS NOT NULL AND geom IS NULL;");
    const dupExternalRes = await pool.query(`
      SELECT external_id, COUNT(*)::int AS count 
      FROM pois 
      GROUP BY external_id 
      HAVING COUNT(*) > 1;
    `);
    const candidateTableRes = await pool.query("SELECT COUNT(*)::int AS count FROM candidate_selling_locations;");

    const totalPoisAfter = postCountRes.rows[0].total_pois;
    const nullExternalIds = nullExternalRes.rows[0].count;
    const nullLogicalPoiIds = nullLogicalRes.rows[0].count;
    const nullGeoms = nullGeomRes.rows[0].count;
    const duplicateExternalIds = dupExternalRes.rows.length;
    const candidateSpotCount = candidateTableRes.rows[0].count;

    console.log(`   • Total POI Setelah Migrasi          : ${totalPoisAfter} (Diff: ${totalPoisAfter - totalPoisBefore})`);
    console.log(`   • Total Null 'external_id'            : ${nullExternalIds} (Must be 0)`);
    console.log(`   • Total Null 'logical_poi_id'         : ${nullLogicalPoiIds} (Must be 0)`);
    console.log(`   • Total Null PostGIS 'geom'           : ${nullGeoms} (Must be 0)`);
    console.log(`   • Total Duplicate 'external_id'       : ${duplicateExternalIds} (Must be 0)`);
    console.log(`   • Total Candidate Selling Locations   : ${candidateSpotCount}`);

    // STEP 4: Verifikasi Assertions
    if (totalPoisBefore !== totalPoisAfter) {
      throw new Error(`CRITICAL: Kehilangan Data POI! Before=${totalPoisBefore}, After=${totalPoisAfter}`);
    }
    if (nullExternalIds !== 0) {
      throw new Error(`CRITICAL: Ditemukan ${nullExternalIds} baris dengan external_id NULL!`);
    }
    if (nullLogicalPoiIds !== 0) {
      throw new Error(`CRITICAL: Ditemukan ${nullLogicalPoiIds} baris dengan logical_poi_id NULL!`);
    }
    if (nullGeoms !== 0) {
      throw new Error(`CRITICAL: Ditemukan ${nullGeoms} baris dengan geom PostGIS NULL!`);
    }
    if (duplicateExternalIds !== 0) {
      throw new Error(`CRITICAL: Ditemukan ${duplicateExternalIds} duplikat external_id!`);
    }

    console.log("\n================================================================================");
    console.log("🎉 MIGRATION 001 PASSED WITH ZERO DATA LOSS! ALL CONSTRAINTS & INDEXES CREATED.");
    console.log("================================================================================\n");
  } catch (error) {
    console.error("\n❌ MIGRATION 001 FAILED:", error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration001();
