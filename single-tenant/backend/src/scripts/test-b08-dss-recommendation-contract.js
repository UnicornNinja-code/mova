import { pool } from "../config/database.js";
import { topsisEngineService } from "../services/dss/TopsisEngineService.js";
import { hybridBwmTopsisService } from "../services/dss/HybridBwmTopsisService.js";
import { rawCriteriaEvaluationService } from "../services/dss/RawCriteriaEvaluationService.js";
import { RecommendationContractFormatter } from "../services/dss/RecommendationContractFormatter.js";

async function runB08ContractAudit() {
  console.log("\n================================================================================");
  console.log("🧪 MEMULAI COMPREHENSIVE AUTOMATED TEST SUITE: B-08 RECOMMENDATION CONTRACT");
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
    // TEST 1 — Zero Frontend Recalculation Contract
    console.log("📌 [INVARIANT 1] Zero Frontend Recalculation Contract...");
    const recResult = await topsisEngineService.calculateTopsisRecommendations({ timeSlot: "siang" });

    assert(recResult.status === "success", "Response contains status 'success'");
    assert(recResult.evaluation_version === "DSS-CRITERIA-v1.0", "Evaluation version is 'DSS-CRITERIA-v1.0'");
    assert(recResult.model_version === "BWM-TOPSIS-v1.0", "Model version is 'BWM-TOPSIS-v1.0'");
    assert(recResult.time_slot === "siang", "Time slot matches request");
    assert(recResult.data_status === "COMPLETE", "Data status is 'COMPLETE'");
    assert(["VALID", "BASELINE", "DEGRADED"].includes(recResult.data_quality), "Data quality enum verified");
    assert(Array.isArray(recResult.rankings) && recResult.rankings.length > 0, "Rankings array populated");

    const topRank = recResult.rankings[0];
    assert(topRank.rank === 1, "Top ranking has rank = 1");
    assert(typeof topRank.preference_score === "number", "Preference score is numeric float");
    assert(typeof topRank.preference_score_pct === "string" && topRank.preference_score_pct.endsWith("%"), "Preference score percentage string formatted");
    assert(typeof topRank.d_pos === "number" && typeof topRank.d_neg === "number", "D+ and D- euclidean distances provided");
    assert(topRank.raw_scores && typeof topRank.raw_scores.C1 === "number", "Strict raw_scores object provided");
    assert(topRank.model && topRank.model.evaluation_version === "DSS-CRITERIA-v1.0", "Self-contained model metadata attached to ranking item");
    assert(topRank.reasoning && Array.isArray(topRank.reasoning.strong_factors) && topRank.reasoning.summary, "Explainability reasoning generated");

    // TEST 2 — Provenance Conservation
    console.log("\n📌 [INVARIANT 2] Provenance Conservation from B-07 to Recommendation...");
    const rawEval = await rawCriteriaEvaluationService.evaluateZoneRawCriteria(topRank.zone_id, { timeSlot: "siang" });
    assert(rawEval.criteria && rawEval.criteria.C1 && rawEval.criteria.C5, "Raw evaluation contains C1-C6 criteria");

    const prov = topRank.provenance;
    assert(prov.C1.source === rawEval.criteria.C1.source, `C1 source conserved (${prov.C1.source})`);
    assert(prov.C1.quality === rawEval.criteria.C1.quality, `C1 quality conserved (${prov.C1.quality})`);
    assert(prov.C1.methodology === rawEval.criteria.C1.methodology, `C1 methodology conserved (${prov.C1.methodology})`);
    assert(prov.C5.source === rawEval.criteria.C5.source, `C5 source conserved (${prov.C5.source})`);
    assert(prov.C5.quality === rawEval.criteria.C5.quality, `C5 quality conserved (${prov.C5.quality})`);
    assert(prov.C5.methodology === rawEval.criteria.C5.methodology, `C5 methodology conserved (${prov.C5.methodology})`);

    // TEST 3 — Worst-Case Degradation & Warning Propagation
    console.log("\n📌 [INVARIANT 3] Worst-Case Degradation & Warning Propagation...");
    const mockDegradedRawEval = [
      {
        zone_id: "zone-1",
        zone_name: "Zone Test 1",
        criteria: {
          C1: { value: 80, source: "POI_MASTER_POSTGIS", quality: "VALID", methodology: "DISTINCT_LOGICAL_POI_COUNT" },
          C2: { value: 12, source: "POI_MASTER_POSTGIS", quality: "VALID", methodology: "DISTINCT_ACTIVE_CATEGORY_COUNT" },
          C3: { value: 4, source: "POI_TIME_SCORES", quality: "VALID", methodology: "EXPERT_BASELINE_LIKERT_1_5" },
          C4: { value: 50, source: "CONSERVATIVE_BASELINE", quality: "DEGRADED", methodology: "OPERATIONAL_HOURS_MAX_PRECIPITATION_PROBABILITY", warning: "WEATHER_UNAVAILABLE_CONSERVATIVE_FALLBACK" },
          C5: { value: 5, source: "DEFAULT_HUB", quality: "BASELINE", methodology: "GEODESIC_DISTANCE_CENTROID" },
          C6: { value: 2, source: "COMPETITOR_COMBINED", quality: "VALID", methodology: "SURVEY_AND_COFFEE_POI_WEIGHTED_SUM" },
        },
      },
    ];

    const mockCalc = {
      rankings: [{ id: "zone-1", name: "Zone Test 1", rank: 1, preference_score: 1.0, d_pos: 0, d_neg: 1 }],
      ideal_positive: { C1: 1, C2: 1, C3: 1, C4: 0, C5: 0, C6: 0 },
      ideal_negative: { C1: 0, C2: 0, C3: 0, C4: 1, C5: 1, C6: 1 },
    };

    const formattedDegraded = RecommendationContractFormatter.buildRecommendationResponse({
      calculation: mockCalc,
      rawEvaluations: mockDegradedRawEval,
      timeSlot: "sore",
      weightSource: "BWM",
    });

    assert(formattedDegraded.data_quality === "DEGRADED", "Overall payload data_quality aggregated to 'DEGRADED'");
    assert(formattedDegraded.rankings[0].data_quality === "DEGRADED", "Zone-level data_quality aggregated to 'DEGRADED'");
    assert(formattedDegraded.warnings.includes("WEATHER_UNAVAILABLE_CONSERVATIVE_FALLBACK"), "Payload-level warnings contains WEATHER_UNAVAILABLE_CONSERVATIVE_FALLBACK");
    assert(formattedDegraded.rankings[0].warnings.includes("WEATHER_UNAVAILABLE_CONSERVATIVE_FALLBACK"), "Zone-level warnings contains WEATHER_UNAVAILABLE_CONSERVATIVE_FALLBACK");

    // TEST 4 — Ranking Immutability (Explainability cannot mutate scores or ranks)
    console.log("\n📌 [INVARIANT 4] Ranking Immutability Verification...");
    const reasoningBefore = formattedDegraded.rankings[0].reasoning;
    const scoreBefore = formattedDegraded.rankings[0].preference_score;
    const rankBefore = formattedDegraded.rankings[0].rank;

    // Mutate reasoning text or invoke reasoning generator
    RecommendationContractFormatter.generateReasoning(
      formattedDegraded.rankings[0].raw_scores,
      { C1: 100, C2: 100, C3: 100, C4: 0, C5: 0, C6: 0 },
      99,
      0.0,
      "Mutated Zone"
    );

    assert(formattedDegraded.rankings[0].preference_score === scoreBefore, "Preference score remains 100% immutable");
    assert(formattedDegraded.rankings[0].rank === rankBefore, "Rank remains 100% immutable");

    // TEST 5 — Snapshot Persistence Completeness
    console.log("\n📌 [TEST 5] Self-Contained History Snapshot Persistence...");
    const snapshots = await hybridBwmTopsisService.getSnapshots(1);
    assert(snapshots.length > 0, "History snapshot exists in database");
    const latestSnapshot = snapshots[0];
    assert(latestSnapshot.evaluation_version === "DSS-CRITERIA-v1.0", "Snapshot evaluation_version recorded");
    assert(latestSnapshot.details.model_version === "BWM-TOPSIS-v1.0", "Snapshot model_version recorded");
    assert(latestSnapshot.details.rankings[0].provenance, "Snapshot preserves ranking item provenance");
    assert(latestSnapshot.details.rankings[0].raw_scores, "Snapshot preserves ranking item raw_scores");

    console.log("\n================================================================================");
    console.log(`🎉 TEST COMPREHENSIVE B-08 SELESAI: ${passed} PASSED, ${failed} FAILED`);
    console.log("================================================================================\n");

    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error("💥 TEST B-08 GAGAL:", err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runB08ContractAudit();
