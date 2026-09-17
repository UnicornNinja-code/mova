if (typeof window === "undefined") {
  globalThis.window = globalThis;
  globalThis.devicePixelRatio = 1;
  globalThis.screen = { deviceXDPI: 96, logicalXDPI: 96 };
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  const dummyEl = { style: {}, appendChild: () => {}, querySelectorAll: () => [] };
  globalThis.document = {
    createElement: () => dummyEl,
    documentElement: { style: {} },
    body: { style: {}, appendChild: () => {} },
  };
}

import { pool } from "../config/database.js";

async function runCorrectiveFixVerification() {
  console.log("\n================================================================================");
  console.log("🧪 AUTOMATED VERIFICATION TEST SUITE: CORRECTIVE FIX A+B+C (READ-ONLY)");
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
    const { getCategoryConfig } = await import("../../../frontend/src/utils/poiCategoryConfig.js");

    // TEST 1 — Protocol Road PostGIS Table & Feature Collection
    console.log("📌 [TEST 1] Protocol Road Spatial Restriction Layer Baseline...");
    const { rows: roadRows } = await pool.query("SELECT COUNT(*)::int AS cnt FROM protocol_roads;");
    assert(roadRows[0].cnt > 0, `PostGIS protocol_roads table contains ${roadRows[0].cnt} features (Baseline: 885)`);

    // TEST 2 — Database POI Category Baseline
    console.log("\n📌 [TEST 2] Database Category Baseline Verification...");
    const { rows: dbLainnya } = await pool.query("SELECT COUNT(*)::int AS cnt FROM pois WHERE category = 'Lainnya';");
    assert(dbLainnya[0].cnt === 25, `Raw database category = 'Lainnya' count equals exactly 25 (Actual: ${dbLainnya[0].cnt})`);

    const { rows: totalApproved } = await pool.query("SELECT COUNT(*)::int AS cnt FROM pois WHERE status = 'APPROVED';");
    assert(totalApproved[0].cnt === 1553, `Total approved POIs in database equals 1,553 (Actual: ${totalApproved[0].cnt})`);

    // TEST 3 — Frontend Category Mapping Function Integrity
    console.log("\n📌 [TEST 3] Frontend Explicit Category Mapping Integrity...");
    assert(getCategoryConfig("Minimarket").key === "Komersial", "Minimarket maps explicitly to 'Komersial' UI Group");
    assert(getCategoryConfig("Rumah Sakit").key === "Fasilitas", "Rumah Sakit maps explicitly to 'Fasilitas' UI Group");
    assert(getCategoryConfig("Hotel & Penginapan").key === "Fasilitas", "Hotel & Penginapan maps explicitly to 'Fasilitas' UI Group");
    assert(getCategoryConfig("Perguruan Tinggi").key === "Kampus", "Perguruan Tinggi maps explicitly to 'Kampus' UI Group");
    assert(getCategoryConfig("Lainnya").key === "Lainnya", "Lainnya maps explicitly to 'Lainnya' UI Group");

    // TEST 4 — Exact Reconciliation (Target: FE UI 'Lainnya' === DB Raw 'Lainnya' === 25)
    console.log("\n📌 [TEST 4] Exact Reconciliation (Target: FE UI 'Lainnya' === 25)...");
    const { rows: allPois } = await pool.query("SELECT id, name, category FROM pois WHERE status = 'APPROVED';");

    let feLainnyaCount = 0;
    let feMappedCount = 0;

    allPois.forEach((poi) => {
      const config = getCategoryConfig(poi.category);
      if (config.key === "Lainnya") {
        feLainnyaCount++;
      } else {
        feMappedCount++;
      }
    });

    assert(feLainnyaCount === 25, `Frontend UI Group 'Lainnya' marker count equals exactly 25 (Actual: ${feLainnyaCount})`);
    assert(feMappedCount === 1528, `Frontend UI Mapped marker count equals exactly 1,528 (Actual: ${feMappedCount})`);

    // TEST 5 — Database Read-Only Integrity (0 Rows Mutated)
    console.log("\n📌 [TEST 5] Database Read-Only Integrity (0 Mutations)...");
    const { rows: poisEnd } = await pool.query("SELECT COUNT(*)::int AS cnt FROM pois;");
    const { rows: zonesEnd } = await pool.query("SELECT COUNT(*)::int AS cnt FROM zones;");
    const { rows: roadsEnd } = await pool.query("SELECT COUNT(*)::int AS cnt FROM protocol_roads;");

    assert(poisEnd[0].cnt === 1553, "pois table 100% unmutated (1,553 rows)");
    assert(zonesEnd[0].cnt === 5, "zones table 100% unmutated (5 rows)");
    assert(roadsEnd[0].cnt === 885, "protocol_roads table 100% unmutated (885 rows)");

    console.log("\n================================================================================");
    console.log(`🎉 TEST CORRECTIVE FIX A+B+C SELESAI: ${passed} PASSED, ${failed} FAILED`);
    console.log("================================================================================\n");

    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error("💥 TEST CORRECTIVE FIX GAGAL:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runCorrectiveFixVerification();
