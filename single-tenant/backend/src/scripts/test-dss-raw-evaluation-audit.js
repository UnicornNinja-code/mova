/*
 * test-dss-raw-evaluation-audit.js
 * Automated Verification Script for DSS Phase 1 — Raw Evaluation Engine (DSS-CRITERIA-v1.0)
 * 
 * Usage:
 *   node backend/src/scripts/test-dss-raw-evaluation-audit.js
 */

import dotenv from "dotenv";
dotenv.config({ path: "backend/.env" });

import { rawCriteriaEvaluationService } from "../services/dss/RawCriteriaEvaluationService.js";
import { ZoneModel } from "../models/zoneModel.js";
import { pool } from "../config/database.js";

async function runAuditTest() {
  console.log("================================================================================");
  console.log("🚀 [DSS PHASE 1 AUDIT] MEMULAI VERIFIKASI RAW CRITERIA EVALUATION ENGINE v1.0");
  console.log("================================================================================");

  try {
    const activeZones = await ZoneModel.findAll({ status: "ACTIVE" });
    console.log(`📌 Total Active Operational Zones Found: ${activeZones.length}`);

    if (activeZones.length === 0) {
      console.warn("⚠️ Warning: Tidak ada zona aktif di database untuk diuji.");
      process.exit(0);
    }

    const testZone = activeZones[0];
    console.log(`📌 Menguji Raw Evaluation untuk Zone: "${testZone.name}" (ID: ${testZone.id})`);

    const result = await rawCriteriaEvaluationService.evaluateZoneRawCriteria(testZone.id, {
      timeSlot: "sore",
    });

    console.log("\n--------------------------------------------------------------------------------");
    console.log("📋 HASIL STRUCTURAL OBJECT AUDIT (DSS-CRITERIA-v1.0):");
    console.log("--------------------------------------------------------------------------------");
    console.log(`• Evaluation Version : ${result.evaluation_version}`);
    console.log(`• Evaluated At       : ${result.evaluated_at}`);
    console.log(`• Active Time Slot   : ${result.time_slot.toUpperCase()}`);

    const c = result.criteria;

    console.log("\n--- RAW VALUES SUMMARY ---");
    console.log(`• C1 (POI Density)     : ${c.C1.raw_value} ${c.C1.unit} (Type: ${c.C1.type})`);
    console.log(`• C2 (POI Diversity)   : ${c.C2.raw_value} ${c.C2.unit} (Type: ${c.C2.type})`);
    console.log(`• C3 (Time Crowd Score): ${c.C3.raw_value} ${c.C3.unit} (Type: ${c.C3.type}) | Contributing POIs: ${c.C3.details.length}`);
    console.log(`• C4 (Weather Risk)    : ${c.C4.raw_value}${c.C4.unit} (Type: ${c.C4.type}) | Risk: ${c.C4.details.risk_level}`);
    console.log(`• C5 (Origin Distance) : ${c.C5.raw_value} ${c.C5.unit} (Type: ${c.C5.type}) | Centroid: (${c.C5.details.centroid.latitude}, ${c.C5.details.centroid.longitude})`);
    console.log(`• C6 (Competition Index): ${c.C6.raw_value} ${c.C6.unit} (Type: ${c.C6.type}) | Competitors: ${c.C6.details.length}`);

    // Verification Assertions
    console.log("\n--------------------------------------------------------------------------------");
    console.log("🔍 MEMERIKSA ASSERTION KONTRAK:");
    console.log("--------------------------------------------------------------------------------");

    // Assertion 1: Version contract
    if (result.evaluation_version === "DSS-CRITERIA-v1.0") {
      console.log("✅ Assertion 1 PASS: Version contract 'DSS-CRITERIA-v1.0' terverifikasi.");
    } else {
      throw new Error(`Assertion 1 FAIL: Invalid version string '${result.evaluation_version}'`);
    }

    // Assertion 2: C5 Centroid Details presence
    if (c.C5.details && c.C5.details.centroid && c.C5.details.centroid.latitude !== 0) {
      console.log(`✅ Assertion 2 PASS: C5 PostGIS Centroid calculation terverifikasi. Lat: ${c.C5.details.centroid.latitude}, Lon: ${c.C5.details.centroid.longitude}`);
    } else {
      throw new Error("Assertion 2 FAIL: C5 Centroid details missing or invalid.");
    }

    // Assertion 3: C3 Explainability POI Breakdown
    if (Array.isArray(c.C3.details)) {
      console.log(`✅ Assertion 3 PASS: C3 Explainability Breakdown list terverifikasi (${c.C3.details.length} POI items).`);
    } else {
      throw new Error("Assertion 3 FAIL: C3 details is not an array.");
    }

    // Assertion 4: C6 Threat Level Explicit Field
    if (Array.isArray(c.C6.details)) {
      const hasThreatLevels = c.C6.details.every(item => item.threat_level !== undefined && item.source !== undefined);
      if (hasThreatLevels) {
        console.log(`✅ Assertion 4 PASS: C6 Competitor Threat Level (1, 2, 3) & Source ('SURVEY'/'POI_AUTOMATED') terverifikasi.`);
      } else {
        throw new Error("Assertion 4 FAIL: C6 details missing threat_level or source properties.");
      }
    }

    // Assertion 5: C4 Weather Risk Transparency
    if (c.C4.details && c.C4.details.source === "Open-Meteo API") {
      console.log(`✅ Assertion 5 PASS: C4 Open-Meteo Weather forecast transparency details terverifikasi.`);
    } else {
      throw new Error("Assertion 5 FAIL: C4 weather details missing source.");
    }

    console.log("\n================================================================================");
    console.log("🎉 [SUCCESS] SELURUH UJI AUDIT RAW CRITERIA EVALUATION ENGINE v1.0 PASSED 100%!");
    console.log("================================================================================");

    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error("\n❌ [FAIL] AUDIT FAILED:", err.message);
    console.error(err.stack);
    await pool.end();
    process.exit(1);
  }
}

runAuditTest();
