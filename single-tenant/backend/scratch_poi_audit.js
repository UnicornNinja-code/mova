import { pool } from "./src/config/database.js";

async function auditPoiClusters() {
  console.log("==================================================");
  console.log("🔍 AUDIT DISTRIBUSI & KLUSTERISASI POI POSTGIS");
  console.log("==================================================\n");

  // 1. Total Count & Status
  const { rows: totalRows } = await pool.query(`
    SELECT 
      COUNT(*) AS total_pois,
      COUNT(CASE WHEN operational_status = 'ELIGIBLE' THEN 1 END) AS eligible_pois,
      COUNT(CASE WHEN operational_status = 'EXCLUDED' THEN 1 END) AS excluded_pois,
      COUNT(CASE WHEN approval_status = 'APPROVED' THEN 1 END) AS approved_pois,
      COUNT(CASE WHEN category IS NULL THEN 1 END) AS uncategorized_pois
    FROM pois;
  `);
  console.log("📊 Ringkasan Status POI:", totalRows[0]);

  // 2. Kategori Breakdown
  const { rows: catBreakdown } = await pool.query(`
    SELECT 
      pc.name AS category_name,
      COUNT(p.id) AS count,
      pc.score_pagi, pc.score_siang, pc.score_sore, pc.score_malam
    FROM poi_categories pc
    LEFT JOIN pois p ON p.category = pc.name
    GROUP BY pc.id, pc.name, pc.score_pagi, pc.score_siang, pc.score_sore, pc.score_malam
    ORDER BY count DESC;
  `);
  console.log("\n📋 Distribusi Kategori POI (Non-Zero):");
  catBreakdown.forEach((c, idx) => {
    if (parseInt(c.count) > 0 || c.category_name === "Lainnya") {
      console.log(`  ${String(idx + 1).padStart(2, " ")}. ${c.category_name.padEnd(40, " ")}: ${c.count} POI (Skor Waktu: P:${c.score_pagi} S:${c.score_siang} So:${c.score_sore} M:${c.score_malam})`);
    }
  });

  // 3. Sample POIs in "Lainnya"
  const { rows: lainnyaSample } = await pool.query(`
    SELECT p.name, p.osm_type, p.metadata
    FROM pois p
    WHERE p.category = 'Lainnya' OR p.category IS NULL
    LIMIT 25;
  `);
  console.log(`\n🔎 Sampel POI Berkategori 'Lainnya' / Uncategorized (${lainnyaSample.length} sampel):`);
  lainnyaSample.forEach((s) => {
    console.log(`  • ${s.name || "(No Name)"} | Tags: ${JSON.stringify(s.metadata?.tags || {})}`);
  });

  // 4. Cek POI dengan Nama Ambigu / Potensi Salah Kategori
  const { rows: ambiguousRows } = await pool.query(`
    SELECT p.name, p.category as current_category, p.metadata
    FROM pois p
    WHERE 
      (p.name ILIKE '%masjid%' AND p.category != 'Masjid & Mushola') OR
      (p.name ILIKE '%mushola%' AND p.category != 'Masjid & Mushola') OR
      (p.name ILIKE '%kopi%' AND p.category NOT IN ('Kafe & Kedai Kopi', 'Toko Minuman')) OR
      (p.name ILIKE '%cafe%' AND p.category NOT IN ('Kafe & Kedai Kopi', 'Toko Minuman')) OR
      (p.name ILIKE '%indomaret%' AND p.category != 'Minimarket') OR
      (p.name ILIKE '%alfamart%' AND p.category != 'Minimarket') OR
      (p.name ILIKE '%sekolah%' AND p.category NOT LIKE '%Sekolah%' AND p.category NOT LIKE '%Pendidikan%' AND p.category NOT LIKE '%SD%' AND p.category NOT LIKE '%SMP%' AND p.category NOT LIKE '%SMA%') OR
      (p.name ILIKE '%apotek%' AND p.category != 'Apotek') OR
      (p.name ILIKE '%rumah sakit%' AND p.category != 'Rumah Sakit')
    LIMIT 20;
  `);
  console.log(`\n⚠️ Potensi Anomali Kategori Berdasarkan Keyword (${ambiguousRows.length} sampel):`);
  ambiguousRows.forEach((a) => {
    console.log(`  • [Current: ${a.current_category}] "${a.name}" | Tags: ${JSON.stringify(a.metadata?.tags || {})}`);
  });

  // 5. Cek Orphaned Categories (Kategori pada pois yang tidak ada di poi_categories)
  const { rows: orphanRows } = await pool.query(`
    SELECT DISTINCT p.category
    FROM pois p
    LEFT JOIN poi_categories pc ON p.category = pc.name
    WHERE pc.id IS NULL;
  `);
  console.log(`\n🔗 Orphaned Categories in pois table:`, orphanRows);

  await pool.end();
  process.exit(0);
}

auditPoiClusters();
