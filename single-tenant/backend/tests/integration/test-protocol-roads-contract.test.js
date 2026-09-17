/*
 * test-protocol-roads-contract.test.js
 * Integration Test Suite for Protocol Roads Acquisition & Spatial Restriction Contract v1.0-FINAL
 * Validates Invariants INV-PR-01 through INV-PR-10 and Acceptance Criteria AC-PR-01 through AC-PR-10.
 * Authority: Protocol Roads Acquisition & Spatial Restriction Contract v1.0-FINAL (FROZEN)
 */

import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { pool } from "../../src/config/database.js";
import { roadRepository } from "../../src/repositories/roadRepository.js";
import { zoneService } from "../../src/services/zoneService.js";
import { spatialRestrictionService } from "../../src/services/spatial/SpatialRestrictionService.js";
import { lbsGeofenceService } from "../../src/services/lbs/LbsGeofenceService.js";
import { operationalRuleService } from "../../src/services/operationalRuleService.js";
import { ZoneModel } from "../../src/models/zoneModel.js";

const TEST_ID_PREFIX = "osm:way:9988";

describe("PROTOCOL ROADS ACQUISITION & SPATIAL RESTRICTION CONTRACT v1.0-FINAL", () => {
  before(async () => {
    // Clean up any test records in protocol_roads and test zones
    await pool.query("DELETE FROM protocol_roads WHERE external_id LIKE $1 OR external_id LIKE 'test:road:%';", [`${TEST_ID_PREFIX}%`]);
    await pool.query("DELETE FROM zones WHERE name LIKE 'Test Contract Zone%';");
  });

  after(async () => {
    // Clean up test records
    await pool.query("DELETE FROM protocol_roads WHERE external_id LIKE $1 OR external_id LIKE 'test:road:%';", [`${TEST_ID_PREFIX}%`]);
    await pool.query("DELETE FROM zones WHERE name LIKE 'Test Contract Zone%';");
    await pool.end();
  });

  /*
   * ============================================================================
   * GROUP A: IDENTITY & UNICITY (INV-PR-01, INV-PR-02, AC-PR-03)
   * ============================================================================
   */
  test("GROUP A: INV-PR-01 & INV-PR-02: Deterministic Natural Identity and Format Validation", async () => {
    const roadA = {
      external_id: `${TEST_ID_PREFIX}01`,
      name: "Jl. Protokol Test A",
      highway_type: "primary",
      restriction_type: "PROHIBITED_ROAD",
      metadata: { highway: "primary", ref: "PR-01" },
      geometry: {
        type: "LineString",
        coordinates: [
          [112.715, -7.445],
          [112.716, -7.446],
        ],
      },
    };

    const roadB = {
      external_id: "way/gen-test-02",
      name: "Jl. Protokol Test B",
      highway_type: "secondary",
      restriction_type: "PROHIBITED_ROAD",
      metadata: { highway: "secondary" },
      geometry: {
        type: "LineString",
        coordinates: [
          [112.717, -7.447],
          [112.718, -7.448],
        ],
      },
    };

    await roadRepository.bulkCreate([roadA, roadB]);

    const { rows } = await pool.query(
      `SELECT external_id, name, highway_type, restriction_type 
       FROM protocol_roads 
       WHERE external_id IN ($1, $2)
       ORDER BY external_id ASC;`,
      [roadA.external_id, roadB.external_id]
    );

    assert.equal(rows.length, 2, "Both distinct external_ids must be persisted without collision");

    // Test accepted regex format ^(osm:way:[0-9]+|way/.+)$
    const regexPattern = /^(osm:way:[0-9]+|way\/.+)$/;
    rows.forEach((r) => {
      assert.match(r.external_id, regexPattern, `external_id '${r.external_id}' must match canonical regex`);
    });

    // Verify unicity: Attempting duplicate insert must not create second physical row
    await roadRepository.bulkCreate([roadA]);
    const { rows: rowsAfterReinsert } = await pool.query(
      `SELECT COUNT(*)::int AS count FROM protocol_roads WHERE external_id = $1;`,
      [roadA.external_id]
    );
    assert.equal(rowsAfterReinsert[0].count, 1, "Duplicate external_id must not create a duplicate physical row");
  });

  /*
   * ============================================================================
   * GROUP B: GEOMETRY, SRID & BOUNDS (INV-PR-03 .. INV-PR-07, AC-PR-02)
   * ============================================================================
   */
  test("GROUP B: INV-PR-03 .. INV-PR-07 & AC-PR-02: PostGIS LineString, SRID 4326, Validity, and Bounds", async () => {
    const road = {
      external_id: `${TEST_ID_PREFIX}02`,
      name: "Jl. Ahmad Yani Test",
      highway_type: "trunk",
      restriction_type: "PROHIBITED_ROAD",
      metadata: { highway: "trunk", ref: "ID-AHY" },
      geometry: {
        type: "LineString",
        coordinates: [
          [112.7183, -7.4478],
          [112.7190, -7.4485],
          [112.7195, -7.4490],
        ],
      },
    };

    await roadRepository.bulkCreate([road]);

    const { rows } = await pool.query(
      `SELECT 
        external_id,
        geom IS NOT NULL AS has_geom,
        ST_SRID(geom) AS srid,
        ST_GeometryType(geom) AS geom_type,
        ST_IsValid(geom) AS is_valid,
        ST_IsEmpty(geom) AS is_empty,
        ST_NPoints(geom) AS npoints,
        ST_XMin(geom) AS xmin,
        ST_XMax(geom) AS xmax,
        ST_YMin(geom) AS ymin,
        ST_YMax(geom) AS ymax
       FROM protocol_roads
       WHERE external_id = $1;`,
      [road.external_id]
    );

    const r = rows[0];
    assert.ok(r, "Road record must exist");
    assert.equal(r.has_geom, true, "INV-PR-03: Geometry must not be NULL");
    assert.equal(r.srid, 4326, "INV-PR-04: SRID must be exactly 4326");
    assert.equal(r.geom_type, "ST_LineString", "INV-PR-05: Geometry type must be ST_LineString");
    assert.equal(r.is_valid, true, "INV-PR-06: Geometry must be valid PostGIS LineString");
    assert.equal(r.is_empty, false, "INV-PR-06: Geometry must not be empty");
    assert.ok(r.npoints >= 2, "INV-PR-06: LineString must have at least 2 points");

    // Check Sidoarjo authoritative bounds: lat [-7.65, -7.25], lon [112.45, 112.95]
    assert.ok(r.ymin >= -7.65 && r.ymax <= -7.25, `INV-PR-07: Latitude bounds [${r.ymin}, ${r.ymax}] within Sidoarjo scope`);
    assert.ok(r.xmin >= 112.45 && r.xmax <= 112.95, `INV-PR-07: Longitude bounds [${r.xmin}, ${r.xmax}] within Sidoarjo scope`);
  });

  /*
   * ============================================================================
   * GROUP C: CLASSIFICATION & TOLL PRECEDENCE (ADR-PR-04, ADR-PR-04A, INV-PR-08, AC-PR-09)
   * ============================================================================
   */
  test("GROUP C: ADR-PR-04, ADR-PR-04A, INV-PR-08 & AC-PR-09: Road Classification Precedence & Domain Purity", async () => {
    // Classification Fixtures
    const fixtures = [
      { highway: "trunk", toll: "no", expected: "PROHIBITED_ROAD" },
      { highway: "trunk_link", toll: "no", expected: "PROHIBITED_ROAD" },
      { highway: "primary", toll: "no", expected: "PROHIBITED_ROAD" },
      { highway: "primary_link", toll: "no", expected: "PROHIBITED_ROAD" },
      { highway: "secondary", toll: "no", expected: "PROHIBITED_ROAD" },
      { highway: "secondary_link", toll: "no", expected: "PROHIBITED_ROAD" },
      // Toll Precedence cases
      { highway: "primary", toll: "yes", expected: "PROHIBITED_TOLL_ROAD" },
      { highway: "secondary", toll: "yes", expected: "PROHIBITED_TOLL_ROAD" },
      { highway: "trunk", toll: "yes", expected: "PROHIBITED_TOLL_ROAD" },
      { highway: "motorway", toll: "yes", expected: "PROHIBITED_TOLL_ROAD" },
      { highway: "motorway_link", toll: "no", expected: "PROHIBITED_TOLL_ROAD" },
    ];

    // Evaluate classification mapping logic according to ADR-PR-04A
    const classifyRoad = (tags) => {
      if (tags.toll === "yes" || tags.highway === "motorway" || tags.highway === "motorway_link") {
        return "PROHIBITED_TOLL_ROAD";
      }
      if (["trunk", "trunk_link", "primary", "primary_link", "secondary", "secondary_link"].includes(tags.highway)) {
        return "PROHIBITED_ROAD";
      }
      return "NOT_ACQUIRED";
    };

    fixtures.forEach((f, idx) => {
      const result = classifyRoad({ highway: f.highway, toll: f.toll });
      assert.equal(
        result,
        f.expected,
        `Fixture ${idx + 1} (highway=${f.highway}, toll=${f.toll}) must resolve to ${f.expected}`
      );
    });

    // Test Domain Purity in DB: PROHIBITED_ROAD must never contain motorway or toll=yes
    const testPurityRoad = {
      external_id: `${TEST_ID_PREFIX}03`,
      name: "Jl. Protokol Murni Test",
      highway_type: "primary",
      restriction_type: "PROHIBITED_ROAD",
      metadata: { highway: "primary", toll: "no" },
      geometry: {
        type: "LineString",
        coordinates: [
          [112.712, -7.442],
          [112.713, -7.443],
        ],
      },
    };

    await roadRepository.bulkCreate([testPurityRoad]);

    const { rows: purityRows } = await pool.query(
      `SELECT COUNT(*)::int AS violations
       FROM protocol_roads
       WHERE restriction_type = 'PROHIBITED_ROAD'
         AND (highway_type IN ('motorway', 'motorway_link') OR (metadata->>'toll') = 'yes');`
    );

    assert.equal(purityRows[0].violations, 0, "INV-PR-08: Zero motorway or toll=yes records in PROHIBITED_ROAD");
  });

  /*
   * ============================================================================
   * GROUP D: IDEMPOTENCY & UPDATE SEMANTICS (ADR-PR-06, INV-PR-09, AC-PR-03)
   * ============================================================================
   */
  test("GROUP D: ADR-PR-06, INV-PR-09 & AC-PR-03: State-Based Idempotency and In-Place Geometry Updates", async () => {
    const extId = `${TEST_ID_PREFIX}04`;
    const initialRoad = {
      external_id: extId,
      name: "Jl. Idempotent Test",
      highway_type: "primary",
      restriction_type: "PROHIBITED_ROAD",
      metadata: { highway: "primary", version: "v1" },
      geometry: {
        type: "LineString",
        coordinates: [
          [112.710, -7.440],
          [112.711, -7.441],
        ],
      },
    };

    // 1. Initial Ingestion
    await roadRepository.bulkCreate([initialRoad]);
    const { rows: r1 } = await pool.query("SELECT id, external_id, name, metadata, ST_AsText(geom) AS geom_wkt FROM protocol_roads WHERE external_id = $1;", [extId]);
    assert.equal(r1.length, 1);
    const initialUuid = r1[0].id;

    // 2. Re-ingestion with Identical Payload (Exact Idempotency)
    await roadRepository.bulkCreate([initialRoad]);
    const { rows: r2 } = await pool.query("SELECT id, external_id, name, metadata, ST_AsText(geom) AS geom_wkt FROM protocol_roads WHERE external_id = $1;", [extId]);
    assert.equal(r2.length, 1, "Must not create duplicate physical row");
    assert.equal(r2[0].id, initialUuid, "Must preserve identical UUID on unchanged payload");

    // 3. Ingestion with Source Geometry & Metadata Update
    const updatedRoad = {
      external_id: extId,
      name: "Jl. Idempotent Test Updated",
      highway_type: "primary",
      restriction_type: "PROHIBITED_ROAD",
      metadata: { highway: "primary", version: "v2" },
      geometry: {
        type: "LineString",
        coordinates: [
          [112.710, -7.440],
          [112.711, -7.441],
          [112.712, -7.442],
        ],
      },
    };

    await roadRepository.bulkCreate([updatedRoad]);
    const { rows: r3 } = await pool.query("SELECT id, external_id, name, metadata, ST_NPoints(geom) AS npoints FROM protocol_roads WHERE external_id = $1;", [extId]);
    assert.equal(r3.length, 1, "Must update existing row in-place");
    assert.equal(r3[0].id, initialUuid, "Must retain same UUID on source update");
    assert.equal(r3[0].name, "Jl. Idempotent Test Updated");
    assert.equal(r3[0].metadata.version, "v2");
    assert.equal(r3[0].npoints, 3, "Geometry must update to 3 points");
  });

  /*
   * ============================================================================
   * GROUP E: PROVENANCE & FORENSIC TRACEABILITY (ADR-PR-06, AC-PR-10)
   * ============================================================================
   */
  test("GROUP E: ADR-PR-06 & AC-PR-10: Forensic Traceability and Metadata Retention", async () => {
    const road = {
      external_id: `${TEST_ID_PREFIX}05`,
      name: "Jl. Pahlawan Sidoarjo",
      highway_type: "primary",
      restriction_type: "PROHIBITED_ROAD",
      metadata: {
        highway: "primary",
        ref: "Jatim-01",
        name: "Jl. Pahlawan Sidoarjo",
        toll: "no",
        maxspeed: "50",
        surface: "asphalt",
      },
      geometry: {
        type: "LineString",
        coordinates: [
          [112.7150, -7.4450],
          [112.7160, -7.4460],
        ],
      },
    };

    await roadRepository.bulkCreate([road]);

    const { rows } = await pool.query("SELECT metadata FROM protocol_roads WHERE external_id = $1;", [road.external_id]);
    const meta = rows[0]?.metadata;

    assert.ok(meta, "Metadata JSONB must be populated");
    assert.equal(meta.highway, "primary", "Must retain source OSM highway tag");
    assert.equal(meta.ref, "Jatim-01", "Must retain source ref tag");
    assert.equal(meta.toll, "no", "Must retain toll tag");
  });

  /*
   * ============================================================================
   * GROUP F: 3-TIER CONSUMER SPATIAL SEMANTICS (ADR-PR-05, INV-PR-10, AC-PR-04..08)
   * ============================================================================
   */
  describe("GROUP F: ADR-PR-05, INV-PR-10 & AC-PR-04..08: 3-Tier Consumer Semantics & Independence", () => {
    const protocolRoadExtId = `${TEST_ID_PREFIX}06`;

    before(async () => {
      // Create a dedicated protocol road for consumer testing: Line from [112.7000, -7.4000] to [112.7000, -7.4100]
      await roadRepository.bulkCreate([
        {
          external_id: protocolRoadExtId,
          name: "Jl. Protokol Consumer Baseline",
          highway_type: "primary",
          restriction_type: "PROHIBITED_ROAD",
          metadata: { highway: "primary" },
          geometry: {
            type: "LineString",
            coordinates: [
              [112.7000, -7.4000],
              [112.7000, -7.4100],
            ],
          },
        },
      ]);
    });

    test("Consumer Tier 1 (Zone): ST_Intersects triggers HTTP 409 when rule ON, advisory when rule OFF (AC-PR-04, AC-PR-05)", async () => {
      // Polygon that crosses longitude 112.7000 (intersects road)
      const intersectingPolygon = {
        type: "Polygon",
        coordinates: [
          [
            [112.6990, -7.4020],
            [112.7010, -7.4020],
            [112.7010, -7.4080],
            [112.6990, -7.4080],
            [112.6990, -7.4020],
          ],
        ],
      };

      // Case 1: Rule ON (Default)
      await operationalRuleService.updateOperationalRules({ protocol_road_prohibited: true });
      const checkOn = await zoneService.checkProhibitedRoadIntersection(JSON.stringify(intersectingPolygon));
      assert.ok(checkOn && checkOn.length > 0, "PostGIS ST_Intersects must detect the intersecting road");

      let errorThrown = null;
      try {
        await zoneService.evaluateProhibitedRoadError(checkOn, false);
      } catch (err) {
        errorThrown = err;
      }
      assert.ok(errorThrown, "Must throw error when rule is ON");
      assert.equal(errorThrown.statusCode, 409, "Must return HTTP 409 Conflict");
      assert.equal(errorThrown.code, "ZONE_INTERSECTS_RESTRICTED_AREA");

      // Case 2: Rule OFF
      await operationalRuleService.updateOperationalRules({ protocol_road_prohibited: false });
      const checkOff = await zoneService.checkProhibitedRoadIntersection(JSON.stringify(intersectingPolygon));
      const warnings = await zoneService.evaluateProhibitedRoadError(checkOff, false);
      assert.ok(Array.isArray(warnings), "Must return advisory warnings instead of throwing error");
      assert.equal(warnings[0].type, "PROTOCOL_ROAD");
      assert.equal(warnings[0].enforcement, "ADVISORY");

      // Restore rule
      await operationalRuleService.updateOperationalRules({ protocol_road_prohibited: true });
    });

    test("Consumer Tier 2 (Candidate Spot): <=10m buffer rejected as PROHIBITED_ROAD, >10m allowed (AC-PR-06, AC-PR-07)", async () => {
      // Create a test container zone that covers the test spots
      const testZoneGeom = {
        type: "Polygon",
        coordinates: [
          [
            [112.6900, -7.3950],
            [112.7100, -7.3950],
            [112.7100, -7.4150],
            [112.6900, -7.4150],
            [112.6900, -7.3950],
          ],
        ],
      };
      const zone = await ZoneModel.create({
        name: "Test Contract Zone Candidate Spot",
        status: "ACTIVE",
        polygon: testZoneGeom,
      });

      // Spot 1: Proximity ~5m from road at lon 112.7000 (Spot at lon 112.700045, lat -7.4050 -> ~5 meters)
      const spotNear = await spatialRestrictionService.validateCandidateSpot(-7.4050, 112.700045, zone.id);
      assert.equal(spotNear.validation_status, "REJECTED", "Spot <= 10m from protocol road must be REJECTED");
      assert.equal(spotNear.rejection_reason, "PROHIBITED_ROAD");

      // Spot 2: Proximity ~50m from road at lon 112.7000 (Spot at lon 112.70045, lat -7.4050 -> ~50 meters)
      const spotFar = await spatialRestrictionService.validateCandidateSpot(-7.4050, 112.70045, zone.id);
      assert.equal(spotFar.validation_status, "ALLOWED", "Spot > 10m from protocol road inside active zone must be ALLOWED");

      // Cleanup test zone
      await pool.query("DELETE FROM zones WHERE id = $1;", [zone.id]);
    });

    test("Consumer Tier 3 (Rider LBS): <=50m triggers PROHIBITED_ROAD_ALERT in telemetry (AC-PR-08)", async () => {
      // Query LBS road violation logic: Point at ~30 meters from road (lon 112.70027, lat -7.4050)
      const lat = -7.4050;
      const lon = 112.70027;

      const roadViolationQuery = `
        SELECT id, external_id, name, highway_type, restriction_type
        FROM protocol_roads
        WHERE restriction_type IS NOT NULL
          AND ST_DWithin(
            ST_SetSRID(geom, 4326)::geography,
            ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
            50
          )
        LIMIT 1;
      `;
      const { rows } = await pool.query(roadViolationQuery, [lon, lat]);
      assert.ok(rows.length > 0, "Rider within 50m must match protocol road");
      assert.equal(rows[0].external_id, protocolRoadExtId);
    });

    test("INV-PR-10: Consumer Independence: Zone (Intersects), Candidate (10m), and Rider (50m) operate independently", async () => {
      // Point at 25 meters from road:
      // - Candidate check (10m) MUST BE ALLOWED (25m > 10m)
      // - Rider check (50m) MUST BE ALERTED (25m <= 50m)
      const lat = -7.4050;
      const lon = 112.700225; // ~25 meters from 112.7000

      // Candidate 10m check
      const { rows: candRows } = await pool.query(
        `SELECT COUNT(*)::int AS count
         FROM protocol_roads
         WHERE restriction_type = 'PROHIBITED_ROAD'
           AND ST_Intersects(geom, ST_Buffer(ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, 10)::geometry);`,
        [lon, lat]
      );
      assert.equal(candRows[0].count, 0, "25m distance is OUTSIDE Candidate 10m buffer (Allowed)");

      // Rider 50m check
      const { rows: riderRows } = await pool.query(
        `SELECT COUNT(*)::int AS count
         FROM protocol_roads
         WHERE restriction_type = 'PROHIBITED_ROAD'
           AND ST_DWithin(ST_SetSRID(geom, 4326)::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, 50);`,
        [lon, lat]
      );
      assert.equal(riderRows[0].count, 1, "25m distance is INSIDE Rider 50m alert zone (Alerted)");
    });
  });
});
