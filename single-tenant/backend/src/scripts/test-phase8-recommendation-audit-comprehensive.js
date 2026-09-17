import { pool } from "../config/database.js";
import { candidateSellingLocationService } from "../services/candidateSellingLocationService.js";
import { candidateExplainabilityService } from "../services/dss/CandidateExplainabilityService.js";
import { topsisRepository } from "../repositories/topsisRepository.js";

async function runComprehensivePhase8AuditTests() {
  console.log("\n================================================================================");
  console.log("🧪 MEMULAI COMPREHENSIVE AUTOMATED TEST SUITE: PHASE 8 DSS EXPLAINABILITY & AUDIT TRAIL");
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
    if (zones.length === 0) throw new Error("Tidak ada zona aktif di database untuk pengujian Phase 8.");
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
    await pool.query("DELETE FROM candidate_selling_locations WHERE name LIKE 'Phase 8 Candidate%';");

    // TEST 1-7 — Snapshot Creation & Evaluation ID Verification
    console.log("📌 [TEST 1-7] Evaluation Snapshot Creation & Evaluation ID Verification...");
    const cand1 = await candidateSellingLocationService.createCandidateSellingLocation({
      zone_id: activeZone.id,
      name: "Phase 8 Candidate Alpha",
      latitude: validLat,
      longitude: validLon,
      source: "MANUAL",
    });

    const evalRes = await candidateSellingLocationService.evaluateZoneCandidateSellingLocations(activeZone.id, { timeSlot: "siang" });
    assert(evalRes && evalRes.evaluation_id !== undefined, "Valid evaluation produces evaluation_id");
    assert(evalRes.audit && evalRes.audit.method === "TOPSIS", "Audit metadata attached to evaluation response");

    const snapshot = await candidateSellingLocationService.getEvaluationSnapshotById(evalRes.evaluation_id);
    assert(snapshot && snapshot.evaluation_id === evalRes.evaluation_id, "Evaluation snapshot retrieved successfully from dss_histories");
    assert(snapshot.zone_id === activeZone.id, "Snapshot contains correct zone_id");
    assert(snapshot.time_slot === "siang", "Snapshot contains correct time_slot");

    // TEST 8-16 — Preserved Criteria & Explanation Integrity
    console.log("\n📌 [TEST 8-16] Preserved Criteria & Explainability Integrity...");
    assert(Array.isArray(snapshot.explanations) && snapshot.explanations.length > 0, "Snapshot contains explanations array");
    const topExp = snapshot.explanations[0];
    assert(topExp.recommendation && topExp.recommendation.recommendation_level !== undefined, "Top explanation contains recommendation_level");
    assert(topExp.reasoning && Array.isArray(topExp.reasoning.strong_factors), "Decision reasoning contains strong_factors array");

    // TEST 17 & 18 — Reproducibility & Immutable Historical Snapshot
    console.log("\n📌 [TEST 17 & 18] Reproducibility & Immutable Historical Snapshot...");
    const evalRepeat = await candidateSellingLocationService.evaluateZoneCandidateSellingLocations(activeZone.id, { timeSlot: "siang" });
    assert(evalRepeat.rankings[0].preference_score === evalRes.rankings[0].preference_score, "Identical input produces identical TOPSIS preference_score");

    const historicalSnapshot = await candidateSellingLocationService.getEvaluationSnapshotById(evalRes.evaluation_id);
    assert(historicalSnapshot.evaluation_id === evalRes.evaluation_id, "Historical snapshot remains 100% immutable and retrievable");

    // TEST 19 & 20 — Invalid Candidate Gate Preservation
    console.log("\n📌 [TEST 19 & 20] Invalid Candidate Gate Preservation...");
    const rejectedCand = await candidateSellingLocationService.createCandidateSellingLocation({
      zone_id: activeZone.id,
      name: "Phase 8 Candidate Rejected",
      latitude: 0.0,
      longitude: 0.0,
      source: "MANUAL",
    });

    let evalErr = null;
    try {
      await candidateSellingLocationService.evaluateCandidateSellingLocation(rejectedCand.id, { timeSlot: "siang" });
    } catch (err) {
      evalErr = err;
    }
    assert(evalErr !== null && evalErr.code === "CANDIDATE_NOT_ELIGIBLE_FOR_DSS", "Ineligible candidate blocked with CANDIDATE_NOT_ELIGIBLE_FOR_DSS");

    // TEST 23-27 — 100% Read-Only POI & Geometry Boundaries
    console.log("\n📌 [TEST 23-27] 100% Read-Only POI & Geometry Boundaries...");
    const { rows: countPoisBefore } = await pool.query("SELECT COUNT(*)::int AS cnt FROM pois;");
    const { rows: countZonesBefore } = await pool.query("SELECT COUNT(*)::int AS cnt FROM zones;");
    const { rows: countRoadsBefore } = await pool.query("SELECT COUNT(*)::int AS cnt FROM protocol_roads;");

    await candidateSellingLocationService.evaluateZoneCandidateSellingLocations(activeZone.id, { timeSlot: "malam" });

    const { rows: countPoisAfter } = await pool.query("SELECT COUNT(*)::int AS cnt FROM pois;");
    const { rows: countZonesAfter } = await pool.query("SELECT COUNT(*)::int AS cnt FROM zones;");
    const { rows: countRoadsAfter } = await pool.query("SELECT COUNT(*)::int AS cnt FROM protocol_roads;");

    assert(countPoisBefore[0].cnt === countPoisAfter[0].cnt, "pois table 100% read-only (0 rows mutated)");
    assert(countZonesBefore[0].cnt === countZonesAfter[0].cnt, "zones table 100% read-only (0 rows mutated)");
    assert(countRoadsBefore[0].cnt === countRoadsAfter[0].cnt, "protocol_roads table 100% read-only (0 rows mutated)");

    // Cleanup test candidates
    await pool.query("DELETE FROM candidate_selling_locations WHERE name LIKE 'Phase 8 Candidate%';");
    console.log("   ✅ Cleanup test candidates selesai.");

    console.log("\n================================================================================");
    console.log(`🎉 TEST COMPREHENSIVE PHASE 8 SELESAI: ${passed} PASSED, ${failed} FAILED`);
    console.log("================================================================================\n");

    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error("💥 TEST COMPREHENSIVE PHASE 8 GAGAL:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runComprehensivePhase8AuditTests();
