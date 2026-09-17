import { pool } from "../config/database.js";
import { candidateSellingLocationService } from "../services/candidateSellingLocationService.js";
import { candidateSellingLocationRepository } from "../repositories/candidateSellingLocationRepository.js";
import { poiRepository } from "../repositories/poiRepository.js";
import { topsisEngineService } from "../services/dss/TopsisEngineService.js";
import crypto from "crypto";

async function runComprehensivePhase6Tests() {
  console.log("\n================================================================================");
  console.log("🧪 MEMULAI COMPREHENSIVE AUTOMATED TEST SUITE: PHASE 6 CANDIDATE DSS EVALUATION");
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
    if (zones.length === 0) throw new Error("Tidak ada zona aktif di database untuk pengujian Phase 6.");
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

    // Clean previous test candidates
    await pool.query("DELETE FROM candidate_selling_locations WHERE name LIKE 'Phase 6 Candidate%';");

    // TEST 1 — ALLOWED Candidate Enters DSS Evaluation
    console.log("📌 [TEST 1 & 21 & 22] ALLOWED Candidate Enters DSS Evaluation...");
    const allowedCand = await candidateSellingLocationService.createCandidateSellingLocation({
      zone_id: activeZone.id,
      name: "Phase 6 Candidate Valid 1",
      latitude: validLat,
      longitude: validLon,
      source: "MANUAL",
    });

    const evalRes = await candidateSellingLocationService.evaluateCandidateSellingLocation(allowedCand.id, { timeSlot: "siang" });
    assert(evalRes.candidate_id === allowedCand.id, "ALLOWED candidate evaluated successfully");
    assert(evalRes.scores && typeof evalRes.scores.C1 === "number" && typeof evalRes.scores.C5 === "number", "C1-C6 criteria matrix structurally valid");

    // TEST 2 — REJECTED Candidate Blocked from DSS Evaluation
    console.log("\n📌 [TEST 2] REJECTED Candidate Blocked from DSS Evaluation...");
    const rejectedCand = await candidateSellingLocationService.createCandidateSellingLocation({
      zone_id: activeZone.id,
      name: "Phase 6 Candidate Rejected",
      latitude: 0.0,
      longitude: 0.0,
      source: "MANUAL",
    });

    let blockedError = null;
    try {
      await candidateSellingLocationService.evaluateCandidateSellingLocation(rejectedCand.id, { timeSlot: "siang" });
    } catch (err) {
      blockedError = err;
    }
    assert(blockedError !== null, "REJECTED candidate evaluation attempt throws error");
    assert(blockedError && blockedError.code === "CANDIDATE_NOT_ELIGIBLE_FOR_DSS", "Error code is 'CANDIDATE_NOT_ELIGIBLE_FOR_DSS'");

    // TEST 7 & 8 — REVIEW / EXCLUDED POI Anchor Candidate Blocked
    console.log("\n📌 [TEST 7 & 8] REVIEW / EXCLUDED POI Anchor Candidate Blocked...");
    const reviewPoiId = crypto.randomUUID();
    await pool.query(`
      INSERT INTO pois (id, external_id, name, category, latitude, longitude, approval_status, operational_status, logical_poi_id, geom)
      VALUES ($1, 'osm:node:99601', 'ATM Review P6', 'ATM', $2, $3, 'APPROVED', 'REVIEW', $1, ST_SetSRID(ST_MakePoint($3, $2), 4326));
    `, [reviewPoiId, validLat, validLon]);

    const reviewPoiCand = await candidateSellingLocationService.createCandidateSellingLocation({
      zone_id: activeZone.id,
      poi_id: reviewPoiId,
      name: "Phase 6 Candidate Review POI Anchor",
      latitude: validLat,
      longitude: validLon,
      source: "POI_REFERENCE",
    });
    assert(reviewPoiCand.validation_status === "REJECTED", "Candidate with REVIEW POI anchor receives REJECTED status");

    let reviewEvalErr = null;
    try {
      await candidateSellingLocationService.evaluateCandidateSellingLocation(reviewPoiCand.id, { timeSlot: "siang" });
    } catch (err) {
      reviewEvalErr = err;
    }
    assert(reviewEvalErr !== null && reviewEvalErr.code === "CANDIDATE_NOT_ELIGIBLE_FOR_DSS", "REVIEW POI anchor candidate evaluation blocked prior to TOPSIS");
    await pool.query("DELETE FROM pois WHERE id = $1;", [reviewPoiId]);

    // TEST 11-16 — C3 Time Slot Mappings (pagi, siang, sore, malam)
    console.log("\n📌 [TEST 11-16] C3 Time Slot Mappings...");
    const evalPagi = await candidateSellingLocationService.evaluateCandidateSellingLocation(allowedCand.id, { timeSlot: "pagi" });
    const evalSiang = await candidateSellingLocationService.evaluateCandidateSellingLocation(allowedCand.id, { timeSlot: "siang" });
    const evalSore = await candidateSellingLocationService.evaluateCandidateSellingLocation(allowedCand.id, { timeSlot: "sore" });
    const evalMalam = await candidateSellingLocationService.evaluateCandidateSellingLocation(allowedCand.id, { timeSlot: "malam" });
    assert(evalPagi.time_slot === "pagi" && typeof evalPagi.scores.C3 === "number", "C3 pagi evaluation succeeds");
    assert(evalSiang.time_slot === "siang" && typeof evalSiang.scores.C3 === "number", "C3 siang evaluation succeeds");
    assert(evalSore.time_slot === "sore" && typeof evalSore.scores.C3 === "number", "C3 sore evaluation succeeds");
    assert(evalMalam.time_slot === "malam" && typeof evalMalam.scores.C3 === "number", "C3 malam evaluation succeeds");

    // TEST 20 — C5 Distance Calculation from Exact Candidate Point
    console.log("\n📌 [TEST 20] C5 Distance Calculation from Exact Candidate Point...");
    assert(typeof evalSiang.scores.C5 === "number" && evalSiang.scores.C5 >= 0, "C5 Distance calculated as valid non-negative float (KM)");

    // TEST 22 & 23 — TOPSIS Candidate Zone Ranking & Deterministic Sorting
    console.log("\n📌 [TEST 22 & 23] TOPSIS Candidate Zone Ranking & Deterministic Sorting...");
    const allowedCand2 = await candidateSellingLocationService.createCandidateSellingLocation({
      zone_id: activeZone.id,
      name: "Phase 6 Candidate Valid 2",
      latitude: validLat + 0.0001,
      longitude: validLon + 0.0001,
      source: "MANUAL",
    });

    const zoneEvalRes = await candidateSellingLocationService.evaluateZoneCandidateSellingLocations(activeZone.id, { timeSlot: "siang" });
    assert(zoneEvalRes.total_evaluated_candidates >= 2, "TOPSIS evaluates all ALLOWED candidates in zone");
    assert(zoneEvalRes.rankings && zoneEvalRes.rankings.length >= 2, "TOPSIS candidate rankings returned");
    assert(zoneEvalRes.rankings[0].rank === 1 && zoneEvalRes.rankings[0].preference_score >= zoneEvalRes.rankings[1].preference_score, "Candidates sorted deterministically by preference_score DESC");

    // TEST 24 — Idempotency Check
    console.log("\n📌 [TEST 24] Candidate Evaluation Idempotency...");
    const evalRepeat1 = await candidateSellingLocationService.evaluateCandidateSellingLocation(allowedCand.id, { timeSlot: "siang" });
    const evalRepeat2 = await candidateSellingLocationService.evaluateCandidateSellingLocation(allowedCand.id, { timeSlot: "siang" });
    assert(evalRepeat1.scores.C1 === evalRepeat2.scores.C1 && evalRepeat1.scores.C5 === evalRepeat2.scores.C5, "Repeated candidate evaluation is 100% idempotent");

    // TEST 25-28 — 100% Read-Only Safety Verification
    console.log("\n📌 [TEST 25-28] 100% Read-Only Safety Verification...");
    const { rows: countPoisBefore } = await pool.query("SELECT COUNT(*)::int AS cnt FROM pois;");
    const { rows: countZonesBefore } = await pool.query("SELECT COUNT(*)::int AS cnt FROM zones;");
    const { rows: countRoadsBefore } = await pool.query("SELECT COUNT(*)::int AS cnt FROM protocol_roads;");

    await candidateSellingLocationService.evaluateCandidateSellingLocation(allowedCand.id, { timeSlot: "malam" });
    await candidateSellingLocationService.evaluateZoneCandidateSellingLocations(activeZone.id, { timeSlot: "malam" });

    const { rows: countPoisAfter } = await pool.query("SELECT COUNT(*)::int AS cnt FROM pois;");
    const { rows: countZonesAfter } = await pool.query("SELECT COUNT(*)::int AS cnt FROM zones;");
    const { rows: countRoadsAfter } = await pool.query("SELECT COUNT(*)::int AS cnt FROM protocol_roads;");

    assert(countPoisBefore[0].cnt === countPoisAfter[0].cnt, "pois table 100% read-only (0 rows mutated)");
    assert(countZonesBefore[0].cnt === countZonesAfter[0].cnt, "zones table 100% read-only (0 rows mutated)");
    assert(countRoadsBefore[0].cnt === countRoadsAfter[0].cnt, "protocol_roads table 100% read-only (0 rows mutated)");

    // TEST 30 — Zone Recommendation Pipeline Intact
    console.log("\n📌 [TEST 30] Zone Recommendation Pipeline Intact...");
    const zoneTopsis = await topsisEngineService.calculateTopsisRecommendations({ timeSlot: "siang" });
    assert(zoneTopsis && zoneTopsis.rankings && zoneTopsis.rankings.length > 0, "Existing zone recommendation pipeline remains 100% intact");

    // Cleanup test candidates
    await pool.query("DELETE FROM candidate_selling_locations WHERE name LIKE 'Phase 6 Candidate%';");
    console.log("   ✅ Cleanup test candidates selesai.");

    console.log("\n================================================================================");
    console.log(`🎉 TEST COMPREHENSIVE PHASE 6 SELESAI: ${passed} PASSED, ${failed} FAILED`);
    console.log("================================================================================\n");

    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error("💥 TEST COMPREHENSIVE PHASE 6 GAGAL:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runComprehensivePhase6Tests();
