import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pool } from "../config/database.js";
import { zoneService } from "../services/zoneService.js";
import { roadService } from "../services/roadService.js";
import { ZoneModel } from "../models/zoneModel.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runProtocolRoadTests() {
  console.log("\n================================================================================");
  console.log("🧪 MEMULAI AUTOMATED TEST SUITE: SPATIAL RESTRICTION LAYER (JALAN PROTOKOL)");
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

  let createdTestZoneId = null;

  try {
    // TEST 1 — Restriction GeoJSON can be read
    console.log("📌 [TEST 1] GeoJSON Source File Exists & Readable...");
    const geoJsonPath = path.join(__dirname, "../../public/geojson/jalan_protokol.geojson");
    const fileExists = fs.existsSync(geoJsonPath);
    assert(fileExists, "File 'jalan_protokol.geojson' ada pada public/geojson/");
    const rawGeoJson = fs.readFileSync(geoJsonPath, "utf8");
    const parsedGeoJson = JSON.parse(rawGeoJson);
    const features = parsedGeoJson.features || [];
    assert(features.length > 0, `GeoJSON berisi ${features.length} features`);

    // TEST 2 — Restriction geometry valid LineStrings
    console.log("\n📌 [TEST 2] Restriction Geometries Valid LineStrings...");
    const lineStrings = features.filter((f) => f.geometry?.type === "LineString");
    assert(lineStrings.length === features.length, `Semua ${features.length} features ber-type LineString`);

    // TEST 3 — Restriction Geometry in PostGIS table with GIST index
    console.log("\n📌 [TEST 3] PostGIS Table & GIST Index Validation...");
    const { rows: dbRoads } = await pool.query("SELECT COUNT(*)::int AS total FROM protocol_roads WHERE restriction_type IS NULL OR restriction_type = 'PROHIBITED_ROAD';");
    assert(dbRoads[0].total === features.length, `Tabel PostGIS 'protocol_roads' berisi ${dbRoads[0].total} rows (Expected: ${features.length})`);

    const { rows: gistIndex } = await pool.query(`
      SELECT indexname FROM pg_indexes 
      WHERE tablename = 'protocol_roads' AND indexname = 'idx_protocol_roads_geom_gist';
    `);
    assert(gistIndex.length > 0, "PostGIS GIST Index 'idx_protocol_roads_geom_gist' aktif!");

    // TEST 4 — Valid Zone Outside Protocol Roads (PASS)
    console.log("\n📌 [TEST 4] Valid Zone Outside Prohibited Roads (PASS)...");
    const validPolygonOutside = {
      type: "Polygon",
      coordinates: [
        [
          [112.750, -7.450],
          [112.755, -7.450],
          [112.755, -7.455],
          [112.750, -7.455],
          [112.750, -7.450],
        ],
      ],
    };

    // Cleanup existing test zone if any
    const existingTest = await ZoneModel.findByName("Zona Valid Uji Coba Prohibited");
    if (existingTest) await ZoneModel.delete(existingTest.id);

    const createdZone = await zoneService.createZone({
      name: "Zona Valid Uji Coba Prohibited",
      description: "Zona uji di area aman",
      max_capacity: 5,
      status: "ACTIVE",
      polygon: validPolygonOutside,
    });
    createdTestZoneId = createdZone.id;
    assert(createdZone && createdZone.id !== undefined, "Zona berhasil dibuat di area aman luar jalan protokol");

    // TEST 5 — Zone Overlap Existing Zone (REJECT 400)
    console.log("\n📌 [TEST 5] Zone Overlapping Existing Active Zone (REJECT 400)...");
    let overlapFailed = false;
    try {
      await zoneService.createZone({
        name: "Zona Overlap Fail Test",
        max_capacity: 5,
        status: "ACTIVE",
        polygon: validPolygonOutside,
      });
    } catch (err) {
      overlapFailed = true;
      assert(err.statusCode === 400, "Overlap zone ditolak dengan HTTP 400 Bad Request");
    }
    assert(overlapFailed, "Zone Overlap validation berhasil menggagalkan request");

    // TEST 6 — Zone Crossing Protocol Road (REJECT 409 Conflict)
    console.log("\n📌 [TEST 6] Zone Crossing Protocol Road (REJECT 409 Conflict)...");
    // Ponokawan road line segment crosses around (112.603, -7.391)
    const prohibitedPolygon = {
      type: "Polygon",
      coordinates: [
        [
          [112.601, -7.390],
          [112.605, -7.390],
          [112.605, -7.393],
          [112.601, -7.393],
          [112.601, -7.390],
        ],
      ],
    };

    let prohibitedFailed = false;
    try {
      await zoneService.createZone({
        name: "Zona Di Jalan Protokol Fail Test",
        max_capacity: 5,
        status: "ACTIVE",
        polygon: prohibitedPolygon,
      });
    } catch (err) {
      prohibitedFailed = true;
      assert(err.statusCode === 409, "Zona di jalan protokol HARUS DITOLAK dengan HTTP 409 Conflict!");
      assert(err.code === "ZONE_INTERSECTS_RESTRICTED_AREA", "Error code HARUS 'ZONE_INTERSECTS_RESTRICTED_AREA'");
      assert(err.details?.restriction_type === "PROHIBITED_ROAD", "Restriction type HARUS 'PROHIBITED_ROAD'");
      assert(Array.isArray(err.details?.intersected_roads), "Error details menyertakan daftar jalan protokol terpotong");
    }
    assert(prohibitedFailed, "Pengecekan PostGIS ST_Intersects jalan protokol berhasil menggagalkan request");

    // TEST 7 — Zone Partially Entering Restriction (REJECT 409)
    console.log("\n📌 [TEST 7] Zone Partially Entering Restriction (REJECT 409)...");
    let partialFailed = false;
    try {
      await zoneService.createZone({
        name: "Zona Partial Fail Test",
        max_capacity: 5,
        status: "ACTIVE",
        polygon: prohibitedPolygon,
      });
    } catch (err) {
      partialFailed = err.statusCode === 409;
    }
    assert(partialFailed, "Zona sebagian memasuki jalan protokol HARUS DITOLAK");

    // TEST 8 — Zone Crossing Multiple Protocol Roads (REJECT + Return Road Details)
    console.log("\n📌 [TEST 8] Zone Crossing Multiple Protocol Roads (REJECT + Return Road Details)...");
    const multiRoadPolygon = {
      type: "Polygon",
      coordinates: [
        [
          [112.590, -7.390],
          [112.610, -7.390],
          [112.610, -7.400],
          [112.590, -7.400],
          [112.590, -7.390],
        ],
      ],
    };

    try {
      await zoneService.createZone({
        name: "Zona Multi Road Fail Test",
        max_capacity: 5,
        status: "ACTIVE",
        polygon: multiRoadPolygon,
      });
    } catch (err) {
      assert(err.statusCode === 409, "Multi-road intersection ditolak HTTP 409");
      const roads = err.details?.intersected_roads || [];
      assert(roads.length >= 1, `Ditemukan ${roads.length} jalan protokol terinterseksi`);
    }

    // TEST 9 — Update Existing Valid Zone to Cross Protocol Road (REJECT 409)
    console.log("\n📌 [TEST 9] Update Existing Valid Zone to Cross Protocol Road (REJECT 409)...");
    let updateProhibitedFailed = false;
    try {
      await zoneService.updateZone(createdTestZoneId, {
        polygon: prohibitedPolygon,
      });
    } catch (err) {
      updateProhibitedFailed = true;
      assert(err.statusCode === 409, "Update zona ke area jalan protokol HARUS DITOLAK dengan HTTP 409 Conflict!");
      assert(err.code === "ZONE_INTERSECTS_RESTRICTED_AREA", "Update error code HARUS 'ZONE_INTERSECTS_RESTRICTED_AREA'");
    }
    assert(updateProhibitedFailed, "Update zona terbukti gagal dan divalidasi PostGIS!");

    // TEST 10 — Update Existing Valid Zone Without Intersection (PASS 200)
    console.log("\n📌 [TEST 10] Update Existing Valid Zone Without Intersection (PASS 200)...");
    const updatedPolygonOutside = {
      type: "Polygon",
      coordinates: [
        [
          [112.751, -7.451],
          [112.756, -7.451],
          [112.756, -7.456],
          [112.751, -7.456],
          [112.751, -7.451],
        ],
      ],
    };

    const updatedZone = await zoneService.updateZone(createdTestZoneId, {
      name: "Zona Valid Uji Coba Prohibited Updated",
      polygon: updatedPolygonOutside,
    });
    assert(updatedZone.name === "Zona Valid Uji Coba Prohibited Updated", "Update zona di area aman BERHASIL diproses");

    // Cleanup created test zone
    await ZoneModel.delete(createdTestZoneId);

    // TEST 11 — Read-Only Protocol Road API (GET /api/roads/protocol)
    console.log("\n📌 [TEST 11] Read-Only Protocol Road API (GET /api/roads/protocol)...");
    const roadGeoJson = await roadService.getProtocolRoadsGeoJson();
    assert(roadGeoJson.type === "FeatureCollection", "API mengembalikan GeoJSON type 'FeatureCollection'");
    assert(Array.isArray(roadGeoJson.features) && roadGeoJson.features.length === features.length, `API mengembalikan seluruh ${features.length} features`);

    // TEST 12 — Phase 2 POI Identity & Classification Untouched Check
    console.log("\n📌 [TEST 12] Phase 2 POI Identity & Classification Untouched Check...");
    const { rows: poiSample } = await pool.query("SELECT external_id, approval_status, operational_status FROM pois LIMIT 5;");
    assert(poiSample.length > 0 && poiSample[0].external_id !== undefined, "Data POI Phase 2 external_id utuh");
    assert(poiSample[0].operational_status !== undefined, "Data POI Phase 2 operational_status utuh");

    console.log("\n================================================================================");
    console.log(`🎉 TEST SPATIAL RESTRICTION LAYER SELESAI: ${passed} PASSED, ${failed} FAILED`);
    console.log("================================================================================\n");

    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error("💥 TEST SPATIAL RESTRICTION FAILED:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runProtocolRoadTests();
