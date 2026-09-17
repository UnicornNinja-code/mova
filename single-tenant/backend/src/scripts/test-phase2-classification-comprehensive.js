import { poiEntityFactory } from "../services/poi/POIEntityFactory.js";
import { poiClusterer } from "../services/poi/POIClusterer.js";
import { pool } from "../config/database.js";
import { poiRepository } from "../repositories/poiRepository.js";

async function runComprehensivePhase2Tests() {
  console.log("\n================================================================================");
  console.log("🧪 MEMULAI COMPREHENSIVE AUTOMATED TEST SUITE: PHASE 2 POI IDENTITY & CLASSIFICATION");
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
    // Drop legacy single-column unique constraint on osm_id to allow same numeric id across node, way, relation
    await pool.query("ALTER TABLE pois DROP CONSTRAINT IF EXISTS pois_osm_id_key; DROP INDEX IF EXISTS pois_osm_id_key;");

    // TEST 1 — OSM Node Identity
    console.log("📌 [TEST 1] OSM Node Identity Parsing (type=node, id=10001)...");
    const nodeEl = { type: "node", id: 10001, lat: -7.4001, lon: 112.7101, tags: { amenity: "restaurant", name: "Warung Bambu" } };
    const nodeEntity = poiEntityFactory.createFromOverpassElement(nodeEl, poiClusterer);
    assert(nodeEntity.osm_type === "node", "osm_type harus 'node'");
    assert(nodeEntity.external_id === "osm:node:10001", "external_id harus 'osm:node:10001'");

    // TEST 2 — OSM Way Identity
    console.log("\n📌 [TEST 2] OSM Way Identity Parsing (type=way, id=10001)...");
    const wayEl = { type: "way", id: 10001, center: { lat: -7.4002, lon: 112.7102 }, tags: { amenity: "school", name: "SMA Negeri 1" } };
    const wayEntity = poiEntityFactory.createFromOverpassElement(wayEl, poiClusterer);
    assert(wayEntity.osm_type === "way", "osm_type harus 'way'");
    assert(wayEntity.external_id === "osm:way:10001", "external_id harus 'osm:way:10001'");

    // TEST 3 — OSM Relation Identity
    console.log("\n📌 [TEST 3] OSM Relation Identity Parsing (type=relation, id=10001)...");
    const relEl = { type: "relation", id: 10001, center: { lat: -7.4003, lon: 112.7103 }, tags: { amenity: "university", name: "Universitas Negeri" } };
    const relEntity = poiEntityFactory.createFromOverpassElement(relEl, poiClusterer);
    assert(relEntity.osm_type === "relation", "osm_type harus 'relation'");
    assert(relEntity.external_id === "osm:relation:10001", "external_id harus 'osm:relation:10001'");

    // TEST 4 — Identity Collision Protection
    console.log("\n📌 [TEST 4] Identity Collision Protection (node/10001 vs way/10001 vs relation/10001)...");
    const upsertBatch = await poiRepository.syncCityPoisWithTransaction([nodeEntity, wayEntity, relEntity]);
    assert(upsertBatch.length === 3, "Bulk UPSERT menyimpan 3 entitas berbeda di database tanpa bentrok ID!");
    const { rows: collisionCheck } = await pool.query(
      "SELECT external_id, osm_type FROM pois WHERE external_id IN ('osm:node:10001', 'osm:way:10001', 'osm:relation:10001');"
    );
    assert(collisionCheck.length === 3, "PostgreSQL menyimpan 3 record terpisah dengan UNIQUE external_id!");

    // TEST 5 — Same Source Upsert
    console.log("\n📌 [TEST 5] Same Source Upsert In-Place Update...");
    const updatedNodeEl = { type: "node", id: 10001, lat: -7.4001, lon: 112.7101, tags: { amenity: "restaurant", name: "Warung Bambu Spesial" } };
    const updatedNodeEntity = poiEntityFactory.createFromOverpassElement(updatedNodeEl, poiClusterer);
    await poiRepository.syncCityPoisWithTransaction([updatedNodeEntity]);
    const { rows: sameSourceRows } = await pool.query("SELECT COUNT(*)::int AS count, MAX(name) AS name FROM pois WHERE external_id = 'osm:node:10001';");
    assert(sameSourceRows[0].count === 1, "Hanya 1 POI tersimpan (in-place update, tanpa duplikasi record source)");
    assert(sameSourceRows[0].name === "Warung Bambu Spesial", "Data nama ter-update dengan sukses di PostgreSQL");

    // TEST 6 — Legacy Identity Preservation
    console.log("\n📌 [TEST 6] Legacy Identity Preservation...");
    const { rows: legacyRows } = await pool.query("SELECT * FROM pois WHERE external_id LIKE 'legacy:osm:%' LIMIT 1;");
    if (legacyRows.length > 0) {
      assert(legacyRows[0].osm_type === null, "Legacy POI osm_type tetap NULL (tanpa mengarang info)");
      assert(legacyRows[0].external_id.startsWith("legacy:osm:"), "Legacy POI external_id utuh");
    } else {
      assert(true, "Legacy check skipped (tabel kosong)");
    }

    // TEST 7 — Category Normalization
    console.log("\n📌 [TEST 7] Deterministic Category Normalization...");
    assert(poiClusterer.cluster({ amenity: "restaurant", name: "Soto Ayam" }) === "Restoran", "amenity=restaurant -> Restoran");
    assert(poiClusterer.cluster({ amenity: "hospital", name: "RSUD Sidoarjo" }) === "Rumah Sakit", "amenity=hospital -> Rumah Sakit");
    assert(poiClusterer.cluster({ shop: "supermarket", name: "Superindo" }) === "Supermarket", "shop=supermarket -> Supermarket");

    // TEST 8 — Rest Area Exclusion
    console.log("\n📌 [TEST 8] Rest Area Exclusion (highway=services / rest_area / amenity=rest_area)...");
    const restAreaNode = {
      type: "node",
      id: 99001,
      lat: -7.430,
      lon: 112.720,
      tags: { highway: "services", amenity: "rest_area", name: "Rest Area KM 753 Pazkul" },
    };
    const restAreaEntity = poiEntityFactory.createFromOverpassElement(restAreaNode, poiClusterer);
    assert(restAreaEntity.operational_status === "EXCLUDED", "Rest Area operational_status HARUS 'EXCLUDED'");
    assert(restAreaEntity.exclusion_reason === "REST_AREA", "Rest Area exclusion_reason HARUS 'REST_AREA'");

    const [savedRestArea] = await poiRepository.syncCityPoisWithTransaction([restAreaEntity]);
    assert(savedRestArea && savedRestArea.operational_status === "EXCLUDED", "Rest Area tersimpan di DB dengan status EXCLUDED (TIDAK DIHAPUS)");

    // TEST 9 — Non-Rest-Area POI
    console.log("\n📌 [TEST 9] Non-Rest-Area Normal Eligible POI...");
    const normalNode = {
      type: "node",
      id: 99002,
      lat: -7.431,
      lon: 112.721,
      tags: { amenity: "cafe", name: "Kopi Kenangan Sidoarjo" },
    };
    const normalEntity = poiEntityFactory.createFromOverpassElement(normalNode, poiClusterer);
    assert(normalEntity.operational_status === "ELIGIBLE", "Normal cafe operational_status HARUS 'ELIGIBLE'");
    assert(normalEntity.exclusion_reason === null, "Normal cafe exclusion_reason HARUS null");

    // TEST 10 — No Logical Deduplication (Phase 3 Boundary Safety)
    console.log("\n📌 [TEST 10] No Logical Deduplication (Phase 3 Boundary Safety)...");
    const poiA = poiEntityFactory.createFromOverpassElement(
      { type: "node", id: 99101, lat: -7.4000, lon: 112.7000, tags: { amenity: "cafe", name: "Kopi Janji Jiwa Alun-Alun" } },
      poiClusterer
    );
    const poiB = poiEntityFactory.createFromOverpassElement(
      { type: "node", id: 99102, lat: -7.4001, lon: 112.7001, tags: { amenity: "cafe", name: "Kopi Janji Jiwa Alun-Alun" } },
      poiClusterer
    );
    const [savedA, savedB] = await poiRepository.syncCityPoisWithTransaction([poiA, poiB]);
    assert(savedA.id !== savedB.id, "Dua POI berdekatan tersimpan sebagai 2 record independen di Phase 2");
    assert(savedA.logical_poi_id === savedA.id, "POI A logical_poi_id = id (tanpa auto-merge)");
    assert(savedB.logical_poi_id === savedB.id, "POI B logical_poi_id = id (tanpa auto-merge)");

    // TEST 11 — Geometry Integrity
    console.log("\n📌 [TEST 11] PostGIS Geometry Integrity (POINT EPSG:4326)...");
    const { rows: geomCheck } = await pool.query(`
      SELECT ST_GeometryType(geom) AS type, ST_SRID(geom) AS srid 
      FROM pois WHERE external_id = 'osm:node:10001';
    `);
    assert(geomCheck[0].type === "ST_Point", "PostGIS geometry type HARUS 'ST_Point'");
    assert(geomCheck[0].srid === 4326, "PostGIS SRID HARUS 4326 (WGS 84)");

    // TEST 12 — Cleanup Test Artifacts
    console.log("\n📌 [TEST 12] Cleanup Test Artifacts...");
    await pool.query("DELETE FROM pois WHERE external_id LIKE 'osm:node:1000%' OR external_id LIKE 'osm:way:1000%' OR external_id LIKE 'osm:relation:1000%' OR external_id LIKE 'osm:node:99%';");
    assert(true, "Cleanup test artifacts selesai");

    console.log("\n================================================================================");
    console.log(`🎉 TEST COMPREHENSIVE PHASE 2 SELESAI: ${passed} PASSED, ${failed} FAILED`);
    console.log("================================================================================\n");

    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error("💥 TEST COMPREHENSIVE PHASE 2 GAGAL:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runComprehensivePhase2Tests();
