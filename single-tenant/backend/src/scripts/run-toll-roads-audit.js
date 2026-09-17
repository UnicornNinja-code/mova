/*
 * run-toll-roads-audit.js
 * Read-Only Post-Ingestion Forensic Audit Engine for Toll Roads (Pilar 3)
 * Authority: Toll Roads Acquisition & Spatial Restriction Contract v1.0 (FROZEN)
 */

import { pool } from "../config/database.js";
import { SystemSettingModel } from "../models/systemSettingModel.js";
import { ZoneModel } from "../models/zoneModel.js";

const REGIONAL_TOLL_BOUNDS = {
  minLat: -7.70,
  maxLat: -7.20,
  minLon: 112.40,
  maxLon: 113.00,
};

export async function runTollRoadsAudit(options = {}) {
  const startedAt = new Date();
  const runId = options.runId || `TR-AUDIT-${startedAt.getTime()}`;
  const source = options.source || "OpenStreetMap (Overpass API)";
  const endpoint = options.endpoint || "https://overpass-api.de/api/interpreter";
  const rawAcquired = options.rawAcquired !== undefined ? options.rawAcquired : null;
  const rawPersisted = options.rawPersisted !== undefined ? options.rawPersisted : null;

  console.log("================================================================================");
  console.log(`🔍 MOVA TOLL ROADS FORENSIC AUDIT — RUN ID: ${runId}`);
  console.log("================================================================================\n");

  const hubCitySetting = await SystemSettingModel.getByKey("HUB_CITY_NAME");
  const hubCity = hubCitySetting?.value || hubCitySetting?.setting_value || "Sidoarjo";

  // 1. Core Record Distribution & Identity Audit (INV-TR-01, INV-TR-02)
  const countsQuery = await pool.query(`
    SELECT 
      COUNT(*)::int AS total_physical_toll_records,
      COUNT(DISTINCT external_id)::int AS unique_external_ids,
      COUNT(*) FILTER (WHERE external_id ~ '^(osm:way:[0-9]+|way/toll-.+)$')::int AS valid_id_format_count,
      COUNT(*) FILTER (WHERE external_id !~ '^(osm:way:[0-9]+|way/toll-.+)$' AND external_id NOT LIKE 'way/gen-%')::int AS invalid_id_format_count
    FROM protocol_roads
    WHERE restriction_type = 'PROHIBITED_TOLL_ROAD';
  `);
  const c = countsQuery.rows[0];

  // 2. Spatial Integrity & Regional Bounds Checks (INV-TR-03 .. INV-TR-07)
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
    WHERE restriction_type = 'PROHIBITED_TOLL_ROAD';
  `, [
    REGIONAL_TOLL_BOUNDS.minLat,
    REGIONAL_TOLL_BOUNDS.maxLat,
    REGIONAL_TOLL_BOUNDS.minLon,
    REGIONAL_TOLL_BOUNDS.maxLon,
  ]);
  const s = spatialAudit.rows[0];

  // 3. Domain Purity & Cross-Domain Isolation Audit (ADR-TR-04, ADR-TR-05, INV-TR-08, AC-TR-08)
  const purityAudit = await pool.query(`
    SELECT 
      COUNT(*) FILTER (
        WHERE restriction_type = 'PROHIBITED_TOLL_ROAD' 
          AND highway_type NOT IN ('motorway', 'motorway_link') 
          AND COALESCE(metadata->>'toll', '') <> 'yes'
      )::int AS toll_purity_violations,
      COUNT(*) FILTER (
        WHERE restriction_type = 'PROHIBITED_ROAD' 
          AND (highway_type IN ('motorway', 'motorway_link') OR (metadata->>'toll') = 'yes')
      )::int AS protocol_purity_violations
    FROM protocol_roads;
  `);
  const p = purityAudit.rows[0];

  // 4. Toll Highway Classification Breakdown
  const highwayBreakdown = await pool.query(`
    SELECT 
      highway_type,
      COALESCE(metadata->>'toll', 'no') AS toll_tag,
      COUNT(*)::int AS count
    FROM protocol_roads
    WHERE restriction_type = 'PROHIBITED_TOLL_ROAD'
    GROUP BY highway_type, metadata->>'toll'
    ORDER BY count DESC;
  `);

  // 5. Metadata Traceability Audit (ADR-TR-07, AC-TR-09)
  const metadataAudit = await pool.query(`
    SELECT 
      COUNT(*) FILTER (WHERE metadata IS NULL OR metadata = '{}'::jsonb)::int AS missing_metadata_count,
      COUNT(*) FILTER (WHERE metadata->>'highway' IS NULL)::int AS missing_highway_tag_count
    FROM protocol_roads
    WHERE restriction_type = 'PROHIBITED_TOLL_ROAD';
  `);
  const m = metadataAudit.rows[0];

  // 6. Consumer Feasibility & Intersecting Zones Audit
  const zoneIntersectionAudit = await pool.query(`
    SELECT 
      z.id AS zone_id,
      z.name AS zone_name,
      z.status AS zone_status,
      COUNT(pr.id)::int AS intersected_toll_roads_count,
      COALESCE(json_agg(json_build_object('name', pr.name, 'highway', pr.highway_type)) FILTER (WHERE pr.id IS NOT NULL), '[]'::json) AS intersected_roads
    FROM zones z
    LEFT JOIN protocol_roads pr ON ST_Intersects(z.geom, pr.geom) AND pr.restriction_type = 'PROHIBITED_TOLL_ROAD'
    GROUP BY z.id, z.name, z.status
    ORDER BY intersected_toll_roads_count DESC;
  `);

  const ruleSetting = await SystemSettingModel.getByKey("OPERATIONAL_RULE_TOLL_ROAD");
  const isRuleActive = ruleSetting?.value === "true" || ruleSetting?.setting_value === "true";

  // Sample Consumer Proximity Checks
  const sampleSpots = [
    { name: "Spot Near Surabaya-Gempol Toll Corridor", lat: -7.4350, lon: 112.7100 },
    { name: "Spot Delta Sari Residential (Away from Toll)", lat: -7.3600, lon: 112.7300 },
  ];

  const candidateAudit = [];
  for (const spot of sampleSpots) {
    const candRes = await pool.query(`
      SELECT COUNT(pr.id)::int AS count
      FROM protocol_roads pr
      WHERE pr.restriction_type = 'PROHIBITED_TOLL_ROAD'
        AND ST_DWithin(
          ST_SetSRID(pr.geom, 4326)::geography,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
          10
        );
    `, [spot.lon, spot.lat]);
    candidateAudit.push({
      ...spot,
      nearRoads: candRes.rows[0].count,
      status: candRes.rows[0].count > 0 ? "REJECTED (PROHIBITED_TOLL_ROAD)" : "ALLOWED",
    });
  }

  const sampleRiders = [
    { name: "Rider Near Toll Ramp (Waru-Sidoarjo)", lat: -7.3550, lon: 112.7250 },
    { name: "Rider In Neighborhood (Pondok Jati)", lat: -7.4350, lon: 112.7050 },
  ];

  const riderAudit = [];
  for (const rider of sampleRiders) {
    const riderRes = await pool.query(`
      SELECT COUNT(pr.id)::int AS count
      FROM protocol_roads pr
      WHERE pr.restriction_type = 'PROHIBITED_TOLL_ROAD'
        AND ST_DWithin(
          ST_SetSRID(pr.geom, 4326)::geography,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
          50
        );
    `, [rider.lon, rider.lat]);
    riderAudit.push({
      ...rider,
      nearRoads: riderRes.rows[0].count,
      alert: riderRes.rows[0].count > 0 ? "PROHIBITED_ROAD_ALERT" : "CLEAR",
    });
  }

  const finishedAt = new Date();

  // HARD GATES EVALUATION
  const hardGateFailures = [];
  if (s.null_geom_count > 0) hardGateFailures.push(`Found ${s.null_geom_count} toll road segments with NULL geometry (INV-TR-03)`);
  if (s.invalid_srid_count > 0) hardGateFailures.push(`Found ${s.invalid_srid_count} toll road segments with invalid SRID (expected 4326) (INV-TR-04)`);
  if (s.non_linestring_count > 0) hardGateFailures.push(`Found ${s.non_linestring_count} toll road segments with non-LineString geometry (INV-TR-05)`);
  if (s.invalid_geom_count > 0) hardGateFailures.push(`Found ${s.invalid_geom_count} toll road segments with invalid PostGIS geometry (INV-TR-06)`);
  if (s.empty_geom_count > 0) hardGateFailures.push(`Found ${s.empty_geom_count} toll road segments with empty geometry (INV-TR-06)`);
  if (s.under_two_points_count > 0) hardGateFailures.push(`Found ${s.under_two_points_count} toll road segments with less than 2 coordinate points (INV-TR-06)`);
  if (s.out_of_bounds_count > 0) hardGateFailures.push(`Found ${s.out_of_bounds_count} toll road segments outside regional bounds (INV-TR-07)`);
  if (c.total_physical_toll_records !== c.unique_external_ids) hardGateFailures.push(`Duplicate external_id detected: ${c.total_physical_toll_records} total vs ${c.unique_external_ids} unique (INV-TR-02)`);
  if (c.invalid_id_format_count > 0) hardGateFailures.push(`Found ${c.invalid_id_format_count} toll road segments with invalid external_id format (INV-TR-01)`);
  if (p.toll_purity_violations > 0) hardGateFailures.push(`Domain Purity Failure: Found ${p.toll_purity_violations} non-toll/non-motorway roads in PROHIBITED_TOLL_ROAD (INV-TR-08)`);
  if (p.protocol_purity_violations > 0) hardGateFailures.push(`Domain Purity Failure: Found ${p.protocol_purity_violations} motorway or toll=yes roads in PROHIBITED_ROAD (AC-TR-08)`);
  if (m.missing_metadata_count > 0) hardGateFailures.push(`Found ${m.missing_metadata_count} toll road segments with missing metadata JSONB (AC-TR-09)`);

  const gateResult = hardGateFailures.length === 0 ? "PASS" : "FAIL";

  // PRINT STRUCTURED REPORT
  console.log("--------------------------------------------------------------------------------");
  console.log(`📌 EXECUTION CONTEXT & PROVENANCE`);
  console.log(`   • Run ID                  : ${runId}`);
  console.log(`   • Source                  : ${source}`);
  console.log(`   • Overpass Endpoint       : ${endpoint}`);
  console.log(`   • Target Scope / Hub City : ${hubCity}`);
  console.log(`   • Regional Bounds Scope   : Lat [${REGIONAL_TOLL_BOUNDS.minLat}, ${REGIONAL_TOLL_BOUNDS.maxLat}], Lon [${REGIONAL_TOLL_BOUNDS.minLon}, ${REGIONAL_TOLL_BOUNDS.maxLon}]`);
  console.log(`   • Started At              : ${startedAt.toISOString()}`);
  console.log(`   • Finished At             : ${finishedAt.toISOString()}`);
  console.log(`   • Duration                : ${((finishedAt - startedAt) / 1000).toFixed(2)}s`);
  console.log("--------------------------------------------------------------------------------\n");

  console.log(`📊 PIPELINE TRANSFORMATION METRICS:`);
  if (rawAcquired !== null) console.log(`   • RAW_ACQUIRED            : ${rawAcquired}`);
  if (rawPersisted !== null) console.log(`   • RAW_PERSISTED           : ${rawPersisted}`);
  console.log(`   • PHYSICAL_TOLL_ROADS     : ${c.total_physical_toll_records}`);
  console.log(`   • UNIQUE_EXTERNAL_IDS     : ${c.unique_external_ids}`);

  console.log(`\n🛡️ POSTGIS SPATIAL & TOPOLOGY INTEGRITY:`);
  console.log(`   • Null Geometry           : ${s.null_geom_count === 0 ? "✅ 0" : "❌ " + s.null_geom_count}`);
  console.log(`   • Invalid SRID (!= 4326)  : ${s.invalid_srid_count === 0 ? "✅ 0" : "❌ " + s.invalid_srid_count}`);
  console.log(`   • Non-LineString Geometry : ${s.non_linestring_count === 0 ? "✅ 0 (100% LineString)" : "❌ " + s.non_linestring_count}`);
  console.log(`   • Invalid PostGIS Geom    : ${s.invalid_geom_count === 0 ? "✅ 0 (ST_IsValid = TRUE)" : "❌ " + s.invalid_geom_count}`);
  console.log(`   • Empty Geometry          : ${s.empty_geom_count === 0 ? "✅ 0" : "❌ " + s.empty_geom_count}`);
  console.log(`   • < 2 Points LineString   : ${s.under_two_points_count === 0 ? "✅ 0" : "❌ " + s.under_two_points_count}`);
  console.log(`   • Out of Bounds Segments  : ${s.out_of_bounds_count === 0 ? "✅ 0" : "❌ " + s.out_of_bounds_count}`);

  console.log(`\n🔗 IDENTITY, CLASSIFICATION & DOMAIN PURITY:`);
  console.log(`   • ID Collision (Duplicates): ${c.total_physical_toll_records === c.unique_external_ids ? "✅ 0 (100% Unique)" : "❌ Duplicate Detected"}`);
  console.log(`   • ID Format Compliance    : ${c.invalid_id_format_count === 0 ? "✅ 100% Valid Format" : "❌ " + c.invalid_id_format_count + " Invalid"}`);
  console.log(`   • Toll Domain Purity      : ${p.toll_purity_violations === 0 ? "✅ 0 Violations" : "❌ " + p.toll_purity_violations + " Violations"}`);
  console.log(`   • Protocol Isolation      : ${p.protocol_purity_violations === 0 ? "✅ 0 Contaminations" : "❌ " + p.protocol_purity_violations + " Contaminations"}`);
  
  const traceabilityRate = c.total_physical_toll_records > 0
    ? (((c.total_physical_toll_records - m.missing_metadata_count) / c.total_physical_toll_records) * 100).toFixed(2)
    : "100.00";
  console.log(`   • Metadata Traceability   : ✅ ${traceabilityRate}% Retained`);

  console.log(`\n🛣️ TOLL HIGHWAY CLASSIFICATION BREAKDOWN:`);
  if (highwayBreakdown.rows.length === 0) {
    console.log(`   • (No toll road records currently in database)`);
  } else {
    for (const row of highwayBreakdown.rows) {
      console.log(`   • highway=${row.highway_type.padEnd(16)} | toll=${row.toll_tag.padEnd(5)} | Count: ${row.count}`);
    }
  }

  console.log(`\n🎯 CONSUMER FEASIBILITY AUDIT (Operational Rule Active: ${isRuleActive ? "YES" : "NO"}):`);
  console.log(`   • ZONE INTERSECTION:`);
  for (const z of zoneIntersectionAudit.rows) {
    const isBlocked = z.intersected_toll_roads_count > 0 && isRuleActive;
    const statusIcon = isBlocked ? "🚫 BLOCKED (Rule ON)" : (z.intersected_toll_roads_count > 0 ? "⚠️ ADVISORY" : "✅ CLEAR");
    console.log(`     - [Zone] ${z.zone_name.padEnd(32)} | Intersected Toll Roads: ${String(z.intersected_toll_roads_count).padStart(2)} | Status: ${statusIcon}`);
  }
  console.log(`   • CANDIDATE SPOT (10m Buffer):`);
  for (const cSpot of candidateAudit) {
    console.log(`     - ${cSpot.name.padEnd(45)} -> ${cSpot.nearRoads} toll roads within 10m [${cSpot.status}]`);
  }
  console.log(`   • RIDER LBS (50m Proximity Alert):`);
  for (const rLbs of riderAudit) {
    console.log(`     - ${rLbs.name.padEnd(45)} -> ${rLbs.nearRoads} toll roads within 50m [${rLbs.alert}]`);
  }

  console.log("\n================================================================================");
  console.log(`🏁 FINAL GATE EVALUATION: ${gateResult === "PASS" ? "🟢 PASS" : "🔴 FAIL"}`);
  if (hardGateFailures.length > 0) {
    console.log("❌ HARD GATE FAILURES:");
    for (const fail of hardGateFailures) {
      console.log(`   - ${fail}`);
    }
  } else {
    console.log("✅ All hard gates successfully satisfied!");
  }
  console.log("================================================================================\n");

  return {
    runId,
    gateResult,
    hardGateFailures,
    metrics: {
      total_physical_toll_records: c.total_physical_toll_records,
      unique_external_ids: c.unique_external_ids,
      null_geom_count: s.null_geom_count,
      invalid_srid_count: s.invalid_srid_count,
      non_linestring_count: s.non_linestring_count,
      invalid_geom_count: s.invalid_geom_count,
      out_of_bounds_count: s.out_of_bounds_count,
      toll_purity_violations: p.toll_purity_violations,
      protocol_purity_violations: p.protocol_purity_violations,
      traceability_rate: parseFloat(traceabilityRate),
    },
  };
}

if (process.argv[1]?.endsWith("run-toll-roads-audit.js")) {
  runTollRoadsAudit()
    .then(async () => {
      await pool.end();
    })
    .catch(async (err) => {
      console.error("💥 Error during Toll Roads Forensic Audit:", err);
      await pool.end();
      process.exit(1);
    });
}
