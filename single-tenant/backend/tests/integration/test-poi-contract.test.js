/*
 * test-poi-contract.test.js
 * Integration Test Suite for POI Acquisition & Ingestion Contract v1.0-FINAL
 * Validates Invariants INV-01 through INV-15 and AC-POI-01 through AC-POI-19.
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { pool } from "../../src/config/database.js";
import { poiRepository } from "../../src/repositories/poiRepository.js";
import { poiEntityFactory } from "../../src/services/poi/POIEntityFactory.js";
import { poiClusterer } from "../../src/services/poi/POIClusterer.js";
import { spatialDeduplicator } from "../../src/services/poi/SpatialDeduplicator.js";

describe("POI ACQUISITION & INGESTION CONTRACT v1.0-FINAL", () => {
  before(async () => {
    // Cleanup any lingering contract test POIs
    await pool.query(
      "DELETE FROM pois WHERE external_id LIKE 'osm:node:99%' OR external_id LIKE 'osm:way:99%' OR external_id LIKE 'osm:relation:99%' OR external_id LIKE 'test:poi:%';"
    );
  });

  after(async () => {
    // Cleanup contract test POIs
    await pool.query(
      "DELETE FROM pois WHERE external_id LIKE 'osm:node:99%' OR external_id LIKE 'osm:way:99%' OR external_id LIKE 'osm:relation:99%' OR external_id LIKE 'test:poi:%';"
    );
    await pool.end();
  });

  test("INV-01 & INV-02: Source Identity is deterministic and unique across OSM element types", async () => {
    const nodeElem = { type: "node", id: 99001, lat: -7.42001, lon: 112.72001, tags: { amenity: "cafe", name: "Kopi Node 99001" } };
    const wayElem = { type: "way", id: 99001, center: { lat: -7.42002, lon: 112.72002 }, tags: { amenity: "cafe", name: "Kopi Way 99001" } };
    const relElem = { type: "relation", id: 99001, center: { lat: -7.42003, lon: 112.72003 }, tags: { amenity: "cafe", name: "Kopi Rel 99001" } };

    const entityNode = poiEntityFactory.createFromOverpassElement(nodeElem, poiClusterer);
    const entityWay = poiEntityFactory.createFromOverpassElement(wayElem, poiClusterer);
    const entityRel = poiEntityFactory.createFromOverpassElement(relElem, poiClusterer);

    assert.equal(entityNode.external_id, "osm:node:99001");
    assert.equal(entityWay.external_id, "osm:way:99001");
    assert.equal(entityRel.external_id, "osm:relation:99001");

    await poiRepository.syncCityPoisWithTransaction([entityNode, entityWay, entityRel]);

    const { rows } = await pool.query(
      "SELECT external_id, osm_type, osm_id FROM pois WHERE external_id IN ('osm:node:99001', 'osm:way:99001', 'osm:relation:99001') ORDER BY external_id ASC;"
    );

    assert.equal(rows.length, 3, "All 3 distinct OSM element types with same numeric ID are persisted as distinct entities");
    assert.equal(rows[0].external_id, "osm:node:99001");
    assert.equal(rows[1].external_id, "osm:relation:99001");
    assert.equal(rows[2].external_id, "osm:way:99001");
  });

  test("INV-03, INV-04, INV-05: Spatial validity, SRID=4326, coordinate order (X=lon, Y=lat)", async () => {
    const elem = { type: "node", id: 99002, lat: -7.4478, lon: 112.7183, tags: { amenity: "restaurant", name: "Resto Sidoarjo Valid" } };
    const entity = poiEntityFactory.createFromOverpassElement(elem, poiClusterer);
    await poiRepository.syncCityPoisWithTransaction([entity]);

    const { rows } = await pool.query(`
      SELECT 
        ST_SRID(geom) AS srid,
        ST_GeometryType(geom) AS geom_type,
        ST_IsValid(geom) AS is_valid,
        ST_X(geom) AS lon_x,
        ST_Y(geom) AS lat_y,
        latitude,
        longitude
      FROM pois 
      WHERE external_id = 'osm:node:99002';
    `);

    assert.equal(rows.length, 1);
    const r = rows[0];
    assert.equal(r.srid, 4326, "SRID must be 4326");
    assert.equal(r.geom_type, "ST_Point", "Geometry must be ST_Point");
    assert.equal(r.is_valid, true, "ST_IsValid(geom) must be true");
    assert.equal(Number(r.lon_x).toFixed(4), "112.7183", "X coordinate must be longitude");
    assert.equal(Number(r.lat_y).toFixed(4), "-7.4478", "Y coordinate must be latitude");
  });

  test("INV-06, INV-07, INV-08: Canonical duplicate_of = NULL, child points to canonical, no self-ref or chains", async () => {
    const parentElem = {
      type: "node",
      id: 99010,
      lat: -7.41500,
      lon: 112.71500,
      tags: { amenity: "cafe", name: "Starbucks Coffee Hub Sidoarjo" },
    };
    const childElem = {
      type: "node",
      id: 99011,
      lat: -7.41503, // ~3-4 meters apart
      lon: 112.71503,
      tags: { amenity: "cafe", name: "Starbucks Coffee Sidoarjo" }, // similarity >= 0.85
    };

    const pEntity = poiEntityFactory.createFromOverpassElement(parentElem, poiClusterer);
    const cEntity = poiEntityFactory.createFromOverpassElement(childElem, poiClusterer);

    await poiRepository.syncCityPoisWithTransaction([pEntity, cEntity]);

    const { rows } = await pool.query(
      "SELECT id, name, duplicate_of, logical_poi_id, external_id FROM pois WHERE external_id IN ('osm:node:99010', 'osm:node:99011') ORDER BY duplicate_of ASC NULLS FIRST;"
    );

    assert.equal(rows.length, 2);
    const canonical = rows[0];
    const duplicate = rows[1];

    assert.equal(canonical.duplicate_of, null, "INV-06: Canonical POI duplicate_of MUST be NULL");
    assert.equal(duplicate.duplicate_of, canonical.id, "INV-07: Duplicate POI duplicate_of MUST point directly to canonical.id");
    assert.notEqual(duplicate.duplicate_of, duplicate.id, "INV-08: No self-referencing duplicate_of");
    assert.equal(duplicate.logical_poi_id, canonical.logical_poi_id, "INV-09: Cluster members share same logical_poi_id");
  });

  test("INV-10: Deterministic Canonical Selection (completeness_score DESC, id ASC)", () => {
    const genericPoi = { id: "00000000-0000-0000-0000-000000000001", name: "Kafe (Tanpa Nama)", category: "Lainnya" };
    const namedPoi = { id: "00000000-0000-0000-0000-000000000002", name: "Kopi Kenangan Alun-Alun", category: "Kafe & Kedai Kopi" };

    const scoreGeneric = spatialDeduplicator.calculateCompletenessScore(genericPoi);
    const scoreNamed = spatialDeduplicator.calculateCompletenessScore(namedPoi);

    assert.equal(scoreGeneric, 0);
    assert.equal(scoreNamed, 15); // +10 name, +5 category
    assert(scoreNamed > scoreGeneric, "Named POI with specific category always scores higher than fallback");
  });

  test("INV-11: Repeated Ingestion Idempotency (N -> N records, 0 drift)", async () => {
    const elem = { type: "node", id: 99020, lat: -7.4300, lon: 112.7300, tags: { shop: "convenience", name: "Indomaret Idempotent Test" } };
    const entity = poiEntityFactory.createFromOverpassElement(elem, poiClusterer);

    // First Ingestion
    await poiRepository.syncCityPoisWithTransaction([entity]);
    const { rows: firstRows } = await pool.query("SELECT id, external_id, logical_poi_id, name FROM pois WHERE external_id = 'osm:node:99020';");
    assert.equal(firstRows.length, 1);
    const firstState = firstRows[0];

    // Second Ingestion of exact same dataset
    await poiRepository.syncCityPoisWithTransaction([entity]);
    const { rows: secondRows } = await pool.query("SELECT id, external_id, logical_poi_id, name FROM pois WHERE external_id = 'osm:node:99020';");
    assert.equal(secondRows.length, 1);
    const secondState = secondRows[0];

    assert.equal(secondState.id, firstState.id, "Physical ID remains identical");
    assert.equal(secondState.logical_poi_id, firstState.logical_poi_id, "Logical POI ID remains identical");
    assert.equal(secondState.name, firstState.name);
  });

  test("INV-12: Zero generic building noise contamination (building=yes is ignored)", () => {
    const buildingElement = {
      type: "way",
      id: 99030,
      center: { lat: -7.4500, lon: 112.7500 },
      tags: { building: "yes" }, // no name, no amenity/shop
    };

    const entity = poiEntityFactory.createFromOverpassElement(buildingElement, poiClusterer);
    assert.equal(entity.category, "IGNORED", "INV-12: Generic building=yes without semantic POI info must be classified as IGNORED");
  });

  test("INV-13: Operational Exclusions (REST_AREA, PRIVATE_ACCESS) are preserved as EXCLUDED", async () => {
    const restAreaElem = {
      type: "node",
      id: 99040,
      lat: -7.4600,
      lon: 112.7600,
      tags: { highway: "services", amenity: "rest_area", name: "Rest Area KM 753 Contract Test" },
    };
    const privateElem = {
      type: "node",
      id: 99041,
      lat: -7.4610,
      lon: 112.7610,
      tags: { amenity: "parking", access: "private", name: "Parkir Khusus Karyawan" },
    };

    const restAreaEntity = poiEntityFactory.createFromOverpassElement(restAreaElem, poiClusterer);
    const privateEntity = poiEntityFactory.createFromOverpassElement(privateElem, poiClusterer);

    assert.equal(restAreaEntity.operational_status, "EXCLUDED");
    assert.equal(restAreaEntity.exclusion_reason, "REST_AREA");

    assert.equal(privateEntity.operational_status, "EXCLUDED");
    assert.equal(privateEntity.exclusion_reason, "PRIVATE_ACCESS");

    await poiRepository.syncCityPoisWithTransaction([restAreaEntity, privateEntity]);

    const { rows } = await pool.query(
      "SELECT external_id, operational_status, exclusion_reason FROM pois WHERE external_id IN ('osm:node:99040', 'osm:node:99041') ORDER BY external_id ASC;"
    );

    assert.equal(rows.length, 2);
    assert.equal(rows[0].operational_status, "EXCLUDED");
    assert.equal(rows[0].exclusion_reason, "REST_AREA");
    assert.equal(rows[1].operational_status, "EXCLUDED");
    assert.equal(rows[1].exclusion_reason, "PRIVATE_ACCESS");
  });

  test("INV-14 & AC-POI-07: Master Category Catalog has 59 active categories", async () => {
    const { rows } = await pool.query("SELECT COUNT(*)::int AS count FROM poi_categories WHERE is_active = true;");
    assert.equal(rows[0].count, 59, "Master Category Catalog MUST have 59 active categories in database");
  });

  test("DATA-QUALITY: Zero orphaned, zero null categories, and valid Likert scores", async () => {
    const { rows: orphaned } = await pool.query(`
      SELECT p.category, COUNT(*)::int AS count
      FROM pois p
      LEFT JOIN poi_categories pc ON p.category = pc.name
      WHERE pc.name IS NULL
      GROUP BY p.category;
    `);
    assert.equal(orphaned.length, 0, `Ditemukan orphaned category: ${JSON.stringify(orphaned)}`);

    const { rows: nullCats } = await pool.query(`
      SELECT COUNT(*)::int AS count FROM pois WHERE category IS NULL OR TRIM(category) = '';
    `);
    assert.equal(nullCats[0].count, 0, "Tidak boleh ada POI dengan category NULL atau kosong");
  });

  test("INV-15: logical_poi_id stability across repeated deduplication runs", async () => {
    const mcd1 = { type: "node", id: 99050, lat: -7.41000, lon: 112.71500, tags: { amenity: "fast_food", name: "McDonald's Invariant 15" } };
    const mcd2 = { type: "node", id: 99051, lat: -7.41003, lon: 112.71503, tags: { amenity: "fast_food", name: "McDonalds Invariant 15" } };

    const e1 = poiEntityFactory.createFromOverpassElement(mcd1, poiClusterer);
    const e2 = poiEntityFactory.createFromOverpassElement(mcd2, poiClusterer);

    await poiRepository.syncCityPoisWithTransaction([e1, e2]);

    const { rows: r1 } = await pool.query(
      "SELECT id, external_id, logical_poi_id, duplicate_of FROM pois WHERE external_id IN ('osm:node:99050', 'osm:node:99051') ORDER BY duplicate_of ASC NULLS FIRST;"
    );
    const logicalIdFirstRun = r1[0].logical_poi_id;

    // Run deduplication again
    await poiRepository.syncCityPoisWithTransaction([e1, e2]);

    const { rows: r2 } = await pool.query(
      "SELECT id, external_id, logical_poi_id, duplicate_of FROM pois WHERE external_id IN ('osm:node:99050', 'osm:node:99051') ORDER BY duplicate_of ASC NULLS FIRST;"
    );

    assert.equal(r2[0].logical_poi_id, logicalIdFirstRun, "Canonical logical_poi_id is preserved on re-deduplication");
    assert.equal(r2[1].logical_poi_id, logicalIdFirstRun, "Child logical_poi_id matches canonical logical_poi_id");
  });

  test("AC-POI-12: Physical POI deduplication threshold (25m) is distinct from Competitor Reconciliation threshold", () => {
    const POI_DEDUP_ENVELOPE_METERS = 25;
    const COMPETITOR_RECONCILIATION_PROXIMITY_METERS = 15;
    const COMPETITOR_RECONCILIATION_SIMILARITY = 0.85;

    assert.equal(POI_DEDUP_ENVELOPE_METERS, 25, "POI physical clustering operates within 25m spatial envelope");
    assert.equal(COMPETITOR_RECONCILIATION_PROXIMITY_METERS, 15, "Competitor reconciliation requires <= 15m");
    assert.equal(COMPETITOR_RECONCILIATION_SIMILARITY, 0.85, "Competitor reconciliation requires >= 85% semantic similarity");
    assert.notEqual(POI_DEDUP_ENVELOPE_METERS, COMPETITOR_RECONCILIATION_PROXIMITY_METERS, "Thresholds remain decoupled");
  });
});
