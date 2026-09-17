/*
 * test-phase2a-bwm-engine-audit.js
 * Automated Verification Script for DSS Phase 2A — BWM Weight Engine (DSS-BWM-TOPSIS-CONTRACT-v1.0)
 * 
 * Usage:
 *   node src/scripts/test-phase2a-bwm-engine-audit.js
 */

import dotenv from "dotenv";
dotenv.config({ path: "backend/.env" });

import { bwmWeightService } from "../services/dss/BwmWeightService.js";
import { pool } from "../config/database.js";

async function runBwmAuditTest() {
  console.log("================================================================================");
  console.log("🚀 [DSS PHASE 2A AUDIT] MEMULAI VERIFIKASI BWM WEIGHT ENGINE (Rezaei, 2016)");
  console.log("================================================================================");

  try {
    // Standard Criteria Set (C1-C6)
    const mockCriteriaList = [
      { id: "c1-id", code: "C1", name: "Densitas POI", type: "BENEFIT" },
      { id: "c2-id", code: "C2", name: "Diversitas POI", type: "BENEFIT" },
      { id: "c3-id", code: "C3", name: "Keramaian Berbasis Waktu", type: "BENEFIT" },
      { id: "c4-id", code: "C4", name: "Risiko Cuaca", type: "COST" },
      { id: "c5-id", code: "C5", name: "Jarak Aksesibilitas Centroid", type: "COST" },
      { id: "c6-id", code: "C6", name: "Indeks Persaingan Pasar", type: "COST" },
    ];

    // Best = C3 (Keramaian), Worst = C6 (Persaingan)
    const sampleInput = {
      best_criteria_id: "c3-id",
      worst_criteria_id: "c6-id",
      best_to_others: {
        "c1-id": 3,
        "c2-id": 4,
        "c3-id": 1, // a_BB = 1
        "c4-id": 2,
        "c5-id": 3,
        "c6-id": 5, // a_BW = 5
      },
      worst_to_others: {
        "c1-id": 3,
        "c2-id": 4,
        "c3-id": 5,
        "c4-id": 2,
        "c5-id": 3,
        "c6-id": 1, // a_WW = 1
      },
      criteria_list: mockCriteriaList,
    };

    console.log("📌 Input Mock Pairwise Vectors:");
    console.log("   • Best (C3) to Others : C1:3, C2:4, C3:1, C4:2, C5:3, C6:5");
    console.log("   • Others to Worst (C6): C1:3, C2:4, C3:5, C4:2, C5:3, C6:1");

    const result = bwmWeightService.calculateBwmWeights(sampleInput);

    console.log("\n--------------------------------------------------------------------------------");
    console.log("📋 HASIL BWM COMPUTATION OUTPUT:");
    console.log("--------------------------------------------------------------------------------");
    console.log(`• Best Criteria ID  : ${result.best_criteria_id}`);
    console.log(`• Worst Criteria ID : ${result.worst_criteria_id}`);
    console.log(`• a_BW Value        : ${result.a_BW}`);
    console.log(`• Min-Max Xi (ξ*)   : ${result.xi_star.toFixed(6)}`);
    console.log(`• Consistency Index : ${result.ci}`);
    console.log(`• Consistency Ratio : ${result.consistency_ratio.toFixed(6)}`);
    console.log(`• Is Consistent     : ${result.is_consistent ? "YES (CR <= 0.10)" : "NO"}`);

    console.log("\n📊 OPTIMAL WEIGHTS (W*):");
    let totalWeightSum = 0;
    mockCriteriaList.forEach((c) => {
      const w = result.weights[c.id];
      totalWeightSum += w;
      console.log(`   • [${c.code}] ${c.name.padEnd(30)} = ${w.toFixed(6)} (${(w * 100).toFixed(2)}%)`);
    });

    console.log(`\n• Total Sum of Weights: ${totalWeightSum.toFixed(8)}`);

    // --- ASSERTION TESTS ---
    console.log("\n--------------------------------------------------------------------------------");
    console.log("🔍 MEMERIKSA ASSERTION KONTRAK BWM:");
    console.log("--------------------------------------------------------------------------------");

    // Assertion 1: Weight Sum equals 1.0 (Full Floating Precision)
    if (Math.abs(totalWeightSum - 1.0) < 1e-6) {
      console.log("✅ Assertion 1 PASS: Sum of weights == 1.000000 (Exact Normalization).");
    } else {
      throw new Error(`Assertion 1 FAIL: Total weight sum is ${totalWeightSum}, expected 1.0`);
    }

    // Assertion 2: All weights positive
    const allPositive = Object.values(result.weights).every((w) => w > 0);
    if (allPositive) {
      console.log("✅ Assertion 2 PASS: All criteria weights are strictly positive (w_j > 0).");
    } else {
      throw new Error("Assertion 2 FAIL: Found non-positive weight in output.");
    }

    // Assertion 3: Best criteria (C3) has highest weight
    const bestWeight = result.weights["c3-id"];
    const isBestHighest = Object.keys(result.weights).every((id) => result.weights[id] <= bestWeight + 1e-6);
    if (isBestHighest) {
      console.log(`✅ Assertion 3 PASS: Best criterion [C3] has the maximum weight (${bestWeight.toFixed(6)}).`);
    } else {
      throw new Error("Assertion 3 FAIL: Best criterion does not have the highest weight.");
    }

    // Assertion 4: Consistency Ratio CR <= 0.10
    if (result.is_consistent && result.consistency_ratio <= 0.10) {
      console.log(`✅ Assertion 4 PASS: Consistency Ratio CR (${result.consistency_ratio.toFixed(4)}) <= 0.10.`);
    } else {
      throw new Error(`Assertion 4 FAIL: CR is ${result.consistency_ratio}, expected <= 0.10`);
    }

    // Assertion 5: Error Handling for Same Best and Worst
    try {
      bwmWeightService.calculateBwmWeights({
        ...sampleInput,
        worst_criteria_id: "c3-id", // Same as best
      });
      throw new Error("Assertion 5 FAIL: Did not throw error when Best == Worst.");
    } catch (e) {
      if (e.message.includes("tidak boleh kriteria yang sama")) {
        console.log("✅ Assertion 5 PASS: Rejects invalid input where Best == Worst.");
      } else {
        throw e;
      }
    }

    console.log("\n================================================================================");
    console.log("🎉 [SUCCESS] SELURUH UJI BWM WEIGHT ENGINE (PHASE 2A) PASSED 100%!");
    console.log("================================================================================");

    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error("\n❌ [FAIL] BWM AUDIT FAILED:", err.message);
    console.error(err.stack);
    await pool.end();
    process.exit(1);
  }
}

runBwmAuditTest();
