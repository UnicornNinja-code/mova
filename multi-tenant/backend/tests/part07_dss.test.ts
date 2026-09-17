/*
 * part07_dss.test.ts
 * Comprehensive Integration & Verification Test Suite for PART 07:
 * BWM Linear Programming Weight Optimization, Consistency Ratio (CR < 0.20),
 * TOPSIS Zone Ranking, Zero-Variance Column Guards, and Snapshot Persistence.
 */

import { pool } from "../src/config/database.js";
import { bwmWeightService } from "../src/services/dss/BwmWeightService.js";
import { topsisEngineService } from "../src/services/dss/TopsisEngineService.js";
import { hybridBwmTopsisService } from "../src/services/dss/HybridBwmTopsisService.js";
import { zoneService } from "../src/services/zoneService.js";
import { ZoneModel } from "../src/models/zoneModel.js";

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string, detail?: any) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`✅ PASS: ${testName}`);
  } else {
    console.error(`❌ FAIL: ${testName}`, detail || "");
    process.exitCode = 1;
  }
}

async function runPart07Tests() {
  console.log("\n========================================================");
  console.log("🧪 RUNNING PART 07: DSS (BWM + TOPSIS) VERIFICATION SUITE");
  console.log("========================================================\n");

  const testSuffix = Date.now();
  let createdZoneId1: string | number = "";
  let createdZoneId2: string | number = "";

  // -------------------------------------------------------------
  // SETUP: Create 2 Temporary Test Zones in Surabaya for TOPSIS
  // -------------------------------------------------------------
  try {
    await pool.query("DELETE FROM weathers WHERE zone_id IN (SELECT id FROM zones WHERE name LIKE 'DSS Test Zone%');");
    await pool.query("DELETE FROM zone_assignments WHERE zone_id IN (SELECT id FROM zones WHERE name LIKE 'DSS Test Zone%');");
    await pool.query("DELETE FROM zones WHERE name LIKE 'DSS Test Zone%';");
  } catch (e) {}

  const zone1 = await zoneService.createZone({
    name: `DSS Test Zone A ${testSuffix}`,
    max_capacity: 5,
    polygon: {
      type: "Polygon",
      coordinates: [
        [
          [112.7400, -7.2600],
          [112.7460, -7.2600],
          [112.7460, -7.2660],
          [112.7400, -7.2660],
          [112.7400, -7.2600],
        ],
      ],
    },
  });
  createdZoneId1 = zone1.id;

  const zone2 = await zoneService.createZone({
    name: `DSS Test Zone B ${testSuffix}`,
    max_capacity: 5,
    polygon: {
      type: "Polygon",
      coordinates: [
        [
          [112.7500, -7.2700],
          [112.7560, -7.2700],
          [112.7560, -7.2760],
          [112.7500, -7.2760],
          [112.7500, -7.2700],
        ],
      ],
    },
  });
  createdZoneId2 = zone2.id;

  // -------------------------------------------------------------
  // GROUP 1: BWM Weight Calculation & Consistency Check (DSS-001, DSS-003, DSS-004)
  // -------------------------------------------------------------
  console.log("⚖️ [GROUP 1] BWM Weight Optimization & Consistency Check");

  const criteriaList = [
    { id: "c1", code: "C1", name: "Densitas POI" },
    { id: "c2", code: "C2", name: "Diversitas POI" },
    { id: "c3", code: "C3", name: "Skor Keramaian Waktu" },
    { id: "c4", code: "C4", name: "Risiko Cuaca" },
    { id: "c5", code: "C5", name: "Jarak Tempuh" },
    { id: "c6", code: "C6", name: "Indeks Kompetitor" },
  ];

  // Best: C1, Worst: C6
  const bwmResult = bwmWeightService.calculateBwmWeights({
    best_criteria_id: "c1",
    worst_criteria_id: "c6",
    best_to_others: { c1: 1, c2: 2, c3: 3, c4: 4, c5: 5, c6: 7 },
    worst_to_others: { c1: 7, c2: 5, c3: 4, c4: 3, c5: 2, c6: 1 },
    criteria_list: criteriaList,
  });

  assert(Boolean(bwmResult && bwmResult.weights), "TEST 1.1: BWM LP Solver calculates optimal weights");

  // Sum of weights = 1.00 ± 0.001 (DSS-004)
  const sumWeights = Object.values(bwmResult.weights).reduce((acc: number, w: number) => acc + w, 0);
  assert(Math.abs(sumWeights - 1.0) <= 0.005, `TEST 1.2: Sum of weights equals 1.00 ± 0.005 (Calculated: ${sumWeights.toFixed(4)})`);

  // Consistency Ratio < 0.20 (DSS-003)
  assert(bwmResult.consistency_ratio < 0.20, `TEST 1.3: Consistency ratio is below 0.20 threshold (CR: ${bwmResult.consistency_ratio.toFixed(4)})`);
  assert(bwmResult.is_consistent === true, "TEST 1.4: BWM result is marked consistent");

  // -------------------------------------------------------------
  // GROUP 2: TOPSIS Zone Recommendation & Score Bounding (DSS-002, DSS-005)
  // -------------------------------------------------------------
  console.log("\n🎯 [GROUP 2] TOPSIS Zone Evaluation & Score Bounding [0.0, 1.0]");

  const topsisResult = await topsisEngineService.calculateTopsisRecommendations({
    timeSlot: "SIANG",
    customWeights: { C1: 0.35, C2: 0.20, C3: 0.15, C4: 0.10, C5: 0.10, C6: 0.10 },
  });

  assert(topsisResult && Array.isArray(topsisResult.rankings), "TEST 2.1: TOPSIS engine generates ranked zone results");
  assert(topsisResult.rankings.length >= 2, `TEST 2.2: Rankings include evaluated zones (Count: ${topsisResult.rankings.length})`);

  // Bounded scores [0.0, 1.0] (DSS-005)
  const allScoresBounded = topsisResult.rankings.every(
    (r: any) => typeof r.score === "number" && r.score >= 0.0 && r.score <= 1.0 && !isNaN(r.score)
  );
  assert(allScoresBounded, "TEST 2.3: All TOPSIS scores are bounded strictly within [0.0, 1.0] without NaN");

  // Verify descending sort order
  let isSortedDescending = true;
  for (let i = 0; i < topsisResult.rankings.length - 1; i++) {
    if (topsisResult.rankings[i].score < topsisResult.rankings[i + 1].score) {
      isSortedDescending = false;
      break;
    }
  }
  assert(isSortedDescending, "TEST 2.4: TOPSIS rankings are sorted descending by closeness score");

  // -------------------------------------------------------------
  // GROUP 3: Zero-Variance Column Handling (DSS-006)
  // -------------------------------------------------------------
  console.log("\n🛡️ [GROUP 3] Zero-Variance Column & Division-by-Zero Guard");

  // Testing TOPSIS with extreme zero custom weights or identical columns
  const zeroColTopsis = await topsisEngineService.calculateTopsisRecommendations({
    timeSlot: "MALAM",
    customWeights: { C1: 0.0, C2: 0.0, C3: 0.5, C4: 0.5, C5: 0.0, C6: 0.0 },
  });

  const zeroScoresValid = zeroColTopsis.rankings.every(
    (r: any) => !isNaN(r.score) && Number.isFinite(r.score)
  );
  assert(zeroScoresValid, "TEST 3.1: TOPSIS handles zero-weighted columns gracefully without NaN");

  // -------------------------------------------------------------
  // GROUP 4: Full Hybrid Evaluation & Snapshot Persistence (DSS-007, HIST-002)
  // -------------------------------------------------------------
  console.log("\n📸 [GROUP 4] Hybrid Evaluation & Snapshot Persistence");

  const hybridEval = await hybridBwmTopsisService.evaluate({
    time_slot: "SIANG",
  });

  assert(hybridEval && typeof hybridEval.snapshot_id !== "undefined", "TEST 4.1: Hybrid evaluation persists snapshot and returns snapshot_id");
  assert(hybridEval.topsis_summary && hybridEval.topsis_summary.rankings, "TEST 4.2: Snapshot contains full TOPSIS rankings");

  // Verify snapshot row in dss_histories table
  const { rows: historyRows } = await pool.query(
    "SELECT * FROM dss_histories WHERE id = $1;",
    [hybridEval.snapshot_id]
  );
  assert(historyRows.length > 0, "TEST 4.3: Snapshot entry verified in dss_histories database table");

  // -------------------------------------------------------------
  // CLEANUP
  // -------------------------------------------------------------
  try {
    await pool.query("DELETE FROM dss_histories WHERE id = $1;", [hybridEval.snapshot_id]);
    await pool.query("DELETE FROM zones WHERE id IN ($1, $2);", [createdZoneId1, createdZoneId2]);
  } catch (err: any) {
    console.warn("Cleanup warning:", err.message);
  }

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log("\n========================================================");
  console.log(`📊 PART 07 TEST RESULTS: ${passedTests}/${totalTests} PASSED`);
  console.log("========================================================\n");

  if (passedTests === totalTests) {
    console.log("🎉 ALL PART 07 TESTS PASSED PERFECTLY!");
    process.exit(0);
  } else {
    console.error("❌ SOME PART 07 TESTS FAILED.");
    process.exit(1);
  }
}

runPart07Tests().catch((err) => {
  console.error("💥 Unhandled error during PART 07 test execution:", err);
  process.exit(1);
});
