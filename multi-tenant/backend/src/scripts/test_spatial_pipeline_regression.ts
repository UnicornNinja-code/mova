/*
 * test_spatial_pipeline_regression.ts
 *
 * Automated Regression Test Suite for MOVA Spatial Data Pipeline Architecture:
 * 1. PostGIS Database Versioning (dataset_versions & staging tables)
 * 2. Intermediate Snapshots & Manifests with SHA-256 Checksums
 * 3. Spatial Validation (ST_IsValid, SRID 4326, Operational Bounding Box)
 * 4. Deduplication Engine (Canonical external_id & Haversine proximity)
 * 5. Atomic Promotion with Reconciliation (TEST 1: Deleted/Orphan features retired)
 * 6. Snapshot-Verified Physical Rollback (TEST 2, 3, 4, 5, 6)
 * 7. Operational API Isolation for Deleted POIs and Roads (TEST 7, 8)
 * 8. Concurrent Sync Locking (Race Condition Prevention)
 * 9. REST API Security & RBAC Guard (SUPERADMIN only)
 */

import { pool } from "../config/database.js";
import { redisClient } from "../config/redis.js";
import { datasetVersionRepository } from "../repositories/datasetVersionRepository.js";
import { datasetSyncJobRepository } from "../repositories/datasetSyncJobRepository.js";
import { poiRepository } from "../repositories/poiRepository.js";
import { roadService } from "../services/roadService.js";
import { spatialSnapshotService } from "../services/spatial/SpatialSnapshotService.js";
import { spatialValidationService } from "../services/spatial/SpatialValidationService.js";
import { datasetPromotionService } from "../services/spatial/DatasetPromotionService.js";
import {
  acquireSyncLock,
  releaseSyncLock,
  renewSyncLock,
  verifySyncLock,
  SyncLockLease,
} from "../queues/overpassQueue.js";
import fs from "fs";
import crypto from "crypto";

