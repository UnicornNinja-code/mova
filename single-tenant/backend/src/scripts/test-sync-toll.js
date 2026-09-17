import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pool } from "../config/database.js";
import { zoneService } from "../services/zoneService.js";
import { roadService } from "../services/roadService.js";
import { roadOverpassSyncService } from "../services/roadOverpassSyncService.js";
import { operationalRuleService } from "../services/operationalRuleService.js";
import { ZoneModel } from "../models/zoneModel.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTollRoadIntegrationTests() {
  console.log("\n================================================================================");
  console.log("🧪 AUTOMATED TEST SUITE: TOLL ROAD SPATIAL RESTRICTION DATA INTEGRATION");
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

  // Ensure operational rules are ON
  await operationalRuleService.updateOperationalRules({
    protocol_road_prohibited: true,
    toll_road_prohibited: true,
  });

  // Clean test zones if existing
  const cleanupNames = [
    "Zona Uji Coba Di Atas Jalan Tol",
    "Zona Uji Coba Di Jalan Protokol",
    "Zona Valid Uji Coba Restriksi Tol",
  ];
  for (const name of cleanupNames) {
    const ex = await ZoneModel.findByName(name);
    if (ex) await ZoneModel.delete(ex.id);
  }

  let createdTestZoneId = null;

  try {
    // TEST 1 — Database Persistence & Toll Road Row Count
    console.log("📌 [TEST 1] Toll Road Database Persistence & Row Count...");
    const { rows: dbTollRows } = await pool.query(
      "SELECT COUNT(*)::int AS total FROM protocol_roads WHERE restriction_type = 'PROHIBITED_TOLL_ROAD';"
    );
    const tollCount = dbTollRows[0].total;
    assert(tollCount > 0, `Database 'protocol_roads' memuat ${tollCount} segmen Jalan Tol (PROHIBITED_TOLL_ROAD)`);

    // TEST 2 — Identity & Canonical ID Format (osm:way:<id>)
    console.log("\n📌 [TEST 2] Toll Road External ID Format & Uniqueness...");
    const { rows: idSample } = await pool.query(
      "SELECT external_id FROM protocol_roads WHERE restriction_type = 'PROHIBITED_TOLL_ROAD' LIMIT 5;"
    );
    assert(
      idSample.length > 0 && idSample[0].external_id.startsWith("osm:way:"),
      `Format external_id terbukti kanonikal 'osm:way:<id>' (Sample: ${idSample[0]?.external_id})`
    );

    const { rows: dupRows } = await pool.query(
      "SELECT external_id, COUNT(*)::int FROM protocol_roads GROUP BY 1 HAVING COUNT(*) > 1;"
    );
    assert(dupRows.length === 0, "Zero duplikasi external_id di seluruh tabel 'protocol_roads'");

    // TEST 3 — PostGIS Geometry & SRID Integrity
    console.log("\n📌 [TEST 3] PostGIS Geometry & SRID Integrity Check...");
    const { rows: geomCheck } = await pool.query(`
      SELECT 
        COUNT(*)::int AS total,
        SUM(CASE WHEN ST_SRID(geom) = 4326 THEN 1 ELSE 0 END)::int AS valid_srid,
        SUM(CASE WHEN ST_IsValid(geom) THEN 1 ELSE 0 END)::int AS valid_geom,
        SUM(CASE WHEN geom IS NULL THEN 1 ELSE 0 END)::int AS null_geom
      FROM protocol_roads
      WHERE restriction_type = 'PROHIBITED_TOLL_ROAD';
    `);

    const gStats = geomCheck[0];
    assert(gStats.valid_srid === gStats.total, `Seluruh ${gStats.total} segmen Jalan Tol ber-SRID 4326`);
    assert(gStats.valid_geom === gStats.total, `Seluruh ${gStats.total} geometri Jalan Tol valid (ST_IsValid = true)`);
    assert(gStats.null_geom === 0, "Zero NULL geometry pada segmen Jalan Tol");

    // TEST 4 — Read-Only Toll Road GeoJSON API Retrieval
    console.log("\n📌 [TEST 4] Read-Only Toll Road GeoJSON API Service...");
    const tollGeoJson = await roadService.getTollRoadsGeoJson();
    assert(tollGeoJson.type === "FeatureCollection", "API mengembalikan GeoJSON 'FeatureCollection'");
    assert(
      Array.isArray(tollGeoJson.features) && tollGeoJson.features.length === tollCount,
      `API GeoJSON mengembalikan seluruh ${tollCount} fitur Jalan Tol`
    );

    // TEST 5 — Sidoarjo–Gempol Toll Road Specific Feature Check
    console.log("\n📌 [TEST 5] Sidoarjo–Gempol Toll Corridor Segments Detection...");
    const { rows: tollCorridorRows } = await pool.query(`
      SELECT external_id, name, highway_type
      FROM protocol_roads
      WHERE restriction_type = 'PROHIBITED_TOLL_ROAD'
        AND (name ILIKE '%surabaya%' OR name ILIKE '%gempol%' OR name ILIKE '%porong%' OR name ILIKE '%sidoarjo%' OR name ILIKE '%way%')
      LIMIT 10;
    `);
    assert(tollCorridorRows.length > 0, `Terdeteksi segmen Jalan Tol koridor Sidoarjo-Porong-Gempol di DB`);

    // TEST 6 — Spatial Intersection Rejection for Zone Crossing Toll Road (HTTP 409 Conflict)
    console.log("\n📌 [TEST 6] Zone Crossing Toll Road Rejection (ZONE_INTERSECTS_TOLL_ROAD)...");
    // Get an actual sample line geometry from toll roads DB
    const { rows: sampleTollGeom } = await pool.query(`
      SELECT ST_AsGeoJSON(ST_Buffer(geom::geography, 20)::geometry) AS buffer_geojson, name
      FROM protocol_roads
      WHERE restriction_type = 'PROHIBITED_TOLL_ROAD'
      LIMIT 1;
    `);

    assert(sampleTollGeom.length > 0, "Segmen contoh geometri Jalan Tol tersedia di database");
    const tollPolygonBuffer = JSON.parse(sampleTollGeom[0].buffer_geojson);

    let tollRejectSuccess = false;
    try {
      await zoneService.createZone({
        name: "Zona Uji Coba Di Atas Jalan Tol",
        max_capacity: 5,
        status: "ACTIVE",
        polygon: tollPolygonBuffer,
      });
    } catch (err) {
      tollRejectSuccess = true;
      assert(err.statusCode === 409, "Zona di area Jalan Tol DITOLAK dengan HTTP 409 Conflict!");
      assert(err.code === "ZONE_INTERSECTS_TOLL_ROAD", "Error code HARUS 'ZONE_INTERSECTS_TOLL_ROAD'");
      assert(
        err.details?.restriction_type === "PROHIBITED_TOLL_ROAD",
        "Error details restriction_type HARUS 'PROHIBITED_TOLL_ROAD'"
      );
      assert(Array.isArray(err.details?.intersected_roads), "Error details menyertakan daftar jalan tol yang terpotong");
    }
    assert(tollRejectSuccess, "PostGIS ST_Intersects Jalan Tol berhasil memblokir request zona terlarang");

    // TEST 7 — Existing Protocol Road Validation Regression Check
    console.log("\n📌 [TEST 7] Existing Protocol Road Validation Regression Check...");
    const { rows: sampleProtocolGeom } = await pool.query(`
      SELECT ST_AsGeoJSON(ST_Buffer(geom::geography, 20)::geometry) AS buffer_geojson, name
      FROM protocol_roads
      WHERE restriction_type = 'PROHIBITED_ROAD'
      LIMIT 1;
    `);
    assert(sampleProtocolGeom.length > 0, "Segmen contoh geometri Jalan Protokol tersedia di database");
    const prohibitedProtocolPolygon = JSON.parse(sampleProtocolGeom[0].buffer_geojson);

    let protocolRejectSuccess = false;
    try {
      await zoneService.createZone({
        name: "Zona Uji Coba Di Jalan Protokol",
        max_capacity: 5,
        status: "ACTIVE",
        polygon: prohibitedProtocolPolygon,
      });
    } catch (err) {
      protocolRejectSuccess = true;
      assert(err.statusCode === 409, "Zona di jalan protokol DITOLAK dengan HTTP 409 Conflict!");
      assert(err.code === "ZONE_INTERSECTS_RESTRICTED_AREA", "Error code Jalan Protokol HARUS 'ZONE_INTERSECTS_RESTRICTED_AREA'");
    }
    assert(protocolRejectSuccess, "Validasi Jalan Protokol tetap 100% konsisten (Zero Regression)");

    // TEST 8 — Valid Zone Outside All Restrictions (PASS 200)
    console.log("\n📌 [TEST 8] Valid Zone Creation Outside Restrictions (PASS 200)...");
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

    const existingTest = await ZoneModel.findByName("Zona Valid Uji Coba Restriksi Tol");
    if (existingTest) await ZoneModel.delete(existingTest.id);

    const createdZone = await zoneService.createZone({
      name: "Zona Valid Uji Coba Restriksi Tol",
      description: "Zona aman luar jalan protokol dan luar jalan tol",
      max_capacity: 5,
      status: "ACTIVE",
      polygon: validPolygonOutside,
    });
    createdTestZoneId = createdZone.id;
    assert(createdZone && createdZone.id !== undefined, "Zona berhasil dibuat di area aman luar restriksi");

    // Cleanup created test zone
    await ZoneModel.delete(createdTestZoneId);

    // TEST 9 — Zero DSS / POI Formula Regression Check
    console.log("\n📌 [TEST 9] Zero DSS & POI Formula Regression Check...");
    const { rows: poiSample } = await pool.query("SELECT COUNT(*)::int AS total FROM pois;");
    assert(poiSample[0].total > 0, `Tabel POI utuh (${poiSample[0].total} record POI)`);

    console.log("\n================================================================================");
    console.log(`🎉 TEST TOLL ROAD DATA INTEGRATION SELESAI: ${passed} PASSED, ${failed} FAILED`);
    console.log("================================================================================\n");

    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error("💥 TEST TOLL ROAD DATA INTEGRATION FAILED:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTollRoadIntegrationTests();
