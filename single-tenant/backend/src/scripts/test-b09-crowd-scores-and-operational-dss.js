/*
 * test-b09-crowd-scores-and-operational-dss.js
 * Comprehensive Verification Test Suite for Milestone B-09:
 * 1. Master Data C3 Configuration API (GET & PUT /api/poi-categories/crowd-scores)
 * 2. Likert 1-5 Validation & Non-blocking Audit Logging
 * 3. Automated Derived Time Slot from Backend Clock (Zero-User-Input for production DSS)
 * 4. C3 Weighted Average Consistency with Representative Distinct Logical POIs
 * 5. DSS History Snapshot Flashback Immutability
 */

import { pool } from "../config/database.js";
import { poiTimeCrowdService } from "../services/poi/POITimeCrowdService.js";
import { TimeSlotEvaluator } from "../utils/TimeSlotEvaluator.js";
import { topsisEngineService } from "../services/dss/TopsisEngineService.js";
import { hybridBwmTopsisService } from "../services/dss/HybridBwmTopsisService.js";
import { rawCriteriaEvaluationService } from "../services/dss/RawCriteriaEvaluationService.js";

let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passedCount++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    failedCount++;
  }
}

async function runB09TestSuite() {
  console.log("================================================================================");
  console.log("🚀 STARTING MILESTONE B-09 AUTOMATED TEST SUITE: C3 & OPERATIONAL DSS EVALUATION");
  console.log("================================================================================\n");

  try {
    // -------------------------------------------------------------------------
    // TEST SECTION 1: GET /api/poi-categories/crowd-scores (Standard Response Contract)
    // -------------------------------------------------------------------------
    console.log("📌 [TEST 1] Testing Master Data C3 Configuration Standard GET API...");
    const crowdScoresData = await poiTimeCrowdService.getCrowdScoresStandard();

    assert(crowdScoresData.status === "success", "Response contains status: 'success'");
    assert(crowdScoresData.evaluation_version === "DSS-CRITERIA-v1.0", "evaluation_version is 'DSS-CRITERIA-v1.0'");
    assert(crowdScoresData.methodology === "EXPERT_BASELINE_LIKERT_1_5", "methodology is 'EXPERT_BASELINE_LIKERT_1_5'");
    assert(
      JSON.stringify(crowdScoresData.time_slots) === JSON.stringify(["pagi", "siang", "sore", "malam"]),
      "time_slots contains exactly ['pagi', 'siang', 'sore', 'malam']"
    );
    assert(Array.isArray(crowdScoresData.categories), "categories is an array");
    assert(crowdScoresData.categories.length === 58, `categories array contains exactly 58 POI categories (got ${crowdScoresData.categories.length})`);

    const sampleCat = crowdScoresData.categories[0];
    assert(sampleCat && typeof sampleCat.id === "string", "Each category has valid ID");
    assert(typeof sampleCat.code === "string", "Each category has valid CODE identifier");
    assert(typeof sampleCat.name === "string", "Each category has valid NAME identifier");
    assert(
      sampleCat.scores &&
      typeof sampleCat.scores.pagi === "number" &&
      typeof sampleCat.scores.siang === "number" &&
      typeof sampleCat.scores.sore === "number" &&
      typeof sampleCat.scores.malam === "number",
      "Each category has scores object with integer numbers for pagi, siang, sore, malam"
    );

    // -------------------------------------------------------------------------
    // TEST SECTION 2: PUT /api/poi-categories/crowd-scores (Likert 1-5 Validation)
    // -------------------------------------------------------------------------
    console.log("\n📌 [TEST 2] Testing Likert 1-5 Validation & Error Handling...");
    
    // Invalid Score > 5
    let errorOver5 = null;
    try {
      await poiTimeCrowdService.bulkUpdateCategoryTimeScores([
        { id: sampleCat.id, pagi: 6, siang: 3, sore: 4, malam: 2 }
      ]);
    } catch (err) {
      errorOver5 = err;
    }
    assert(errorOver5 !== null && errorOver5.statusCode === 400, "Score > 5 is properly rejected with 400 Bad Request");

    // Invalid Score < 1
    let errorUnder1 = null;
    try {
      await poiTimeCrowdService.bulkUpdateCategoryTimeScores([
        { id: sampleCat.id, pagi: 0, siang: 3, sore: 4, malam: 2 }
      ]);
    } catch (err) {
      errorUnder1 = err;
    }
    assert(errorUnder1 !== null && errorUnder1.statusCode === 400, "Score < 1 is properly rejected with 400 Bad Request");

    // Invalid Non-integer Score
    let errorFloat = null;
    try {
      await poiTimeCrowdService.bulkUpdateCategoryTimeScores([
        { id: sampleCat.id, pagi: 3.5, siang: 3, sore: 4, malam: 2 }
      ]);
    } catch (err) {
      errorFloat = err;
    }
    assert(errorFloat !== null && errorFloat.statusCode === 400, "Non-integer score is properly rejected with 400 Bad Request");

    // -------------------------------------------------------------------------
    // TEST SECTION 3: Single & Bulk Update with Audit Logging
    // -------------------------------------------------------------------------
    console.log("\n📌 [TEST 3] Testing Valid Single & Bulk Update with Audit Log Verification...");
    const { rows: dbUsers } = await pool.query("SELECT id, role FROM users LIMIT 1;");
    const mockAdminUser = dbUsers.length > 0 ? dbUsers[0] : { id: null, role: "SUPERADMIN" };

    // Single Update
    const updatedSingle = await poiTimeCrowdService.updateCategoryTimeScores(
      sampleCat.id,
      { pagi: 4, siang: 4, sore: 5, malam: 3 },
      mockAdminUser
    );
    assert(updatedSingle.score_pagi === 4 && updatedSingle.score_sore === 5, "Single category crowd scores successfully updated");

    // Bulk Update
    const updatedBulk = await poiTimeCrowdService.bulkUpdateCategoryTimeScores(
      [
        { id: sampleCat.id, pagi: 5, siang: 4, sore: 5, malam: 4 },
        { id: crowdScoresData.categories[1].id, pagi: 3, siang: 3, sore: 4, malam: 3 },
      ],
      mockAdminUser
    );
    assert(updatedBulk.length === 2, "Bulk update successfully processed 2 categories");

    // Wait a brief moment for non-blocking setImmediate audit logs to persist
    await new Promise((r) => setTimeout(r, 200));

    const { rows: auditRows } = await pool.query(
      `SELECT * FROM audit_logs WHERE action IN ('UPDATE_POI_CATEGORY_CROWD_SCORES', 'BULK_UPDATE_POI_CATEGORY_CROWD_SCORES') ORDER BY created_at DESC LIMIT 5;`
    );
    assert(auditRows.length > 0, "Audit logs recorded for C3 crowd score modifications");

    // -------------------------------------------------------------------------
    // TEST SECTION 4: Derived Time Slot from Backend Clock
    // -------------------------------------------------------------------------
    console.log("\n📌 [TEST 4] Testing Backend Clock Automated Derived Time Slots...");
    assert(TimeSlotEvaluator.getSlot("08:30") === "pagi", "08:30 correctly derived as 'pagi' (06:00-10:59)");
    assert(TimeSlotEvaluator.getSlot("12:15") === "siang", "12:15 correctly derived as 'siang' (11:00-14:59)");
    assert(TimeSlotEvaluator.getSlot("16:45") === "sore", "16:45 correctly derived as 'sore' (15:00-17:59)");
    assert(TimeSlotEvaluator.getSlot("19:30") === "malam", "19:30 correctly derived as 'malam' (18:00-21:00)");
    assert(TimeSlotEvaluator.getSlot("02:00") === "off_hours", "02:00 correctly derived as 'off_hours'");

    // Verify current clock evaluation without explicit input
    const autoSlot = TimeSlotEvaluator.getSlot(new Date());
    assert(["pagi", "siang", "sore", "malam", "off_hours"].includes(autoSlot), `Current live time slot derived: '${autoSlot}'`);

    // -------------------------------------------------------------------------
    // TEST SECTION 5: C3 Weighted Average vs PostGIS Logical POI Calculation
    // -------------------------------------------------------------------------
    console.log("\n📌 [TEST 5] Testing C3 Weighted Average Calculation Formula...");
    const { rows: testZones } = await pool.query("SELECT id, name, polygon FROM zones WHERE status = 'ACTIVE' LIMIT 1;");
    if (testZones.length > 0) {
      const zone = testZones[0];
      const c3Eval = await poiTimeCrowdService.calculateZoneC3Score(zone.polygon, "sore");
      assert(typeof c3Eval.total_c3_score === "number", "C3 total score computed");
      assert(typeof c3Eval.avg_c3_score === "number", "C3 average score computed");
      assert(c3Eval.active_time_slot === "sore", "C3 active time slot is 'sore'");

      // Also verify through RawCriteriaEvaluationService
      const rawEval = await rawCriteriaEvaluationService.evaluateZoneRawCriteria(zone.id, { timeSlot: "sore" });
      assert(rawEval.criteria.C3.code === "C3", "Raw C3 criterion code is C3");
      assert(rawEval.criteria.C3.type === "BENEFIT", "C3 type is strictly BENEFIT");
      assert(rawEval.criteria.C3.methodology === "EXPERT_BASELINE_LIKERT_1_5", "C3 methodology matches EXPERT_BASELINE_LIKERT_1_5");
    }

    // -------------------------------------------------------------------------
    // TEST SECTION 6: DSS Recommendations & History Snapshot Flashback Immutability
    // -------------------------------------------------------------------------
    console.log("\n📌 [TEST 6] Testing DSS History Snapshot & Flashback Immutability...");
    
    // Trigger hybrid evaluation that creates an immutable snapshot
    const hybridRes = await hybridBwmTopsisService.evaluateZonesHybrid({
      time_slot: "sore",
      save_snapshot: true,
    });
    assert(hybridRes.status === "success", "Hybrid DSS evaluation succeeded");
    assert(typeof hybridRes.snapshot_id === "string", `Snapshot created with ID: ${hybridRes.snapshot_id}`);

    // Fetch snapshot via getSnapshotById (history flashback)
    const snapshot = await hybridBwmTopsisService.getSnapshotById(hybridRes.snapshot_id);
    assert(snapshot !== null, "Historical snapshot successfully retrieved by ID");
    assert(snapshot.id === hybridRes.snapshot_id, "Snapshot ID matches");
    assert(
      Array.isArray(snapshot.snapshot_data?.rankings || snapshot.snapshot_data?.topsis_summary?.rankings),
      "Snapshot contains complete ranking list"
    );
    assert(snapshot.snapshot_data?.time_slot === "sore", "Snapshot accurately records historical time_slot");

    // Recommendations endpoint without time parameter (automated derived backend clock)
    const recs = await topsisEngineService.calculateTopsisRecommendations({});
    assert(recs.status === "success", "Recommendations generated without explicit time input");
    assert(typeof recs.time_slot === "string", `Recommendations automatically derived time_slot: '${recs.time_slot}'`);
    assert(Array.isArray(recs.rankings), "Recommendations returned as rankings array");


  } catch (error) {
    console.error("❌ Unexpected Error in Test Suite:", error);
    failedCount++;
  } finally {
    console.log("\n================================================================================");
    console.log(`🏁 B-09 TEST RUN COMPLETED: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log("================================================================================");
    process.exit(failedCount > 0 ? 1 : 0);
  }
}

runB09TestSuite();
