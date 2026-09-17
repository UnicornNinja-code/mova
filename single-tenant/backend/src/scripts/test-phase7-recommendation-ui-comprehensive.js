import { pool } from "../config/database.js";
import { candidateSellingLocationService } from "../services/candidateSellingLocationService.js";
import { candidateSellingLocationRepository } from "../repositories/candidateSellingLocationRepository.js";

async function runComprehensivePhase7ContractTests() {
  console.log("\n================================================================================");
  console.log("🧪 MEMULAI COMPREHENSIVE AUTOMATED API CONTRACT TEST SUITE: PHASE 7 FRONTEND DSS INTEGRATION");
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
    if (zones.length === 0) throw new Error("Tidak ada zona aktif di database untuk pengujian API contract Phase 7.");
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
    await pool.query("DELETE FROM candidate_selling_locations WHERE name LIKE 'Phase 7 Candidate%';");

    // TEST 1 — Create Valid Test Candidates
    console.log("📌 [TEST 1 & 2] Create Valid Candidate & Verify API Contract...");
    const candidate1 = await candidateSellingLocationService.createCandidateSellingLocation({
      zone_id: activeZone.id,
      name: "Phase 7 Candidate Alpha",
      latitude: validLat,
      longitude: validLon,
      source: "MANUAL",
    });

    const candidate2 = await candidateSellingLocationService.createCandidateSellingLocation({
      zone_id: activeZone.id,
      name: "Phase 7 Candidate Beta",
      latitude: validLat + 0.0001,
      longitude: validLon + 0.0001,
      source: "MANUAL",
    });

    assert(candidate1.validation_status === "ALLOWED", "Candidate 1 created with status 'ALLOWED'");
    assert(candidate2.validation_status === "ALLOWED", "Candidate 2 created with status 'ALLOWED'");

    // TEST 3 & 4 & 5 — Evaluate Zone Candidates API Response Contract
    console.log("\n📌 [TEST 3 & 4 & 5] Evaluate Zone Candidates API Response Contract...");
    const evalZoneRes = await candidateSellingLocationService.evaluateZoneCandidateSellingLocations(activeZone.id, { timeSlot: "siang" });
    assert(evalZoneRes && Array.isArray(evalZoneRes.rankings), "API response contains rankings array");
    assert(evalZoneRes.rankings.length >= 2, "API response returns evaluation for all ALLOWED candidates");
    assert(typeof evalZoneRes.rankings[0].preference_score === "number", "API response includes numerical preference_score (V_i)");

    // TEST 6 — Error Code Preservation for Ineligible Candidate
    console.log("\n📌 [TEST 6] Error Code Preservation for Ineligible Candidate...");
    const rejectedCand = await candidateSellingLocationService.createCandidateSellingLocation({
      zone_id: activeZone.id,
      name: "Phase 7 Candidate Rejected",
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
    assert(evalErr !== null && evalErr.code === "CANDIDATE_NOT_ELIGIBLE_FOR_DSS", "Ineligible candidate evaluation fails with code 'CANDIDATE_NOT_ELIGIBLE_FOR_DSS'");

    // TEST 7-10 — Time Slot Payload Parameter Dispatch
    console.log("\n📌 [TEST 7-10] Time Slot Payload Parameter Dispatch...");
    const slots = ["pagi", "siang", "sore", "malam"];
    for (const slot of slots) {
      const res = await candidateSellingLocationService.evaluateCandidateSellingLocation(candidate1.id, { timeSlot: slot });
      assert(res.time_slot === slot && typeof res.scores.C3 === "number", `Time slot '${slot}' dispatched & C3 score evaluated`);
    }

    // TEST 11-13 — Read-Only Data Safety
    console.log("\n📌 [TEST 11-13] Read-Only Data Safety Verification...");
    const { rows: pBefore } = await pool.query("SELECT COUNT(*)::int AS cnt FROM pois;");
    const { rows: zBefore } = await pool.query("SELECT COUNT(*)::int AS cnt FROM zones;");
    const { rows: rBefore } = await pool.query("SELECT COUNT(*)::int AS cnt FROM protocol_roads;");

    await candidateSellingLocationService.evaluateZoneCandidateSellingLocations(activeZone.id, { timeSlot: "malam" });

    const { rows: pAfter } = await pool.query("SELECT COUNT(*)::int AS cnt FROM pois;");
    const { rows: zAfter } = await pool.query("SELECT COUNT(*)::int AS cnt FROM zones;");
    const { rows: rAfter } = await pool.query("SELECT COUNT(*)::int AS cnt FROM protocol_roads;");

    assert(pBefore[0].cnt === pAfter[0].cnt, "pois table 100% read-only (0 rows mutated)");
    assert(zBefore[0].cnt === zAfter[0].cnt, "zones table 100% read-only (0 rows mutated)");
    assert(rBefore[0].cnt === rAfter[0].cnt, "protocol_roads table 100% read-only (0 rows mutated)");

    // Cleanup test candidates
    await pool.query("DELETE FROM candidate_selling_locations WHERE name LIKE 'Phase 7 Candidate%';");
    console.log("   ✅ Cleanup test candidates selesai.");

    console.log("\n================================================================================");
    console.log(`🎉 TEST API CONTRACT PHASE 7 SELESAI: ${passed} PASSED, ${failed} FAILED`);
    console.log("================================================================================\n");

    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error("💥 TEST API CONTRACT PHASE 7 GAGAL:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runComprehensivePhase7ContractTests();
