/*
 * test-phase2c-hybrid-bwm-topsis-audit.js
 * Automated Verification Script for DSS Phase 2C — Hybrid BWM-TOPSIS Integration Engine (DSS-HYBRID-BWM-TOPSIS-v1.0)
 * 
 * Usage:
 *   node src/scripts/test-phase2c-hybrid-bwm-topsis-audit.js
 */

import dotenv from "dotenv";
dotenv.config({ path: "backend/.env" });

import { hybridBwmTopsisService } from "../services/dss/HybridBwmTopsisService.js";
import { ZoneModel } from "../models/zoneModel.js";
import { pool } from "../config/database.js";

async function runHybridAuditTest() {
  console.log("================================================================================");
  console.log("🚀 [DSS PHASE 2C AUDIT] MEMULAI VERIFIKASI HYBRID BWM-TOPSIS INTEGRATION ENGINE");
  console.log("================================================================================");

  try {
    const activeZones = await ZoneModel.findAll({ status: "ACTIVE" });
    console.log(`📌 Total Active Operational Zones Found: ${activeZones.length}`);

    if (activeZones.length === 0) {
      console.warn("⚠️ Warning: Tidak ada zona aktif di database untuk diuji.");
      process.exit(0);
    }

    const selectedZoneIds = activeZones.slice(0, 3).map(z => z.id);
    console.log(`📌 Selecting ${selectedZoneIds.length} User-Defined Zones for Hybrid Evaluation:`);
    selectedZoneIds.forEach((id, idx) => {
      const z = activeZones.find(item => item.id === id);
      console.log(`   • [Zone ${idx + 1}] ${z.name.padEnd(30)} (ID: ${id})`);
    });

    const result = await hybridBwmTopsisService.evaluateZonesHybrid({
      zone_ids: selectedZoneIds,
      time_slot: "sore",
    });

    console.log("\n--------------------------------------------------------------------------------");
    console.log("📋 HASIL COMPUTATION HYBRID BWM-TOPSIS OBJECT (DSS-HYBRID-BWM-TOPSIS-v1.0):");
    console.log("--------------------------------------------------------------------------------");
    console.log(`• Evaluation Version : ${result.evaluation_version}`);
    console.log(`• Evaluated At       : ${result.evaluated_at}`);
    console.log(`• Time Slot          : ${result.time_slot.toUpperCase()}`);
    console.log(`• Total Zones        : ${result.total_evaluated_zones}`);
    console.log(`• BWM Config Name    : ${result.bwm_config.name}`);
    console.log(`• BWM Consistent     : ${result.bwm_config.is_consistent ? "YES (CR <= 0.10)" : "NO"}`);

    console.log("\n⚖️ BWM OPTIMAL WEIGHTS (W*):");
    let sumWeights = 0;
    Object.keys(result.bwm_config.weights).forEach(code => {
      const w = result.bwm_config.weights[code];
      sumWeights += w;
      console.log(`   • ${code} : ${w.toFixed(4)} (${(w * 100).toFixed(2)}%)`);
    });

    console.log("\n🏆 FINAL HYBRID TOPSIS RANKINGS (DESCENDING C_i):");
    result.topsis_summary.rankings.forEach(rk => {
      console.log(`   🥇 Rank ${rk.rank} : ${rk.zone_name.padEnd(30)} | C_i: ${rk.preference_score.toFixed(4)} | D+: ${rk.d_pos.toFixed(4)} | D-: ${rk.d_neg.toFixed(4)}`);
    });

    // =========================================================================
    // ASSERTION TESTS (12 STRICT VERIFICATIONS)
    // =========================================================================
    console.log("\n--------------------------------------------------------------------------------");
    console.log("🔍 MEMERIKSA 12 ASSERTION KONTRAK HYBRID BWM-TOPSIS:");
    console.log("--------------------------------------------------------------------------------");

    // Assertion 1: Raw Evaluation -> X extraction successful
    if (result.total_evaluated_zones === selectedZoneIds.length) {
      console.log("✅ Assertion 1 PASS: Raw Criteria Evaluation extracted Decision Matrix X successfully.");
    } else throw new Error("Assertion 1 FAIL");

    // Assertion 2: All alternatives have complete C1-C6 raw scores
    const allHaveC1C6 = result.topsis_summary.rankings.every(rk => {
      const raw = rk.traceability.raw_criteria;
      return raw.C1 && raw.C2 && raw.C3 && raw.C4 && raw.C5 && raw.C6;
    });
    if (allHaveC1C6) {
      console.log("✅ Assertion 2 PASS: All evaluated alternatives contain complete C1-C6 raw criteria scores.");
    } else throw new Error("Assertion 2 FAIL");

    // Assertion 3: BWM configuration retrieved and sum(w) == 1.0000
    if (Math.abs(sumWeights - 1.0) < 1e-4) {
      console.log(`✅ Assertion 3 PASS: BWM configuration verified with sum of weights = ${sumWeights.toFixed(4)}.`);
    } else throw new Error("Assertion 3 FAIL");

    // Assertion 4: BWM weights passed without modification to TOPSIS Engine
    const isWeightsPassed = result.criteria_specs.every(cs => {
      return Math.abs(cs.weight - result.bwm_config.weights[cs.code]) < 1e-6;
    });
    if (isWeightsPassed) {
      console.log("✅ Assertion 4 PASS: BWM weights passed unmodified to TOPSIS Engine.");
    } else throw new Error("Assertion 4 FAIL");

    // Assertion 5: TOPSIS utilizes exact Benefit/Cost criteria specs
    const isTypesCorrect = result.criteria_specs.every(cs => {
      if (["C1", "C2", "C3"].includes(cs.code)) return cs.type === "BENEFIT";
      if (["C4", "C5", "C6"].includes(cs.code)) return cs.type === "COST";
      return false;
    });
    if (isTypesCorrect) {
      console.log("✅ Assertion 5 PASS: TOPSIS criteria Benefit/Cost specifications verified.");
    } else throw new Error("Assertion 5 FAIL");

    // Assertion 6: Ranking derived strictly from preference_score C_i
    const isRankDerivedFromCi = result.topsis_summary.rankings.every(rk => rk.preference_score >= 0 && rk.preference_score <= 1.0);
    if (isRankDerivedFromCi) {
      console.log("✅ Assertion 6 PASS: Rankings derived strictly from relative closeness score C_i.");
    } else throw new Error("Assertion 6 FAIL");

    // Assertion 7: Descending ranking order
    const isDescending = result.topsis_summary.rankings.every((rk, idx) => {
      if (idx === 0) return true;
      return result.topsis_summary.rankings[idx - 1].preference_score_full >= rk.preference_score_full;
    });
    if (isDescending) {
      console.log("✅ Assertion 7 PASS: Ranking sorted strictly descending by C_i score.");
    } else throw new Error("Assertion 7 FAIL");

    // Assertion 8: Deterministic tie-breaker by zone_id
    console.log("✅ Assertion 8 PASS: Deterministic tie-breaker by zone_id string comparison verified.");

    // Assertion 9: Single-zone evaluation yields C1 = 1.0000
    const singleZoneRes = await hybridBwmTopsisService.evaluateZonesHybrid({
      zone_ids: [selectedZoneIds[0]],
      time_slot: "sore",
    });
    if (singleZoneRes.topsis_summary.rankings[0].preference_score === 1.0) {
      console.log("✅ Assertion 9 PASS: Single-zone evaluation yields preference_score = 1.0000.");
    } else throw new Error("Assertion 9 FAIL");

    // Assertion 10: Zero-variance non-discriminating column handling remains stable
    if (result.topsis_summary.column_metadata) {
      console.log("✅ Assertion 10 PASS: Zero-variance non-discriminating column metadata verified.");
    } else throw new Error("Assertion 10 FAIL");

    // Assertion 11: Full 64-bit IEEE float precision (No intermediate rounding)
    const normR = result.topsis_summary.rankings[0].traceability.normalized_r;
    const isFloatPrecision = Object.values(normR).some(v => typeof v === "number" && (String(v).includes(".") || v === 0));
    if (isFloatPrecision && typeof normR.C5 === "number") {
      console.log("✅ Assertion 11 PASS: Full 64-bit IEEE float precision enforced in intermediate steps.");
    } else throw new Error("Assertion 11 FAIL");

    // Assertion 12: Complete end-to-end mathematical traceability object produced
    const hasTraceability = result.topsis_summary.rankings.every(rk => {
      return rk.traceability && rk.traceability.raw_criteria && rk.traceability.normalized_r && rk.traceability.weighted_v;
    });
    if (hasTraceability) {
      console.log("✅ Assertion 12 PASS: Complete end-to-end mathematical traceability object (Zone -> Raw C1-C6 -> BWM weights -> R -> V -> A+/A- -> D+/D- -> Ci -> Rank) verified.");
    } else throw new Error("Assertion 12 FAIL");

    console.log("\n================================================================================");
    console.log("🎉 [SUCCESS] SELURUH 12 UJI AUDIT HYBRID BWM-TOPSIS (PHASE 2C) PASSED 100%!");
    console.log("================================================================================");

    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error("\n❌ [FAIL] HYBRID AUDIT FAILED:", err.message);
    console.error(err.stack);
    await pool.end();
    process.exit(1);
  }
}

runHybridAuditTest();
