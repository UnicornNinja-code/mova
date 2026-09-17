/*
 * test-toll-roads-contract.test.js
 * Integration Test Suite for Toll Roads Acquisition & Spatial Restriction Contract v1.0
 * Validates Invariants INV-TR-01 through INV-TR-10 and Acceptance Criteria AC-TR-01 through AC-TR-10.
 * Authority: Toll Roads Acquisition & Spatial Restriction Contract v1.0 (FROZEN)
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { pool } from "../../src/config/database.js";
import { roadRepository } from "../../src/repositories/roadRepository.js";
import { roadService } from "../../src/services/roadService.js";
import { RoadOverpassSyncService } from "../../src/services/roadOverpassSyncService.js";
import { zoneService } from "../../src/services/zoneService.js";
import { spatialRestrictionService } from "../../src/services/spatial/SpatialRestrictionService.js";
import { operationalRuleService } from "../../src/services/operationalRuleService.js";
import { ZoneModel } from "../../src/models/zoneModel.js";

const TEST_ID_PREFIX = "osm:way:8877";

describe("TOLL ROADS ACQUISITION & SPATIAL RESTRICTION CONTRACT v1.0", () => {
  before(async () => {
    // Clean up any test records in protocol_roads and test zones
    await pool.query("DELETE FROM protocol_roads WHERE external_id LIKE $1 OR external_id LIKE 'way/toll-test-%';", [`${TEST_ID_PREFIX}%`]);
    await pool.query("DELETE FROM zones WHERE name LIKE 'Test Contract Toll Zone%';");
  });

  after(async () => {
    // Clean up test records
    await pool.query("DELETE FROM protocol_roads WHERE external_id LIKE $1 OR external_id LIKE 'way/toll-test-%';", [`${TEST_ID_PREFIX}%`]);
    await pool.query("DELETE FROM zones WHERE name LIKE 'Test Contract Toll Zone%';");
    await pool.end();
  });

  /*
   * ============================================================================
   * GROUP A: IDENTITY & UNICITY (INV-TR-01, INV-TR-02)
   * ============================================================================
   */
  test("GROUP A: INV-TR-01 & INV-TR-02: Deterministic Natural Identity and Format Validation", async () => {
    // 1. Valid OSM Live ID: osm:way:<id>
    const tollLive = {
      external_id: `${TEST_ID_PREFIX}01`,
      name: "Jalan Tol Surabaya–Gempol Live Test",
      highway_type: "motorway",
      restriction_type: "PROHIBITED_TOLL_ROAD",
      metadata: { highway: "motorway", toll: "yes", ref: "8" },
      geometry: {
        type: "LineString",
        coordinates: [
          [112.715, -7.445],
          [112.716, -7.446],
        ],
      },
    };

    // 2. Valid Synthetic Test ID: way/toll-<id>
    const tollSynthetic = {
      external_id: "way/toll-test-02",
      name: "Jalan Tol Synthetic Ramp Test",
      highway_type: "motorway_link",
      restriction_type: "PROHIBITED_TOLL_ROAD",
      metadata: { highway: "motorway_link", toll: "yes" },
      geometry: {
        type: "LineString",
        coordinates: [
          [112.717, -7.447],
          [112.718, -7.448],
        ],
      },
    };

    const inserted = await roadRepository.bulkCreate([tollLive, tollSynthetic]);
    assert.equal(inserted.length, 2, "Both valid toll roads must be persisted");

    // 3. Invariant check: Regex format compliance (Live/Snapshot: osm:way:[0-9]+, Synthetic: way/toll-.+)
    const { rows: formatRows } = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE external_id ~ '^(osm:way:[0-9]+|way/toll-.+)$')::int AS valid_format_count,
        COUNT(*) FILTER (WHERE external_id !~ '^(osm:way:[0-9]+|way/toll-.+)$' AND external_id NOT LIKE 'way/gen-%')::int AS invalid_format_count
      FROM protocol_roads
      WHERE restriction_type = 'PROHIBITED_TOLL_ROAD';
    `);

    assert.equal(formatRows[0].invalid_format_count, 0, "INV-TR-01: Zero invalid external_id formats for toll roads");

    // 4. Invariant check: Unicity (INV-TR-02)
    const { rows: unicityRows } = await pool.query(`
      SELECT external_id, COUNT(*)::int AS count
      FROM protocol_roads
      WHERE restriction_type = 'PROHIBITED_TOLL_ROAD'
      GROUP BY external_id
      HAVING COUNT(*) > 1;
    `);
    assert.equal(unicityRows.length, 0, "INV-TR-02: Zero duplicate external_id records in PROHIBITED_TOLL_ROAD");
  });

  /*
   * ============================================================================
   * GROUP B: POSTGIS GEOMETRY & SPATIAL INTEGRITY (INV-TR-03..07, AC-TR-02)
   * ============================================================================
   */
  test("GROUP B: INV-TR-03 .. INV-TR-07 & AC-TR-02: PostGIS LineString, SRID 4326, Validity, and Bounds", async () => {
    const { rows: spatialCheck } = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE geom IS NULL)::int AS null_geom_count,
        COUNT(*) FILTER (WHERE ST_SRID(geom) <> 4326)::int AS invalid_srid_count,
        COUNT(*) FILTER (WHERE ST_GeometryType(geom) <> 'ST_LineString')::int AS non_linestring_count,
        COUNT(*) FILTER (WHERE ST_IsValid(geom) = FALSE)::int AS invalid_geom_count,
        COUNT(*) FILTER (WHERE ST_IsEmpty(geom) = TRUE)::int AS empty_geom_count,
        COUNT(*) FILTER (WHERE ST_NPoints(geom) < 2)::int AS under_two_points_count,
        COUNT(*) FILTER (
          WHERE NOT ST_Intersects(geom, ST_MakeEnvelope(112.40, -7.70, 113.00, -7.20, 4326))
        )::int AS out_of_regional_bounds_count
      FROM protocol_roads
      WHERE restriction_type = 'PROHIBITED_TOLL_ROAD';
    `);

    const s = spatialCheck[0];
    assert.equal(s.null_geom_count, 0, "INV-TR-03: Zero NULL geometries in PROHIBITED_TOLL_ROAD");
    assert.equal(s.invalid_srid_count, 0, "INV-TR-04: 100% SRID 4326 in PROHIBITED_TOLL_ROAD");
    assert.equal(s.non_linestring_count, 0, "INV-TR-05: 100% ST_LineString geometry type in PROHIBITED_TOLL_ROAD");
    assert.equal(s.invalid_geom_count, 0, "INV-TR-06: ST_IsValid = TRUE for all toll road geometries");
    assert.equal(s.empty_geom_count, 0, "INV-TR-06: ST_IsEmpty = FALSE for all toll road geometries");
    assert.equal(s.under_two_points_count, 0, "INV-TR-06: ST_NPoints >= 2 for all toll road geometries");
    assert.equal(s.out_of_regional_bounds_count, 0, "INV-TR-07: All toll roads intersect regional envelope bounds");

    // AC-TR-02: GeoJSON Feature Collection Retrieval
    const geoJson = await roadService.getTollRoadsGeoJson();
    assert.equal(geoJson.type, "FeatureCollection", "AC-TR-02: getTollRoadsGeoJson must return a FeatureCollection");
    assert.ok(Array.isArray(geoJson.features), "Features must be an array");
    for (const feat of geoJson.features) {
      assert.equal(feat.properties.restriction_type, "PROHIBITED_TOLL_ROAD", "Every feature in getTollRoadsGeoJson must be PROHIBITED_TOLL_ROAD");
      assert.equal(feat.geometry.type, "LineString", "Geometry must be LineString");
    }
  });

  /*
   * ============================================================================
   * GROUP C: RESTRICTION CLASSIFICATION PRECEDENCE & DOMAIN PURITY (ADR-TR-04, ADR-TR-05, INV-TR-08, AC-TR-08)
   * ============================================================================
   */
  test("GROUP C: ADR-TR-04, ADR-TR-05, INV-TR-08 & AC-TR-08: Classification Precedence & Domain Purity", async () => {
    // Classification rules matrix verification
    const fixtures = [
      // 1. Motorways always resolve to PROHIBITED_TOLL_ROAD
      { highway: "motorway", toll: "no", expected: "PROHIBITED_TOLL_ROAD" },
      { highway: "motorway", toll: "yes", expected: "PROHIBITED_TOLL_ROAD" },
      { highway: "motorway_link", toll: "no", expected: "PROHIBITED_TOLL_ROAD" },
      { highway: "motorway_link", toll: "yes", expected: "PROHIBITED_TOLL_ROAD" },
      
      // 2. Arterials with toll=yes resolve to PROHIBITED_TOLL_ROAD
      { highway: "trunk", toll: "yes", expected: "PROHIBITED_TOLL_ROAD" },
      { highway: "primary", toll: "yes", expected: "PROHIBITED_TOLL_ROAD" },
      { highway: "secondary", toll: "yes", expected: "PROHIBITED_TOLL_ROAD" },
      { highway: "trunk_link", toll: "yes", expected: "PROHIBITED_TOLL_ROAD" },

      // 3. Arterials with toll != yes resolve to PROHIBITED_ROAD (Pilar 2)
      { highway: "trunk", toll: "no", expected: "PROHIBITED_ROAD" },
      { highway: "primary", toll: "no", expected: "PROHIBITED_ROAD" },
      { highway: "secondary", toll: "no", expected: "PROHIBITED_ROAD" },
      { highway: "trunk", toll: undefined, expected: "PROHIBITED_ROAD" },

      // 4. Other types resolve to NOT_ACQUIRED
      { highway: "residential", toll: "no", expected: "NOT_ACQUIRED" },
      { highway: "service", toll: "no", expected: "NOT_ACQUIRED" },
    ];

    const classifyRoad = (tags) => {
      const isToll = tags.toll === "yes";
      const hw = tags.highway;
      if (isToll || hw === "motorway" || hw === "motorway_link") {
        return "PROHIBITED_TOLL_ROAD";
      }
      if (["trunk", "trunk_link", "primary", "primary_link", "secondary", "secondary_link"].includes(hw)) {
        return "PROHIBITED_ROAD";
      }
      return "NOT_ACQUIRED";
    };

    fixtures.forEach((f, idx) => {
      const res = classifyRoad({ highway: f.highway, toll: f.toll });
      assert.equal(res, f.expected, `Fixture #${idx + 1} (${f.highway}, toll=${f.toll}) must be ${f.expected}`);
    });

    // Domain Purity Invariant in DB (INV-TR-08 & AC-TR-08)
    const { rows: purityRows } = await pool.query(`
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

    assert.equal(purityRows[0].toll_purity_violations, 0, "INV-TR-08: Zero non-toll/non-motorway roads in PROHIBITED_TOLL_ROAD");
    assert.equal(purityRows[0].protocol_purity_violations, 0, "AC-TR-08: Zero motorway or toll=yes roads in PROHIBITED_ROAD");
  });

  /*
   * ============================================================================
   * GROUP D: IDEMPOTENCY & IN-PLACE UPDATES (ADR-TR-08, INV-TR-09)
   * ============================================================================
   */
  test("GROUP D: ADR-TR-08 & INV-TR-09: State-Based Idempotency and In-Place Geometry Updates", async () => {
    const extId = `${TEST_ID_PREFIX}03`;
    const initialToll = {
      external_id: extId,
      name: "Jalan Tol Idempotency Initial",
      highway_type: "motorway",
      restriction_type: "PROHIBITED_TOLL_ROAD",
      metadata: { highway: "motorway", toll: "yes", version: "v1" },
      geometry: {
        type: "LineString",
        coordinates: [
          [112.710, -7.440],
          [112.711, -7.441],
        ],
      },
    };

    // 1. Initial Ingestion
    await roadRepository.bulkCreate([initialToll]);
    const { rows: r1 } = await pool.query("SELECT id, external_id, name, metadata, ST_AsText(geom) AS geom_wkt FROM protocol_roads WHERE external_id = $1;", [extId]);
    assert.equal(r1.length, 1);
    const initialUuid = r1[0].id;

    // 2. Re-ingestion with In-Place Geometry and Tag Updates
    const updatedToll = {
      external_id: extId,
      name: "Jalan Tol Idempotency Updated",
      highway_type: "motorway",
      restriction_type: "PROHIBITED_TOLL_ROAD",
      metadata: { highway: "motorway", toll: "yes", version: "v2", lanes: "4" },
      geometry: {
        type: "LineString",
        coordinates: [
          [112.710, -7.440],
          [112.712, -7.442],
        ],
      },
    };

    await roadRepository.bulkCreate([updatedToll]);
    const { rows: r2 } = await pool.query("SELECT id, external_id, name, metadata, ST_AsText(geom) AS geom_wkt FROM protocol_roads WHERE external_id = $1;", [extId]);
    assert.equal(r2.length, 1, "Must not create a new physical row");
    assert.equal(r2[0].id, initialUuid, "Primary Key UUID must remain unchanged across in-place updates");
    assert.equal(r2[0].name, "Jalan Tol Idempotency Updated", "Road name must update in place");
    assert.equal(r2[0].metadata.version, "v2", "Metadata must update in place");
    assert.equal(r2[0].geom_wkt, "LINESTRING(112.71 -7.44,112.712 -7.442)", "PostGIS LineString geometry must update in place");
  });

  /*
   * ============================================================================
   * GROUP E: PROVENANCE & METADATA RETENTION (ADR-TR-07, AC-TR-09)
   * ============================================================================
   */
  test("GROUP E: ADR-TR-07 & AC-TR-09: Forensic Traceability and Metadata Retention", async () => {
    const tollWithMeta = {
      external_id: `${TEST_ID_PREFIX}04`,
      name: "Jalan Tol Surabaya–Gempol KM 25",
      highway_type: "motorway",
      restriction_type: "PROHIBITED_TOLL_ROAD",
      metadata: {
        highway: "motorway",
        toll: "yes",
        ref: "8",
        operator: "PT Jasamarga Surabaya-Gempol",
        maxspeed: "100",
        surface: "concrete",
      },
      geometry: {
        type: "LineString",
        coordinates: [
          [112.7150, -7.4450],
          [112.7160, -7.4460],
        ],
      },
    };

    await roadRepository.bulkCreate([tollWithMeta]);

    const { rows } = await pool.query("SELECT metadata FROM protocol_roads WHERE external_id = $1;", [tollWithMeta.external_id]);
    const meta = rows[0]?.metadata;

    assert.ok(meta, "Metadata JSONB must be populated");
    assert.equal(meta.highway, "motorway", "Must retain source OSM highway tag");
    assert.equal(meta.toll, "yes", "Must retain toll tag");
    assert.equal(meta.ref, "8", "Must retain ref tag");
    assert.equal(meta.operator, "PT Jasamarga Surabaya-Gempol", "Must retain operator tag");
  });

  /*
   * ============================================================================
   * GROUP F: 3-TIER CONSUMER SPATIAL SEMANTICS (ADR-TR-06, INV-TR-10, AC-TR-03..07)
   * ============================================================================
   */
  describe("GROUP F: ADR-TR-06, INV-TR-10 & AC-TR-03..07: 3-Tier Consumer Semantics & Independence", () => {
    const tollRoadExtId = `${TEST_ID_PREFIX}05`;

    before(async () => {
      // Create a dedicated toll road for consumer testing: Line from [112.7050, -7.4000] to [112.7050, -7.4100]
      await roadRepository.bulkCreate([
        {
          external_id: tollRoadExtId,
          name: "Jalan Tol Consumer Baseline",
          highway_type: "motorway",
          restriction_type: "PROHIBITED_TOLL_ROAD",
          metadata: { highway: "motorway", toll: "yes" },
          geometry: {
            type: "LineString",
            coordinates: [
              [112.7050, -7.4000],
              [112.7050, -7.4100],
            ],
          },
        },
      ]);
    });

    test("Consumer Tier 1 (Zone): ST_Intersects triggers HTTP 409 ZONE_INTERSECTS_TOLL_ROAD when rule ON, advisory when OFF (AC-TR-03, AC-TR-04)", async () => {
      // Polygon that crosses longitude 112.7050 (intersects toll road)
      const intersectingPolygon = {
        type: "Polygon",
        coordinates: [
          [
            [112.7040, -7.4020],
            [112.7060, -7.4020],
            [112.7060, -7.4080],
            [112.7040, -7.4080],
            [112.7040, -7.4020],
          ],
        ],
      };

      // Case 1: Rule ON (Default)
      await operationalRuleService.updateOperationalRules({ toll_road_prohibited: true, protocol_road_prohibited: true });
      const checkOn = await zoneService.checkProhibitedRoadIntersection(JSON.stringify(intersectingPolygon));
      assert.ok(checkOn && checkOn.length > 0, "PostGIS ST_Intersects must detect the intersecting toll road");

      let errorThrown = null;
      try {
        await zoneService.evaluateProhibitedRoadError(checkOn, false);
      } catch (err) {
        errorThrown = err;
      }
      assert.ok(errorThrown, "Must throw error when toll road restriction rule is ON");
      assert.equal(errorThrown.statusCode, 409, "Must return HTTP 409 Conflict");
      assert.equal(errorThrown.code, "ZONE_INTERSECTS_TOLL_ROAD", "Error code must be ZONE_INTERSECTS_TOLL_ROAD");
      assert.equal(errorThrown.details.restriction_type, "PROHIBITED_TOLL_ROAD", "Details restriction_type must be PROHIBITED_TOLL_ROAD");

      // Case 2: Rule OFF
      await operationalRuleService.updateOperationalRules({ toll_road_prohibited: false });
      const checkOff = await zoneService.checkProhibitedRoadIntersection(JSON.stringify(intersectingPolygon));
      const warnings = await zoneService.evaluateProhibitedRoadError(checkOff, false);
      assert.ok(Array.isArray(warnings), "Must return advisory warnings instead of throwing error");
      const tollWarning = warnings.find((w) => w.type === "TOLL_ROAD");
      assert.ok(tollWarning, "Must contain a TOLL_ROAD advisory warning");
      assert.equal(tollWarning.enforcement, "ADVISORY");

      // Restore rule
      await operationalRuleService.updateOperationalRules({ toll_road_prohibited: true });
    });

    test("Consumer Tier 2 (Candidate Spot): <=10m buffer rejected as PROHIBITED_TOLL_ROAD, >10m allowed (AC-TR-05, AC-TR-06)", async () => {
      // Create a test container zone covering the test area
      const testZoneGeom = {
        type: "Polygon",
        coordinates: [
          [
            [112.6950, -7.3950],
            [112.7150, -7.3950],
            [112.7150, -7.4150],
            [112.6950, -7.4150],
            [112.6950, -7.3950],
          ],
        ],
      };
      const zone = await ZoneModel.create({
        name: "Test Contract Toll Zone Candidate Spot",
        status: "ACTIVE",
        polygon: testZoneGeom,
      });

      // Spot 1: Proximity ~5m from toll road at lon 112.7050 (Spot at lon 112.705045, lat -7.4050 -> ~5 meters)
      const spotNear = await spatialRestrictionService.validateCandidateSpot(-7.4050, 112.705045, zone.id);
      assert.equal(spotNear.validation_status, "REJECTED", "Spot <= 10m from toll road must be REJECTED");
      assert.equal(spotNear.rejection_reason, "PROHIBITED_TOLL_ROAD", "Rejection reason must be PROHIBITED_TOLL_ROAD");

      // Spot 2: Proximity ~50m from toll road at lon 112.7050 (Spot at lon 112.70545, lat -7.4050 -> ~50 meters)
      const spotFar = await spatialRestrictionService.validateCandidateSpot(-7.4050, 112.70545, zone.id);
      assert.equal(spotFar.validation_status, "ALLOWED", "Spot > 10m from toll road inside active zone must be ALLOWED");

      // Cleanup test zone
      await pool.query("DELETE FROM zones WHERE id = $1;", [zone.id]);
    });

    test("Consumer Tier 3 (Rider LBS): <=50m triggers PROHIBITED_ROAD_ALERT in telemetry (AC-TR-07)", async () => {
      // Query LBS road violation logic: Point at ~30 meters from toll road (lon 112.70527, lat -7.4050)
      const lat = -7.4050;
      const lon = 112.70527;

      const roadViolationQuery = `
        SELECT id, external_id, name, highway_type, restriction_type
        FROM protocol_roads
        WHERE restriction_type = 'PROHIBITED_TOLL_ROAD'
          AND ST_DWithin(
            ST_SetSRID(geom, 4326)::geography,
            ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
            50
          )
        LIMIT 1;
      `;
      const { rows } = await pool.query(roadViolationQuery, [lon, lat]);
      assert.ok(rows.length > 0, "Rider within 50m must match toll road");
      assert.equal(rows[0].external_id, tollRoadExtId);
      assert.equal(rows[0].restriction_type, "PROHIBITED_TOLL_ROAD");
    });

    test("INV-TR-10: Consumer Independence: Zone (Intersects), Candidate (10m), and Rider (50m) operate independently", async () => {
      // Point at 25 meters from toll road (lon 112.705225, lat -7.4050):
      // - Candidate check (10m) MUST BE ALLOWED (25m > 10m)
      // - Rider check (50m) MUST BE ALERTED (25m <= 50m)
      const lat = -7.4050;
      const lon = 112.705225; // ~25 meters from 112.7050

      // Candidate 10m check
      const { rows: candRows } = await pool.query(
        `SELECT COUNT(*)::int AS count
         FROM protocol_roads
         WHERE restriction_type = 'PROHIBITED_TOLL_ROAD'
           AND ST_Intersects(geom, ST_Buffer(ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, 10)::geometry);`,
        [lon, lat]
      );
      assert.equal(candRows[0].count, 0, "25m distance is OUTSIDE Candidate 10m buffer (Allowed)");

      // Rider 50m check
      const { rows: riderRows } = await pool.query(
        `SELECT COUNT(*)::int AS count
         FROM protocol_roads
         WHERE restriction_type = 'PROHIBITED_TOLL_ROAD'
           AND ST_DWithin(ST_SetSRID(geom, 4326)::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, 50);`,
        [lon, lat]
      );
      assert.equal(riderRows[0].count, 1, "25m distance is INSIDE Rider 50m alert zone (Alerted)");
    });
  });

  /*
   * ============================================================================
   * GROUP G: ACQUISITION REFINEMENT: CUSTOM BBOX & PROVENANCE DTO (AC-TR-01, AC-TR-09)
   * ============================================================================
   */
  test("GROUP G: ADR-TR-07, AC-TR-01 & AC-TR-09: Custom BBox Execution & Standardized Provenance DTO", async () => {
    let capturedQuery = null;
    const mockClient = {
      fetchOverpassData: async (query) => {
        capturedQuery = query;
        return [
          {
            type: "way",
            id: 887799,
            tags: {
              name: "Jalan Tol Custom Bbox Test",
              highway: "motorway",
              toll: "yes",
              ref: "8",
              operator: "PT Jasamarga",
            },
            geometry: [
              { lon: 112.710, lat: -7.420 },
              { lon: 112.711, lat: -7.421 },
            ],
          },
        ];
      },
    };

    const syncService = new RoadOverpassSyncService(mockClient, roadRepository);

    const customBbox = { minLat: -7.45, minLon: 112.70, maxLat: -7.40, maxLon: 112.75 };
    const runId = "TEST-RUN-TR-01";
    const result = await syncService.syncTollRoadsFromOverpass({ customBbox, runId });

    // 1. Verify customBbox was properly incorporated in Overpass query
    assert.ok(capturedQuery, "Query must be sent to overpass client");
    assert.ok(capturedQuery.includes("(-7.45,112.7,-7.4,112.75)"), "Query must contain customBbox coordinates");
    assert.ok(capturedQuery.includes('way["highway"="motorway"]'), "Query must query motorway");
    assert.ok(capturedQuery.includes('way["toll"="yes"]'), "Query must query toll=yes");

    // 2. Verify Standardized Provenance DTO structure
    assert.equal(result.success, true);
    assert.equal(result.runId, runId);
    assert.equal(result.source, "OVERPASS_API");
    assert.equal(result.endpoint, "https://overpass-api.de/api/interpreter");
    assert.equal(result.queryScope, "BBOX: (-7.45,112.7,-7.4,112.75)");
    assert.ok(result.acquiredAt, "acquiredAt timestamp must be present");
    assert.equal(result.rawAcquired, 1, "rawAcquired must match raw element count");
    assert.equal(result.rawPersisted, 1, "rawPersisted must match valid persisted count");
    assert.equal(result.tollRoadsCount, 1, "tollRoadsCount must match returned PostGIS rows");
    assert.equal(result.restriction_type, "PROHIBITED_TOLL_ROAD");
  });
});
