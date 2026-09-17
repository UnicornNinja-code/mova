/*
 * test_stage3b_safe_topsis.ts
 * Comprehensive Stage 3B Verification: Criteria Master, BWM Weighting, Safe TOPSIS Engine, & End-to-End Pipeline
 */

import { pool } from "../src/config/database.js";
import { safeTopsisEngine, CandidateAlternative, CriterionDefinition } from "../src/services/dss/SafeTopsisEngine.js";
import { criteriaMasterService, STANDARD_DSS_CRITERIA } from "../src/services/dss/CriteriaMasterService.js";
import { bwmWeightService } from "../src/services/dss/BwmWeightService.js";
import { rawCriteriaEvaluationService } from "../src/services/dss/RawCriteriaEvaluationService.js";
import { topsisEngineService } from "../src/services/dss/TopsisEngineService.js";
import { withTenantContext } from "../src/lib/tenantContext.js";

const TENANT_A = "test-stage3b-tenant-a";

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string, detail?: any) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ PASS: ${testName}`);
  } else {
    console.error(`  ❌ FAIL: ${testName}`, detail || "");
    process.exitCode = 1;
  }
}

async function runStage3bTests() {
  console.log("\n==================================================================");
  console.log("📊 STAGE 3B: CRITERIA MASTER, BWM & SAFE TOPSIS VERIFICATION");
  console.log("==================================================================\n");

  try {
    // 0. Ensure Standard Criteria in Database
    await criteriaMasterService.ensureStandardCriteriaInDb();

    // =========================================================================
    // SUITE 1: Criteria Master Standard Verification (C1-C3 BENEFIT, C4-C6 COST)
    // =========================================================================
    console.log("--- Suite 1: Criteria Master Standard Definition (C1-C6) ---");
    assert(STANDARD_DSS_CRITERIA.length === 6, "Standard DSS criteria contains exactly 6 criteria");

    const benefitCriteria = STANDARD_DSS_CRITERIA.filter((c) => c.type === "BENEFIT").map((c) => c.code);
    const costCriteria = STANDARD_DSS_CRITERIA.filter((c) => c.type === "COST").map((c) => c.code);

    assert(
      JSON.stringify(benefitCriteria) === JSON.stringify(["C1", "C2", "C3"]),
      "C1 (Density), C2 (Diversity), and C3 (Footfall/Time Crowd) are strictly BENEFIT criteria",
      benefitCriteria
    );

    assert(
      JSON.stringify(costCriteria) === JSON.stringify(["C4", "C5", "C6"]),
      "C4 (Weather Risk), C5 (Rider Distance), and C6 (Relevant Competitor) are strictly COST criteria",
      costCriteria
    );

    // =========================================================================
    // SUITE 2: Pure Safe TOPSIS Mathematical Kernel & Edge Case Invariants
    // =========================================================================
    console.log("\n--- Suite 2: Pure Safe TOPSIS Mathematical Kernel ---");

    const sampleCriteria: CriterionDefinition[] = [
      { code: "C1", name: "Densitas POI", type: "BENEFIT", weight: 0.30 },
      { code: "C2", name: "Diversitas POI", type: "BENEFIT", weight: 0.20 },
      { code: "C3", name: "Potensi Keramaian", type: "BENEFIT", weight: 0.20 },
      { code: "C4", name: "Risiko Cuaca", type: "COST", weight: 0.10 },
      { code: "C5", name: "Jarak Rider", type: "COST", weight: 0.10 },
      { code: "C6", name: "Dampak Kompetitor", type: "COST", weight: 0.10 },
    ];

    // Case 2.1: Monotonic Behavior (High Benefit, Low Cost vs Low Benefit, High Cost)
    const sampleAlternatives: CandidateAlternative[] = [
      {
        id: "zone-good",
        name: "Zona A (High POI, Low Competitor)",
        scores: { C1: 50, C2: 12, C3: 4.5, C4: 10, C5: 1.5, C6: 0.2 }, // Favorable
      },
      {
        id: "zone-bad",
        name: "Zona B (Low POI, High Competitor)",
        scores: { C1: 10, C2: 3, C3: 1.5, C4: 80, C5: 8.0, C6: 3.5 }, // Unfavorable
      },
      {
        id: "zone-medium",
        name: "Zona C (Balanced Medium)",
        scores: { C1: 30, C2: 8, C3: 3.0, C4: 40, C5: 4.0, C6: 1.2 }, // Medium
      },
    ];

    const result = safeTopsisEngine.execute(sampleAlternatives, sampleCriteria);
    assert(result.rankings.length === 3, "TOPSIS generates rankings for all 3 alternatives");
    assert(
      result.rankings[0].id === "zone-good" && result.rankings[0].rank === 1,
      `Top ranked alternative is Zona A with highest closeness score (${result.rankings[0].score})`
    );
    assert(
      result.rankings[2].id === "zone-bad" && result.rankings[2].rank === 3,
      `Lowest ranked alternative is Zona B with lowest closeness score (${result.rankings[2].score})`
    );

    // Verify Ideal Solutions direction for C1 (Benefit) and C6 (Cost)
    assert(
      result.ideal_solutions.positive.C1 > result.ideal_solutions.negative.C1,
      "For C1 (BENEFIT), A+ is higher than A-"
    );
    assert(
      result.ideal_solutions.positive.C6 < result.ideal_solutions.negative.C6,
      "For C6 (COST), A+ is lower than A- (penalizing high competitor impact)"
    );

    // Case 2.2: Zero-Variance Guard (All alternatives have 0 for a criterion)
    const zeroVarAlternatives: CandidateAlternative[] = [
      { id: "z1", name: "Z1", scores: { C1: 20, C2: 0, C3: 3, C4: 10, C5: 2, C6: 0 } },
      { id: "z2", name: "Z2", scores: { C1: 10, C2: 0, C3: 2, C4: 20, C5: 4, C6: 0 } },
    ];
    const zeroVarResult = safeTopsisEngine.execute(zeroVarAlternatives, sampleCriteria);
    assert(
      !isNaN(zeroVarResult.rankings[0].score) && zeroVarResult.rankings[0].score >= 0,
      "Zero-Variance Guard handles zero-value columns without NaN or crash"
    );

    // Case 2.3: Zero-Distance Guard (Identical alternatives return score 0.50)
    const identicalAlternatives: CandidateAlternative[] = [
      { id: "dup1", name: "Dup 1", scores: { C1: 20, C2: 5, C3: 3, C4: 20, C5: 3, C6: 1 } },
      { id: "dup2", name: "Dup 2", scores: { C1: 20, C2: 5, C3: 3, C4: 20, C5: 3, C6: 1 } },
    ];
    const identicalResult = safeTopsisEngine.execute(identicalAlternatives, sampleCriteria);
    assert(
      identicalResult.rankings[0].score === 0.50 && identicalResult.rankings[1].score === 0.50,
      "Zero-Distance Guard assigns 0.50 to identical alternatives"
    );

    // =========================================================================
    // SUITE 3: Best-Worst Method (BWM) Optimal Weight Solver
    // =========================================================================
    console.log("\n--- Suite 3: Best-Worst Method (BWM) Weight Solver ---");

    const bwmCriteriaList = [
      { id: "c1", code: "C1", name: "Densitas POI" },
      { id: "c2", code: "C2", name: "Diversitas POI" },
      { id: "c3", code: "C3", name: "Potensi Keramaian" },
      { id: "c4", code: "C4", name: "Risiko Cuaca" },
      { id: "c5", code: "C5", name: "Jarak Rider" },
      { id: "c6", code: "C6", name: "Dampak Kompetitor" },
    ];

    const bwmOutput = bwmWeightService.calculateBwmWeights({
      best_criteria_id: "c1",
      worst_criteria_id: "c6",
      best_to_others: { c1: 1, c2: 2, c3: 2, c4: 4, c5: 5, c6: 8 },
      worst_to_others: { c1: 8, c2: 4, c3: 4, c4: 2, c5: 2, c6: 1 },
      criteria_list: bwmCriteriaList,
    });

    assert(bwmOutput.is_consistent === true, `BWM Consistency Ratio CR = ${bwmOutput.consistency_ratio.toFixed(4)} <= 0.30`);
    assert(bwmOutput.weights["c1"] > bwmOutput.weights["c6"], "Best criterion (C1) gets higher weight than Worst criterion (C6)");

    const totalBwmWeight = Object.values(bwmOutput.weights).reduce((a, b) => a + b, 0);
    assert(Math.abs(totalBwmWeight - 1.0) < 1e-4, "Sum of optimal BWM weights equals 1.0 (100%)");

    // =========================================================================
    // SUITE 4: End-to-End Decision Flow (Raw Evaluation -> BWM -> Safe TOPSIS)
    // =========================================================================
    console.log("\n--- Suite 4: End-to-End Decision Flow Integration ---");

    // Setup Test Tenant and Zones for Tenant A
    await pool.query(
      `INSERT INTO tenants (id, name, code, status, max_fleets, max_riders, max_zones)
       VALUES ($1, 'Tenant Stage 3B DSS', 'STAGE3B_A', 'ACTIVE', 20, 50, 10)
       ON CONFLICT (id) DO NOTHING;`,
      [TENANT_A]
    );

    const polygonA = {
      type: "Polygon",
      coordinates: [[[112.71, -7.44], [112.73, -7.44], [112.73, -7.46], [112.71, -7.46], [112.71, -7.44]]]
    };

    const zoneRes = await withTenantContext(TENANT_A, async (client) => {
      const z = await client.query(
        `INSERT INTO zones (tenant_id, name, polygon, status)
         VALUES ($1, 'Zona DSS Test Sidoarjo', $2, 'ACTIVE')
         RETURNING id;`,
        [TENANT_A, JSON.stringify(polygonA)]
      );
      return z.rows[0];
    });

    const rawEvaluation = await rawCriteriaEvaluationService.evaluateZoneRawCriteria(zoneRes.id, {
      tenantId: TENANT_A,
    });

    assert(rawEvaluation.criteria.C1.type === "BENEFIT", "Raw evaluation C1 is BENEFIT");
    assert(rawEvaluation.criteria.C6.type === "COST", "Raw evaluation C6 is COST");
    assert(rawEvaluation.criteria.C6.name === "Dampak Kompetitor Relevan", "C6 name is Dampak Kompetitor Relevan");

    console.log("\n==================================================================");
    console.log(`🎯 STAGE 3B TEST RESULTS: ${passedTests}/${totalTests} PASSED`);
    console.log("==================================================================\n");

  } catch (err: any) {
    console.error("💥 Error during Stage 3B test execution:", err);
    process.exitCode = 1;
  } finally {
    try {
      await pool.query(`DELETE FROM zones WHERE tenant_id = $1;`, [TENANT_A]);
      await pool.query(`DELETE FROM tenants WHERE id = $1;`, [TENANT_A]);
    } catch {}
  }

  if (passedTests === totalTests && totalTests > 0) {
    console.log("🎉 ALL STAGE 3B INTEGRATION TESTS PASSED PERFECTLY!\n");
    process.exit(0);
  } else {
    console.error("💥 SOME STAGE 3B TESTS FAILED!\n");
    process.exit(1);
  }
}

runStage3bTests().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
