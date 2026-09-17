/*
 *   Copyright (c) 2026 
 *   All rights reserved.
 *   Batch POI Re-clustering & ETL Data Quality Engine
 */

import { pool } from "../config/database.js";
import { poiClusterer } from "../services/poi/POIClusterer.js";

export async function runPoiRecluster() {
  console.log("==================================================");
  console.log("🔄 MEMULAI PROSES BATCH RE-CLUSTERING POI (ETL PIPELINE)");
  console.log("==================================================\n");

  const client = await pool.connect();
  try {
    // 1. Pastikan kategori Objek Wisata & Budaya terdaftar
    console.log("⏳ [1/4] Memastikan sinkronisasi tabel poi_categories...");
    await client.query(`
      INSERT INTO poi_categories (name, score_pagi, score_siang, score_sore, score_malam, is_active)
      VALUES ('Objek Wisata & Budaya', 3, 4, 5, 4, true)
      ON CONFLICT (name) DO UPDATE SET
        score_pagi  = 3,
        score_siang = 4,
        score_sore  = 5,
        score_malam = 4,
        is_active   = true;
    `);
    console.log("   ✅ Kategori 'Objek Wisata & Budaya' aktif terverifikasi.\n");

    // 2. Fetch seluruh POI saat ini
    console.log("⏳ [2/4] Mengambil seluruh data POI dari PostGIS...");
    const { rows: pois } = await client.query(`
      SELECT id, osm_id, name, category, operational_status, exclusion_reason, metadata
      FROM pois;
    `);
    console.log(`   ✅ Ditemukan ${pois.length} entitas POI untuk diproses ulang.\n`);

    // 3. Re-clustering in-memory
    console.log("⏳ [3/4] Menjalankan engine POIClusterer pada seluruh entitas...");
    let reclassifiedCount = 0;
    let excludedCount = 0;
    const categoryDistribution = {};

    await client.query("BEGIN;");

    for (const poi of pois) {
      const rawTags = poi.metadata?.raw_tags || {};
      const tags = {
        ...rawTags,
        name: rawTags.name || poi.name || "",
      };

      // Evaluasi Kategori
      let newCategory = poiClusterer.cluster(tags);
      
      // Evaluasi Status Operasional
      const operationalData = poiClusterer.classifyOperationalStatus(tags);
      let newOpStatus = operationalData.operational_status;
      let newExclusionReason = operationalData.exclusion_reason;

      // Tangani POI yang diabaikan (IGNORED) sebagai EXCLUDED noise
      if (newCategory === "IGNORED") {
        newCategory = "Lainnya";
        newOpStatus = "EXCLUDED";
        newExclusionReason = newExclusionReason || "BLACKLIST_NOISE";
      }

      // Catat statistik jika ada perubahan
      if (newCategory !== poi.category || newOpStatus !== poi.operational_status) {
        reclassifiedCount++;
      }
      if (newOpStatus === "EXCLUDED") {
        excludedCount++;
      }

      categoryDistribution[newCategory] = (categoryDistribution[newCategory] || 0) + 1;

      // Update POI record
      await client.query(
        `UPDATE pois
         SET category = $1,
             operational_status = $2,
             exclusion_reason = $3,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4;`,
        [newCategory, newOpStatus, newExclusionReason, poi.id]
      );
    }

    await client.query("COMMIT;");
    console.log(`   ✅ Selesai memperbarui database! (${reclassifiedCount} record terklasifikasi ulang)\n`);

    // 4. Rekapitulasi Data Quality
    console.log("⏳ [4/4] Ringkasan Distribusi Pasca Re-clustering:");
    const sortedCategories = Object.entries(categoryDistribution).sort((a, b) => b[1] - a[1]);
    sortedCategories.forEach(([cat, count], idx) => {
      console.log(`   ${String(idx + 1).padStart(2, " ")}. ${cat.padEnd(36, " ")}: ${count} POI`);
    });

    console.log("\n==================================================");
    console.log(`🎉 BATCH RE-CLUSTERING SELESAI DENGAN SUKSES!`);
    console.log(`   Total POI Terproses       : ${pois.length}`);
    console.log(`   Total POI Re-klasifikasi  : ${reclassifiedCount}`);
    console.log(`   Total POI Excluded/Noise  : ${excludedCount}`);
    console.log("==================================================\n");

    return { total: pois.length, reclassified: reclassifiedCount, excluded: excludedCount };
  } catch (err) {
    await client.query("ROLLBACK;");
    console.error("❌ Terjadi kesalahan saat batch re-clustering:", err);
    throw err;
  } finally {
    client.release();
  }
}

// Jalankan jika dipanggil via CLI
if (process.argv[1] && process.argv[1].includes("run-poi-recluster")) {
  runPoiRecluster()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
