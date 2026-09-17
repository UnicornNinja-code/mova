/*
 * run-competitor-survey-audit.js
 * Read-Only Forensic Audit Engine for Competitor Survey Acquisition & Reconciliation (Pilar 4)
 * Authority: Competitor Survey Acquisition & Reconciliation Contract v1.0 (FROZEN)
 */

import { pool } from "../config/database.js";
import { SystemSettingModel } from "../models/systemSettingModel.js";
import { ZoneModel } from "../models/zoneModel.js";

const SIDOARJO_SURVEY_BOUNDS = {
  minLat: -7.65,
  maxLat: -7.25,
  minLon: 112.45,
  maxLon: 112.95,
};

export async function runCompetitorSurveyAudit(options = {}) {
  const startedAt = new Date();
  const runId = options.runId || `CS-AUDIT-${startedAt.getTime()}`;
  const source = options.source || "Field Survey / Survey Intake Engine";

  console.log("================================================================================");
  console.log(`🔍 MOVA COMPETITOR SURVEY FORENSIC AUDIT — RUN ID: ${runId}`);
  console.log("================================================================================\n");

  const hubCitySetting = await SystemSettingModel.getByKey("HUB_CITY_NAME");
  const hubCity = hubCitySetting?.value || hubCitySetting?.setting_value || "Sidoarjo";

  // 1. Core Record Distribution & Identity Audit (INV-CS-01)
  const countsQuery = await pool.query(`
    SELECT 
      COUNT(*)::int AS total_physical_competitor_records,
      COUNT(DISTINCT id)::int AS unique_ids,
      COUNT(*) FILTER (WHERE id IS NULL)::int AS null_id_count,
      COUNT(*) FILTER (WHERE zone_id IS NULL)::int AS null_zone_id_count
    FROM competitors;
  `);
  const c = countsQuery.rows[0];

  // 2. Spatial Integrity & Regional Bounds Checks (INV-CS-02 .. INV-CS-04)
  const spatialAudit = await pool.query(`
    SELECT 
      COUNT(*) FILTER (WHERE geom IS NULL)::int AS null_geom_count,
      COUNT(*) FILTER (WHERE ST_SRID(geom) <> 4326)::int AS invalid_srid_count,
      COUNT(*) FILTER (WHERE ST_GeometryType(geom) <> 'ST_Point')::int AS non_point_count,
      COUNT(*) FILTER (WHERE ST_IsValid(geom) = FALSE)::int AS invalid_geom_count,
      COUNT(*) FILTER (WHERE ST_IsEmpty(geom) = TRUE)::int AS empty_geom_count,
      COUNT(*) FILTER (
        WHERE ST_X(geom) < $1 OR ST_X(geom) > $2 OR ST_Y(geom) < $3 OR ST_Y(geom) > $4
      )::int AS out_of_bounds_count,
      COUNT(*) FILTER (
        WHERE latitude IS NULL OR longitude IS NULL
      )::int AS null_coord_columns_count,
      COUNT(*) FILTER (
        WHERE geom IS NOT NULL AND (
          ABS(ST_X(geom) - longitude) > 0.0001 OR ABS(ST_Y(geom) - latitude) > 0.0001
        )
      )::int AS coord_mismatch_count
    FROM competitors;
  `, [
    SIDOARJO_SURVEY_BOUNDS.minLon,
    SIDOARJO_SURVEY_BOUNDS.maxLon,
    SIDOARJO_SURVEY_BOUNDS.minLat,
    SIDOARJO_SURVEY_BOUNDS.maxLat,
  ]);
  const s = spatialAudit.rows[0];

  // 3. Category & Weight Taxonomy Audit (INV-CS-05, INV-CS-06)
  const taxonomyAudit = await pool.query(`
    SELECT 
      COUNT(*) FILTER (
        WHERE category NOT IN ('DIRECT_STARLING', 'LOW_PRICE_TAKEAWAY', 'INDIRECT_PREMIUM')
      )::int AS invalid_category_count,
      COUNT(*) FILTER (
        WHERE weight < 1 OR weight > 3 OR weight IS NULL
      )::int AS invalid_weight_count,
      COUNT(*) FILTER (WHERE category = 'DIRECT_STARLING')::int AS direct_starling_count,
      COUNT(*) FILTER (WHERE category = 'LOW_PRICE_TAKEAWAY')::int AS low_price_takeaway_count,
      COUNT(*) FILTER (WHERE category = 'INDIRECT_PREMIUM')::int AS indirect_premium_count
    FROM competitors;
  `);
  const t = taxonomyAudit.rows[0];

  // 4. Reconciliation State Breakdown & Triad Integrity (INV-CS-07..09, ADR-CS-05)
  const reconciliationAudit = await pool.query(`
    SELECT 
      COUNT(*) FILTER (WHERE reconciliation_status = 'UNLINKED')::int AS unlinked_count,
      COUNT(*) FILTER (WHERE reconciliation_status = 'CANDIDATE_MATCH')::int AS candidate_match_count,
      COUNT(*) FILTER (WHERE reconciliation_status = 'DEFINITIVE_MATCH')::int AS definitive_match_count,
      COUNT(*) FILTER (
        WHERE reconciliation_status NOT IN ('UNLINKED', 'CANDIDATE_MATCH', 'DEFINITIVE_MATCH')
      )::int AS invalid_status_count,
      COUNT(*) FILTER (
        WHERE reconciliation_status = 'DEFINITIVE_MATCH' AND (
          matched_logical_poi_id IS NULL OR matched_external_id IS NULL
        )
      )::int AS incomplete_definitive_triad_count,
      COUNT(*) FILTER (
        WHERE reconciliation_status = 'UNLINKED' AND (
          matched_logical_poi_id IS NOT NULL OR matched_external_id IS NOT NULL OR matched_poi_id IS NOT NULL
        )
      )::int AS polluted_unlinked_count
    FROM competitors;
  `);
  const r = reconciliationAudit.rows[0];

  // 5. Relational & Foreign Key Integrity (INV-CS-01)
  const fkAudit = await pool.query(`
    SELECT 
      COUNT(*) FILTER (WHERE z.id IS NULL)::int AS orphaned_zone_fk_count
    FROM competitors c
    LEFT JOIN zones z ON c.zone_id = z.id;
  `);
  const f = fkAudit.rows[0];

  // 6. Cross-reference POI matches existence in pois table
  const poiMatchAudit = await pool.query(`
    SELECT 
      COUNT(*) FILTER (
        WHERE c.matched_logical_poi_id IS NOT NULL 
          AND NOT EXISTS (SELECT 1 FROM pois p WHERE p.logical_poi_id = c.matched_logical_poi_id)
      )::int AS dangling_poi_logical_match_count
    FROM competitors c
    WHERE c.reconciliation_status = 'DEFINITIVE_MATCH';
  `);
  const p = poiMatchAudit.rows[0];

  // Invariant Evaluations
  const evaluations = [
    {
      code: "INV-CS-01",
      name: "Deterministic Identity & FK",
      status: c.total_physical_competitor_records === c.unique_ids && c.null_id_count === 0 && f.orphaned_zone_fk_count === 0 ? "PASS" : "FAIL",
      details: `Total: ${c.total_physical_competitor_records}, Unique IDs: ${c.unique_ids}, Orphaned Zone FK: ${f.orphaned_zone_fk_count}`,
    },
    {
      code: "INV-CS-02",
      name: "PostGIS Point Geometry",
      status: s.null_geom_count === 0 && s.invalid_srid_count === 0 && s.non_point_count === 0 && s.invalid_geom_count === 0 ? "PASS" : "FAIL",
      details: `Null: ${s.null_geom_count}, SRID!=4326: ${s.invalid_srid_count}, Non-Point: ${s.non_point_count}, Invalid: ${s.invalid_geom_count}`,
    },
    {
      code: "INV-CS-03",
      name: "Coordinate Column & PostGIS Sync",
      status: s.null_coord_columns_count === 0 && s.coord_mismatch_count === 0 ? "PASS" : "FAIL",
      details: `Null Cols: ${s.null_coord_columns_count}, Mismatch [lon, lat]: ${s.coord_mismatch_count}`,
    },
    {
      code: "INV-CS-04",
      name: "Regional Bounds (Sidoarjo)",
      status: s.out_of_bounds_count === 0 ? "PASS" : "FAIL",
      details: `Out of Bounds: ${s.out_of_bounds_count} (Bounds: [${SIDOARJO_SURVEY_BOUNDS.minLon}..${SIDOARJO_SURVEY_BOUNDS.maxLon}, ${SIDOARJO_SURVEY_BOUNDS.minLat}..${SIDOARJO_SURVEY_BOUNDS.maxLat}])`,
    },
    {
      code: "INV-CS-05",
      name: "Category Taxonomy Compliance",
      status: t.invalid_category_count === 0 ? "PASS" : "FAIL",
      details: `Starling: ${t.direct_starling_count}, Takeaway: ${t.low_price_takeaway_count}, Premium: ${t.indirect_premium_count}, Invalid: ${t.invalid_category_count}`,
    },
    {
      code: "INV-CS-06",
      name: "Weight Bounds Integrity (1..3)",
      status: t.invalid_weight_count === 0 ? "PASS" : "FAIL",
      details: `Invalid weights (<1 or >3 or null): ${t.invalid_weight_count}`,
    },
    {
      code: "INV-CS-07",
      name: "Reconciliation State Taxonomy",
      status: r.invalid_status_count === 0 && r.polluted_unlinked_count === 0 ? "PASS" : "FAIL",
      details: `Unlinked: ${r.unlinked_count}, Candidate: ${r.candidate_match_count}, Definitive: ${r.definitive_match_count}, Polluted Unlinked: ${r.polluted_unlinked_count}`,
    },
    {
      code: "INV-CS-08",
      name: "Definitive Triad & POI Match Integrity",
      status: r.incomplete_definitive_triad_count === 0 && p.dangling_poi_logical_match_count === 0 ? "PASS" : "FAIL",
      details: `Incomplete Triads: ${r.incomplete_definitive_triad_count}, Dangling POI Matches: ${p.dangling_poi_logical_match_count}`,
    },
  ];

  const allPassed = evaluations.every((e) => e.status === "PASS");

  // Output formatting
  console.log("--------------------------------------------------------------------------------");
  console.log("1. INGESTION & DATASET METRICS");
  console.log("--------------------------------------------------------------------------------");
  console.log(`Source Type                   : ${source}`);
  console.log(`Hub City Target               : ${hubCity}`);
  console.log(`Physical Competitor Records   : ${c.total_physical_competitor_records}`);
  console.log(`Unique Competitor IDs         : ${c.unique_ids}`);
  console.log(`Orphaned Zone Foreign Keys    : ${f.orphaned_zone_fk_count}`);

  console.log("\n--------------------------------------------------------------------------------");
  console.log("2. POSTGIS SPATIAL INTEGRITY");
  console.log("--------------------------------------------------------------------------------");
  console.log(`Null Geometry Count           : ${s.null_geom_count}`);
  console.log(`Invalid SRID (!= 4326)        : ${s.invalid_srid_count}`);
  console.log(`Non-Point Geometry Count      : ${s.non_point_count}`);
  console.log(`Invalid PostGIS Geometries    : ${s.invalid_geom_count}`);
  console.log(`Out-of-Bounds Records         : ${s.out_of_bounds_count}`);
  console.log(`Coord Column Mismatch Count   : ${s.coord_mismatch_count}`);

  console.log("\n--------------------------------------------------------------------------------");
  console.log("3. CATEGORY TAXONOMY & RECONCILIATION BREAKDOWN");
  console.log("--------------------------------------------------------------------------------");
  console.log(`DIRECT_STARLING (Weight 3)    : ${t.direct_starling_count}`);
  console.log(`LOW_PRICE_TAKEAWAY (Weight 2) : ${t.low_price_takeaway_count}`);
  console.log(`INDIRECT_PREMIUM (Weight 1)   : ${t.indirect_premium_count}`);
  console.log(`Invalid Category Count        : ${t.invalid_category_count}`);
  console.log(`Invalid Weight Count          : ${t.invalid_weight_count}`);
  console.log(`Reconciliation UNLINKED       : ${r.unlinked_count}`);
  console.log(`Reconciliation CANDIDATE_MATCH: ${r.candidate_match_count}`);
  console.log(`Reconciliation DEFINITIVE     : ${r.definitive_match_count}`);

  console.log("\n--------------------------------------------------------------------------------");
  console.log("4. INVARIANT VERIFICATION SUMMARY");
  console.log("--------------------------------------------------------------------------------");
  for (const ev of evaluations) {
    const icon = ev.status === "PASS" ? "✔" : "✖";
    console.log(`[${icon}] ${ev.code.padEnd(12)} : ${ev.name.padEnd(36)} [${ev.status}] - ${ev.details}`);
  }

  console.log("\n================================================================================");
  console.log(`AUDIT RESULT: ${allPassed ? "PASSED (CLEAN STATE / COMPLIANT)" : "FAILED (VIOLATIONS DETECTED)"}`);
  console.log("================================================================================\n");

  return {
    runId,
    startedAt,
    finishedAt: new Date(),
    allPassed,
    counts: c,
    spatial: s,
    taxonomy: t,
    reconciliation: r,
    evaluations,
  };
}

if (process.argv[1]?.endsWith("run-competitor-survey-audit.js")) {
  runCompetitorSurveyAudit()
    .then((res) => {
      process.exit(res.allPassed ? 0 : 1);
    })
    .catch((err) => {
      console.error("Audit error:", err);
      process.exit(1);
    });
}
