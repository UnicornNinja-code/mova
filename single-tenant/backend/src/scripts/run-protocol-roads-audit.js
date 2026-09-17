/*
 * run-protocol-roads-audit.js
 * Read-Only Post-Ingestion Forensic Audit Engine for Protocol Roads (Gate RW-01 & RW-02)
 * Authority: Protocol Roads Acquisition & Spatial Restriction Contract v1.0-FINAL (FROZEN)
 */

import { pool } from "../config/database.js";
import { SystemSettingModel } from "../models/systemSettingModel.js";
import { ZoneModel } from "../models/zoneModel.js";

const AUTHORITATIVE_BOUNDS = {
  minLat: -7.65,
  maxLat: -7.25,
  minLon: 112.45,
  maxLon: 112.95,
};

export async function runProtocolRoadsAudit(options = {}) {
  const startedAt = new Date();
  const runId = options.runId || `PR-AUDIT-${startedAt.getTime()}`;
  const source = options.source || "OpenStreetMap (Overpass API)";
  const endpoint = options.endpoint || "https://overpass-api.de/api/interpreter";
  const rawAcquired = options.rawAcquired !== undefined ? options.rawAcquired : null;
  const rawPersisted = options.rawPersisted !== undefined ? options.rawPersisted : null;

  console.log("================================================================================");
  console.log(`🔍 MOVA PROTOCOL ROADS FORENSIC AUDIT — RUN ID: ${runId}`);
  console.log("================================================================================\n");

  const hubCitySetting = await SystemSettingModel.getByKey("HUB_CITY_NAME");
  const hubCity = hubCitySetting?.value || hubCitySetting?.setting_value || "Sidoarjo";

  // 1. Core Record Distribution
  const countsQuery = await pool.query(`
    SELECT 
      COUNT(*)::int AS total_physical_records,
      COUNT(DISTINCT external_id)::int AS unique_external_ids,
      COUNT(*) FILTER (WHERE restriction_type = 'PROHIBITED_ROAD')::int AS protocol_roads_count,
      COUNT(*) FILTER (WHERE restriction_type = 'PROHIBITED_TOLL_ROAD')::int AS toll_roads_count,
      COUNT(*) FILTER (WHERE restriction_type IS NULL OR restriction_type NOT IN ('PROHIBITED_ROAD', 'PROHIBITED_TOLL_ROAD'))::int AS invalid_restriction_count,
      COUNT(*) FILTER (WHERE external_id !~ '^(osm:way:[0-9]+|way/.+)$')::int AS invalid_id_format_count
    FROM protocol_roads;
  `);
  const c = countsQuery.rows[0];

  // 2. Spatial Integrity & Bounds Checks (INV-PR-03 .. INV-PR-07)
  const spatialAudit = await pool.query(`
    SELECT 
      COUNT(*) FILTER (WHERE geom IS NULL)::int AS null_geom_count,
      COUNT(*) FILTER (WHERE ST_SRID(geom) <> 4326)::int AS invalid_srid_count,
      COUNT(*) FILTER (WHERE ST_GeometryType(geom) <> 'ST_LineString')::int AS non_linestring_count,
      COUNT(*) FILTER (WHERE ST_IsValid(geom) = FALSE)::int AS invalid_geom_count,
      COUNT(*) FILTER (WHERE ST_IsEmpty(geom) = TRUE)::int AS empty_geom_count,
      COUNT(*) FILTER (WHERE ST_NPoints(geom) < 2)::int AS under_two_points_count,
      COUNT(*) FILTER (
        WHERE NOT ST_Intersects(geom, ST_MakeEnvelope($3, $1, $4, $2, 4326))
      )::int AS out_of_bounds_count
    FROM protocol_roads
    WHERE geom IS NOT NULL;
  `, [
    AUTHORITATIVE_BOUNDS.minLat,
    AUTHORITATIVE_BOUNDS.maxLat,
    AUTHORITATIVE_BOUNDS.minLon,
    AUTHORITATIVE_BOUNDS.maxLon,
  ]);
  const s = spatialAudit.rows[0];

  // 3. Semantic Domain Purity & Toll Precedence Checks (ADR-PR-04, ADR-PR-04A, INV-PR-08)
  const purityAudit = await pool.query(`
    SELECT 
      COUNT(*) FILTER (
        WHERE restriction_type = 'PROHIBITED_ROAD' 
          AND (highway_type IN ('motorway', 'motorway_link') OR (metadata->>'toll') = 'yes')
      )::int AS protocol_purity_violations,
      COUNT(*) FILTER (
        WHERE restriction_type = 'PROHIBITED_TOLL_ROAD' 
          AND highway_type NOT IN ('motorway', 'motorway_link') 
          AND COALESCE(metadata->>'toll', '') <> 'yes'
      )::int AS toll_purity_violations
    FROM protocol_roads;
  `);
  const p = purityAudit.rows[0];

  // 4. Highway Classification Breakdown
  const highwayBreakdown = await pool.query(`
    SELECT 
      restriction_type,
      highway_type,
      COUNT(*)::int AS count
    FROM protocol_roads
    GROUP BY restriction_type, highway_type
    ORDER BY restriction_type ASC, count DESC;
  `);

  // 5. Metadata Traceability Audit (AC-PR-10)
  const metadataAudit = await pool.query(`
    SELECT 
      COUNT(*) FILTER (WHERE metadata IS NULL OR metadata = '{}'::jsonb)::int AS missing_metadata_count,
      COUNT(*) FILTER (WHERE metadata->>'highway' IS NULL)::int AS missing_highway_tag_count
    FROM protocol_roads;
  `);
  const m = metadataAudit.rows[0];

  // 6. Consumer Feasibility & Intersecting Zones Audit
  const zoneIntersectionAudit = await pool.query(`
    SELECT 
      z.id AS zone_id,
      z.name AS zone_name,
      z.status AS zone_status,
      COUNT(pr.id)::int AS intersected_protocol_roads_count,
      COALESCE(json_agg(json_build_object('name', pr.name, 'highway', pr.highway_type)) FILTER (WHERE pr.id IS NOT NULL), '[]'::json) AS intersected_roads
    FROM zones z
    LEFT JOIN protocol_roads pr ON ST_Intersects(z.geom, pr.geom) AND pr.restriction_type = 'PROHIBITED_ROAD'
    GROUP BY z.id, z.name, z.status
    ORDER BY intersected_protocol_roads_count DESC;
  `);

  const ruleSetting = await SystemSettingModel.getByKey("OPERATIONAL_RULE_PROTOCOL_ROAD");
  const isRuleActive = ruleSetting?.value === "true" || ruleSetting?.setting_value === "true";

  const finishedAt = new Date();

  // HARD GATES EVALUATION
  const hardGateFailures = [];
  if (s.null_geom_count > 0) hardGateFailures.push(`Found ${s.null_geom_count} road segments with NULL geometry (INV-PR-03)`);
  if (s.invalid_srid_count > 0) hardGateFailures.push(`Found ${s.invalid_srid_count} road segments with invalid SRID (expected 4326) (INV-PR-04)`);
  if (s.non_linestring_count > 0) hardGateFailures.push(`Found ${s.non_linestring_count} road segments with non-LineString geometry (INV-PR-05)`);
  if (s.invalid_geom_count > 0) hardGateFailures.push(`Found ${s.invalid_geom_count} road segments with invalid PostGIS geometry (INV-PR-06)`);
  if (s.empty_geom_count > 0) hardGateFailures.push(`Found ${s.empty_geom_count} road segments with empty geometry (INV-PR-06)`);
  if (s.under_two_points_count > 0) hardGateFailures.push(`Found ${s.under_two_points_count} road segments with less than 2 coordinate points (INV-PR-06)`);
  if (s.out_of_bounds_count > 0) hardGateFailures.push(`Found ${s.out_of_bounds_count} road segments outside Sidoarjo geographic bounds (INV-PR-07)`);
  if (c.total_physical_records !== c.unique_external_ids) hardGateFailures.push(`Duplicate external_id detected: ${c.total_physical_records} total vs ${c.unique_external_ids} unique (INV-PR-01)`);
  if (c.invalid_id_format_count > 0) hardGateFailures.push(`Found ${c.invalid_id_format_count} road segments with invalid external_id format (INV-PR-02)`);
  if (c.invalid_restriction_count > 0) hardGateFailures.push(`Found ${c.invalid_restriction_count} road segments with unrecognized restriction_type`);
  if (p.protocol_purity_violations > 0) hardGateFailures.push(`Domain Purity Failure: Found ${p.protocol_purity_violations} motorway or toll=yes roads in PROHIBITED_ROAD (INV-PR-08)`);
  if (p.toll_purity_violations > 0) hardGateFailures.push(`Domain Purity Failure: Found ${p.toll_purity_violations} non-toll/non-motorway roads in PROHIBITED_TOLL_ROAD`);

  const gateResult = hardGateFailures.length === 0 ? "PASS" : "FAIL";

  // PRINT STRUCTURED REPORT
  console.log("--------------------------------------------------------------------------------");
  console.log(`📌 EXECUTION CONTEXT & PROVENANCE`);
  console.log(`   • Run ID                  : ${runId}`);
  console.log(`   • Source                  : ${source}`);
  console.log(`   • Overpass Endpoint       : ${endpoint}`);
  console.log(`   • Target Scope / Hub City : ${hubCity}`);
  console.log(`   • Geographic Bounds Scope : Lat [${AUTHORITATIVE_BOUNDS.minLat}, ${AUTHORITATIVE_BOUNDS.maxLat}], Lon [${AUTHORITATIVE_BOUNDS.minLon}, ${AUTHORITATIVE_BOUNDS.maxLon}]`);
  console.log(`   • Started At              : ${startedAt.toISOString()}`);
  console.log(`   • Finished At             : ${finishedAt.toISOString()}`);
  console.log(`   • Duration                : ${((finishedAt - startedAt) / 1000).toFixed(2)}s`);
  console.log("--------------------------------------------------------------------------------\n");

  console.log(`📊 PIPELINE TRANSFORMATION METRICS:`);
  if (rawAcquired !== null) console.log(`   • RAW_ACQUIRED            : ${rawAcquired}`);
  if (rawPersisted !== null) console.log(`   • RAW_PERSISTED           : ${rawPersisted}`);
  console.log(`   • TOTAL_PHYSICAL_ROADS    : ${c.total_physical_records}`);
  console.log(`   • UNIQUE_EXTERNAL_IDS     : ${c.unique_external_ids}`);
  console.log(`   • PROHIBITED_ROAD (Pilar2): ${c.protocol_roads_count}`);
  console.log(`   • PROHIBITED_TOLL (Pilar3): ${c.toll_roads_count}\n`);

  console.log(`🛡️ POSTGIS SPATIAL & TOPOLOGY INTEGRITY:`);
  console.log(`   • Null Geometry           : ${s.null_geom_count === 0 ? "✅ 0" : "❌ " + s.null_geom_count}`);
  console.log(`   • Invalid SRID (!= 4326)  : ${s.invalid_srid_count === 0 ? "✅ 0" : "❌ " + s.invalid_srid_count}`);
  console.log(`   • Non-LineString Geometry : ${s.non_linestring_count === 0 ? "✅ 0 (100% LineString)" : "❌ " + s.non_linestring_count}`);
  console.log(`   • Invalid PostGIS Geom    : ${s.invalid_geom_count === 0 ? "✅ 0 (ST_IsValid = TRUE)" : "❌ " + s.invalid_geom_count}`);
  console.log(`   • Empty Geometry          : ${s.empty_geom_count === 0 ? "✅ 0" : "❌ " + s.empty_geom_count}`);
  console.log(`   • < 2 Points LineString   : ${s.under_two_points_count === 0 ? "✅ 0" : "❌ " + s.under_two_points_count}`);
  console.log(`   • Out of Bounds Segments  : ${s.out_of_bounds_count === 0 ? "✅ 0" : "❌ " + s.out_of_bounds_count}\n`);

  console.log(`🔗 IDENTITY, CLASSIFICATION & DOMAIN PURITY:`);
  console.log(`   • ID Collision (Duplication): ${c.total_physical_records === c.unique_external_ids ? "✅ 0 (100% Unique)" : "❌ Duplicate detected"}`);
  console.log(`   • ID Format Compliance    : ${c.invalid_id_format_count === 0 ? "✅ 100% Valid Format" : "❌ " + c.invalid_id_format_count}`);
  console.log(`   • Protocol Domain Purity  : ${p.protocol_purity_violations === 0 ? "✅ 0 Violations (Zero Motorway/Toll)" : "❌ " + p.protocol_purity_violations}`);
  console.log(`   • Metadata Traceability   : ${m.missing_metadata_count === 0 ? "✅ 100% Retained" : "⚠️ " + m.missing_metadata_count + " Missing"}\n`);

  console.log(`🛣️ HIGHWAY CLASSIFICATION BREAKDOWN:`);
  if (highwayBreakdown.rows.length === 0) {
    console.log(`   (No road records currently populated in database)\n`);
  } else {
    highwayBreakdown.rows.forEach((h) => {
      console.log(`   • [${h.restriction_type.padEnd(20)}] highway=${(h.highway_type || "unspecified").padEnd(15)} | Count: ${h.count}`);
    });
    console.log("");
  }

  console.log(`🎯 CONSUMER FEASIBILITY AUDIT (Operational Rule Active: ${isRuleActive ? "YES" : "NO"}):`);
  zoneIntersectionAudit.rows.forEach((z) => {
    const statusIcon = z.intersected_protocol_roads_count > 0 ? (isRuleActive ? "🚫 BLOCKED (Rule ON)" : "⚠️ ADVISORY") : "✅ CLEAR";
    console.log(`   • [Zone] ${z.zone_name.padEnd(30)} | Intersected Protocol Roads: ${String(z.intersected_protocol_roads_count).padStart(2)} | Status: ${statusIcon}`);
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
      totalPhysicalRoads: c.total_physical_records,
      uniqueExternalIds: c.unique_external_ids,
      protocolRoadsCount: c.protocol_roads_count,
      tollRoadsCount: c.toll_roads_count,
      spatialIntegrity: s,
      purity: p,
    },
  };
}

if (process.argv[1] && process.argv[1].endsWith("run-protocol-roads-audit.js")) {
  runProtocolRoadsAudit()
    .catch((err) => {
      console.error("💥 Protocol Roads Audit failed with unexpected error:", err);
      process.exit(1);
    })
    .finally(async () => {
      await pool.end();
    });
}
