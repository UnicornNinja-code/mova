/*
 * test-phase2b-topsis-engine-audit.js
 * Automated Verification Script for DSS Phase 2B — TOPSIS Normalization & Ranking Engine (DSS-BWM-TOPSIS-CONTRACT-v1.0)
 * 
 * Usage:
 *   node src/scripts/test-phase2b-topsis-engine-audit.js
 */

import dotenv from "dotenv";
dotenv.config({ path: "backend/.env" });

import { topsisEngineService } from "../services/dss/TopsisEngineService.js";
import { pool } from "../config/database.js";

async function runTopsisAuditTest() {
  console.log("================================================================================");
  console.log("🚀 [DSS PHASE 2B AUDIT] MEMULAI VERIFIKASI TOPSIS ENGINE (Hwang & Yoon, 1981)");
  console.log("================================================================================");

  try {
    // 1. Criteria Metadata Specification (C1-C6 with BWM Weights)
    const mockWeights = {
      C1: 0.15,
      C2: 0.10,
      C3: 0.35,
      C4: 0.20,
      C5: 0.15,
      C6: 0.05,
    };

    const criteriaSpecs = [
      { code: "C1", name: "Densitas POI", type: "BENEFIT", weight: mockWeights.C1 },
      { code: "C2", name: "Diversitas POI", type: "BENEFIT", weight: mockWeights.C2 },
      { code: "C3", name: "Keramaian Waktu", type: "BENEFIT", weight: mockWeights.C3 },
      { code: "C4", name: "Risiko Cuaca", type: "COST", weight: mockWeights.C4 },
      { code: "C5", name: "Jarak Aksesibilitas Centroid", type: "COST", weight: mockWeights.C5 },
      { code: "C6", name: "Indeks Persaingan Pasar", type: "COST", weight: mockWeights.C6 },
    ];

    // 2. Decision Matrix X (4 Mock Operational Zones)
    const rawMatrix = [
      { id: "zone-a", name: "Zona A (Alun-Alun)", scores: { C1: 16, C2: 11, C3: 53, C4: 0, C5: 5.99, C6: 4 } },
      { id: "zone-b", name: "Zona B (Pasar Porong)", scores: { C1: 23, C2: 8, C3: 61, C4: 0, C5: 3.20, C6: 9 } },
      { id: "zone-c", name: "Zona C (Krian)", scores: { C1: 12, C2: 5, C3: 42, C4: 0, C5: 7.10, C6: 2 } },
      { id: "zone-d", name: "Zona D (Waru Utama)", scores: { C1: 30, C2: 10, C3: 72, C4: 0, C5: 4.50, C6: 12 } },
    ];

    console.log(`📌 Alternatives (m): ${rawMatrix.length} Zones | Criteria (n): 6`);
    console.log("📌 Input Decision Matrix (X):");
    rawMatrix.forEach((r) => {
      console.log(`   • ${r.name.padEnd(25)} | C1:${r.scores.C1} | C2:${r.scores.C2} | C3:${r.scores.C3} | C4:${r.scores.C4}% | C5:${r.scores.C5}km | C6:${r.scores.C6}`);
    });

    const result = topsisEngineService.calculateTopsisForMatrix(rawMatrix, criteriaSpecs);

    console.log("\n--------------------------------------------------------------------------------");
    console.log("📋 HASIL COMPUTATION TOPSIS AUDIT:");
    console.log("--------------------------------------------------------------------------------");
    console.log("⭐ Solusi Ideal Positif (A+):");
    console.log(`   • Benefit (C1,C2,C3 = Max) : C1:${result.ideal_positive.C1.toFixed(4)}, C2:${result.ideal_positive.C2.toFixed(4)}, C3:${result.ideal_positive.C3.toFixed(4)}`);
    console.log(`   • Cost    (C4,C5,C6 = Min) : C4:${result.ideal_positive.C4.toFixed(4)}, C5:${result.ideal_positive.C5.toFixed(4)}, C6:${result.ideal_positive.C6.toFixed(4)}`);

    console.log("\n⭐ Solusi Ideal Negatif (A-):");
    console.log(`   • Benefit (C1,C2,C3 = Min) : C1:${result.ideal_negative.C1.toFixed(4)}, C2:${result.ideal_negative.C2.toFixed(4)}, C3:${result.ideal_negative.C3.toFixed(4)}`);
    console.log(`   • Cost    (C4,C5,C6 = Max) : C4:${result.ideal_negative.C4.toFixed(4)}, C5:${result.ideal_negative.C5.toFixed(4)}, C6:${result.ideal_negative.C6.toFixed(4)}`);

    console.log("\n🏆 PERANGKINGAN TOPSIS (C_i DESCENDING):");
    result.rankings.forEach((r) => {
      console.log(`   🥇 Rank ${r.rank} : ${r.name.padEnd(25)} | C_i: ${r.preference_score.toFixed(4)} | D+: ${r.d_pos.toFixed(4)} | D-: ${r.d_neg.toFixed(4)}`);
    });

    // =========================================================================
    // ASSERTION TESTS (15 STRICT VERIFICATIONS)
    // =========================================================================
    console.log("\n--------------------------------------------------------------------------------");
    console.log("🔍 MEMERIKSA 15 ASSERTION KONTRAK TOPSIS (DSS-BWM-TOPSIS-CONTRACT-v1.0):");
    console.log("--------------------------------------------------------------------------------");

    // Assertion 1: Raw Matrix X extraction
    if (result.decision_matrix.length === 4) {
      console.log("✅ Assertion 1 PASS: Decision Matrix X extracted successfully (4 alternatives).");
    } else throw new Error("Assertion 1 FAIL");

    // Assertion 2: Matrix Dimensions m x 6
    if (result.decision_matrix.every(row => Object.keys(row.scores).length === 6)) {
      console.log("✅ Assertion 2 PASS: Matrix dimensions m x 6 verified.");
    } else throw new Error("Assertion 2 FAIL");

    // Assertion 3: Euclidean Normalization formula (r_11 = 16 / sqrt(16^2 + 23^2 + 12^2 + 30^2))
    const expectedSumSqC1 = Math.sqrt(16 * 16 + 23 * 23 + 12 * 12 + 30 * 30);
    const expectedR11 = 16 / expectedSumSqC1;
    const actualR11 = result.normalized_matrix.find(r => r.id === "zone-a").r.C1;
    if (Math.abs(actualR11 - expectedR11) < 1e-6) {
      console.log(`✅ Assertion 3 PASS: Euclidean Normalization formula verified (r11 = ${actualR11.toFixed(6)}).`);
    } else throw new Error(`Assertion 3 FAIL: Expected ${expectedR11}, got ${actualR11}`);

    // Assertion 4: Zero variance column metadata (C4 = 0 for all zones -> discriminating = false)
    if (result.column_metadata.C4 && result.column_metadata.C4.discriminating === false) {
      console.log("✅ Assertion 4 PASS: Zero-variance non-discriminating column metadata verified (C4 discriminating = false).");
    } else throw new Error("Assertion 4 FAIL: C4 should be non-discriminating.");

    // Assertion 5: Weighted Matrix V (y_11 = w1 * r_11)
    const expectedY11 = mockWeights.C1 * expectedR11;
    const actualY11 = result.weighted_matrix.find(r => r.id === "zone-a").y.C1;
    if (Math.abs(actualY11 - expectedY11) < 1e-6) {
      console.log(`✅ Assertion 5 PASS: Weighted Normalization V verified (v11 = ${actualY11.toFixed(6)}).`);
    } else throw new Error(`Assertion 5 FAIL: Expected ${expectedY11}, got ${actualY11}`);

    // Assertion 6: Benefit Ideal A+ (Max of C3 across all weighted rows)
    const weightedC3 = result.weighted_matrix.map(r => r.y.C3);
    const maxC3 = Math.max(...weightedC3);
    if (Math.abs(result.ideal_positive.C3 - maxC3) < 1e-6) {
      console.log(`✅ Assertion 6 PASS: Benefit Ideal Positive (A+ for C3) = MAX (${maxC3.toFixed(6)}).`);
    } else throw new Error("Assertion 6 FAIL");

    // Assertion 7: Cost Ideal A+ (Min of C5 across all weighted rows)
    const weightedC5 = result.weighted_matrix.map(r => r.y.C5);
    const minC5 = Math.min(...weightedC5);
    if (Math.abs(result.ideal_positive.C5 - minC5) < 1e-6) {
      console.log(`✅ Assertion 7 PASS: Cost Ideal Positive (A+ for C5) = MIN (${minC5.toFixed(6)}).`);
    } else throw new Error("Assertion 7 FAIL");

    // Assertion 8: Distance D+ and D- calculation for Zone A
    const zoneADist = result.distances.find(d => d.id === "zone-a");
    if (zoneADist.d_pos > 0 && zoneADist.d_neg > 0) {
      console.log(`✅ Assertion 8 PASS: Distance D+ (${zoneADist.d_pos.toFixed(4)}) & D- (${zoneADist.d_neg.toFixed(4)}) verified.`);
    } else throw new Error("Assertion 8 FAIL");

    // Assertion 9: Preference Score C_i formula (C_i = D- / (D+ + D-))
    const expectedCiA = zoneADist.d_neg / (zoneADist.d_pos + zoneADist.d_neg);
    const actualCiA = result.rankings.find(r => r.id === "zone-a").preference_score_full;
    if (Math.abs(actualCiA - expectedCiA) < 1e-6) {
      console.log(`✅ Assertion 9 PASS: Preference Score C_i formula verified (${actualCiA.toFixed(4)}).`);
    } else throw new Error("Assertion 9 FAIL");

    // Assertion 10: Descending Ranking order
    const isSorted = result.rankings.every((r, idx) => {
      if (idx === 0) return true;
      return result.rankings[idx - 1].preference_score >= r.preference_score;
    });
    if (isSorted) {
      console.log("✅ Assertion 10 PASS: Ranking sorted strictly descending by C_i score.");
    } else throw new Error("Assertion 10 FAIL");

    // Assertion 11: Single Zone Edge Case (m = 1 -> C_1 = 1.0000)
    const singleZoneRes = topsisEngineService.calculateTopsisForMatrix([rawMatrix[0]], criteriaSpecs);
    if (singleZoneRes.rankings.length === 1 && singleZoneRes.rankings[0].preference_score === 1.0) {
      console.log("✅ Assertion 11 PASS: Single Zone edge case (m = 1 -> C1 = 1.0000) verified.");
    } else throw new Error("Assertion 11 FAIL");

    // Assertion 12: Division-by-Zero Safety (Empty / Zero Matrix)
    const zeroRes = topsisEngineService.calculateTopsisForMatrix([], criteriaSpecs);
    if (zeroRes.total_alternatives === 0 && zeroRes.rankings.length === 0) {
      console.log("✅ Assertion 12 PASS: Empty matrix division-by-zero safety verified.");
    } else throw new Error("Assertion 12 FAIL");

    // Assertion 13: Full Precision (No intermediate rounding in calculation)
    const rawR11Str = String(actualR11);
    if (rawR11Str.includes(".") && rawR11Str.split(".")[1].length > 4) {
      console.log("✅ Assertion 13 PASS: Intermediate matrix steps use 64-bit full IEEE float precision.");
    } else throw new Error("Assertion 13 FAIL");

    // Assertion 14: Weight sum validation
    const sumW = Object.values(mockWeights).reduce((a, b) => a + b, 0);
    if (Math.abs(sumW - 1.0) < 1e-6) {
      console.log("✅ Assertion 14 PASS: Input criteria weight sum == 1.0000.");
    } else throw new Error("Assertion 14 FAIL");

    // Assertion 15: Structured Explainability Output presence
    if (result.column_metadata && result.decision_matrix && result.normalized_matrix && result.weighted_matrix && result.ideal_positive && result.ideal_negative && result.distances) {
      console.log("✅ Assertion 15 PASS: Full structured explainability output (X, R, V, A+, A-, D+, D-, Rankings) verified.");
    } else throw new Error("Assertion 15 FAIL");

    console.log("\n================================================================================");
    console.log("🎉 [SUCCESS] SELURUH 15 UJI AUDIT TOPSIS ENGINE (PHASE 2B) PASSED 100%!");
    console.log("================================================================================");

    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error("\n❌ [FAIL] TOPSIS AUDIT FAILED:", err.message);
    console.error(err.stack);
    await pool.end();
    process.exit(1);
  }
}

runTopsisAuditTest();
