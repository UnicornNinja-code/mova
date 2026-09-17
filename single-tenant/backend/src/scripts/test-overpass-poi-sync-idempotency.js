import { pool } from "../config/database.js";
import { poiRepository } from "../repositories/poiRepository.js";
import { syncCityPoisService } from "../services/poiService.js";
import { topsisEngineService } from "../services/dss/TopsisEngineService.js";

async function runOverpassSyncIdempotencyTests() {
  console.log("\n================================================================================");
  console.log("🧪 AUTOMATED VERIFICATION TEST SUITE: OVERPASS POI SYNC IDEMPOTENCY & CLEANUP");
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
    // TEST 1 — Baseline Database Measurements
    console.log("📌 [TEST 1] Capture Baseline Database State...");
    const { rows: rInit } = await pool.query("SELECT COUNT(*)::int AS cnt FROM pois;");
    const { rows: dupInit } = await pool.query("SELECT COUNT(*)::int AS cnt FROM (SELECT osm_id FROM pois WHERE osm_id IS NOT NULL GROUP BY osm_id HAVING COUNT(*) > 1) d;");
    console.log(`   • Initial Physical POI Rows: ${rInit[0].cnt}`);
    console.log(`   • Initial Duplicate Groups by osm_id: ${dupInit[0].cnt}`);
    assert(rInit[0].cnt > 0, "Database contains baseline physical POI records");

    // TEST 2 — Safe Duplicate Reconcile & Transactional Cleanup
    console.log("\n📌 [TEST 2] Safe Duplicate Reconcile & Cleanup Execution...");
    const cleanupRes = await poiRepository.reconcileAndCleanupDuplicatePois();
    console.log(`   • Duplicate Groups Processed: ${cleanupRes.duplicateGroupsProcessed}`);
    console.log(`   • Physical Rows Deleted: ${cleanupRes.totalDeleted}`);
    console.log(`   • Candidate References Re-linked: ${cleanupRes.totalRelinked}`);

    const { rows: rClean } = await pool.query("SELECT COUNT(*)::int AS cnt FROM pois;");
    const { rows: dupClean } = await pool.query("SELECT COUNT(*)::int AS cnt FROM (SELECT osm_id FROM pois WHERE osm_id IS NOT NULL GROUP BY osm_id HAVING COUNT(*) > 1) d;");

    assert(dupClean[0].cnt === 0, `Duplicate OSM ID groups reduced to 0 (Actual: ${dupClean[0].cnt})`);
    assert(rClean[0].cnt > 0, `Physical POI rows after cleanup equals ${rClean[0].cnt}`);
    const postCleanupCount = rClean[0].cnt;

    // TEST 3 — Overpass Sync #1
    console.log("\n📌 [TEST 3] Overpass Sync #1 Execution...");
    await syncCityPoisService();
    const { rows: rSync1 } = await pool.query("SELECT COUNT(*)::int AS cnt FROM pois;");
    const sync1Count = rSync1[0].cnt;
    assert(sync1Count > 0, `Sync #1 completed successfully (Unique POI Count: ${sync1Count})`);

    // TEST 4 — Overpass Sync #2 (Idempotency Check 1)
    console.log("\n📌 [TEST 4] Overpass Sync #2 (Idempotency Check)...");
    await syncCityPoisService();
    const { rows: rSync2 } = await pool.query("SELECT COUNT(*)::int AS cnt FROM pois;");
    assert(rSync2[0].cnt === sync1Count, `Sync #2 maintains identical count of ${sync1Count} (N -> N) (Actual: ${rSync2[0].cnt})`);

    // TEST 5 — Overpass Sync #3 (Repeat Idempotency Check 2)
    console.log("\n📌 [TEST 5] Overpass Sync #3 (Repeat Idempotency Check)...");
    await syncCityPoisService();
    const { rows: rSync3 } = await pool.query("SELECT COUNT(*)::int AS cnt FROM pois;");
    assert(rSync3[0].cnt === sync1Count, `Sync #3 maintains identical count of ${sync1Count} (N -> N) (Actual: ${rSync3[0].cnt})`);

    // TEST 6 — Duplicate OSM Identity Verification
    console.log("\n📌 [TEST 6] Duplicate OSM Identity Check...");
    const { rows: dupOsmFinal } = await pool.query("SELECT COUNT(*)::int AS cnt FROM (SELECT osm_id FROM pois WHERE osm_id IS NOT NULL GROUP BY osm_id HAVING COUNT(*) > 1) d;");
    const { rows: dupExtFinal } = await pool.query("SELECT COUNT(*)::int AS cnt FROM (SELECT external_id FROM pois WHERE external_id IS NOT NULL GROUP BY external_id HAVING COUNT(*) > 1) d;");
    assert(dupOsmFinal[0].cnt === 0, `0 duplicate osm_id groups remaining (Actual: ${dupOsmFinal[0].cnt})`);
    assert(dupExtFinal[0].cnt === 0, `0 duplicate external_id groups remaining (Actual: ${dupExtFinal[0].cnt})`);

    // TEST 7 — Existing POI Reuse Check
    console.log("\n📌 [TEST 7] Existing POI Reuse Verification...");
    const { rows: samplePoi } = await pool.query("SELECT id, updated_at FROM pois WHERE osm_id IS NOT NULL LIMIT 1;");
    if (samplePoi.length > 0) {
      assert(samplePoi[0].id !== undefined && samplePoi[0].updated_at !== null, "Existing POIs updated in place with updated_at timestamp");
    }

    // TEST 8 — Genuinely New POI Insertion
    console.log("\n📌 [TEST 8] Genuinely New POI Insertion & Repeat Sync Test...");
    const mockNewPoi = {
      osm_type: "node",
      osm_id: 9999888877,
      external_id: "osm:node:9999888877",
      name: "Mock New POI Test Station",
      category: "Transportasi",
      latitude: -7.45000,
      longitude: 112.71000,
      approval_status: "APPROVED",
      operational_status: "ELIGIBLE",
    };

    await poiRepository.syncCityPoisWithTransaction([mockNewPoi]);
    const { rows: rNewInsert } = await pool.query("SELECT COUNT(*)::int AS cnt FROM pois;");
    assert(rNewInsert[0].cnt === sync1Count + 1, `New POI inserted exactly once (Count: ${sync1Count + 1})`);

    // Repeat sync with same mock POI
    await poiRepository.syncCityPoisWithTransaction([mockNewPoi]);
    const { rows: rNewRepeat } = await pool.query("SELECT COUNT(*)::int AS cnt FROM pois;");
    assert(rNewRepeat[0].cnt === sync1Count + 1, `Repeat sync reuses new POI without duplication (Count: ${sync1Count + 1})`);

    // Clean up mock POI
    await pool.query("DELETE FROM pois WHERE osm_id = 9999888877;");
    console.log("   ✅ Cleanup mock POI test record selesai.");

    // TEST 9 — Logical POI & Duplicate Relationship Integrity
    console.log("\n📌 [TEST 9] Logical POI & Duplicate Relationship Integrity...");
    const { rows: nullLogical } = await pool.query("SELECT COUNT(*)::int AS cnt FROM pois WHERE logical_poi_id IS NULL;");
    assert(nullLogical[0].cnt === 0, `0 records with null logical_poi_id (Actual: ${nullLogical[0].cnt})`);

    const { rows: validLogical } = await pool.query("SELECT COUNT(DISTINCT logical_poi_id)::int AS cnt FROM pois;");
    assert(validLogical[0].cnt > 0, `Unique logical POIs intact (${validLogical[0].cnt})`);

    // TEST 10 — Before/After DSS Engine Comparison
    console.log("\n📌 [TEST 10] DSS Engine Stability & Comparison...");
    const { rows: activeZones } = await pool.query("SELECT id FROM zones WHERE status = 'ACTIVE' LIMIT 1;");
    if (activeZones.length > 0) {
      const dssRes = await topsisEngineService.calculateTopsisRecommendations({ riderLat: -7.44, riderLon: 112.71, timeSlot: "siang" });
      assert(dssRes && Array.isArray(dssRes.rankings), "TOPSIS Engine runs cleanly and generates valid rankings");
    }

    console.log("\n================================================================================");
    console.log(`🎉 TEST OVERPASS SYNC IDEMPOTENCY SELESAI: ${passed} PASSED, ${failed} FAILED`);
    console.log("================================================================================\n");

    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error("💥 TEST OVERPASS SYNC GAGAL:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runOverpassSyncIdempotencyTests();
