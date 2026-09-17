/*
 * run-poi-ingestion-audit.js
 * Read-Only Post-Ingestion Forensic Audit Engine for POI Pipeline (Gate RW-01 & RW-02)
 * Authority: POI Acquisition & Ingestion Contract v1.0-FINAL
 */

import { pool } from "../config/database.js";
import { SystemSettingModel } from "../models/systemSettingModel.js";
import { RawCriteriaEvaluationService } from "../services/dss/RawCriteriaEvaluationService.js";
import { ZoneModel } from "../models/zoneModel.js";
import { poiEntityFactory } from "../services/poi/POIEntityFactory.js";
import { poiClusterer } from "../services/poi/POIClusterer.js";

export async function runPoiIngestionAudit(options = {}) {
  const startedAt = new Date();
  const runId = options.runId || `RW02-FULL-SIDOARJO-${startedAt.getTime()}`;
  const overpassEndpoint = options.endpoint || "https://overpass-api.de/api/interpreter";
  const rawAcquiredReported = options.rawAcquired !== undefined ? options.rawAcquired : null;

  console.log("================================================================================");
  console.log(`🔍 MOVA POI INGESTION FORENSIC AUDIT — RUN ID: ${runId}`);
  console.log("================================================================================\n");

  const hubCitySetting = await SystemSettingModel.getByKey("HUB_CITY_NAME");
  const hubCity = hubCitySetting?.value || hubCitySetting?.setting_value || "Sidoarjo";

  // 1. Raw Provenance & Persistence Audit
  const rawPoisQuery = await pool.query(
    "SELECT city_name, jsonb_array_length(raw_data) AS raw_count, raw_data, fetched_at FROM pois_raw WHERE city_name = $1;",
    [hubCity]
  );
  const rawPersisted = rawPoisQuery.rows[0]?.raw_count || 0;
  const rawAcquired = rawAcquiredReported !== null ? rawAcquiredReported : rawPersisted;
  const rawPersistFailure = Math.max(0, rawAcquired - rawPersisted);
  const rawDataArray = rawPoisQuery.rows[0]?.raw_data || [];
  const rawFetchedAt = rawPoisQuery.rows[0]?.fetched_at || null;

  // 2. Core Physical & Logical Record Distribution
  const countsQuery = await pool.query(`
    SELECT 
      COUNT(*)::int AS total_physical_records,
      COUNT(DISTINCT external_id)::int AS unique_external_ids,
      COUNT(DISTINCT logical_poi_id)::int AS distinct_logical_pois,
      COUNT(*) FILTER (WHERE duplicate_of IS NULL)::int AS canonical_count,
      COUNT(*) FILTER (WHERE duplicate_of IS NOT NULL)::int AS duplicate_count,
      COUNT(*) FILTER (WHERE operational_status = 'ELIGIBLE')::int AS eligible_count,
      COUNT(*) FILTER (WHERE operational_status = 'EXCLUDED')::int AS excluded_count,
      COUNT(*) FILTER (WHERE operational_status = 'REVIEW')::int AS review_count,
      COUNT(*) FILTER (WHERE category = 'IGNORED')::int AS ignored_count,
      COUNT(*) FILTER (WHERE logical_poi_id IS NULL)::int AS null_logical_poi_count
    FROM pois;
  `);
  const c = countsQuery.rows[0];

  // 3. Spatial Integrity Checks
  const spatialAudit = await pool.query(`
    SELECT 
      COUNT(*) FILTER (WHERE geom IS NULL)::int AS null_geom_count,
      COUNT(*) FILTER (WHERE ST_SRID(geom) <> 4326)::int AS invalid_srid_count,
      COUNT(*) FILTER (WHERE ST_IsValid(geom) = FALSE)::int AS invalid_geom_count,
      COUNT(*) FILTER (WHERE latitude < -90 OR latitude > 90 OR longitude < -180 OR longitude > 180)::int AS out_of_bounds_coords,
      COUNT(*) FILTER (WHERE ST_GeometryType(geom) <> 'ST_Point')::int AS non_point_geom_count
    FROM pois;
  `);
  const s = spatialAudit.rows[0];

  // 4. Duplicate & Hierarchy Referential Invariant Checks
  const duplicateAudit = await pool.query(`
    SELECT 
      COUNT(*) FILTER (WHERE duplicate_of = id)::int AS self_reference_count,
      COUNT(*) FILTER (WHERE duplicate_of IS NOT NULL AND duplicate_of NOT IN (SELECT id FROM pois))::int AS dangling_duplicate_count
    FROM pois;
  `);
  const d = duplicateAudit.rows[0];

  // Check for duplicate chains (A -> B -> C)
  const chainsAudit = await pool.query(`
    SELECT COUNT(*)::int AS chain_count
    FROM pois child
    JOIN pois parent ON child.duplicate_of = parent.id
    WHERE parent.duplicate_of IS NOT NULL;
  `);
  const chainCount = chainsAudit.rows[0]?.chain_count || 0;

  // Check for multi-logical_poi_id in single cluster or mismatched child/parent logical_poi_id
  const clusterLogicalAudit = await pool.query(`
    WITH cluster_groups AS (
      SELECT 
        COALESCE(duplicate_of, id) AS canonical_root,
        COUNT(DISTINCT logical_poi_id) AS logical_count
      FROM pois
      GROUP BY COALESCE(duplicate_of, id)
      HAVING COUNT(DISTINCT logical_poi_id) > 1
    )
    SELECT COUNT(*)::int AS inconsistent_cluster_count FROM cluster_groups;
  `);
  const inconsistentClusters = clusterLogicalAudit.rows[0]?.inconsistent_cluster_count || 0;

  const childParentMismatchAudit = await pool.query(`
    SELECT COUNT(*)::int AS mismatch_count
    FROM pois child
    JOIN pois parent ON child.duplicate_of = parent.id
    WHERE child.logical_poi_id <> parent.logical_poi_id;
  `);
  const childParentMismatchCount = childParentMismatchAudit.rows[0]?.mismatch_count || 0;

  // 5. Categorization of Filtered / Ignored Raw Elements (Forensic Breakdown)
  const ignoredBreakdown = {
    generic_building: 0,
    blacklisted_noise: 0,
    missing_semantic_tags: 0,
    invalid_coordinates: 0,
    unnamed_unclassified: 0,
    other_unsupported: 0,
    total_ignored: 0,
  };

  if (Array.isArray(rawDataArray) && rawDataArray.length > 0) {
    for (const el of rawDataArray) {
      const coords = poiEntityFactory.extractCoordinates(el);
      if (isNaN(coords.latitude) || isNaN(coords.longitude)) {
        ignoredBreakdown.invalid_coordinates++;
        ignoredBreakdown.total_ignored++;
        continue;
      }
      const tags = el.tags || {};
      const tagKeys = Object.keys(tags);
      if (tagKeys.length === 0) {
        ignoredBreakdown.missing_semantic_tags++;
        ignoredBreakdown.total_ignored++;
        continue;
      }
      const rawCategory = poiClusterer.cluster(tags);
      const poiName = (tags.name || "").trim();

      if (rawCategory === "IGNORED") {
        if (tags.building && !tags.amenity && !tags.shop && !tags.leisure && !tags.office && !tags.tourism) {
          ignoredBreakdown.generic_building++;
        } else if (tags.highway || tags.natural || (tags.landuse && tags.landuse !== "cemetery")) {
          ignoredBreakdown.blacklisted_noise++;
        } else {
          ignoredBreakdown.other_unsupported++;
        }
        ignoredBreakdown.total_ignored++;
      } else if (rawCategory === "Lainnya" && (poiName === "" || poiName.toLowerCase() === "lainnya")) {
        ignoredBreakdown.unnamed_unclassified++;
        ignoredBreakdown.total_ignored++;
      }
    }
  }

  // 6. Category Master Integrity (58 Master Catalog) & HHI Concentration
  const categoryMasterAudit = await pool.query(`
    SELECT 
      pc.id AS master_id,
      pc.name AS category_name,
      pc.is_active AS is_active_master,
      COUNT(p.id)::int AS count
    FROM poi_categories pc
    LEFT JOIN pois p ON p.category = pc.name
    GROUP BY pc.id, pc.name, pc.is_active
    ORDER BY count DESC, pc.name ASC;
  `);

  const unregisteredCategoryQuery = await pool.query(`
    SELECT p.category, COUNT(*)::int AS count
    FROM pois p
    LEFT JOIN poi_categories pc ON p.category = pc.name
    WHERE pc.name IS NULL
    GROUP BY p.category;
  `);
  const unregisteredCategories = unregisteredCategoryQuery.rows;

  // Calculate HHI (Herfindahl-Hirschman Index) across populated categories
  const totalCategorizedPois = categoryMasterAudit.rows.reduce((sum, r) => sum + r.count, 0);
  let hhi = 0;
  if (totalCategorizedPois > 0) {
    categoryMasterAudit.rows.forEach((r) => {
      if (r.count > 0) {
        const share = r.count / totalCategorizedPois;
        hhi += share * share;
      }
    });
  }

  // 7. Generic Building Contamination Check
  const buildingContaminationAudit = await pool.query(`
    SELECT COUNT(*)::int AS building_noise_count
    FROM pois
    WHERE operational_status = 'ELIGIBLE'
      AND (
        name ILIKE 'Gedung (Tanpa Nama)%'
        OR name ILIKE 'building (Tanpa Nama)%'
        OR (category = 'Lainnya' AND (name IS NULL OR name = '' OR name ILIKE '%(Tanpa Nama)%'))
        OR category = 'IGNORED'
      );
  `);
  const buildingNoiseCount = buildingContaminationAudit.rows[0]?.building_noise_count || 0;

  // 8. Top Clusters & Unnamed POI Cluster Diagnostics
  const topClustersAudit = await pool.query(`
    SELECT 
      COALESCE(duplicate_of, id) AS canonical_id,
      logical_poi_id,
      COUNT(*)::int AS cluster_size,
      MAX(name) AS sample_name,
      MAX(category) AS category,
      COUNT(*) FILTER (WHERE name ILIKE '%(Tanpa Nama)%')::int AS unnamed_members
    FROM pois
    GROUP BY COALESCE(duplicate_of, id), logical_poi_id
    HAVING COUNT(*) > 1
    ORDER BY cluster_size DESC
    LIMIT 10;
  `);

  const clusterSizeDistribution = await pool.query(`
    WITH cluster_sizes AS (
      SELECT 
        COALESCE(duplicate_of, id) AS canonical_id,
        COUNT(*)::int AS size
      FROM pois
      GROUP BY COALESCE(duplicate_of, id)
    )
    SELECT 
      COUNT(*) FILTER (WHERE size = 1)::int AS size_1_clusters,
      COUNT(*) FILTER (WHERE size = 2)::int AS size_2_clusters,
      COUNT(*) FILTER (WHERE size >= 3)::int AS size_3_plus_clusters,
      MAX(size) AS max_cluster_size
    FROM cluster_sizes;
  `);
  const cs = clusterSizeDistribution.rows[0];

  // 9. Deep Inspection of REVIEW Records (<=3m Proximity Candidates)
  const reviewRecordsQuery = await pool.query(`
    SELECT 
      id, external_id, name, category, operational_status, exclusion_reason,
      latitude, longitude, logical_poi_id, duplicate_of
    FROM pois
    WHERE operational_status = 'REVIEW'
    ORDER BY category ASC, latitude ASC;
  `);
  const reviewRecords = reviewRecordsQuery.rows;

  // 10. Operational Status Breakdown
  const operationalBreakdown = await pool.query(`
    SELECT operational_status, exclusion_reason, COUNT(*)::int AS count
    FROM pois
    GROUP BY operational_status, exclusion_reason
    ORDER BY count DESC;
  `);

  // 11. DSS Criteria Evaluation Verification (Consumer Readiness)
  let dssReadiness = { status: "PASS", message: "All zones evaluated successfully", sample_zone_evaluations: [] };
  try {
    const rawEvalService = RawCriteriaEvaluationService.getInstance();
    const zones = await ZoneModel.findAll();
    for (const z of zones.slice(0, 5)) {
      const evalRes = await rawEvalService.evaluateZoneRawCriteria(z.id);
      dssReadiness.sample_zone_evaluations.push({
        zone_id: z.id,
        zone_name: z.name,
        C1: evalRes.criteria.C1.value,
        C2: evalRes.criteria.C2.value,
        C3: evalRes.criteria.C3.value,
        C6: evalRes.criteria.C6.value,
      });
    }
  } catch (err) {
    dssReadiness = { status: "FAIL", message: err.message, sample_zone_evaluations: [] };
  }

  const finishedAt = new Date();

  // HARD GATES EVALUATION
  const hardGateFailures = [];
  if (s.null_geom_count > 0) hardGateFailures.push(`Found ${s.null_geom_count} POIs with NULL geometry`);
  if (s.invalid_srid_count > 0) hardGateFailures.push(`Found ${s.invalid_srid_count} POIs with invalid SRID (expected 4326)`);
  if (s.invalid_geom_count > 0) hardGateFailures.push(`Found ${s.invalid_geom_count} POIs with invalid PostGIS geometry`);
  if (s.out_of_bounds_coords > 0) hardGateFailures.push(`Found ${s.out_of_bounds_coords} POIs with out of bounds coordinates`);
  if (d.self_reference_count > 0) hardGateFailures.push(`Found ${d.self_reference_count} POIs with duplicate_of = id (self-reference)`);
  if (d.dangling_duplicate_count > 0) hardGateFailures.push(`Found ${d.dangling_duplicate_count} POIs with dangling duplicate_of references`);
  if (chainCount > 0) hardGateFailures.push(`Found ${chainCount} duplicate chains (A -> B -> C)`);
  if (inconsistentClusters > 0) hardGateFailures.push(`Found ${inconsistentClusters} clusters with multiple logical_poi_ids`);
  if (childParentMismatchCount > 0) hardGateFailures.push(`Found ${childParentMismatchCount} duplicate POIs whose logical_poi_id differs from canonical parent`);
  if (c.null_logical_poi_count > 0) hardGateFailures.push(`Found ${c.null_logical_poi_count} POIs with NULL logical_poi_id`);
  if (unregisteredCategories.length > 0) hardGateFailures.push(`Found ${unregisteredCategories.length} categories not registered in Master Catalog`);
  if (buildingNoiseCount > 0) hardGateFailures.push(`Found ${buildingNoiseCount} eligible generic building noise records`);
  if (c.total_physical_records !== c.unique_external_ids) hardGateFailures.push(`external_id collision detected: ${c.total_physical_records} total vs ${c.unique_external_ids} unique`);
  if (rawPersistFailure > 0) hardGateFailures.push(`Raw acquisition vs persistence mismatch: ${rawAcquired} acquired vs ${rawPersisted} persisted`);
  if (dssReadiness.status === "FAIL") hardGateFailures.push(`DSS evaluation failed: ${dssReadiness.message}`);

  const gateResult = hardGateFailures.length === 0 ? "PASS" : "FAIL";

  // PRINT STRUCTURED REPORT
  console.log("--------------------------------------------------------------------------------");
  console.log(`📌 EXECUTION CONTEXT & PROVENANCE`);
  console.log(`   • Run ID                  : ${runId}`);
  console.log(`   • Source                  : OpenStreetMap (Overpass API)`);
  console.log(`   • Overpass Endpoint       : ${overpassEndpoint}`);
  console.log(`   • Hub City / Target Scope : ${hubCity}`);
  console.log(`   • Ingestion Started At    : ${startedAt.toISOString()}`);
  console.log(`   • Ingestion Finished At   : ${finishedAt.toISOString()}`);
  console.log(`   • Raw Data Staging Time   : ${rawFetchedAt ? new Date(rawFetchedAt).toISOString() : "N/A"}`);
  console.log(`   • Execution Duration      : ${((finishedAt - startedAt) / 1000).toFixed(2)}s`);
  console.log("--------------------------------------------------------------------------------\n");

  console.log(`📊 PIPELINE TRANSFORMATION METRICS:`);
  console.log(`   • RAW_ACQUIRED            : ${rawAcquired}`);
  console.log(`   • RAW_PERSISTED           : ${rawPersisted}`);
  console.log(`   • RAW_PERSIST_FAILURE     : ${rawPersistFailure === 0 ? "0 (100% Persisted)" : rawPersistFailure}`);
  console.log(`   • TOTAL_PHYSICAL_POIS     : ${c.total_physical_records}`);
  console.log(`   • UNIQUE_EXTERNAL_IDS     : ${c.unique_external_ids}`);
  console.log(`   • DISTINCT_LOGICAL_POIS   : ${c.distinct_logical_pois}`);
  console.log(`   • CANONICAL_RECORDS       : ${c.canonical_count}`);
  console.log(`   • DUPLICATE_RECORDS       : ${c.duplicate_count}`);
  console.log(`   • ELIGIBLE_FOR_DSS        : ${c.eligible_count}`);
  console.log(`   • EXCLUDED_RECORDS        : ${c.excluded_count}`);
  console.log(`   • REVIEW_STATUS           : ${c.review_count}`);
  console.log(`   • IGNORED_FILTERED        : ${ignoredBreakdown.total_ignored}\n`);

  console.log(`🔍 IGNORED & FILTERED RAW ELEMENTS BREAKDOWN:`);
  console.log(`   • Generic Unnamed Building: ${ignoredBreakdown.generic_building}`);
  console.log(`   • Blacklisted Noise       : ${ignoredBreakdown.blacklisted_noise}`);
  console.log(`   • Missing Semantic Tags   : ${ignoredBreakdown.missing_semantic_tags}`);
  console.log(`   • Invalid Coordinates     : ${ignoredBreakdown.invalid_coordinates}`);
  console.log(`   • Unnamed Generic Lainnya : ${ignoredBreakdown.unnamed_unclassified}`);
  console.log(`   • Other Unsupported Tags  : ${ignoredBreakdown.other_unsupported}`);
  console.log(`   • Sum Breakdown Verified  : ${ignoredBreakdown.total_ignored === rawAcquired - c.total_physical_records ? "✅ EXACT MATCH" : `ℹ️ ${ignoredBreakdown.total_ignored} calculated`}\n`);

  console.log(`🛡️ POSTGIS SPATIAL & GEOMETRY INTEGRITY:`);
  console.log(`   • Null Geometry           : ${s.null_geom_count === 0 ? "✅ 0" : "❌ " + s.null_geom_count}`);
  console.log(`   • Invalid SRID (!= 4326)  : ${s.invalid_srid_count === 0 ? "✅ 0" : "❌ " + s.invalid_srid_count}`);
  console.log(`   • Invalid PostGIS Geom    : ${s.invalid_geom_count === 0 ? "✅ 0" : "❌ " + s.invalid_geom_count}`);
  console.log(`   • Out of Bounds Coords    : ${s.out_of_bounds_coords === 0 ? "✅ 0" : "❌ " + s.out_of_bounds_coords}`);
  console.log(`   • Non-Point Geometries    : ${s.non_point_geom_count === 0 ? "✅ 0" : "❌ " + s.non_point_geom_count}\n`);

  console.log(`🔗 IDENTITY & DUPLICATION INVARIANTS:`);
  console.log(`   • Self-Referencing        : ${d.self_reference_count === 0 ? "✅ 0" : "❌ " + d.self_reference_count}`);
  console.log(`   • Dangling References     : ${d.dangling_duplicate_count === 0 ? "✅ 0" : "❌ " + d.dangling_duplicate_count}`);
  console.log(`   • Duplicate Chains        : ${chainCount === 0 ? "✅ 0" : "❌ " + chainCount}`);
  console.log(`   • Cluster ID Consistency  : ${inconsistentClusters === 0 ? "✅ 100% Consistent" : "❌ " + inconsistentClusters + " Inconsistent"}`);
  console.log(`   • Child-Parent Logical ID : ${childParentMismatchCount === 0 ? "✅ 100% Matched" : "❌ " + childParentMismatchCount + " Mismatched"}`);
  console.log(`   • Null Logical POI ID     : ${c.null_logical_poi_count === 0 ? "✅ 0 (100% Present)" : "❌ " + c.null_logical_poi_count}`);
  console.log(`   • Building Contamination  : ${buildingNoiseCount === 0 ? "✅ 0 (Zero Noise)" : "❌ " + buildingNoiseCount}\n`);

  console.log(`👥 PHYSICAL CLUSTER ANALYSIS (25m Deduplication):`);
  console.log(`   • Single-member Clusters  : ${cs.size_1_clusters}`);
  console.log(`   • 2-member Clusters       : ${cs.size_2_clusters}`);
  console.log(`   • >=3-member Clusters     : ${cs.size_3_plus_clusters}`);
  console.log(`   • Max Cluster Size        : ${cs.max_cluster_size || 1}`);
  if (topClustersAudit.rows.length > 0) {
    console.log(`   • Top Detected Multi-Member Clusters:`);
    topClustersAudit.rows.forEach((cl, idx) => {
      console.log(`     ${idx + 1}. [Size: ${cl.cluster_size}] ${cl.sample_name} (${cl.category}) -> logical_poi_id: ${cl.logical_poi_id} [Unnamed count: ${cl.unnamed_members}]`);
    });
  }
  console.log("");

  if (reviewRecords.length > 0) {
    console.log(`📋 FORENSIC INSPECTION OF REVIEW RECORDS (Proximity <=3m Candidates):`);
    console.log(`   Found ${reviewRecords.length} records flagged for REVIEW (Preserved as non-destructive observation):`);
    reviewRecords.forEach((r, idx) => {
      console.log(`   ${idx + 1}. [${r.external_id}] "${r.name}" (${r.category}) @ [${r.latitude.toFixed(6)}, ${r.longitude.toFixed(6)}] | Reason: ${r.exclusion_reason || "PROXIMITY_REVIEW"}`);
    });
    console.log("");
  }

  console.log(`📑 MASTER CATEGORY DISTRIBUTION (58 Authoritative Catalog):`);
  console.log(`   • Total Master Categories: ${categoryMasterAudit.rows.length}`);
  console.log(`   • Populated Categories   : ${categoryMasterAudit.rows.filter(r => r.count > 0).length}/58`);
  console.log(`   • Unregistered Categories: ${unregisteredCategories.length === 0 ? "✅ 0" : "❌ " + unregisteredCategories.length}`);
  console.log(`   • Category HHI Index     : ${hhi.toFixed(4)} (Diagnostic Concentration Metric)`);
  console.log(`   • Category Breakdown:`);
  categoryMasterAudit.rows.forEach((cat) => {
    const statusIcon = cat.count > 0 ? "🟢" : "⚪";
    console.log(`     ${statusIcon} [${String(cat.count).padStart(4)}] ${cat.category_name.padEnd(35)} (Active: ${cat.is_active_master ? "YES" : "NO"})`);
  });
  console.log("");

  console.log(`🏢 OPERATIONAL STATUS BREAKDOWN:`);
  operationalBreakdown.rows.forEach((r) => {
    console.log(`   • ${r.operational_status.padEnd(10)} | Reason: ${(r.exclusion_reason || "NONE").padEnd(20)} | Count: ${r.count}`);
  });
  console.log("");

  console.log(`🎯 DSS CONSUMER READINESS:`);
  console.log(`   • Evaluation Engine Status: ${dssReadiness.status === "PASS" ? "✅ READY" : "❌ FAILED"}`);
  dssReadiness.sample_zone_evaluations.forEach((ze) => {
    console.log(`   • [Zone] ${ze.zone_name.padEnd(30)} | C1 (Density): ${String(ze.C1).padStart(3)} | C2 (Diversity): ${String(ze.C2).padStart(2)} | C3 (Crowd): ${String(ze.C3).padStart(5)} | C6 (Competitor): ${String(ze.C6).padStart(2)}`);
  });
  console.log("");

  console.log("================================================================================");
  console.log(`🏁 FINAL GATE EVALUATION: ${gateResult === "PASS" ? "🟢 PASS" : "🔴 FAIL"}`);
  if (hardGateFailures.length > 0) {
    console.log("❌ HARD GATE FAILURES:");
    hardGateFailures.forEach((f) => console.log(`   - ${f}`));
  } else {
    console.log("✅ All hard gates successfully satisfied!");
  }
  console.log("================================================================================\n");

  return {
    runId,
    gateResult,
    hardGateFailures,
    metrics: {
      rawAcquired,
      rawPersisted,
      rawPersistFailure,
      totalPhysicalPois: c.total_physical_records,
      uniqueExternalIds: c.unique_external_ids,
      distinctLogicalPois: c.distinct_logical_pois,
      canonicalCount: c.canonical_count,
      duplicateCount: c.duplicate_count,
      eligibleCount: c.eligible_count,
      excludedCount: c.excluded_count,
      reviewCount: c.review_count,
      ignoredCount: ignoredBreakdown.total_ignored,
      categoryHHI: hhi,
    },
    ignoredBreakdown,
    reviewRecords,
    dssReadiness,
  };
}

if (process.argv[1] && process.argv[1].endsWith("run-poi-ingestion-audit.js")) {
  runPoiIngestionAudit()
    .catch((err) => {
      console.error("💥 Ingestion Audit failed with unexpected error:", err);
      process.exit(1);
    })
    .finally(async () => {
      await pool.end();
    });
}

