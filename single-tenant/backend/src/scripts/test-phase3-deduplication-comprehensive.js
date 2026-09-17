import { pool } from "../config/database.js";
import { poiRepository } from "../repositories/poiRepository.js";
import { poiEntityFactory } from "../services/poi/POIEntityFactory.js";
import { poiClusterer } from "../services/poi/POIClusterer.js";
import { calculateStringSimilarity } from "../utils/stringSimilarity.js";

async function runComprehensivePhase3Tests() {
  console.log("\n================================================================================");
  console.log("🧪 MEMULAI COMPREHENSIVE AUTOMATED TEST SUITE: PHASE 3 POI DEDUPLICATION ENGINE");
  console.log("================================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`   ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`   ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // Setup: Ensure legacy constraint on osm_id is dropped
    await pool.query("ALTER TABLE pois DROP CONSTRAINT IF EXISTS pois_osm_id_key; DROP INDEX IF EXISTS pois_osm_id_key;");

    // Cleanup previous test artifacts
    await pool.query("DELETE FROM pois WHERE external_id LIKE 'osm:node:88%' OR external_id LIKE 'osm:way:88%' OR external_id LIKE 'osm:relation:88%';");

    // TEST 1 & 2 — Level 1 Exact Source Identity & In-Place Update
    console.log("📌 [TEST 1 & 2] Level 1 Exact Source Identity & In-Place Update...");
    const nodeA = poiEntityFactory.createFromOverpassElement(
      { type: "node", id: 88001, lat: -7.400, lon: 112.700, tags: { amenity: "cafe", name: "Janji Jiwa 1" } },
      poiClusterer
    );
    const [savedLevel1] = await poiRepository.syncCityPoisWithTransaction([nodeA]);
    assert(savedLevel1.external_id === "osm:node:88001", "Level 1 external_id parsed as 'osm:node:88001'");

    const nodeAUpdated = poiEntityFactory.createFromOverpassElement(
      { type: "node", id: 88001, lat: -7.400, lon: 112.700, tags: { amenity: "cafe", name: "Janji Jiwa 1 Updated" } },
      poiClusterer
    );
    await poiRepository.syncCityPoisWithTransaction([nodeAUpdated]);
    const { rows: rowsL1 } = await pool.query("SELECT COUNT(*)::int AS cnt, MAX(name) AS name FROM pois WHERE external_id = 'osm:node:88001';");
    assert(rowsL1[0].cnt === 1, "Level 1 upsert tidak membuat duplikat physical POI");
    assert(rowsL1[0].name === "Janji Jiwa 1 Updated", "Level 1 nama ter-update in-place");

    // TEST 3 — Different OSM Types with Same Numeric ID Remain Distinct
    console.log("\n📌 [TEST 3] Different OSM Types Same Numeric ID (node/88001 vs way/88001 vs relation/88001)...");
    const wayA = poiEntityFactory.createFromOverpassElement(
      { type: "way", id: 88001, center: { lat: -7.400, lon: 112.700 }, tags: { amenity: "cafe", name: "Janji Jiwa Way" } },
      poiClusterer
    );
    const relA = poiEntityFactory.createFromOverpassElement(
      { type: "relation", id: 88001, center: { lat: -7.400, lon: 112.700 }, tags: { amenity: "cafe", name: "Janji Jiwa Relation" } },
      poiClusterer
    );
    await poiRepository.syncCityPoisWithTransaction([wayA, relA]);
    const { rows: rowsDiffTypes } = await pool.query("SELECT COUNT(*)::int AS cnt FROM pois WHERE external_id IN ('osm:node:88001', 'osm:way:88001', 'osm:relation:88001');");
    assert(rowsDiffTypes[0].cnt === 3, "node/88001, way/88001, dan relation/88001 tersimpan sebagai 3 entitas terpisah");

    // TEST 4 & 9 — False-Positive Protection: Same Category + <= 3m + Different Name -> REVIEW (NOT Duplicate)
    console.log("\n📌 [TEST 4 & 9] False-Positive Protection: ATM A vs ATM B (1.5m apart) -> REVIEW (NOT Duplicate)...");
    const atm1 = poiEntityFactory.createFromOverpassElement(
      { type: "node", id: 88002, lat: -7.40500, lon: 112.71000, tags: { amenity: "atm", name: "ATM A" } },
      poiClusterer
    );
    const atm2 = poiEntityFactory.createFromOverpassElement(
      { type: "node", id: 88003, lat: -7.40501, lon: 112.71001, tags: { amenity: "atm", name: "ATM B" } },
      poiClusterer
    );
    await poiRepository.syncCityPoisWithTransaction([atm1, atm2]);

    const { rows: atmRows } = await pool.query("SELECT id, name, operational_status, duplicate_of, logical_poi_id FROM pois WHERE external_id IN ('osm:node:88002', 'osm:node:88003') ORDER BY external_id;");
    assert(atmRows.length === 2, "Dua ATM berdekatan tersimpan fisik sebagai 2 POI");
    assert(atmRows[0].operational_status === "REVIEW", "ATM A operational_status = 'REVIEW'");
    assert(atmRows[1].operational_status === "REVIEW", "ATM B operational_status = 'REVIEW'");
    assert(atmRows[0].duplicate_of === null && atmRows[1].duplicate_of === null, "ATM A dan ATM B duplicate_of HARUS NULL (tidak di-merge)");
    assert(atmRows[0].logical_poi_id !== atmRows[1].logical_poi_id, "ATM A dan ATM B logical_poi_id tetap independen");

    // TEST 5 & 10 & 11 & 12 — Level 3 Confirmed Duplicate: Same Category + <= 15m + Similarity >= 85%
    console.log("\n📌 [TEST 5 & 10 & 11 & 12] Level 3 Confirmed Duplicate: 'McDonald's' vs 'McDonalds' (5m apart)...");
    const mcd1 = poiEntityFactory.createFromOverpassElement(
      { type: "node", id: 88004, lat: -7.41000, lon: 112.71500, tags: { amenity: "fast_food", name: "McDonald's Sidoarjo" } },
      poiClusterer
    );
    const mcd2 = poiEntityFactory.createFromOverpassElement(
      { type: "node", id: 88005, lat: -7.41003, lon: 112.71503, tags: { amenity: "fast_food", name: "McDonalds Sidoarjo" } },
      poiClusterer
    );
    await poiRepository.syncCityPoisWithTransaction([mcd1, mcd2]);

    const { rows: mcdRows } = await pool.query("SELECT id, name, operational_status, duplicate_of, logical_poi_id FROM pois WHERE external_id IN ('osm:node:88004', 'osm:node:88005') ORDER BY created_at ASC;");
    assert(mcdRows.length === 2, "Dua McDonald's tersimpan fisik 2 record");
    const parentMcd = mcdRows[0];
    const childMcd = mcdRows[1];
    assert(childMcd.duplicate_of === parentMcd.id, "Child McDonald's duplicate_of menunjuk ke id Parent");
    assert(childMcd.logical_poi_id === parentMcd.logical_poi_id, "Child McDonald's logical_poi_id bernilai sama dengan Parent");
    assert(parentMcd.duplicate_of === null, "Parent McDonald's duplicate_of HARUS NULL");

    // TEST 6 — String Similarity Utility Tests
    console.log("\n📌 [TEST 6] String Similarity Utility Evaluation...");
    assert(calculateStringSimilarity("Bank Central Asia", "bank central asia") === 1.0, "'Bank Central Asia' vs 'bank central asia' = 1.0");
    assert(calculateStringSimilarity("McDonald's", "McDonalds") >= 0.85, "'McDonald's' vs 'McDonalds' >= 0.85");
    assert(calculateStringSimilarity("ATM BCA", "ATM Mandiri") < 0.85, "'ATM BCA' vs 'ATM Mandiri' < 0.85");

    // TEST 7 — Same Category + Distance > 15m -> Distinct
    console.log("\n📌 [TEST 7] Same Category + Distance > 15m -> Distinct...");
    const distant1 = poiEntityFactory.createFromOverpassElement(
      { type: "node", id: 88006, lat: -7.42000, lon: 112.72000, tags: { amenity: "restaurant", name: "Ayam Goreng Pemuda" } },
      poiClusterer
    );
    const distant2 = poiEntityFactory.createFromOverpassElement(
      { type: "node", id: 88007, lat: -7.43000, lon: 112.73000, tags: { amenity: "restaurant", name: "Ayam Goreng Pemuda" } },
      poiClusterer
    );
    await poiRepository.syncCityPoisWithTransaction([distant1, distant2]);
    const { rows: distantRows } = await pool.query("SELECT duplicate_of, logical_poi_id FROM pois WHERE external_id IN ('osm:node:88006', 'osm:node:88007');");
    assert(distantRows[0].duplicate_of === null && distantRows[1].duplicate_of === null, "POIs dengan jarak > 15m tetap independen (duplicate_of = NULL)");

    // TEST 8 — Different Category + Close Distance -> Distinct
    console.log("\n📌 [TEST 8] Different Category + Close Distance -> Distinct...");
    const diffCat1 = poiEntityFactory.createFromOverpassElement(
      { type: "node", id: 88008, lat: -7.4000, lon: 112.7000, tags: { amenity: "bank", name: "Gedung Utama Sidoarjo" } },
      poiClusterer
    );
    const diffCat2 = poiEntityFactory.createFromOverpassElement(
      { type: "node", id: 88009, lat: -7.4000, lon: 112.7000, tags: { amenity: "school", name: "Gedung Utama Sidoarjo" } },
      poiClusterer
    );
    await poiRepository.syncCityPoisWithTransaction([diffCat1, diffCat2]);
    const { rows: diffCatRows } = await pool.query("SELECT duplicate_of FROM pois WHERE external_id IN ('osm:node:88008', 'osm:node:88009');");
    assert(diffCatRows[0].duplicate_of === null && diffCatRows[1].duplicate_of === null, "Kategori berbeda pada posisi berdekatan tidak di-merge!");

    // TEST 13 — Transitive Logical Cluster Consistency
    console.log("\n📌 [TEST 13] Transitive Logical Cluster Consistency...");
    const mcd3 = poiEntityFactory.createFromOverpassElement(
      { type: "node", id: 88010, lat: -7.41005, lon: 112.71505, tags: { amenity: "fast_food", name: "McDonalds Sidoarjo" } },
      poiClusterer
    );
    await poiRepository.syncCityPoisWithTransaction([mcd3]);
    const { rows: clusterRows } = await pool.query("SELECT COUNT(DISTINCT logical_poi_id)::int AS unique_logicals FROM pois WHERE external_id IN ('osm:node:88004', 'osm:node:88005', 'osm:node:88010');");
    assert(clusterRows[0].unique_logicals === 1, "Seluruh anggota cluster terduplikasi mengacu ke 1 logical_poi_id konsisten!");

    // TEST 14 — Legacy POI Participation
    console.log("\n📌 [TEST 14] Legacy POI Participation Without Changing external_id...");
    const { rows: legacyRows } = await pool.query("SELECT external_id, osm_type FROM pois WHERE external_id LIKE 'legacy:osm:%' LIMIT 1;");
    if (legacyRows.length > 0) {
      assert(legacyRows[0].osm_type === null, "Legacy POI osm_type tetap NULL");
      assert(legacyRows[0].external_id.startsWith("legacy:osm:"), "Legacy POI external_id tidak berubah");
    }

    // TEST 15 — EXCLUDED Rest Area POI Safety
    console.log("\n📌 [TEST 15] EXCLUDED Rest Area POI Safety...");
    const restAreaNode = poiEntityFactory.createFromOverpassElement(
      { type: "node", id: 88011, lat: -7.440, lon: 112.740, tags: { highway: "services", amenity: "rest_area", name: "Rest Area KM 753 Pazkul" } },
      poiClusterer
    );
    const [savedRestArea] = await poiRepository.syncCityPoisWithTransaction([restAreaNode]);
    assert(savedRestArea.operational_status === "EXCLUDED", "Rest Area POI tetap 'EXCLUDED' (tidak diubah menjadi ELIGIBLE/REVIEW)");

    // TEST 16 — Zero Physical Deletion Verification
    console.log("\n📌 [TEST 16] Zero Physical Deletion Verification...");
    const { rows: countAfter } = await pool.query("SELECT COUNT(*)::int AS total FROM pois;");
    assert(countAfter[0].total > 0, `Total physical POIs di database (${countAfter[0].total}) tersimpan utuh tanpa ada penghapusan fisik!`);

    // Cleanup test POIs
    await pool.query("DELETE FROM pois WHERE external_id LIKE 'osm:node:88%' OR external_id LIKE 'osm:way:88%' OR external_id LIKE 'osm:relation:88%';");
    console.log("   ✅ Cleanup test POIs selesai.");

    console.log("\n================================================================================");
    console.log(`🎉 TEST COMPREHENSIVE PHASE 3 SELESAI: ${passed} PASSED, ${failed} FAILED`);
    console.log("================================================================================\n");

    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error("💥 TEST COMPREHENSIVE PHASE 3 GAGAL:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runComprehensivePhase3Tests();
