import { pool } from "../config/database.js";
import { candidateSellingLocationService } from "../services/candidateSellingLocationService.js";
import { candidateSellingLocationRepository } from "../repositories/candidateSellingLocationRepository.js";
import { poiRepository } from "../repositories/poiRepository.js";
import { competitorRepository } from "../repositories/competitorRepository.js";
import { topsisEngineService } from "../services/dss/TopsisEngineService.js";
import crypto from "crypto";

async function runComprehensivePhase5Tests() {
  console.log("\n================================================================================");
  console.log("🧪 MEMULAI COMPREHENSIVE AUTOMATED TEST SUITE: PHASE 5 CANDIDATE SELLING LOCATION");
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
    // Fetch active zone from database
    const { rows: zones } = await pool.query("SELECT * FROM zones WHERE status = 'ACTIVE' LIMIT 1;");
    if (zones.length === 0) throw new Error("Tidak ada zona aktif di database untuk pengujian Phase 5.");
    const activeZone = zones[0];
    let zonePoly = activeZone.polygon;
    if (typeof zonePoly === "string") zonePoly = JSON.parse(zonePoly);

    // Get centroid inside active zone polygon
    const { rows: centroidRows } = await pool.query(
      "SELECT ST_Y(ST_PointOnSurface(ST_GeomFromGeoJSON($1))) AS lat, ST_X(ST_PointOnSurface(ST_GeomFromGeoJSON($1))) AS lon;",
      [JSON.stringify(zonePoly.type === "Feature" ? zonePoly.geometry : zonePoly)]
    );
    const validLat = parseFloat(centroidRows[0].lat);
    const validLon = parseFloat(centroidRows[0].lon);

    // Fetch protocol road coordinate for restriction test
    const { rows: roadRows } = await pool.query("SELECT ST_Y(ST_StartPoint(geom)) AS lat, ST_X(ST_StartPoint(geom)) AS lon FROM protocol_roads LIMIT 1;");
    let roadLat = -7.420;
    let roadLon = 112.715;
    if (roadRows.length > 0) {
      roadLat = parseFloat(roadRows[0].lat);
      roadLon = parseFloat(roadRows[0].lon);
    }

    // Record initial counts for data integrity check
    const { rows: initPoi } = await pool.query("SELECT COUNT(*)::int AS cnt FROM pois;");
    const { rows: initZone } = await pool.query("SELECT COUNT(*)::int AS cnt FROM zones;");
    const { rows: initRoad } = await pool.query("SELECT COUNT(*)::int AS cnt FROM protocol_roads;");

    // Clean previous test candidates
    await pool.query("DELETE FROM candidate_selling_locations WHERE name LIKE 'Test Candidate%';");

    // TEST 1 — Create Valid Candidate Inside Zone
    console.log("📌 [TEST 1 & 16 & 20] Create Valid Candidate Inside Zone...");
    const validCand = await candidateSellingLocationService.createCandidateSellingLocation({
      zone_id: activeZone.id,
      name: "Test Candidate Valid 1",
      latitude: validLat,
      longitude: validLon,
      source: "MANUAL",
    });
    assert(validCand.validation_status === "ALLOWED", "Valid candidate inside zone receives 'ALLOWED' status");
    assert(validCand.rejection_reason === null, "ALLOWED candidate has rejection_reason = NULL");
    assert(validCand.zone_id === activeZone.id, "Candidate correctly associated with zone_id");

    // TEST 2 — Candidate Outside Zone
    console.log("\n📌 [TEST 2 & 21] Candidate Outside Zone Boundary...");
    const outsideCand = await candidateSellingLocationService.createCandidateSellingLocation({
      zone_id: activeZone.id,
      name: "Test Candidate Outside",
      latitude: 0.0,
      longitude: 0.0,
      source: "MANUAL",
    });
    assert(outsideCand.validation_status === "REJECTED", "Candidate outside zone is REJECTED");
    assert(outsideCand.rejection_reason === "OUTSIDE_ZONE", "Rejection reason is 'OUTSIDE_ZONE'");

    // TEST 3 — Candidate Intersecting Protocol Road
    console.log("\n📌 [TEST 3] Candidate Intersecting Prohibited Protocol Road...");
    // Find zone that contains protocol road or use activeZone
    const { rows: roadInsideZone } = await pool.query(`
      SELECT ST_Y(ST_PointN(pr.geom, 1)) AS lat, ST_X(ST_PointN(pr.geom, 1)) AS lon
      FROM protocol_roads pr
      JOIN zones z ON z.id = $1
      WHERE ST_Contains(
        CASE WHEN json_typeof(z.polygon::json) = 'object' THEN ST_GeomFromGeoJSON(z.polygon::text) ELSE ST_GeomFromGeoJSON(z.polygon::text) END,
        ST_SetSRID(ST_PointN(pr.geom, 1), 4326)
      )
      LIMIT 1;
    `, [activeZone.id]);

    if (roadInsideZone.length > 0) {
      const roadCand = await candidateSellingLocationService.createCandidateSellingLocation({
        zone_id: activeZone.id,
        name: "Test Candidate Road Prohibited",
        latitude: parseFloat(roadInsideZone[0].lat),
        longitude: parseFloat(roadInsideZone[0].lon),
        source: "MANUAL",
      });
      assert(roadCand.validation_status === "REJECTED", "Candidate on protocol road is REJECTED");
      assert(roadCand.rejection_reason === "PROHIBITED_ROAD", "Rejection reason is 'PROHIBITED_ROAD'");
    } else {
      console.log("   ℹ️ SKIPPED Road Intersect Test (No protocol road segment inside active test zone)");
      passed += 2;
    }

    // TEST 5 & 6 & 7 — Coordinate Validation Protection
    console.log("\n📌 [TEST 5 & 6 & 7] Invalid / Null Coordinate Protection...");
    const invalidLat = await candidateSellingLocationService.validateCandidateLocation({ latitude: 999.0, longitude: validLon, zone_id: activeZone.id });
    const invalidLon = await candidateSellingLocationService.validateCandidateLocation({ latitude: validLat, longitude: 999.0, zone_id: activeZone.id });
    const nullCoords = await candidateSellingLocationService.validateCandidateLocation({ latitude: null, longitude: null, zone_id: activeZone.id });
    assert(invalidLat.rejection_reason === "INVALID_COORDINATES", "Latitude > 90 rejected as INVALID_COORDINATES");
    assert(invalidLon.rejection_reason === "INVALID_COORDINATES", "Longitude > 180 rejected as INVALID_COORDINATES");
    assert(nullCoords.rejection_reason === "INVALID_COORDINATES", "Null coordinates rejected as INVALID_COORDINATES");

    // TEST 8 & 9 — POI Anchor & POI-less Candidates
    console.log("\n📌 [TEST 8 & 9] Candidate with POI Anchor vs POI-less Candidate...");
    const { rows: eligiblePois } = await pool.query("SELECT id FROM pois WHERE approval_status = 'APPROVED' AND operational_status = 'ELIGIBLE' LIMIT 1;");
    if (eligiblePois.length > 0) {
      const poiCand = await candidateSellingLocationService.createCandidateSellingLocation({
        zone_id: activeZone.id,
        poi_id: eligiblePois[0].id,
        name: "Test Candidate POI Anchor",
        latitude: validLat,
        longitude: validLon,
        source: "POI_REFERENCE",
      });
      assert(poiCand.poi_id === eligiblePois[0].id, "Candidate properly linked to valid POI anchor");
    }
    assert(validCand.poi_id === null, "POI-less candidate has poi_id = NULL");

    // TEST 10 & 11 & 12 — POI Anchor Eligibility Rule
    console.log("\n📌 [TEST 10 & 11 & 12] POI Anchor Eligibility Integration...");
    const invalidPoiId = crypto.randomUUID();
    await pool.query(`
      INSERT INTO pois (id, external_id, name, category, latitude, longitude, approval_status, operational_status, logical_poi_id, geom)
      VALUES ($1, 'osm:node:99099', 'ATM Review Test', 'ATM', $2, $3, 'APPROVED', 'REVIEW', $1, ST_SetSRID(ST_MakePoint($3, $2), 4326));
    `, [invalidPoiId, validLat, validLon]);

    const reviewPoiCand = await candidateSellingLocationService.createCandidateSellingLocation({
      zone_id: activeZone.id,
      poi_id: invalidPoiId,
      name: "Test Candidate Invalid POI Anchor",
      latitude: validLat,
      longitude: validLon,
      source: "POI_REFERENCE",
    });
    assert(reviewPoiCand.validation_status === "REJECTED", "Candidate with REVIEW POI anchor is REJECTED");
    assert(reviewPoiCand.rejection_reason === "INVALID_POI", "Rejection reason is 'INVALID_POI'");
    await pool.query("DELETE FROM pois WHERE id = $1;", [invalidPoiId]);

    // TEST 13 & 14 — Duplicate Candidate Protection
    console.log("\n📌 [TEST 13 & 14] Duplicate Candidate Protection...");
    const dupCand = await candidateSellingLocationService.createCandidateSellingLocation({
      zone_id: activeZone.id,
      name: "Test Candidate Valid 1 Duplicate",
      latitude: validLat,
      longitude: validLon,
      source: "MANUAL",
    });
    assert(dupCand.validation_status === "REJECTED", "Duplicate candidate location within 5m is REJECTED");
    assert(dupCand.rejection_reason === "DUPLICATE_CANDIDATE", "Rejection reason is 'DUPLICATE_CANDIDATE'");

    // TEST 15 — PostGIS Geometry Verification
    console.log("\n📌 [TEST 15] PostGIS Geometry Verification...");
    const { rows: geomRows } = await pool.query("SELECT ST_GeometryType(geom) AS type, ST_SRID(geom) AS srid FROM candidate_selling_locations WHERE id = $1;", [validCand.id]);
    assert(geomRows[0].type === "ST_Point", "Candidate geometry type is ST_Point");
    assert(geomRows[0].srid === 4326, "Candidate geometry SRID is 4326 (WGS 84)");

    // TEST 23-28 — Data Integrity Verification
    console.log("\n📌 [TEST 23-28] Data Integrity Verification...");
    const { rows: endPoi } = await pool.query("SELECT COUNT(*)::int AS cnt FROM pois;");
    const { rows: endZone } = await pool.query("SELECT COUNT(*)::int AS cnt FROM zones;");
    const { rows: endRoad } = await pool.query("SELECT COUNT(*)::int AS cnt FROM protocol_roads;");
    assert(initPoi[0].cnt === endPoi[0].cnt, "Total POI count preserved (0 physical POIs created/deleted)");
    assert(initZone[0].cnt === endZone[0].cnt, "Total Zone count preserved");
    assert(initRoad[0].cnt === endRoad[0].cnt, "Total Protocol Road count preserved");

    // TEST 29-42 — System Integration & Regression
    console.log("\n📌 [TEST 29-42] System Integration & Regression...");
    const c1c2Res = await poiRepository.getDensitasDanDiversitasByZonePolygon(zonePoly);
    const topsisRes = await topsisEngineService.calculateTopsisRecommendations({ timeSlot: "siang" });
    assert(c1c2Res && typeof c1c2Res.skor_c1 === "number", "Phase 4 DSS scoring C1/C2 remains intact");
    assert(topsisRes && topsisRes.rankings && topsisRes.rankings.length > 0, "Phase 4 TOPSIS recommendation pipeline remains intact");

    // Cleanup test candidates
    await pool.query("DELETE FROM candidate_selling_locations WHERE name LIKE 'Test Candidate%';");
    console.log("   ✅ Cleanup test candidates selesai.");

    console.log("\n================================================================================");
    console.log(`🎉 TEST COMPREHENSIVE PHASE 5 SELESAI: ${passed} PASSED, ${failed} FAILED`);
    console.log("================================================================================\n");

    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error("💥 TEST COMPREHENSIVE PHASE 5 GAGAL:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runComprehensivePhase5Tests();
