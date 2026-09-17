import "dotenv/config";
import http from "http";
import { app } from "../../index.js";
import { pool } from "../../src/config/database.js";
import { topsisEngineService } from "../../src/services/dss/TopsisEngineService.js";

const PORT = process.env.PORT || 9003;
const BASE_URL = `http://localhost:${PORT}`;

async function runDssHardeningTests() {
  console.log(`\n======================================================`);
  console.log(`Starting Phase 3 Hardening: DSS Edge-Cases & Determinism Test Suite`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`======================================================\n`);

  let passedCount = 0;
  let failedCount = 0;
  let localServer = null;

  try {
    try {
      await fetch(`${BASE_URL}/api/poi-categories`, { signal: AbortSignal.timeout(1500) });
    } catch {
      console.log(`Starting test server in-process on port ${PORT}...`);
      localServer = http.createServer(app);
      await new Promise((resolve) => localServer.listen(PORT, resolve));
      console.log(`Test server running at ${BASE_URL}\n`);
    }

    function assertTest(testName, isSuccess, details = "") {
      if (isSuccess) {
        console.log(`  ✓ PASS: ${testName}${details ? ` (${details})` : ""}`);
        passedCount++;
      } else {
        console.log(`  ✗ FAIL: ${testName}${details ? ` (${details})` : ""}`);
        failedCount++;
      }
    }

    // 1. Authenticate Supervisor
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "supervisor@kopikeliling.com", password: "password123" }),
    });
    const loginData = await loginRes.json();
    const supervisorToken = loginData.token;
    assertTest("Supervisor Login", !!supervisorToken);

    // 2. Test Edge-Case: Deterministic TOPSIS Ranking Tie-Breaker
    console.log(`\n[1] Testing Deterministic Ranking on Exact Score Tie...`);
    const criteriaSpecs = [
      { code: "C1", name: "Densitas", type: "BENEFIT", weight: 0.5 },
      { code: "C2", name: "Diversitas", type: "BENEFIT", weight: 0.5 },
    ];
    // Identical scores for Zone A & Zone B
    const tieMatrix = [
      { id: "zone-b", name: "Zone Beta", scores: { C1: 10, C2: 10 } },
      { id: "zone-a", name: "Zone Alpha", scores: { C1: 10, C2: 10 } },
    ];
    const tieResult1 = topsisEngineService.calculateTopsisForMatrix(tieMatrix, criteriaSpecs);
    const tieResult2 = topsisEngineService.calculateTopsisForMatrix(tieMatrix, criteriaSpecs);

    const isDeterministic = tieResult1.rankings[0].id === tieResult2.rankings[0].id &&
      tieResult1.rankings[0].id === "zone-a"; // Sorted by id ASC when score tied
    assertTest("TOPSIS Ranking Tie Determinism", isDeterministic, `Rank 1: ${tieResult1.rankings[0].name} (ID: ${tieResult1.rankings[0].id})`);

    // 3. Test Edge-Case: Explicit weight_source metadata
    console.log(`\n[2] Testing Explicit weight_source Metadata in TOPSIS output...`);
    const dssRecRes = await fetch(`${BASE_URL}/api/dss/recommendations`, {
      headers: { Authorization: `Bearer ${supervisorToken}` },
    });
    const dssRecData = await dssRecRes.json();
    const hasWeightSource = dssRecData.weight_source === "BWM" || dssRecData.weight_source === "EQUAL_FALLBACK";
    assertTest("Explicit weight_source Metadata", hasWeightSource, `weight_source: ${dssRecData.weight_source}`);

    // 4. Test Edge-Case: Capacity Overflow & Remaining Queue Integrity
    console.log(`\n[3] Testing Capacity Overflow (More Riders Than Zone Capacities)...`);

    // Reset today's queues
    await pool.query("DELETE FROM zone_assignments WHERE assignment_date = CURRENT_DATE;");
    await pool.query("DELETE FROM rider_duty_queues WHERE duty_date = CURRENT_DATE;");

    // Create 4 temporary test riders
    const testRiderIds = [];
    for (let i = 1; i <= 4; i++) {
      const email = `overflow_rider_${i}_${Date.now()}@test.com`;
      const reg = await pool.query(`
        INSERT INTO users (username, name, email, password, role)
        VALUES ($1, $2, $3, 'hash', 'RIDER')
        RETURNING id;
      `, [`rider_ov_${i}_${Date.now()}`, `Overflow Rider ${i}`, email]);
      testRiderIds.push(reg.rows[0].id);

      // Add to duty queue with staggered confirmed_at for deterministic FIFO
      const confirmedAt = new Date(Date.now() - (5 - i) * 60000);
      await pool.query(`
        INSERT INTO rider_duty_queues (rider_id, duty_date, confirmed_at, status)
        VALUES ($1, CURRENT_DATE, $2, 'WAITING');
      `, [reg.rows[0].id, confirmedAt]);
    }

    // Set all active zones to low max_capacity so total capacity = 2
    await pool.query("UPDATE zones SET max_capacity = 0;");
    const activeZones = (await pool.query("SELECT id, name FROM zones WHERE status = 'ACTIVE' ORDER BY name ASC LIMIT 2;")).rows;
    if (activeZones.length >= 2) {
      await pool.query(`UPDATE zones SET max_capacity = 1 WHERE id IN ('${activeZones[0].id}', '${activeZones[1].id}');`);
    }

    // Trigger auto distribute
    const autoPlotRes = await fetch(`${BASE_URL}/api/distribution/auto`, {
      method: "POST",
      headers: { Authorization: `Bearer ${supervisorToken}` },
    });
    const autoPlotData = await autoPlotRes.json();

    assertTest("Capacity Limit Enforced (Assigned = 2)", autoPlotData.assigned_riders_count === 2, `Assigned: ${autoPlotData.assigned_riders_count}`);
    assertTest("Unassigned Riders Count Reported (Unassigned = 2)", autoPlotData.unassigned_riders_count === 2, `Unassigned: ${autoPlotData.unassigned_riders_count}`);

    // Verify queue statuses: exactly 2 PLOTTED and exactly 2 still WAITING
    const plottedCheck = await pool.query("SELECT COUNT(*)::int AS count FROM rider_duty_queues WHERE duty_date = CURRENT_DATE AND status = 'PLOTTED';");
    const waitingCheck = await pool.query("SELECT COUNT(*)::int AS count FROM rider_duty_queues WHERE duty_date = CURRENT_DATE AND status = 'WAITING';");
    assertTest("PLOTTED Queue Count = 2", plottedCheck.rows[0]?.count === 2);
    assertTest("WAITING Queue Count = 2 (Not wrongly marked PLOTTED)", waitingCheck.rows[0]?.count === 2);

    // 5. Test Edge-Case: All Zones Full / Zero Capacity Remaining
    console.log(`\n[4] Testing Distribution When All Zones Are Full...`);

    const fullPlotRes = await fetch(`${BASE_URL}/api/distribution/auto`, {
      method: "POST",
      headers: { Authorization: `Bearer ${supervisorToken}` },
    });
    const fullPlotData = await fullPlotRes.json();
    assertTest("Zero Assignments When Full", fullPlotData.assigned_riders_count === 0, `Assigned: ${fullPlotData.assigned_riders_count}`);

    const remainingWaiting = await pool.query("SELECT COUNT(*)::int AS count FROM rider_duty_queues WHERE duty_date = CURRENT_DATE AND status = 'WAITING';");
    assertTest("Remaining Riders Still WAITING (Zero Leakage)", remainingWaiting.rows[0]?.count === 2);

    // 6. Test Edge-Case: Idempotency (Single Assignment per Rider Date)
    console.log(`\n[5] Testing Assignment Idempotency & Conflict Guard...`);

    const assignedRider = testRiderIds[0];
    const targetZone = activeZones[0].id;

    // Direct insert to check UNIQUE constraint (rider_id, assignment_date)
    let duplicateErrorThrown = false;
    try {
      await pool.query(`
        INSERT INTO zone_assignments (rider_id, zone_id, assignment_date, status)
        VALUES ($1, $2, CURRENT_DATE, 'ASSIGNED');
      `, [assignedRider, targetZone]);
    } catch (err) {
      if (err.code === "23505") { // unique_violation
        duplicateErrorThrown = true;
      }
    }
    assertTest("DB Unique Constraint Prevents Duplicate Assignment per Date", duplicateErrorThrown);

    // Clean up temporary test riders & restore zone capacities
    for (const uid of testRiderIds) {
      await pool.query("DELETE FROM users WHERE id = $1;", [uid]);
    }
    await pool.query("UPDATE zones SET max_capacity = 10 WHERE max_capacity < 10;");

  } catch (err) {
    console.error("FATAL ERROR in DSS Hardening tests:", err);
  } finally {
    if (localServer) {
      localServer.close();
    }
    console.log(`\n======================================================`);
    console.log(`Phase 3 Hardening Test Results:`);
    console.log(`PASSED: ${passedCount} | FAILED: ${failedCount}`);
    console.log(`======================================================\n`);
    await pool.end();
    process.exit(failedCount > 0 ? 1 : 0);
  }
}

runDssHardeningTests();
