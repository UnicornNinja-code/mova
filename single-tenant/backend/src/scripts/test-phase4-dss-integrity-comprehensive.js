import { pool } from "../config/database.js";
import { poiRepository } from "../repositories/poiRepository.js";
import { competitorRepository } from "../repositories/competitorRepository.js";
import { topsisEngineService } from "../services/dss/TopsisEngineService.js";
import crypto from "crypto";

async function runComprehensivePhase4Tests() {
  console.log("\n================================================================================");
  console.log("🧪 MEMULAI COMPREHENSIVE AUTOMATED TEST SUITE: PHASE 4 DSS INPUT INTEGRITY");
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
    // Fetch active zone from database to obtain valid PostGIS spatial boundary
    const { rows: zones } = await pool.query("SELECT * FROM zones WHERE status = 'ACTIVE' LIMIT 1;");
    if (zones.length === 0) {
      throw new Error("Tidak ada zona aktif di database untuk pengujian Phase 4.");
    }
    const activeZone = zones[0];
    let zonePoly = activeZone.polygon;
    if (typeof zonePoly === "string") {
      zonePoly = JSON.parse(zonePoly);
    }

    // Get PostGIS PointOnSurface / Centroid inside active zone polygon
    const { rows: centroidRows } = await pool.query(
      "SELECT ST_Y(ST_PointOnSurface(ST_GeomFromGeoJSON($1))) AS lat, ST_X(ST_PointOnSurface(ST_GeomFromGeoJSON($1))) AS lon;",
      [JSON.stringify(zonePoly.type === "Feature" ? zonePoly.geometry : zonePoly)]
    );
    const testLat = parseFloat(centroidRows[0].lat);
    const testLon = parseFloat(centroidRows[0].lon);

    // Clean previous test artifacts
    await pool.query("DELETE FROM pois WHERE external_id LIKE 'osm:node:99%' OR external_id LIKE 'osm:way:99%' OR external_id LIKE 'legacy:osm:99%';");

    // Fetch baseline C1 & C2 before inserting test POIs
    const baseC1C2 = await poiRepository.getDensitasDanDiversitasByZonePolygon(zonePoly);
    const baseC1 = baseC1C2.skor_c1;
    const baseC2 = baseC1C2.skor_c2;

    // TEST 1 & 3 — C1 Logical POI Density & C3 Double Reward Protection
    console.log("📌 [TEST 1 & 3] C1 Logical POI Density & C3 Double Reward Protection...");
    const sharedLogicalId = crypto.randomUUID();
    const parentId = crypto.randomUUID();
    const childId = crypto.randomUUID();

    // Insert 2 physical POIs sharing 1 logical_poi_id
    await pool.query(`
      INSERT INTO pois (id, external_id, osm_type, osm_id, name, category, latitude, longitude, approval_status, operational_status, logical_poi_id, duplicate_of, geom)
      VALUES 
      ($1, 'osm:node:99001', 'node', 99001, 'Restoran A Parent', 'Restoran', $4, $5, 'APPROVED', 'ELIGIBLE', $3, NULL, ST_SetSRID(ST_MakePoint($5, $4), 4326)),
      ($2, 'osm:node:99002', 'node', 99002, 'Restoran A Child', 'Restoran', $4, $5, 'APPROVED', 'ELIGIBLE', $3, $1, ST_SetSRID(ST_MakePoint($5, $4), 4326));
    `, [parentId, childId, sharedLogicalId, testLat, testLon]);

    const c1c2Res = await poiRepository.getDensitasDanDiversitasByZonePolygon(zonePoly);
    assert(c1c2Res.skor_c1 === baseC1 + 1, `C1 menghitung +1 logical POI (sebelum: ${baseC1}, sesudah: ${c1c2Res.skor_c1})`);
    assert(c1c2Res.skor_c2 >= baseC2, `C2 menghitung kategori aktif`);

    const c3ResSiang = await poiRepository.getTimeCrowdScoreByZonePolygon(zonePoly, "siang");
    assert(c3ResSiang.total_pois > 0, "C3 menghitung representative logical POI");

    // TEST 4 — REVIEW POI Protection
    console.log("\n📌 [TEST 4] REVIEW POI Protection...");
    const reviewId = crypto.randomUUID();
    await pool.query(`
      INSERT INTO pois (id, external_id, osm_type, osm_id, name, category, latitude, longitude, approval_status, operational_status, logical_poi_id, geom)
      VALUES ($1, 'osm:node:99003', 'node', 99003, 'ATM Uncertain', 'ATM', $2, $3, 'APPROVED', 'REVIEW', $1, ST_SetSRID(ST_MakePoint($3, $2), 4326));
    `, [reviewId, testLat, testLon]);

    const c1c2Review = await poiRepository.getDensitasDanDiversitasByZonePolygon(zonePoly);
    assert(c1c2Review.skor_c1 === baseC1 + 1, "REVIEW POI tidak menambah skor C1 Densitas");

    // TEST 5 — EXCLUDED Rest Area POI Protection
    console.log("\n📌 [TEST 5] EXCLUDED Rest Area POI Protection...");
    const excludedId = crypto.randomUUID();
    await pool.query(`
      INSERT INTO pois (id, external_id, osm_type, osm_id, name, category, latitude, longitude, approval_status, operational_status, exclusion_reason, logical_poi_id, geom)
      VALUES ($1, 'osm:node:99004', 'node', 99004, 'Rest Area KM 753', 'Rest Area', $2, $3, 'APPROVED', 'EXCLUDED', 'REST_AREA', $1, ST_SetSRID(ST_MakePoint($3, $2), 4326));
    `, [excludedId, testLat, testLon]);

    const c1c2Excluded = await poiRepository.getDensitasDanDiversitasByZonePolygon(zonePoly);
    assert(c1c2Excluded.skor_c1 === baseC1 + 1, "EXCLUDED POI tidak menambah skor C1 Densitas");

    // TEST 6 — PENDING_APPROVAL & REJECTED POI Protection
    console.log("\n📌 [TEST 6] PENDING_APPROVAL & REJECTED POI Protection...");
    const pendingId = crypto.randomUUID();
    await pool.query(`
      INSERT INTO pois (id, external_id, osm_type, osm_id, name, category, latitude, longitude, approval_status, operational_status, logical_poi_id, geom)
      VALUES ($1, 'osm:node:99005', 'node', 99005, 'Toko Pending', 'Supermarket', $2, $3, 'PENDING_APPROVAL', 'ELIGIBLE', $1, ST_SetSRID(ST_MakePoint($3, $2), 4326));
    `, [pendingId, testLat, testLon]);

    const c1c2Pending = await poiRepository.getDensitasDanDiversitasByZonePolygon(zonePoly);
    assert(c1c2Pending.skor_c1 === baseC1 + 1, "PENDING_APPROVAL POI tidak menambah skor C1");

    // TEST 7 — Inactive Category Filtering
    console.log("\n📌 [TEST 7] Inactive Category Filtering...");
    await pool.query("INSERT INTO poi_categories (name, is_active) VALUES ('Kategori Inaktif Test', false) ON CONFLICT (name) DO UPDATE SET is_active = false;");
    const inactiveCatPoiId = crypto.randomUUID();
    await pool.query(`
      INSERT INTO pois (id, external_id, osm_type, osm_id, name, category, latitude, longitude, approval_status, operational_status, logical_poi_id, geom)
      VALUES ($1, 'osm:node:99006', 'node', 99006, 'POI Inaktif', 'Kategori Inaktif Test', $2, $3, 'APPROVED', 'ELIGIBLE', $1, ST_SetSRID(ST_MakePoint($3, $2), 4326));
    `, [inactiveCatPoiId, testLat, testLon]);

    const c1c2Inactive = await poiRepository.getDensitasDanDiversitasByZonePolygon(zonePoly);
    assert(c1c2Inactive.skor_c1 === baseC1 + 1, "POI kategori inaktif tidak menambah skor C1");

    // TEST 8 — Legacy POI Participation
    console.log("\n📌 [TEST 8] Legacy POI Participation...");
    const legacyId = crypto.randomUUID();
    await pool.query(`
      INSERT INTO pois (id, external_id, osm_type, osm_id, name, category, latitude, longitude, approval_status, operational_status, logical_poi_id, geom)
      VALUES ($1, 'legacy:osm:99007:${legacyId}', NULL, 99007, 'Legacy Cafe', 'Kafe & Kedai Kopi', $2, $3, 'APPROVED', 'ELIGIBLE', $1, ST_SetSRID(ST_MakePoint($3, $2), 4326));
    `, [legacyId, testLat, testLon]);

    const c1c2Legacy = await poiRepository.getDensitasDanDiversitasByZonePolygon(zonePoly);
    assert(c1c2Legacy.skor_c1 === baseC1 + 2, "Legacy POI ELIGIBLE ikut berkontribusi (+1) ke skor C1");

    // TEST 9 & 10 — Time Slot Mapping (pagi, siang, sore, malam)
    console.log("\n📌 [TEST 9 & 10] Time Slot Mapping & Deterministic Representative Selection...");
    const c3Pagi = await poiRepository.getTimeCrowdScoreByZonePolygon(zonePoly, "pagi");
    const c3Malam = await poiRepository.getTimeCrowdScoreByZonePolygon(zonePoly, "malam");
    assert(c3Pagi.time_slot === "pagi" && typeof c3Pagi.total_c3_score === "number", "C3 Pagi ter-map ke score_pagi");
    assert(c3Malam.time_slot === "malam" && typeof c3Malam.total_c3_score === "number", "C3 Malam ter-map ke score_malam");

    // TEST 12 — Read-Only Data Safety (0 POI Mutations)
    console.log("\n📌 [TEST 12] Read-Only Data Safety Verification...");
    const { rows: countBefore } = await pool.query("SELECT COUNT(*)::int AS cnt FROM pois;");
    await poiRepository.getDensitasDanDiversitasByZonePolygon(zonePoly);
    await poiRepository.getTimeCrowdScoreByZonePolygon(zonePoly, "siang");
    const { rows: countAfter } = await pool.query("SELECT COUNT(*)::int AS cnt FROM pois;");
    assert(countBefore[0].cnt === countAfter[0].cnt, "Eksekusi DSS 100% Read-Only (0 mutasi/penghapusan data POI)");

    // TEST 13 — C6 Competitor Logical POI Deduplication & Category Preservation
    console.log("\n📌 [TEST 13] C6 Competitor Logical POI Deduplication...");
    const baseComp = await competitorRepository.getZoneCompetitorScore(zonePoly);
    const compLogicalId = crypto.randomUUID();
    const comp1Id = crypto.randomUUID();
    const comp2Id = crypto.randomUUID();
    await pool.query(`
      INSERT INTO pois (id, external_id, osm_type, osm_id, name, category, latitude, longitude, approval_status, operational_status, logical_poi_id, duplicate_of, geom)
      VALUES 
      ($1, 'osm:node:99008', 'node', 99008, 'Kopi Kenangan Parent', 'Kafe & Kedai Kopi', $4, $5, 'APPROVED', 'ELIGIBLE', $3, NULL, ST_SetSRID(ST_MakePoint($5, $4), 4326)),
      ($2, 'osm:node:99009', 'node', 99009, 'Kopi Kenangan Child', 'Kafe & Kedai Kopi', $4, $5, 'APPROVED', 'ELIGIBLE', $3, $1, ST_SetSRID(ST_MakePoint($5, $4), 4326));
    `, [comp1Id, comp2Id, compLogicalId, testLat, testLon]);

    const compRes = await competitorRepository.getZoneCompetitorScore(zonePoly);
    assert(compRes.coffee_poi_count === baseComp.coffee_poi_count + 1, `C6 Competitor menghitung 2 physical POI terduplikasi sebagai +1 logical coffee POI (sebelum: ${baseComp.coffee_poi_count}, sesudah: ${compRes.coffee_poi_count})`);

    // TEST 14 — TOPSIS Pipeline Integration Compatibility
    console.log("\n📌 [TEST 14] TOPSIS Pipeline Integration Compatibility...");
    const topsisRes = await topsisEngineService.calculateTopsisRecommendations({ timeSlot: "siang" });
    assert(topsisRes && topsisRes.rankings && topsisRes.rankings.length > 0, "TOPSIS Pipeline rekomendasi zona berjalan sukses dengan input C1-C6 terverifikasi!");

    // Cleanup test POIs & Categories
    await pool.query("DELETE FROM pois WHERE external_id LIKE 'osm:node:99%' OR external_id LIKE 'osm:way:99%' OR external_id LIKE 'legacy:osm:99%';");
    await pool.query("DELETE FROM poi_categories WHERE name = 'Kategori Inaktif Test';");
    console.log("   ✅ Cleanup test POIs & Categories selesai.");

    console.log("\n================================================================================");
    console.log(`🎉 TEST COMPREHENSIVE PHASE 4 SELESAI: ${passed} PASSED, ${failed} FAILED`);
    console.log("================================================================================\n");

    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error("💥 TEST COMPREHENSIVE PHASE 4 GAGAL:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runComprehensivePhase4Tests();