const BASE_URL = "http://localhost:9099/api";

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, testName: string, detail?: any) {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    testsPassed++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}`);
    if (detail) console.error("     Detail:", detail);
    testsFailed++;
  }
}

async function runRegressionSuite() {
  console.log("================================================================================");
  console.log("🌍 MOVA SPATIAL DATA PIPELINE ARCHITECTURE REGRESSION TEST SUITE");
  console.log("================================================================================");

  // ---------------------------------------------------------------------------
  // TEST SUITE 1: Baseline Versioning & Database Schema Integrity
  // ---------------------------------------------------------------------------
  console.log("\n📌 [SUITE 1] Database Versioning & Staging Schema Verification");

  const activePoi = await datasetVersionRepository.findActiveVersion("POI");
  assert(activePoi !== null && activePoi.status === "ACTIVE", "Active baseline version exists for POI (status = ACTIVE)");

  const activeRoads = await datasetVersionRepository.findActiveVersion("PROTOCOL_ROADS");
  assert(activeRoads !== null && activeRoads.status === "ACTIVE", "Active baseline version exists for PROTOCOL_ROADS (status = ACTIVE)");

  const activeToll = await datasetVersionRepository.findActiveVersion("TOLL_ROADS");
  assert(activeToll !== null && activeToll.status === "ACTIVE", "Active baseline version exists for TOLL_ROADS (status = ACTIVE)");

  // ---------------------------------------------------------------------------
  // TEST SUITE 2: Spatial Validation & Deduplication Engine
  // ---------------------------------------------------------------------------
  console.log("\n📌 [SUITE 2] Spatial Validation & Canonical Deduplication Engine");

  // 2.1 Bounding box & Coordinate validation
  const testPois = [
    { name: "Valid Cafe Sidoarjo", latitude: -7.4478, longitude: 112.7183, category: "CAFE", osm_id: 101, osm_type: "node" },
    { name: "Out of Bounds Cafe (Jakarta)", latitude: -6.2088, longitude: 106.8456, category: "CAFE", osm_id: 102, osm_type: "node" },
    { name: "Corrupt Coordinate Cafe", latitude: NaN, longitude: 112.71, category: "CAFE", osm_id: 103, osm_type: "node" },
    { name: "Valid Warung Pasuruan", latitude: -7.6469, longitude: 112.9075, category: "RESTAURANT", osm_id: 104, osm_type: "node" },
    { name: "Duplicate of Valid Cafe", latitude: -7.4478, longitude: 112.7183, category: "CAFE", osm_id: 101, osm_type: "node" },
  ];

  const validationRes = spatialValidationService.validatePois(testPois);
  assert(validationRes.validPois.length === 2, "Validation filters out out-of-bounds, corrupt coordinates, and duplicate external_ids");
  assert(validationRes.report.outOfBoundsCount === 1, "Correctly identifies 1 out-of-bounds feature");
  assert(validationRes.report.invalidCount === 1, "Correctly identifies 1 corrupt coordinate feature");
  assert(validationRes.report.duplicateCount === 1, "Correctly identifies 1 duplicate external_id");

  // 2.2 LineString road geometry validation
  const testRoads = [
    {
      osm_id: 201,
      geometry: {
        type: "LineString",
        coordinates: [
          [112.71, -7.44],
          [112.72, -7.45],
        ],
      },
      highway_type: "motorway",
    },
    {
      osm_id: 202,
      geometry: {
        type: "LineString",
        coordinates: [[112.71, -7.44]], // Invalid: only 1 point!
      },
      highway_type: "motorway",
    },
  ];

  const roadValRes = spatialValidationService.validateRoads(testRoads);
  assert(roadValRes.validRoads.length === 1, "LineString validation rejects single-point or corrupt polylines");
  assert(roadValRes.report.invalidCount === 1, "Correctly flags single-point LineString as INVALID");

  // ---------------------------------------------------------------------------
  // TEST SUITE 3: Snapshot Storage & SHA-256 Manifest Checksums
  // ---------------------------------------------------------------------------
  console.log("\n📌 [SUITE 3] Snapshot Storage & SHA-256 Manifest Checksums");

  const sampleGeoJson = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [112.7183, -7.4478] },
        properties: { name: "Test Artifact Feature", id: "osm:node:99901" },
      },
    ],
  };

  const snapshotRes = await spatialSnapshotService.saveGeoJsonSnapshot("poi", 999, sampleGeoJson);
  assert(fs.existsSync(snapshotRes.filePath), "GeoJSON intermediate snapshot successfully written to disk");
  assert(snapshotRes.checksum.length === 64, "SHA-256 checksum generated with length 64");

  const manifestPath = await spatialSnapshotService.saveManifest("poi", 999, {
    dataset: "poi",
    version: 999,
    source: "Automated Regression Test Suite",
    fetched_at: new Date().toISOString(),
    feature_count: 1,
    checksum_sha256: snapshotRes.checksum,
    validation_status: "VALIDATED",
    status: "STAGING",
  });
  assert(fs.existsSync(manifestPath), "Manifest JSON artifact successfully written to disk");

  const readManifest = await spatialSnapshotService.readManifest(manifestPath);
  assert(readManifest.checksum_sha256 === snapshotRes.checksum, "Manifest checksum matches snapshot checksum exactly");

  try {
    fs.unlinkSync(snapshotRes.filePath);
    fs.unlinkSync(manifestPath);
  } catch {}

  // ---------------------------------------------------------------------------
  // TEST SUITE 4: DATA LIFECYCLE RECONCILIATION & PHYSICAL ROLLBACK
  // (Mencakup TEST 1, TEST 2, TEST 3, TEST 4, TEST 5, TEST 6, TEST 7, TEST 8)
  // ---------------------------------------------------------------------------
  console.log("\n📌 [SUITE 4] Data Lifecycle: Reconciliation (Tombstoning) & Physical Rollback");

  const v1Num = 8801;
  const v2Num = 8802;

  // Cleanup test versions if left over
  await pool.query("DELETE FROM dataset_versions WHERE dataset_type = 'POI' AND version IN ($1, $2);", [v1Num, v2Num]);
  await pool.query("DELETE FROM pois WHERE external_id IN ('osm:node:test-a', 'osm:node:test-b', 'osm:node:test-c', 'osm:node:test-d');");

  // Step 4.1: Create V1 with POI [A, B, C]
  const geojsonV1 = {
    type: "FeatureCollection",
    features: [
      { type: "Feature", geometry: { type: "Point", coordinates: [112.718, -7.447] }, properties: { id: "osm:node:test-a", name: "POI A", category: "CAFE" } },
      { type: "Feature", geometry: { type: "Point", coordinates: [112.719, -7.448] }, properties: { id: "osm:node:test-b", name: "POI B", category: "RESTAURANT" } },
      { type: "Feature", geometry: { type: "Point", coordinates: [112.720, -7.449] }, properties: { id: "osm:node:test-c", name: "POI C", category: "WARUNG" } },
    ],
  };

  const snapV1 = await spatialSnapshotService.saveGeoJsonSnapshot("poi", v1Num, geojsonV1);
  const manifestV1Path = await spatialSnapshotService.saveManifest("poi", v1Num, {
    dataset: "poi",
    version: v1Num,
    source: "REGRESSION_TEST",
    fetched_at: new Date().toISOString(),
    feature_count: 3,
    checksum_sha256: snapV1.checksum,
    validation_status: "VALIDATED",
    status: "STAGING",
  });

  const version1 = await datasetVersionRepository.createVersion({
    dataset_type: "POI",
    version: v1Num,
    status: "STAGING",
    source: "REGRESSION_TEST",
    feature_count: 3,
    checksum: snapV1.checksum,
    snapshot_path: snapV1.filePath,
    manifest_path: manifestV1Path,
  });

  for (const f of geojsonV1.features) {
    await pool.query(`
      INSERT INTO pois_staging (version_id, external_id, name, category, latitude, longitude, geom, validation_status)
      VALUES ($1, $2, $3, $4, $5, $6, ST_SetSRID(ST_MakePoint($6, $5), 4326), 'VALID');
    `, [version1.id, f.properties.id, f.properties.name, f.properties.category, f.geometry.coordinates[1], f.geometry.coordinates[0]]);
  }

  // Promote V1
  await datasetPromotionService.promoteVersion(version1.id);

  // Step 4.2: Create V2 with POI [A, B, D] (C is missing / deleted in OSM)
  const geojsonV2 = {
    type: "FeatureCollection",
    features: [
      { type: "Feature", geometry: { type: "Point", coordinates: [112.718, -7.447] }, properties: { id: "osm:node:test-a", name: "POI A (Updated)", category: "CAFE" } },
      { type: "Feature", geometry: { type: "Point", coordinates: [112.719, -7.448] }, properties: { id: "osm:node:test-b", name: "POI B", category: "RESTAURANT" } },
      { type: "Feature", geometry: { type: "Point", coordinates: [112.721, -7.450] }, properties: { id: "osm:node:test-d", name: "POI D", category: "MARKET" } },
    ],
  };

  const snapV2 = await spatialSnapshotService.saveGeoJsonSnapshot("poi", v2Num, geojsonV2);
  const manifestV2Path = await spatialSnapshotService.saveManifest("poi", v2Num, {
    dataset: "poi",
    version: v2Num,
    source: "REGRESSION_TEST",
    fetched_at: new Date().toISOString(),
    feature_count: 3,
    checksum_sha256: snapV2.checksum,
    validation_status: "VALIDATED",
    status: "STAGING",
  });

  const version2 = await datasetVersionRepository.createVersion({
    dataset_type: "POI",
    version: v2Num,
    status: "STAGING",
    source: "REGRESSION_TEST",
    feature_count: 3,
    checksum: snapV2.checksum,
    snapshot_path: snapV2.filePath,
    manifest_path: manifestV2Path,
  });

  for (const f of geojsonV2.features) {
    await pool.query(`
      INSERT INTO pois_staging (version_id, external_id, name, category, latitude, longitude, geom, validation_status)
      VALUES ($1, $2, $3, $4, $5, $6, ST_SetSRID(ST_MakePoint($6, $5), 4326), 'VALID');
    `, [version2.id, f.properties.id, f.properties.name, f.properties.category, f.geometry.coordinates[1], f.geometry.coordinates[0]]);
  }

  // --- TEST 1: Promotion Reconciliation ---
  await datasetPromotionService.promoteVersion(version2.id);

  const checkV2A = await pool.query("SELECT is_active, status, operational_status FROM pois WHERE external_id = 'osm:node:test-a';");
  const checkV2B = await pool.query("SELECT is_active, status, operational_status FROM pois WHERE external_id = 'osm:node:test-b';");
  const checkV2D = await pool.query("SELECT is_active, status, operational_status FROM pois WHERE external_id = 'osm:node:test-d';");
  const checkV2C = await pool.query("SELECT is_active, status, operational_status FROM pois WHERE external_id = 'osm:node:test-c';");

  assert(
    checkV2A.rows[0]?.is_active === true &&
    checkV2B.rows[0]?.is_active === true &&
    checkV2D.rows[0]?.is_active === true,
    "TEST 1.1: Features in new version (A, B, D) are active in production (is_active = true)"
  );

  assert(
    checkV2C.rows[0]?.is_active === false &&
    checkV2C.rows[0]?.status === "INACTIVE" &&
    checkV2C.rows[0]?.operational_status === "RETIRED",
    "TEST 1.2: Feature missing from new version (C) is safely retired (is_active = false, operational_status = RETIRED)"
  );

  // --- TEST 7: Operational API Isolation for Deleted POI ---
  const allPoisFromRepo = await poiRepository.findAll();
  const foundRetiredC = allPoisFromRepo.find((p) => p.external_id === "osm:node:test-c");
  const foundActiveD = allPoisFromRepo.find((p) => p.external_id === "osm:node:test-d");
  assert(foundRetiredC === undefined, "TEST 7: Retired POI (C) does NOT appear in poiRepository.findAll()");
  assert(foundActiveD !== undefined, "TEST 7: Active POI (D) appears in poiRepository.findAll()");

  // --- TEST 2: Physical Rollback to V1 ---
  const rollbackV1Res = await datasetPromotionService.rollbackToVersion(version1.id);
  assert(rollbackV1Res.success === true, "TEST 2.1: Physical rollback to V1 succeeds");

  const checkV1A = await pool.query("SELECT is_active, operational_status FROM pois WHERE external_id = 'osm:node:test-a';");
  const checkV1B = await pool.query("SELECT is_active, operational_status FROM pois WHERE external_id = 'osm:node:test-b';");
  const checkV1C = await pool.query("SELECT is_active, operational_status FROM pois WHERE external_id = 'osm:node:test-c';");
  const checkV1D = await pool.query("SELECT is_active, operational_status FROM pois WHERE external_id = 'osm:node:test-d';");

  assert(
    checkV1A.rows[0]?.is_active === true &&
    checkV1B.rows[0]?.is_active === true &&
    checkV1C.rows[0]?.is_active === true &&
    checkV1C.rows[0]?.operational_status === "ELIGIBLE",
    "TEST 2.2: Rollback physically reactivated C (is_active = true, operational_status = ELIGIBLE)"
  );

  assert(
    checkV1D.rows[0]?.is_active === false &&
    checkV1D.rows[0]?.operational_status === "RETIRED",
    "TEST 2.3: Rollback physically retired D which was not in V1 (is_active = false, operational_status = RETIRED)"
  );

  // --- TEST 6: Rollback Idempotency ---
  const idempotentRollback = await datasetPromotionService.rollbackToVersion(version1.id);
  assert(idempotentRollback.success === true, "TEST 6: Calling rollback twice to the same version is cleanly idempotent");

  // --- TEST 3: Snapshot Checksum Invalid ---
  // Modify V2 snapshot file without updating manifest to simulate corruption
  fs.writeFileSync(snapV2.filePath, JSON.stringify({ type: "FeatureCollection", features: [] }), "utf8");

  let checksumErrorCaught = false;
  try {
    await datasetPromotionService.rollbackToVersion(version2.id);
  } catch (err: any) {
    if (err.message.includes("SNAPSHOT_CHECKSUM_INVALID")) {
      checksumErrorCaught = true;
    }
  }
  const currentActivePoi = await datasetVersionRepository.findActiveVersion("POI");
  assert(checksumErrorCaught === true, "TEST 3.1: Corrupt snapshot with invalid checksum is rejected");
  assert(currentActivePoi?.id === version1.id, "TEST 3.2: Active version remains untouched (V1) after rejected corrupt rollback");

  // --- TEST 4: Snapshot File Missing ---
  fs.unlinkSync(snapV2.filePath);

  let missingFileErrorCaught = false;
  try {
    await datasetPromotionService.rollbackToVersion(version2.id);
  } catch (err: any) {
    if (err.message.includes("SNAPSHOT_FILE_MISSING")) {
      missingFileErrorCaught = true;
    }
  }
  const activePoiAfterMissing = await datasetVersionRepository.findActiveVersion("POI");
  assert(missingFileErrorCaught === true, "TEST 4.1: Missing snapshot file is rejected with SNAPSHOT_FILE_MISSING");
  assert(activePoiAfterMissing?.id === version1.id, "TEST 4.2: Active version remains safe after missing file abort");

  // --- TEST 5: Database Error During Restore ---
  let invalidVersionError = false;
  try {
    await datasetPromotionService.rollbackToVersion("00000000-0000-0000-0000-000000000000");
  } catch {
    invalidVersionError = true;
  }
  const activePoiAfterDbError = await datasetVersionRepository.findActiveVersion("POI");
  assert(invalidVersionError === true, "TEST 5.1: Non-existent version ID aborts safely");
  assert(activePoiAfterDbError?.id === version1.id, "TEST 5.2: Active version remains safe (transaction rolled back)");

  // --- TEST 8: Road Reconciliation & Operational API Isolation ---
  const vToll1Num = 7701;
  const vToll2Num = 7702;
  await pool.query("DELETE FROM dataset_versions WHERE dataset_type = 'TOLL_ROADS' AND version IN ($1, $2);", [vToll1Num, vToll2Num]);
  await pool.query("DELETE FROM protocol_roads WHERE external_id IN ('osm:way:toll-a', 'osm:way:toll-b');");

  // Toll V1 with [Toll A, Toll B]
  const tollGeojsonV1 = {
    type: "FeatureCollection",
    features: [
      { type: "Feature", geometry: { type: "LineString", coordinates: [[112.71, -7.44], [112.72, -7.45]] }, properties: { id: "osm:way:toll-a", name: "Toll A", highway: "motorway", restriction_type: "PROHIBITED_TOLL_ROAD" } },
      { type: "Feature", geometry: { type: "LineString", coordinates: [[112.72, -7.45], [112.73, -7.46]] }, properties: { id: "osm:way:toll-b", name: "Toll B", highway: "motorway", restriction_type: "PROHIBITED_TOLL_ROAD" } },
    ],
  };

  const snapTollV1 = await spatialSnapshotService.saveGeoJsonSnapshot("toll_roads", vToll1Num, tollGeojsonV1);
  const manifestTollV1 = await spatialSnapshotService.saveManifest("toll_roads", vToll1Num, {
    dataset: "toll_roads",
    version: vToll1Num,
    source: "REGRESSION_TEST",
    fetched_at: new Date().toISOString(),
    feature_count: 2,
    checksum_sha256: snapTollV1.checksum,
    validation_status: "VALIDATED",
    status: "STAGING",
  });

  const versionToll1 = await datasetVersionRepository.createVersion({
    dataset_type: "TOLL_ROADS",
    version: vToll1Num,
    status: "STAGING",
    source: "REGRESSION_TEST",
    feature_count: 2,
    checksum: snapTollV1.checksum,
    snapshot_path: snapTollV1.filePath,
    manifest_path: manifestTollV1,
  });

  for (const f of tollGeojsonV1.features) {
    await pool.query(`
      INSERT INTO protocol_roads_staging (version_id, external_id, name, highway_type, restriction_type, geom, validation_status)
      VALUES ($1, $2, $3, $4, $5, ST_SetSRID(ST_GeomFromGeoJSON($6), 4326), 'VALID');
    `, [versionToll1.id, f.properties.id, f.properties.name, f.properties.highway, f.properties.restriction_type, JSON.stringify(f.geometry)]);
  }

  await datasetPromotionService.promoteVersion(versionToll1.id);

  // Toll V2 with [Toll A] only (Toll B was decommissioned/deleted in OSM)
  const tollGeojsonV2 = {
    type: "FeatureCollection",
    features: [
      { type: "Feature", geometry: { type: "LineString", coordinates: [[112.71, -7.44], [112.72, -7.45]] }, properties: { id: "osm:way:toll-a", name: "Toll A (Updated)", highway: "motorway", restriction_type: "PROHIBITED_TOLL_ROAD" } },
    ],
  };

  const snapTollV2 = await spatialSnapshotService.saveGeoJsonSnapshot("toll_roads", vToll2Num, tollGeojsonV2);
  const manifestTollV2 = await spatialSnapshotService.saveManifest("toll_roads", vToll2Num, {
    dataset: "toll_roads",
    version: vToll2Num,
    source: "REGRESSION_TEST",
    fetched_at: new Date().toISOString(),
    feature_count: 1,
    checksum_sha256: snapTollV2.checksum,
    validation_status: "VALIDATED",
    status: "STAGING",
  });

  const versionToll2 = await datasetVersionRepository.createVersion({
    dataset_type: "TOLL_ROADS",
    version: vToll2Num,
    status: "STAGING",
    source: "REGRESSION_TEST",
    feature_count: 1,
    checksum: snapTollV2.checksum,
    snapshot_path: snapTollV2.filePath,
    manifest_path: manifestTollV2,
  });

  for (const f of tollGeojsonV2.features) {
    await pool.query(`
      INSERT INTO protocol_roads_staging (version_id, external_id, name, highway_type, restriction_type, geom, validation_status)
      VALUES ($1, $2, $3, $4, $5, ST_SetSRID(ST_GeomFromGeoJSON($6), 4326), 'VALID');
    `, [versionToll2.id, f.properties.id, f.properties.name, f.properties.highway, f.properties.restriction_type, JSON.stringify(f.geometry)]);
  }

  await datasetPromotionService.promoteVersion(versionToll2.id);

  const tollRoadsGeoJson = await roadService.getTollRoadsGeoJson();
  const tollBInGeoJson = tollRoadsGeoJson.features.find((f: any) => f.properties.id === "osm:way:toll-b");
  const tollAInGeoJson = tollRoadsGeoJson.features.find((f: any) => f.properties.id === "osm:way:toll-a");

  assert(tollBInGeoJson === undefined, "TEST 8.1: Decommissioned toll road (B) does NOT appear in getTollRoadsGeoJson()");
  assert(tollAInGeoJson !== undefined, "TEST 8.2: Active toll road (A) appears in getTollRoadsGeoJson()");

  // Restore initial baseline version for POI & Toll
  const baselinePoi = await pool.query("SELECT id FROM dataset_versions WHERE dataset_type = 'POI' AND version = 1;");
  if (baselinePoi.rows[0]?.id) {
    await datasetPromotionService.rollbackToVersion(baselinePoi.rows[0].id);
  }

  const baselineToll = await pool.query("SELECT id FROM dataset_versions WHERE dataset_type = 'TOLL_ROADS' AND version = 1;");
  if (baselineToll.rows[0]?.id) {
    await datasetPromotionService.rollbackToVersion(baselineToll.rows[0].id);
  }

  // Clean up test versions
  await pool.query("DELETE FROM dataset_versions WHERE dataset_type = 'POI' AND version IN ($1, $2);", [v1Num, v2Num]);
  await pool.query("DELETE FROM dataset_versions WHERE dataset_type = 'TOLL_ROADS' AND version IN ($1, $2);", [vToll1Num, vToll2Num]);
  await pool.query("DELETE FROM pois WHERE external_id IN ('osm:node:test-a', 'osm:node:test-b', 'osm:node:test-c', 'osm:node:test-d');");
  await pool.query("DELETE FROM protocol_roads WHERE external_id IN ('osm:way:toll-a', 'osm:way:toll-b');");

  try {
    fs.unlinkSync(snapV1.filePath);
    fs.unlinkSync(manifestV1Path);
    if (fs.existsSync(snapV2.filePath)) fs.unlinkSync(snapV2.filePath);
    fs.unlinkSync(manifestV2Path);
    fs.unlinkSync(snapTollV1.filePath);
    fs.unlinkSync(manifestTollV1);
    fs.unlinkSync(snapTollV2.filePath);
    fs.unlinkSync(manifestTollV2);
  } catch {}

  // ---------------------------------------------------------------------------
  // TEST SUITE 4B: True Compare-and-Swap (CAS) Concurrency Safety
  // (Mencakup TEST CAS-1, TEST CAS-2, TEST CAS-3, TEST CAS-4)
  // ---------------------------------------------------------------------------
  console.log("\n📌 [SUITE 4B] True Compare-and-Swap (CAS) & Single Active Invariant");

  const vCas1Num = 8901;
  const vCas2Num = 8902;
  const vCas3Num = 8903;
  const vCas4Num = 8904;

  await pool.query("DELETE FROM dataset_versions WHERE dataset_type = 'POI' AND version IN ($1, $2, $3, $4);", [vCas1Num, vCas2Num, vCas3Num, vCas4Num]);

  const activeBaselinePoi = await datasetVersionRepository.findActiveVersion("POI");
  const baselineId = activeBaselinePoi?.id;

  // CAS-1: Normal Promotion with matching expectedActiveVersionId
  const vCas1 = await datasetVersionRepository.createVersion({
    dataset_type: "POI",
    version: vCas1Num,
    status: "STAGING",
    source: "CAS_REGRESSION_TEST",
    feature_count: 1,
  });

  await pool.query(`
    INSERT INTO pois_staging (version_id, external_id, name, category, latitude, longitude, geom, validation_status)
    VALUES ($1, 'osm:node:cas-1', 'CAS Cafe 1', 'CAFE', -7.4478, 112.7183, ST_SetSRID(ST_MakePoint(112.7183, -7.4478), 4326), 'VALID');
  `, [vCas1.id]);

  const promoCas1 = await datasetPromotionService.promoteVersion(vCas1.id, baselineId);
  assert(promoCas1.success === true, "TEST CAS-1.1: Normal promotion succeeds when expectedActiveVersionId matches");
  
  const currentActiveCas1 = await datasetVersionRepository.findActiveVersion("POI");
  assert(currentActiveCas1?.id === vCas1.id, "TEST CAS-1.2: V_CAS_1 is now ACTIVE in database");

  // CAS-2: Stale Worker (Optimistic Concurrency Conflict)
  // Worker B produces V_CAS_2 and successfully promotes it from baseline V_CAS_1
  const vCas2 = await datasetVersionRepository.createVersion({
    dataset_type: "POI",
    version: vCas2Num,
    status: "STAGING",
    source: "CAS_REGRESSION_TEST",
    feature_count: 1,
  });
  await pool.query(`
    INSERT INTO pois_staging (version_id, external_id, name, category, latitude, longitude, geom, validation_status)
    VALUES ($1, 'osm:node:cas-2', 'CAS Cafe 2', 'CAFE', -7.4478, 112.7183, ST_SetSRID(ST_MakePoint(112.7183, -7.4478), 4326), 'VALID');
  `, [vCas2.id]);

  await datasetPromotionService.promoteVersion(vCas2.id, vCas1.id);
  const currentActiveCas2 = await datasetVersionRepository.findActiveVersion("POI");
  assert(currentActiveCas2?.id === vCas2.id, "TEST CAS-2.1: Worker B successfully promotes V_CAS_2 to ACTIVE");

  // Worker A attempts to promote V_CAS_3 with stale expectedActiveVersionId = V_CAS_1
  const vCas3 = await datasetVersionRepository.createVersion({
    dataset_type: "POI",
    version: vCas3Num,
    status: "STAGING",
    source: "CAS_REGRESSION_TEST",
    feature_count: 1,
  });
  await pool.query(`
    INSERT INTO pois_staging (version_id, external_id, name, category, latitude, longitude, geom, validation_status)
    VALUES ($1, 'osm:node:cas-3', 'CAS Cafe 3', 'CAFE', -7.4478, 112.7183, ST_SetSRID(ST_MakePoint(112.7183, -7.4478), 4326), 'VALID');
  `, [vCas3.id]);

  let conflictCaught = false;
  try {
    await datasetPromotionService.promoteVersion(vCas3.id, vCas1.id); // Stale expectation!
  } catch (err: any) {
    if (err.message.includes("OPTIMISTIC_CONCURRENCY_CONFLICT") || err.code === "CONCURRENCY_CONFLICT") {
      conflictCaught = true;
    }
  }

  assert(conflictCaught === true, "TEST CAS-2.2: Stale worker promotion rejected with OPTIMISTIC_CONCURRENCY_CONFLICT");

  const activeAfterConflict = await datasetVersionRepository.findActiveVersion("POI");
  assert(activeAfterConflict?.id === vCas2.id, "TEST CAS-2.3: Active version remains V_CAS_2 (not overwritten by stale worker)");

  const vCas3Record = await datasetVersionRepository.findById(vCas3.id);
  assert(vCas3Record?.status !== "ACTIVE", "TEST CAS-2.4: Rejected version V_CAS_3 is NOT active");

  // CAS-3: Single Active Database Invariant (Enforced by partial unique index)
  let invariantErrorCaught = false;
  try {
    // Attempt raw SQL to force a second version to have status = 'ACTIVE'
    await pool.query("UPDATE dataset_versions SET status = 'ACTIVE' WHERE id = $1;", [vCas1.id]);
  } catch (err: any) {
    if (err.code === "23505" || err.message.includes("uq_dataset_versions_single_active")) {
      invariantErrorCaught = true;
    }
  }
  assert(invariantErrorCaught === true, "TEST CAS-3.1: Partial unique index uq_dataset_versions_single_active rejects multiple ACTIVE versions");

  const countActivePoi = await pool.query("SELECT COUNT(*)::int AS count FROM dataset_versions WHERE dataset_type = 'POI' AND status = 'ACTIVE';");
  assert(countActivePoi.rows[0]?.count === 1, "TEST CAS-3.2: Database strictly guarantees exactly 1 ACTIVE version");

  // CAS-4: Transaction Failure Safe Rollback
  const vCas4 = await datasetVersionRepository.createVersion({
    dataset_type: "POI",
    version: vCas4Num,
    status: "STAGING",
    source: "CAS_REGRESSION_TEST",
    feature_count: 1,
  });

  // Corrupt geometry in staging to trigger quality gate abort
  await pool.query(`
    INSERT INTO pois_staging (version_id, external_id, name, category, latitude, longitude, geom, validation_status)
    VALUES ($1, 'osm:node:cas-4', 'Corrupt Cafe', 'CAFE', -7.4478, 112.7183, NULL, 'INVALID');
  `, [vCas4.id]);

  let qualityGateError = false;
  try {
    await datasetPromotionService.promoteVersion(vCas4.id, vCas2.id);
  } catch {
    qualityGateError = true;
  }
  assert(qualityGateError === true, "TEST CAS-4.1: Promotion aborted due to PostGIS quality gate failure");

  const activeAfterQualityGate = await datasetVersionRepository.findActiveVersion("POI");
  assert(activeAfterQualityGate?.id === vCas2.id, "TEST CAS-4.2: Previously active version V_CAS_2 remains untouched (Transaction rolled back)");

  // Restore baseline
  if (baselineId) {
    await pool.query("UPDATE dataset_versions SET status = 'RETIRED' WHERE dataset_type = 'POI';");
    await pool.query("UPDATE dataset_versions SET status = 'ACTIVE' WHERE id = $1;", [baselineId]);
  }
  await pool.query("DELETE FROM dataset_versions WHERE dataset_type = 'POI' AND version IN ($1, $2, $3, $4);", [vCas1Num, vCas2Num, vCas3Num, vCas4Num]);
  await pool.query("DELETE FROM pois WHERE external_id IN ('osm:node:cas-1', 'osm:node:cas-2', 'osm:node:cas-3', 'osm:node:cas-4');");

  // ---------------------------------------------------------------------------
  // TEST SUITE 4C: Dynamic Operational Boundary & Multi-City Readiness
  // (Mencakup TEST BBOX-1, TEST BBOX-2, TEST BBOX-3, TEST BBOX-4)
  // ---------------------------------------------------------------------------
  console.log("\n📌 [SUITE 4C] Dynamic Operational Boundary & Multi-City Readiness");

  // TEST BBOX-1: City Presets Resolution
  const sbyBbox = await spatialValidationService.resolveBoundingBox("Surabaya");
  assert(
    sbyBbox.minLon === 112.58 && sbyBbox.maxLat === -7.18,
    "TEST BBOX-1.1: Successfully resolves Surabaya preset bounding box"
  );

  const mlgBbox = await spatialValidationService.resolveBoundingBox("Malang");
  assert(
    mlgBbox.minLon === 112.55 && mlgBbox.maxLat === -7.90,
    "TEST BBOX-1.2: Successfully resolves Malang preset bounding box"
  );

  // TEST BBOX-2: Multi-City POI Validation with Custom Bounding Box
  const testSurabayaPois = [
    {
      external_id: "osm:node:tunjungan-plaza",
      name: "Tunjungan Plaza Surabaya",
      category: "MALL",
      latitude: -7.2625,
      longitude: 112.7385,
    },
    {
      external_id: "osm:node:monumen-kapal-selam",
      name: "Monumen Kapal Selam",
      category: "TOURISM",
      latitude: -7.2655,
      longitude: 112.7505,
    },
  ];

  // Validation with Sidoarjo strict BBox rejects Surabaya points as OUT_OF_OPERATIONAL_BOUNDS
  const sidoarjoStrictBbox = { minLon: 112.50, maxLon: 112.85, minLat: -7.58, maxLat: -7.33 };
  const sdaValidation = spatialValidationService.validatePois(testSurabayaPois, sidoarjoStrictBbox);
  assert(
    sdaValidation.report.outOfBoundsCount === 2 && sdaValidation.validPois.length === 0,
    "TEST BBOX-2.1: Surabaya coordinates are accurately rejected when Sidoarjo strict BBox is active"
  );

  // Validation with Surabaya BBox accepts Surabaya points
  const sbyValidation = spatialValidationService.validatePois(testSurabayaPois, sbyBbox);
  assert(
    sbyValidation.report.validCount === 2 && sbyValidation.report.outOfBoundsCount === 0,
    "TEST BBOX-2.2: Surabaya coordinates are successfully validated when Surabaya dynamic BBox is active"
  );

  // TEST BBOX-3: Distant Coordinates Rejection against Dynamic BBox
  const testJakartaPoi = [
    {
      external_id: "osm:node:monas-jakarta",
      name: "Monas Jakarta",
      category: "HISTORIC",
      latitude: -6.1754,
      longitude: 106.8272,
    },
  ];
  const jktValidation = spatialValidationService.validatePois(testJakartaPoi, sbyBbox);
  assert(
    jktValidation.report.outOfBoundsCount === 1,
    "TEST BBOX-3: Jakarta coordinates are rejected as out of bounds against active Surabaya BBox"
  );

  // TEST BBOX-4: Protocol Roads Pipeline Dataset Independence & Promotion
  const protoVersionNum = 6601;
  await pool.query("DELETE FROM dataset_versions WHERE dataset_type = 'PROTOCOL_ROADS' AND version = $1;", [protoVersionNum]);

  const activeBaselineProto = await datasetVersionRepository.findActiveVersion("PROTOCOL_ROADS");
  const baselineProtoId = activeBaselineProto?.id;

  const vProto = await datasetVersionRepository.createVersion({
    dataset_type: "PROTOCOL_ROADS",
    version: protoVersionNum,
    status: "STAGING",
    source: "DYNAMIC_BBOX_TEST",
    feature_count: 1,
  });

  const testProtoLine = {
    type: "LineString",
    coordinates: [
      [112.7100, -7.4500],
      [112.7200, -7.4600],
    ],
  };

  await pool.query(`
    INSERT INTO protocol_roads_staging (
      version_id, external_id, name, highway_type, restriction_type, geom, validation_status
    ) VALUES (
      $1, 'osm:way:proto-test-1', 'Jalan Pahlawan Protokol', 'primary', 'PROHIBITED_ROAD',
      ST_SetSRID(ST_GeomFromGeoJSON($2), 4326), 'VALID'
    );
  `, [vProto.id, JSON.stringify(testProtoLine)]);

  const promoProto = await datasetPromotionService.promoteVersion(vProto.id, baselineProtoId);
  assert(promoProto.success === true, "TEST BBOX-4.1: PROTOCOL_ROADS version successfully promoted via CAS");

  const currentActiveProto = await datasetVersionRepository.findActiveVersion("PROTOCOL_ROADS");
  assert(currentActiveProto?.id === vProto.id, "TEST BBOX-4.2: PROTOCOL_ROADS is now ACTIVE in database");

  const protoRows = await pool.query(
    "SELECT external_id, is_active FROM protocol_roads WHERE external_id = 'osm:way:proto-test-1';"
  );
  assert(
    protoRows.rows.length === 1 && protoRows.rows[0].is_active === true,
    "TEST BBOX-4.3: Promoted protocol road segment is active in master table"
  );

  // Ensure TOLL_ROADS active version and records remain untouched
  const tollActiveAfterProto = await datasetVersionRepository.findActiveVersion("TOLL_ROADS");
  assert(
    tollActiveAfterProto !== null && tollActiveAfterProto.status === "ACTIVE",
    "TEST BBOX-4.4: TOLL_ROADS dataset status completely unimpacted by PROTOCOL_ROADS promotion"
  );

  // Restore protocol roads baseline
  if (baselineProtoId) {
    await pool.query("UPDATE dataset_versions SET status = 'RETIRED' WHERE dataset_type = 'PROTOCOL_ROADS';");
    await pool.query("UPDATE dataset_versions SET status = 'ACTIVE' WHERE id = $1;", [baselineProtoId]);
    await pool.query("UPDATE protocol_roads SET is_active = true WHERE (restriction_type = 'PROHIBITED_ROAD' OR restriction_type IS NULL);");
  }
  await pool.query("DELETE FROM dataset_versions WHERE dataset_type = 'PROTOCOL_ROADS' AND version = $1;", [protoVersionNum]);
  await pool.query("DELETE FROM protocol_roads WHERE external_id = 'osm:way:proto-test-1';");

  // ---------------------------------------------------------------------------
  // TEST SUITE 5: Safe Redis Distributed Lock with UUID, Heartbeat, and Safe Release
  // (Mencakup TEST LOCK-1, TEST LOCK-2, TEST LOCK-3, TEST LOCK-4, TEST LOCK-5, TEST LOCK-6, TEST LOCK-7)
  // ---------------------------------------------------------------------------
  console.log("\n📌 [SUITE 5] Safe Redis Distributed Lock (Ownership, Heartbeat & Recovery)");

  // Ensure key is clean before suite
  await redisClient.del("lock:sync:poi");
  await redisClient.del("lock:sync:toll_roads");

  // TEST LOCK-1: Unique Ownership Token
  const lockA = await acquireSyncLock("POI", 5000);
  const lockB = await acquireSyncLock("POI", 5000);

  assert(lockA.acquired === true && typeof lockA.token === "string" && lockA.token.length > 0, "TEST LOCK-1.1: Worker A successfully acquires lock with unique UUID token");
  assert(lockB.acquired === false && lockB.token === null, "TEST LOCK-1.2: Concurrent Worker B is locked out (returns acquired = false, token = null)");

  // TEST LOCK-2: Wrong Owner Release Rejection
  const fakeToken = crypto.randomUUID();
  const wrongOwnerRelease = await releaseSyncLock("POI", fakeToken);
  assert(wrongOwnerRelease === false, "TEST LOCK-2.1: Release attempt with wrong token is rejected (Lua returns 0)");

  const currentKeyVal = await redisClient.get("lock:sync:poi");
  assert(currentKeyVal === lockA.token, "TEST LOCK-2.2: Lock key remains safely owned by Worker A");

  // TEST LOCK-3: Expired Lock Race / Foreign Release Prevention
  // Simulate lock A expired in Redis and Worker B acquired it with token B
  const tokenB = crypto.randomUUID();
  await redisClient.set("lock:sync:poi", tokenB, { PX: 5000 });

  // Worker A attempts to release using old token A
  const lateReleaseA = await releaseSyncLock("POI", lockA.token!);
  assert(lateReleaseA === false, "TEST LOCK-3.1: Stale Worker A release attempt rejected");

  const keyAfterLateRelease = await redisClient.get("lock:sync:poi");
  assert(keyAfterLateRelease === tokenB, "TEST LOCK-3.2: Worker B lock was NOT destroyed by Worker A safe release");
  await releaseSyncLock("POI", tokenB);

  // TEST LOCK-4: Lease Renewal Heartbeat
  const lockHeartbeat = await acquireSyncLock("POI", 500); // 500ms initial TTL
  assert(lockHeartbeat.acquired === true, "TEST LOCK-4.1: Acquire lock with short TTL (500ms)");

  const leaseH = new SyncLockLease("POI", lockHeartbeat.token!, 500, 150); // Heartbeat every 150ms
  leaseH.startHeartbeat();

  // Wait 700ms (exceeding initial 500ms TTL!)
  await new Promise((resolve) => setTimeout(resolve, 700));

  const stillValidAfterHeartbeat = await leaseH.verify();
  assert(stillValidAfterHeartbeat === true, "TEST LOCK-4.2: Lock lease successfully maintained active past initial TTL via heartbeat");
  await leaseH.release();

  // TEST LOCK-5: Lost Ownership Detection
  const lockLostTest = await acquireSyncLock("POI", 5000);
  const leaseLost = new SyncLockLease("POI", lockLostTest.token!, 5000, 100);

  // Simulate eviction or foreign token takeover
  await redisClient.set("lock:sync:poi", "foreign-usurper-token");

  const verifyLost = await leaseLost.verify();
  assert(verifyLost === false && leaseLost.isLost() === true, "TEST LOCK-5: Worker detects lost lock ownership and marks lease as lost");
  await redisClient.del("lock:sync:poi");

  // TEST LOCK-6: Worker Crash Recovery
  const lockCrash = await acquireSyncLock("POI", 300); // 300ms TTL
  assert(lockCrash.acquired === true, "TEST LOCK-6.1: Crashed worker acquires lock without explicit release");

  // Wait 450ms for crash expiration
  await new Promise((resolve) => setTimeout(resolve, 450));

  const lockNewWorker = await acquireSyncLock("POI", 5000);
  assert(lockNewWorker.acquired === true, "TEST LOCK-6.2: New worker successfully acquires lock after crashed worker TTL expiration");
  await releaseSyncLock("POI", lockNewWorker.token!);

  // TEST LOCK-7: Different Dataset Granularity Isolation
  const lockPoi = await acquireSyncLock("POI", 5000);
  const lockToll = await acquireSyncLock("TOLL_ROADS", 5000);

  assert(
    lockPoi.acquired === true && lockToll.acquired === true,
    "TEST LOCK-7: POI and TOLL_ROADS locks operate independently without mutual blockage"
  );

  await releaseSyncLock("POI", lockPoi.token!);
  await releaseSyncLock("TOLL_ROADS", lockToll.token!);

  // ---------------------------------------------------------------------------
  // TEST SUITE 6: REST API Security, Endpoints & Role Authorization Guard
  // ---------------------------------------------------------------------------
  console.log("\n📌 [SUITE 6] REST API Security & Endpoint Verification");

  // 6.1 Public/Auth Road Endpoints return GeoJSON FeatureCollection from PostGIS
  const protocolRoadRes = await fetch(`${BASE_URL}/roads/protocol`);
  const protocolData = (await protocolRoadRes.json()) as any;
  assert(
    protocolRoadRes.status === 200 && protocolData.type === "FeatureCollection",
    "GET /api/roads/protocol returns valid GeoJSON FeatureCollection from PostGIS"
  );

  const tollRoadRes = await fetch(`${BASE_URL}/roads/toll`);
  const tollData = (await tollRoadRes.json()) as any;
  assert(
    tollRoadRes.status === 200 && tollData.type === "FeatureCollection",
    "GET /api/roads/toll returns valid GeoJSON FeatureCollection from PostGIS"
  );

  // 6.2 POST /api/data-sync/trigger without authentication must be rejected (401)
  const unauthTriggerRes = await fetch(`${BASE_URL}/data-sync/trigger`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dataset_type: "POI" }),
  });
  assert(unauthTriggerRes.status === 401, "POST /api/data-sync/trigger without auth rejected with 401 Unauthorized");

  // 6.3 Login as Superadmin to test authorized data-sync endpoints
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: "superadmin@kopikeliling.com", password: "password123" }),
  });
  const loginData = (await loginRes.json()) as any;
  const token = loginData.token;

  if (token) {
    // 6.4 Query Version History via API
    const versionsRes = await fetch(`${BASE_URL}/data-sync/versions/POI`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const versionsData = (await versionsRes.json()) as any;
    assert(
      versionsRes.status === 200 && versionsData.status === "success" && Array.isArray(versionsData.versions),
      "GET /api/data-sync/versions/POI returns version history with status and active version"
    );
  } else {
    console.warn("⚠️ Could not authenticate Superadmin for suite 6.4");
  }

  // ---------------------------------------------------------------------------
  // TEST SUMMARY
  // ---------------------------------------------------------------------------
  console.log("\n================================================================================");
  console.log(`📊 TEST RESULTS: ${testsPassed} PASSED | ${testsFailed} FAILED`);
  console.log("================================================================================");

  if (testsFailed === 0) {
    console.log("🎉 ALL MOVA SPATIAL DATA PIPELINE ARCHITECTURAL INVARIANTS SATISFIED!\n");
  } else {
    console.error("❌ Some regression tests failed.\n");
    process.exit(1);
  }

  process.exit(0);
}

runRegressionSuite().catch((err) => {
  console.error("💥 Unhandled regression test error:", err);
  process.exit(1);
});
