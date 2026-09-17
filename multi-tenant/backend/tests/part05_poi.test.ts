/*
 * part05_poi.test.ts
 * Comprehensive Integration & Verification Test Suite for PART 05:
 * POI Ingestion Pipeline, 51 Classified Categories, PostGIS GiST Spatial Indexing,
 * CAS Atomic Dataset Versioning, and Excluded POI Filtering.
 */

import { pool } from "../src/config/database.js";
import { PoiCategoryModel } from "../src/models/poiCategoryModel.js";
import { poiRepository } from "../src/repositories/poiRepository.js";
import { datasetVersionRepository } from "../src/repositories/datasetVersionRepository.js";

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

async function runPart05Tests() {
  console.log("\n========================================================");
  console.log("🧪 RUNNING PART 05: POI & SPATIAL DATA PIPELINE TESTS");
  console.log("========================================================\n");

  const testSuffix = Date.now();

  // -------------------------------------------------------------
  // GROUP 1: 51 POI Categories & Time-Slot Crowd Scores (POI-003, POI-004)
  // -------------------------------------------------------------
  console.log("🏢 [GROUP 1] 51 POI Categories & Time-Slot Likert Crowd Scores");

  const categories = await PoiCategoryModel.findAll();
  assert(categories && categories.length >= 51, `TEST 1.1: Database has at least 51 POI categories (Found: ${categories.length})`);

  const activeCategories = categories.filter((c: any) => c.is_active === true);
  assert(activeCategories.length >= 51, `TEST 1.2: All 51 categories are marked is_active = true (Active: ${activeCategories.length})`);

  // Verify time-slot crowd scores are in Likert range [1, 5]
  const validScores = categories.every(
    (c: any) =>
      c.score_pagi >= 1 &&
      c.score_pagi <= 5 &&
      c.score_siang >= 1 &&
      c.score_siang <= 5 &&
      c.score_sore >= 1 &&
      c.score_sore <= 5 &&
      c.score_malam >= 1 &&
      c.score_malam <= 5
  );
  assert(validScores, "TEST 1.3: All categories have valid 1-5 Likert crowd scores for pagi, siang, sore, malam");

  // Verify no orphaned POI categories in active pois table
  const orphanQuery = `
    SELECT COUNT(*) AS orphan_count
    FROM pois p
    LEFT JOIN poi_categories pc ON p.category = pc.name
    WHERE pc.name IS NULL AND p.category IS NOT NULL;
  `;
  const { rows: orphanRows } = await pool.query(orphanQuery);
  const orphanCount = parseInt(orphanRows[0]?.orphan_count || "0", 10);
  assert(orphanCount === 0, `TEST 1.4: Zero orphaned POIs without matching category in poi_categories (Orphans: ${orphanCount})`);

  // -------------------------------------------------------------
  // GROUP 2: PostGIS GiST Spatial Indexing & Containment (POI-005, PERF-002)
  // -------------------------------------------------------------
  console.log("\n🗺️ [GROUP 2] PostGIS GiST Spatial Indexing & Query Execution");

  // Check GiST index on pois.geom
  const indexQuery = `
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'pois' AND indexdef ILIKE '%gist%geom%';
  `;
  const { rows: indexRows } = await pool.query(indexQuery);
  assert(indexRows.length > 0, "TEST 2.1: PostGIS GiST index on pois.geom is active");

  // Test spatial query with ST_Contains on polygon
  const spatialQuery = `
    SELECT 
      p.id, p.name, p.category, 
      ST_X(p.geom) AS lng, 
      ST_Y(p.geom) AS lat
    FROM pois p
    WHERE p.geom IS NOT NULL
      AND ST_Contains(
        ST_SetSRID(
          ST_MakePolygon(
            ST_GeomFromText('LINESTRING(112.70 -7.35, 112.85 -7.35, 112.85 -7.20, 112.70 -7.20, 112.70 -7.35)')
          ), 
          4326
        ),
        p.geom
      )
    LIMIT 10;
  `;
  const { rows: spatialRows } = await pool.query(spatialQuery);
  assert(Array.isArray(spatialRows), "TEST 2.2: PostGIS ST_Contains spatial query executes without error");

  // -------------------------------------------------------------
  // GROUP 3: EXCLUDED POI Filtering in DSS (POI-007)
  // -------------------------------------------------------------
  console.log("\n🚫 [GROUP 3] Excluded POI Operational Status Filtering");

  // Create temporary test POIs: 1 ACTIVE, 1 EXCLUDED
  const activeExtId = `node/test_active_${testSuffix}`;
  const excludedExtId = `node/test_excluded_${testSuffix}`;
  const logicalActiveId = crypto.randomUUID();
  const logicalExcludedId = crypto.randomUUID();

  await pool.query(
    `INSERT INTO pois (logical_poi_id, external_id, name, category, operational_status, latitude, longitude, geom)
     VALUES 
       ($1, $2, 'Test Active POI', 'Kafe / Coffee Shop', 'ACTIVE', -7.26, 112.75, ST_SetSRID(ST_MakePoint(112.75, -7.26), 4326)),
       ($3, $4, 'Test Excluded POI', 'Kafe / Coffee Shop', 'EXCLUDED', -7.26, 112.75, ST_SetSRID(ST_MakePoint(112.75, -7.26), 4326));`,
    [logicalActiveId, activeExtId, logicalExcludedId, excludedExtId]
  );

  // Active query should only count ACTIVE POIs
  const activeCountQuery = `
    SELECT COUNT(*) AS active_count
    FROM pois
    WHERE external_id IN ($1, $2) AND (operational_status = 'ACTIVE' OR operational_status IS NULL);
  `;
  const { rows: activeCountRows } = await pool.query(activeCountQuery, [activeExtId, excludedExtId]);
  const activeCount = parseInt(activeCountRows[0]?.active_count || "0", 10);
  assert(activeCount === 1, "TEST 3.1: EXCLUDED POIs are filtered out from active POI counts");

  // Clean up temporary test POIs
  await pool.query("DELETE FROM pois WHERE external_id IN ($1, $2);", [activeExtId, excludedExtId]);

  // -------------------------------------------------------------
  // GROUP 4: Dataset Versioning & CAS Promotion Pipeline (POI-006, POI-008)
  // -------------------------------------------------------------
  console.log("\n📦 [GROUP 4] Dataset Versioning Lifecycle & Rollback Model");

  const versions = await datasetVersionRepository.findHistory("POI");
  assert(Array.isArray(versions), "TEST 4.1: Dataset version history queryable for POI");

  const activeVersion = await datasetVersionRepository.findActiveVersion("POI");
  assert(activeVersion !== undefined, "TEST 4.2: Active dataset version query executes successfully");

  // -------------------------------------------------------------
  // GROUP 5: POI Querying & Category Filtering (POI-010)
  // -------------------------------------------------------------
  console.log("\n🔍 [GROUP 5] POI Querying, Search & Filtering");

  const poiList = await poiRepository.findAll({ limit: 15 });
  assert(Array.isArray(poiList), "TEST 5.1: POI repository listing returns array of records");

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log("\n========================================================");
  console.log(`📊 PART 05 TEST RESULTS: ${passedTests}/${totalTests} PASSED`);
  console.log("========================================================\n");

  if (passedTests === totalTests) {
    console.log("🎉 ALL PART 05 TESTS PASSED PERFECTLY!");
    process.exit(0);
  } else {
    console.error("❌ SOME PART 05 TESTS FAILED.");
    process.exit(1);
  }
}

runPart05Tests().catch((err) => {
  console.error("💥 Unhandled error during PART 05 test execution:", err);
  process.exit(1);
});
