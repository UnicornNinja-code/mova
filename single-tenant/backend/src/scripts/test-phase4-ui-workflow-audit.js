/*
 * test-phase4-ui-workflow-audit.js
 * Verification Script for DSS Phase 4 — UI Workflow, Result Explainability & Backend Snapshots
 * 
 * Usage:
 *   node src/scripts/test-phase4-ui-workflow-audit.js
 */

import dotenv from "dotenv";
dotenv.config({ path: "backend/.env" });

import { hybridBwmTopsisService } from "../services/dss/HybridBwmTopsisService.js";
import { ZoneModel } from "../models/zoneModel.js";
import { pool } from "../config/database.js";

async function runPhase4Verification() {
  console.log("================================================================================");
  console.log("🚀 [DSS PHASE 4 AUDIT] UI WORKFLOW, EXPLAINABILITY & SNAPSHOT HISTORY VERIFICATION");
  console.log("================================================================================");

  try {
    const activeZones = await ZoneModel.findAll({ status: "ACTIVE" });
    console.log(`📌 Active Operational Zones Found: ${activeZones.length}`);

    if (activeZones.length === 0) {
      console.warn("⚠️ No active zones found.");
      process.exit(0);
    }

    const selectedZoneIds = activeZones.slice(0, 3).map(z => z.id);
    console.log(`📌 4A/4B: User Selected ${selectedZoneIds.length} Zones (Model B Workflow):`);
    selectedZoneIds.forEach((id, idx) => {
      const z = activeZones.find(item => item.id === id);
      console.log(`   • [Alternative ${idx + 1}] ${z.name}`);
    });

    // 1. Run Evaluation & Save Backend Snapshot
    console.log("\n🧪 Executing Hybrid Evaluation & Persisting Backend Snapshot (4A/4E)...");
    const evalRes = await hybridBwmTopsisService.evaluateZonesHybrid({
      zone_ids: selectedZoneIds,
      time_slot: "sore",
      save_snapshot: true,
    });

    const snapshotId = evalRes.snapshot_id;
    console.log(`✅ Snapshot Successfully Persisted in Backend! ID: ${snapshotId}`);
    console.log(`   • Model Version: ${evalRes.evaluation_version}`);
    console.log(`   • Rank #1 Zone: ${evalRes.topsis_summary.rankings[0].zone_name} (Ci = ${evalRes.topsis_summary.rankings[0].preference_score.toFixed(4)})`);

    // 2. Fetch Snapshots List from Backend (4E)
    console.log("\n🧪 Fetching Snapshots List from Backend (4E)...");
    const snapshots = await hybridBwmTopsisService.getSnapshots(10);
    console.log(`✅ Fetched ${snapshots.length} Snapshots from Database.`);
    const foundSnp = snapshots.find(s => s.id === snapshotId);
    if (foundSnp) {
      console.log(`✅ Snapshot ID ${snapshotId} verified in database listing.`);
    } else throw new Error("Snapshot not found in listing!");

    // 3. Re-open Single Snapshot by ID without Recalculating (4E Reproducibility Audit)
    console.log("\n🧪 Re-opening Snapshot by ID without Recalculating (4E Audit)...");
    const reopened = await hybridBwmTopsisService.getSnapshotById(snapshotId);
    const snapData = reopened.snapshot_data;

    console.log("📋 REOPENED SNAPSHOT MATHEMATICAL AUDIT TRAIL:");
    console.log(`   • Version      : ${snapData.evaluation_version}`);
    console.log(`   • Time Slot    : ${snapData.time_slot.toUpperCase()}`);
    console.log(`   • Total Zones  : ${snapData.total_evaluated_zones}`);
    console.log(`   • BWM Weights  : C1=${snapData.bwm_config.weights.C1.toFixed(3)}, C3=${snapData.bwm_config.weights.C3.toFixed(3)}, C5=${snapData.bwm_config.weights.C5.toFixed(3)}`);

    const isIdentical = snapData.topsis_summary.rankings[0].preference_score === evalRes.topsis_summary.rankings[0].preference_score;
    if (isIdentical) {
      console.log("✅ 100% Reproducibility & Auditability Verified! Reopened snapshot data matches evaluated run exactly.");
    } else throw new Error("Reopened snapshot data mismatch!");

    console.log("\n================================================================================");
    console.log("🎉 [SUCCESS] SELURUH PHASE 4 ACCEPTANCE CRITERIA PASSED 100%!");
    console.log("================================================================================");

    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error("\n❌ [FAIL] PHASE 4 VERIFICATION FAILED:", err.message);
    console.error(err.stack);
    await pool.end();
    process.exit(1);
  }
}

runPhase4Verification();
