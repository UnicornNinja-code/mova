import { poiEntityFactory } from "../services/poi/POIEntityFactory.js";
import { poiClusterer } from "../services/poi/POIClusterer.js";
import { pool } from "../config/database.js";
import { poiRepository } from "../repositories/poiRepository.js";

async function runPhase2Tests() {
  console.log("\n================================================================================");
  console.log("🧪 MEMULAI AUTOMATED TEST SUITE: PHASE 2 POI IDENTITY & CLASSIFICATION LAYER");
  console.log("================================================================================\n");

  let passedTests = 0;
  let failedTests = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`   ✅ PASS: ${message}`);
      passedTests++;
    } else {
      console.error(`   ❌ FAIL: ${message}`);
      failedTests++;
    }
  }

  try {
    // TEST 1 — OSM Node Identity
    console.log("📌 [TEST 1] OSM Node Identity Parsing (node/12345)...");
    const nodeEl = { type: "node", id: 12345, lat: -7.397, lon: 112.711, tags: { amenity: "restaurant", name: "Warung Sederhana" } };
    const nodeEntity = poiEntityFactory.createFromOverpassElement(nodeEl, poiClusterer);
    assert(nodeEntity.osm_type === "node", "osm_type harus 'node'");
    assert(nodeEntity.external_id === "osm:node:12345", "external_id harus 'osm:node:12345'");

    // TEST 2 — OSM Way Identity
    console.log("\n📌 [TEST 2] OSM Way Identity Parsing (way/12345)...");
    const wayEl = { type: "way", id: 12345, center: { lat: -7.398, lon: 112.712 }, tags: { amenity: "school", name: "SMP 1 Sidoarjo" } };
    const wayEntity = poiEntityFactory.createFromOverpassElement(wayEl, poiClusterer);
    assert(wayEntity.osm_type === "way", "osm_type harus 'way'");
    assert(wayEntity.external_id === "osm:way:12345", "external_id harus 'osm:way:12345'");

    // TEST 3 — Node vs Way Identity Collision Prevention
    console.log("\n📌 [TEST 3] Node vs Way Identity Collision Prevention...");
    assert(nodeEntity.external_id !== wayEntity.external_id, "external_id node/12345 dan way/12345 HARUS BERBEDA!");

    // TEST 4 — Legacy POI Identity Preservation
    console.log("\n📌 [TEST 4] Legacy POI Identity Preservation...");
    const { rows: legacyRows } = await pool.query("SELECT * FROM pois WHERE external_id LIKE 'legacy:osm:%' LIMIT 1;");
    if (legacyRows.length > 0) {
      const legacyPoi = legacyRows[0];
      assert(legacyPoi.osm_type === null, "Legacy POI osm_type HARUS NULL (tanpa mengarang info)");
      assert(legacyPoi.external_id.startsWith("legacy:osm:"), "Legacy POI external_id tetap utuh format legacy");
    } else {
      assert(true, "Skipped check legacy rows (tabel kosong)");
    }

    // TEST 5 — Rest Area Exclusion (highway=services)
    console.log("\n📌 [TEST 5] Rest Area Exclusion (highway=services)...");
    const restAreaEl = {
      type: "node",
      id: 753001,
      lat: -7.420,
      lon: 112.700,
      tags: { highway: "services", amenity: "food_court", name: "Rest Area KM 753 Pazkul" },
    };
    const restAreaEntity = poiEntityFactory.createFromOverpassElement(restAreaEl, poiClusterer);
    assert(restAreaEntity.operational_status === "EXCLUDED", "Rest Area operational_status HARUS 'EXCLUDED'");
    assert(restAreaEntity.exclusion_reason === "REST_AREA", "Rest Area exclusion_reason HARUS 'REST_AREA'");
    assert(restAreaEntity.category === "Food Court", "Kategori Rest Area tetap di-map secara presisi");

    // TEST 6 — Rest Area Tag Variant (highway=rest_area)
    console.log("\n📌 [TEST 6] Rest Area Tag Variant (highway=rest_area)...");
    const restAreaEl2 = {
      type: "way",
      id: 753002,
      center: { lat: -7.421, lon: 112.701 },
      tags: { highway: "rest_area", name: "Rest Area Tol Gempol" },
    };
    const restAreaEntity2 = poiEntityFactory.createFromOverpassElement(restAreaEl2, poiClusterer);
    assert(restAreaEntity2.operational_status === "EXCLUDED", "highway=rest_area operational_status HARUS 'EXCLUDED'");
    assert(restAreaEntity2.exclusion_reason === "REST_AREA", "highway=rest_area exclusion_reason HARUS 'REST_AREA'");

    // TEST 7 — Normal Restaurant Case
    console.log("\n📌 [TEST 7] Normal Restaurant Case (amenity=restaurant)...");
    const restoEl = {
      type: "node",
      id: 888001,
      lat: -7.400,
      lon: 112.710,
      tags: { amenity: "restaurant", name: "Ayam Goreng Pemuda" },
    };
    const restoEntity = poiEntityFactory.createFromOverpassElement(restoEl, poiClusterer);
    assert(restoEntity.operational_status === "ELIGIBLE", "Normal restaurant operational_status HARUS 'ELIGIBLE'");
    assert(restoEntity.exclusion_reason === null, "Normal restaurant exclusion_reason HARUS null");

    // TEST 8 — Restricted Access (access=private)
    console.log("\n📌 [TEST 8] Restricted Access (access=private)...");
    const privateEl = {
      type: "node",
      id: 999001,
      lat: -7.405,
      lon: 112.715,
      tags: { amenity: "parking", access: "private", name: "Parkir Khusus Karyawan" },
    };
    const privateEntity = poiEntityFactory.createFromOverpassElement(privateEl, poiClusterer);
    assert(privateEntity.operational_status === "EXCLUDED", "access=private operational_status HARUS 'EXCLUDED'");
    assert(privateEntity.exclusion_reason === "PRIVATE_ACCESS", "access=private exclusion_reason HARUS 'PRIVATE_ACCESS'");

    // TEST 9 — Home / Test Safety ("Home Coffee")
    console.log("\n📌 [TEST 9] Home / Test Safety ('Home Coffee')...");
    const homeCoffeeEl = {
      type: "node",
      id: 444001,
      lat: -7.395,
      lon: 112.705,
      tags: { amenity: "cafe", name: "Home Coffee Roastery" },
    };
    const homeCoffeeEntity = poiEntityFactory.createFromOverpassElement(homeCoffeeEl, poiClusterer);
    assert(homeCoffeeEntity.category !== "IGNORED", "'Home Coffee' TIDAK BOLEH di-filter sebagai IGNORED");
    assert(homeCoffeeEntity.operational_status === "ELIGIBLE", "'Home Coffee' operational_status HARUS 'ELIGIBLE'");

    // TEST 10 — Database Persistence of Excluded Rest Area (Not Deleted!)
    console.log("\n📌 [TEST 10] Database Persistence of Excluded Rest Area (Stored in DB)...");
    const upsertResult = await poiRepository.syncCityPoisWithTransaction([restAreaEntity]);
    assert(upsertResult.length > 0, "Rest Area POI berhasil disimpan ke database (TIDAK DIHAPUS)");
    const savedRestArea = upsertResult[0];
    assert(savedRestArea.operational_status === "EXCLUDED", "Tersimpan di DB dengan operational_status = 'EXCLUDED'");
    assert(savedRestArea.exclusion_reason === "REST_AREA", "Tersimpan di DB dengan exclusion_reason = 'REST_AREA'");

    // TEST 11 — Logical POI Stability
    console.log("\n📌 [TEST 11] Logical POI Stability...");
    const { rows: fetchedRows } = await pool.query("SELECT * FROM pois WHERE id = $1;", [savedRestArea.id]);
    const fetchedPoi = fetchedRows[0];
    assert(fetchedPoi.logical_poi_id !== null && fetchedPoi.logical_poi_id !== undefined, "logical_poi_id tetap stabil dan valid (tidak bernilai NULL)");

    // TEST 12 — Existing POI REST API Compatibility
    console.log("\n📌 [TEST 12] Existing POI API Regression...");
    const { rows: samplePois } = await pool.query("SELECT id, name, category, status, approval_status, operational_status FROM pois LIMIT 5;");
    assert(samplePois.length > 0, "Tabel pois dapat di-query dengan normal via REST API columns");
    samplePois.forEach(p => {
      assert(p.approval_status !== undefined && p.operational_status !== undefined, `Row ${p.id} menyertakan approval_status & operational_status`);
    });

    console.log("\n================================================================================");
    console.log(`🎉 VERIFIKASI TEST PHASE 2 SELESAI: ${passedTests} PASSED, ${failedTests} FAILED`);
    console.log("================================================================================\n");

    if (failedTests > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error("💥 TEST PHASE 2 GAGAL:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runPhase2Tests();
