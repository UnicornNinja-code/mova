/*
 * test-competitor-contract.test.js
 * Integration & Acceptance Test Suite for Competitor Acquisition & C6 Evaluation Engine Contract v1.0
 * Verifies AC-01 through AC-08, Identity Architecture, and State Invariants
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import { pool } from "../../src/config/database.js";
import { ZoneModel } from "../../src/models/zoneModel.js";
import { competitorRepository } from "../../src/repositories/competitorRepository.js";
import { poiCompetitorService } from "../../src/services/poi/POICompetitorService.js";

describe("🏢 Competitor Acquisition & C6 Evaluation Contract v1.0 Suite", () => {
  // Synthetic Test Variables
  const testRunId = crypto.randomBytes(4).toString("hex");
  let testZoneId;
  let testZonePolygon;
  let otherZoneId;
  let otherZonePolygon;
  let createdCompetitorIds = [];
  let createdPoiIds = [];
  let createdZoneIds = [];

  // Zone coordinates: Square polygon from (112.70, -7.40) to (112.80, -7.30)
  // Boundary includes (112.70, -7.35)
  // Interior includes (112.75, -7.35)
  // Outside includes (112.55, -7.35)
  const zoneGeoJson = {
    type: "Polygon",
    coordinates: [
      [
        [112.70, -7.40],
        [112.80, -7.40],
        [112.80, -7.30],
        [112.70, -7.30],
        [112.70, -7.40],
      ],
    ],
  };

  const otherZoneGeoJson = {
    type: "Polygon",
    coordinates: [
      [
        [112.50, -7.40],
        [112.65, -7.40],
        [112.65, -7.30],
        [112.50, -7.30],
        [112.50, -7.40],
      ],
    ],
  };

  before(async () => {
    // 1. Create Synthetic Test Zones via ZoneModel
    const zone1 = await ZoneModel.create({
      name: `Zone Test Contract Primary ${testRunId}`,
      description: "Test Zone 1 for Competitor Contract",
      max_capacity: 5,
      status: "ACTIVE",
      polygon: zoneGeoJson,
    });

    const zone2 = await ZoneModel.create({
      name: `Zone Test Contract Other ${testRunId}`,
      description: "Test Zone 2 for Competitor Contract",
      max_capacity: 5,
      status: "ACTIVE",
      polygon: otherZoneGeoJson,
    });

    testZoneId = zone1.id;
    otherZoneId = zone2.id;
    createdZoneIds.push(testZoneId, otherZoneId);
    testZonePolygon = zoneGeoJson;
    otherZonePolygon = otherZoneGeoJson;
  });

  after(async () => {
    // Clean up all synthetic test data
    if (createdCompetitorIds.length > 0) {
      await pool.query(`DELETE FROM competitors WHERE id = ANY($1::uuid[])`, [createdCompetitorIds]);
    }
    if (createdPoiIds.length > 0) {
      await pool.query(`DELETE FROM pois WHERE id = ANY($1::uuid[])`, [createdPoiIds]);
    }
    if (createdZoneIds.length > 0) {
      await pool.query(`DELETE FROM zones WHERE id = ANY($1::uuid[])`, [createdZoneIds]);
    }
    if (pool) {
      await pool.end();
    }
  });

  // Helper to insert test POI
  async function insertTestPoi({
    name,
    categoryName = "Kafe & Kedai Kopi",
    lon = 112.75,
    lat = -7.35,
    externalId = `OSM-TEST-${crypto.randomUUID()}`,
    logicalPoiId = crypto.randomUUID(),
  }) {
    const { rows } = await pool.query(
      `INSERT INTO pois (
         osm_id, external_id, logical_poi_id, name, category,
         geom, latitude, longitude,
         status, approval_status, operational_status
       )
       VALUES (
         $1, $2, $3, $4, $5,
         ST_SetSRID(ST_MakePoint($6, $7), 4326), $7, $6,
         'ACTIVE', 'APPROVED', 'ELIGIBLE'
       )
       RETURNING id, logical_poi_id, external_id, name, category;`,
      [
        Date.now(),
        externalId,
        logicalPoiId,
        name,
        categoryName,
        lon,
        lat,
      ]
    );
    createdPoiIds.push(rows[0].id);
    return rows[0];
  }

  // Helper to insert test Competitor directly or via service
  async function insertTestCompetitor({
    name,
    category = "DIRECT_STARLING",
    weight = 3,
    lon = 112.75,
    lat = -7.35,
    zoneId = testZoneId,
    reconciliationStatus = "UNLINKED",
    matchedLogicalPoiId = null,
    matchedExternalId = null,
    matchedPoiId = null,
  }) {
    const { rows } = await pool.query(
      `INSERT INTO competitors (
         zone_id, name, category, weight,
         latitude, longitude, geom,
         reconciliation_status, matched_logical_poi_id, matched_external_id, matched_poi_id
       )
       VALUES (
         $1, $2, $3, $4,
         $5, $6, ST_SetSRID(ST_MakePoint($6, $5), 4326),
         $7, $8, $9, $10
       )
       RETURNING id, name, category, weight, reconciliation_status, matched_logical_poi_id;`,
      [
        zoneId,
        name,
        category,
        weight,
        lat,
        lon,
        reconciliationStatus,
        matchedLogicalPoiId,
        matchedExternalId,
        matchedPoiId,
      ]
    );
    createdCompetitorIds.push(rows[0].id);
    return rows[0];
  }

  // --- AC-01: Boundary Points Membership ---
  it("AC-01: Boundary Points Membership (ST_Covers evaluates points on polygon perimeter as TRUE)", async () => {
    // Point on the west edge: lon = 112.70, lat = -7.35
    const compBoundary = await insertTestCompetitor({
      name: `Boundary Starling ${testRunId}`,
      category: "DIRECT_STARLING",
      weight: 3,
      lon: 112.70,
      lat: -7.35,
    });

    const result = await competitorRepository.getZoneCompetitorScore(testZonePolygon);
    const boundaryItem = result.details.find((d) => d.name === compBoundary.name);

    assert.ok(boundaryItem, "Competitor located exactly on zone boundary MUST be captured by ST_Covers");
    assert.equal(boundaryItem.contributing, true, "Boundary competitor must contribute to C6 score");
    assert.ok(result.skor_c6 >= 3, "Skor C6 must reflect boundary competitor weight");
  });

  // --- AC-02: Spatial Shift Isolation ---
  it("AC-02: Spatial Shift Isolation (Pure ST_Covers spatial truth, NO relational zone_id fallback)", async () => {
    // Competitor assigned zone_id = testZoneId, but physically located outside in otherZone (lon 112.55)
    const shiftedComp = await insertTestCompetitor({
      name: `Shifted Out Competitor ${testRunId}`,
      category: "LOW_PRICE_TAKEAWAY",
      weight: 2,
      lon: 112.55,
      lat: -7.35,
      zoneId: testZoneId, // Foreign zone_id tag in DB
    });

    // Query C6 for testZonePolygon
    const resultTestZone = await competitorRepository.getZoneCompetitorScore(testZonePolygon);
    const foundInTestZone = resultTestZone.details.some((d) => d.name === shiftedComp.name);
    assert.equal(foundInTestZone, false, "Competitor outside testZonePolygon MUST NOT contribute to testZone C6 despite having zone_id set to testZone");

    // Query C6 for otherZonePolygon
    const resultOtherZone = await competitorRepository.getZoneCompetitorScore(otherZonePolygon);
    const foundInOtherZone = resultOtherZone.details.find((d) => d.name === shiftedComp.name);
    assert.ok(foundInOtherZone, "Competitor MUST be captured in otherZone where its actual geometry resides");
    assert.equal(foundInOtherZone.contributing, true);
  });

  // --- AC-03: Explicit Linkage Deduplication ---
  it("AC-03: Explicit Linkage Deduplication (Definitive match excludes duplicate POI record from C6)", async () => {
    const sharedLogicalId = crypto.randomUUID();
    const sharedExternalId = `OSM-DEDUP-${crypto.randomUUID()}`;

    // 1. Insert POI (weight 2 for Kafe)
    const poi = await insertTestPoi({
      name: `Kopi Kenangan Dedup ${testRunId}`,
      categoryName: "Kafe & Kedai Kopi",
      lon: 112.74,
      lat: -7.34,
      logicalPoiId: sharedLogicalId,
      externalId: sharedExternalId,
    });

    // 2. Insert Survey Competitor (weight 2 for LOW_PRICE_TAKEAWAY)
    const survey = await insertTestCompetitor({
      name: `Survey Kopi Kenangan ${testRunId}`,
      category: "LOW_PRICE_TAKEAWAY",
      weight: 2,
      lon: 112.74,
      lat: -7.34,
      reconciliationStatus: "DEFINITIVE_MATCH",
      matchedLogicalPoiId: sharedLogicalId,
      matchedExternalId: sharedExternalId,
      matchedPoiId: poi.id,
    });

    const result = await competitorRepository.getZoneCompetitorScore(testZonePolygon);

    const surveyDetail = result.details.find((d) => d.id === survey.id);
    const poiDetail = result.details.find((d) => d.logical_poi_id === sharedLogicalId && d.source === "POI_AUTOMATED");

    assert.ok(surveyDetail, "Survey competitor must be present");
    assert.equal(surveyDetail.contributing, true, "Survey competitor must contribute");
    assert.equal(surveyDetail.weight, 2);

    assert.ok(poiDetail, "Matched POI detail record must be tracked for audit");
    assert.equal(poiDetail.contributing, false, "Matched POI MUST NOT contribute to C6");
    assert.equal(poiDetail.excluded_reason, "MATCHED_SURVEY_COMPETITOR", "Excluded reason must be MATCHED_SURVEY_COMPETITOR");

    // Total weight contribution for this pair must be exactly 2 (not 4)
    const pairWeights = result.details
      .filter((d) => d.id === survey.id || (d.logical_poi_id === sharedLogicalId && d.source === "POI_AUTOMATED"))
      .reduce((sum, d) => sum + (d.contributing ? d.weight : 0), 0);
    assert.equal(pairWeights, 2, "Combined weight must be exactly 2, eliminating double counting");
  });

  // --- AC-04: Candidate Match Non-Invasiveness ---
  it("AC-04: Candidate Match Non-Invasiveness (Candidate status does not exclude either entity from C6)", async () => {
    const candidateLogicalId = crypto.randomUUID();
    const candidateExternalId = `OSM-CAND-${crypto.randomUUID()}`;

    // 1. POI
    const poi = await insertTestPoi({
      name: `Starbucks Juanda Candidate ${testRunId}`,
      categoryName: "Kafe & Kedai Kopi",
      lon: 112.76,
      lat: -7.36,
      logicalPoiId: candidateLogicalId,
      externalId: candidateExternalId,
    });

    // 2. Survey Competitor with CANDIDATE_MATCH status
    const survey = await insertTestCompetitor({
      name: `Starbucks Juanda Survey ${testRunId}`,
      category: "LOW_PRICE_TAKEAWAY",
      weight: 2,
      lon: 112.76005, // ~6 meters away
      lat: -7.36005,
      reconciliationStatus: "CANDIDATE_MATCH",
      matchedLogicalPoiId: candidateLogicalId,
      matchedExternalId: candidateExternalId,
      matchedPoiId: poi.id,
    });

    const result = await competitorRepository.getZoneCompetitorScore(testZonePolygon);

    const surveyDetail = result.details.find((d) => d.id === survey.id);
    const poiDetail = result.details.find((d) => d.logical_poi_id === candidateLogicalId && d.source === "POI_AUTOMATED");

    assert.ok(surveyDetail, "Survey competitor must be present");
    assert.equal(surveyDetail.reconciliation_status, "CANDIDATE_MATCH");
    assert.equal(surveyDetail.contributing, true, "Survey with CANDIDATE_MATCH must contribute");

    assert.ok(poiDetail, "POI candidate must be present");
    assert.equal(poiDetail.contributing, true, "POI with CANDIDATE_MATCH MUST contribute normally until promoted");
    assert.equal(poiDetail.excluded_reason, null);

    // Both weights (2 + 2 = 4) must be counted
    assert.equal(surveyDetail.weight + poiDetail.weight, 4);
  });

  // --- AC-05: Survey Precedence Weighting ---
  it("AC-05: Survey Precedence Weighting (Survey weight replaces POI automated weight upon definitive match)", async () => {
    const sharedLogicalId = crypto.randomUUID();
    const sharedExternalId = `OSM-PREC-${crypto.randomUUID()}`;

    // POI with weight 1 (Toko Minuman)
    const poi = await insertTestPoi({
      name: `Warung Minuman Precedence ${testRunId}`,
      categoryName: "Toko Minuman",
      lon: 112.72,
      lat: -7.32,
      logicalPoiId: sharedLogicalId,
      externalId: sharedExternalId,
    });

    // Survey with weight 3 (DIRECT_STARLING)
    const survey = await insertTestCompetitor({
      name: `Starling Lapangan Precedence ${testRunId}`,
      category: "DIRECT_STARLING",
      weight: 3,
      lon: 112.72,
      lat: -7.32,
      reconciliationStatus: "DEFINITIVE_MATCH",
      matchedLogicalPoiId: sharedLogicalId,
      matchedExternalId: sharedExternalId,
      matchedPoiId: poi.id,
    });

    const result = await competitorRepository.getZoneCompetitorScore(testZonePolygon);

    const surveyDetail = result.details.find((d) => d.id === survey.id);
    const poiDetail = result.details.find((d) => d.logical_poi_id === sharedLogicalId && d.source === "POI_AUTOMATED");

    assert.equal(surveyDetail.contributing, true);
    assert.equal(surveyDetail.weight, 3, "Survey weight is 3");

    assert.equal(poiDetail.contributing, false);
    assert.equal(poiDetail.excluded_reason, "MATCHED_SURVEY_COMPETITOR");

    const effectiveSum = (surveyDetail.contributing ? surveyDetail.weight : 0) + (poiDetail.contributing ? poiDetail.weight : 0);
    assert.equal(effectiveSum, 3, "Effective C6 contribution must be 3 (Survey weight), not 4 and not max(3,1)");
  });

  // --- AC-06: Historical Linkage Resilience ---
  it("AC-06: Historical Linkage Resilience (Reconciliation remains valid when pois.id is regenerated)", async () => {
    const resilientLogicalId = crypto.randomUUID();
    const resilientExternalId = `OSM-RESILIENT-${crypto.randomUUID()}`;

    // 1. Original POI record (UUID-A)
    const initialPoi = await insertTestPoi({
      name: `Resilient Cafe ${testRunId}`,
      categoryName: "Kafe & Kedai Kopi",
      lon: 112.73,
      lat: -7.33,
      logicalPoiId: resilientLogicalId,
      externalId: resilientExternalId,
    });

    // 2. Reconcile Competitor with initialPoi
    const survey = await insertTestCompetitor({
      name: `Resilient Cafe Survey ${testRunId}`,
      category: "LOW_PRICE_TAKEAWAY",
      weight: 2,
      lon: 112.73,
      lat: -7.33,
      reconciliationStatus: "DEFINITIVE_MATCH",
      matchedLogicalPoiId: resilientLogicalId,
      matchedExternalId: resilientExternalId,
      matchedPoiId: initialPoi.id,
    });

    // 3. Simulate POI Reclustering / Re-ingestion: Delete initial POI and re-insert with NEW UUID-B
    await pool.query(`DELETE FROM pois WHERE id = $1;`, [initialPoi.id]);
    createdPoiIds = createdPoiIds.filter((id) => id !== initialPoi.id);

    const reingestedPoi = await insertTestPoi({
      name: `Resilient Cafe ${testRunId}`,
      categoryName: "Kafe & Kedai Kopi",
      lon: 112.73,
      lat: -7.33,
      logicalPoiId: resilientLogicalId, // Same canonical logical ID
      externalId: resilientExternalId,   // Same external ID
    });

    assert.notEqual(reingestedPoi.id, initialPoi.id, "Simulated new POI snapshot ID must be different");

    // 4. Verify C6 Evaluation: Survey Precedence MUST STILL hold via logical_poi_id
    const result = await competitorRepository.getZoneCompetitorScore(testZonePolygon);
    const newPoiDetail = result.details.find((d) => d.id === reingestedPoi.id && d.source === "POI_AUTOMATED");

    assert.ok(newPoiDetail, "Re-ingested POI must be present in details");
    assert.equal(newPoiDetail.contributing, false, "Re-ingested POI must still be excluded by matched logical_poi_id");
    assert.equal(newPoiDetail.excluded_reason, "MATCHED_SURVEY_COMPETITOR");
  });

  // --- AC-07: Provenance Traceability ---
  it("AC-07: Provenance Traceability (Full provenance contract exposed in C6 score details)", async () => {
    const serviceResult = await poiCompetitorService.getZoneC6Score(testZoneId);

    assert.ok(serviceResult.zone_id, "Result must contain zone_id");
    assert.ok(typeof serviceResult.skor_c6 === "number", "Result must contain numeric skor_c6");
    assert.ok(Array.isArray(serviceResult.details), "Result must contain details array");
    assert.ok(serviceResult.reconciliation_summary, "Result must contain reconciliation_summary");

    for (const detail of serviceResult.details) {
      assert.ok(["SURVEY", "POI_AUTOMATED"].includes(detail.source), `Valid source required: ${detail.source}`);
      assert.ok(["UNLINKED", "CANDIDATE_MATCH", "DEFINITIVE_MATCH"].includes(detail.reconciliation_status), `Valid reconciliation_status required: ${detail.reconciliation_status}`);
      assert.equal(typeof detail.contributing, "boolean", "contributing must be boolean");
      assert.ok(detail.category, "category is required");
      assert.ok(typeof detail.weight === "number", "weight must be number");
      assert.ok(detail.coordinates && typeof detail.coordinates.lat === "number" && typeof detail.coordinates.lon === "number", "coordinates required");
      if (!detail.contributing) {
        assert.ok(detail.excluded_reason, "Excluded records must have an excluded_reason");
      }
    }
  });

  // --- AC-08: Unexpected Identity Mutation Detection ---
  it("AC-08: Unexpected Identity Mutation Detection (Explicit reconciliation rejects inconsistent or missing identities)", async () => {
    const dummyCompetitor = await poiCompetitorService.createCompetitor({
      zone_id: testZoneId,
      name: `Integrity Check Starling ${testRunId}`,
      category: "DIRECT_STARLING",
      latitude: -7.35,
      longitude: 112.75,
    });
    createdCompetitorIds.push(dummyCompetitor.id);

    const validPoi = await insertTestPoi({
      name: `Integrity Check POI ${testRunId}`,
      categoryName: "Kafe & Kedai Kopi",
      lon: 112.75,
      lat: -7.35,
    });

    // 1. Attempt reconciliation with non-existent POI ID -> Expect 404 error
    await assert.rejects(
      async () => {
        await poiCompetitorService.reconcileExplicitLink({
          competitorId: dummyCompetitor.id,
          poiId: crypto.randomUUID(),
        });
      },
      (err) => {
        assert.equal(err.statusCode, 404);
        return true;
      }
    );

    // 2. Attempt reconciliation with mismatched logicalPoiId -> Expect 400 error
    await assert.rejects(
      async () => {
        await poiCompetitorService.reconcileExplicitLink({
          competitorId: dummyCompetitor.id,
          poiId: validPoi.id,
          logicalPoiId: crypto.randomUUID(), // Inconsistent with validPoi.logical_poi_id
        });
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /Inkonsistensi identitas/);
        return true;
      }
    );

    // 3. Attempt reconciliation with mismatched externalId -> Expect 400 error
    await assert.rejects(
      async () => {
        await poiCompetitorService.reconcileExplicitLink({
          competitorId: dummyCompetitor.id,
          poiId: validPoi.id,
          externalId: "WRONG-EXTERNAL-ID",
        });
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /Inkonsistensi identitas/);
        return true;
      }
    );

    // 4. Valid reconciliation succeeds and locks DEFINITIVE_MATCH
    const reconciled = await poiCompetitorService.reconcileExplicitLink({
      competitorId: dummyCompetitor.id,
      poiId: validPoi.id,
    });
    assert.equal(reconciled.reconciliation_status, "DEFINITIVE_MATCH");
    assert.equal(reconciled.matched_logical_poi_id, validPoi.logical_poi_id);
    assert.equal(reconciled.matched_external_id, validPoi.external_id);
  });

  // --- Supporting Invariants: Level 3 Detection & Unlinking ---
  it("Invariant: detectCandidateMatches identifies POI <= 15m and similarity >= 85% without altering C6 exclusion", async () => {
    const candidatePoi = await insertTestPoi({
      name: `Kopi Janji Jiwa Sidoarjo Jawa Timur ${testRunId}`,
      categoryName: "Kafe & Kedai Kopi",
      lon: 112.75,
      lat: -7.35,
    });

    const candidateSurvey = await poiCompetitorService.createCompetitor({
      zone_id: testZoneId,
      name: `Kopi Janji Jiwa Sidoarjo Jawa Timur ${testRunId}`, // 100% string similarity
      category: "LOW_PRICE_TAKEAWAY",
      latitude: -7.35002, // ~2.2m distance
      longitude: 112.75002,
    });
    createdCompetitorIds.push(candidateSurvey.id);

    // Run candidate detection
    const candidates = await poiCompetitorService.detectCandidateMatches(testZoneId);
    const match = candidates.find((c) => c.competitor_id === candidateSurvey.id);

    assert.ok(match, "Candidate detection must find nearby high-similarity POI");
    assert.ok(match.distance_meters <= 15, "Distance must be <= 15m");
    assert.ok(match.similarity_score >= 0.85, "Similarity score must be >= 0.85");
    assert.equal(match.updated_competitor.reconciliation_status, "CANDIDATE_MATCH");

    // Unlink test
    const unlinked = await poiCompetitorService.unlinkReconciliation(candidateSurvey.id);
    assert.equal(unlinked.reconciliation_status, "UNLINKED");
    assert.equal(unlinked.matched_logical_poi_id, null);
  });

  // --- INV-CS-01..03 & AC-CS-01: PostGIS Geometry and Coordinate Ordering Contract ---
  it("INV-CS-01..03 & AC-CS-01: Single survey intake stores PostGIS Point geometry with SRID 4326 and [lon, lat] ordering", async () => {
    const lon = 112.7234;
    const lat = -7.3456;
    const comp = await poiCompetitorService.createCompetitor({
      zone_id: testZoneId,
      name: `PostGIS Point Geometry Test ${testRunId}`,
      category: "DIRECT_STARLING",
      latitude: lat,
      longitude: lon,
    });
    createdCompetitorIds.push(comp.id);

    // Verify directly in database
    const { rows } = await pool.query(
      `SELECT id, zone_id, name, category, weight, latitude, longitude,
              reconciliation_status,
              ST_GeometryType(geom) AS geom_type,
              ST_SRID(geom) AS srid,
              ST_X(geom) AS st_x,
              ST_Y(geom) AS st_y,
              ST_IsValid(geom) AS is_valid
       FROM competitors
       WHERE id = $1;`,
      [comp.id]
    );

    assert.equal(rows.length, 1);
    const row = rows[0];
    assert.equal(row.geom_type, "ST_Point");
    assert.equal(Number(row.srid), 4326);
    assert.equal(row.is_valid, true);
    assert.equal(row.reconciliation_status, "UNLINKED");
    // ST_X is Longitude, ST_Y is Latitude
    assert.ok(Math.abs(Number(row.st_x) - lon) < 0.0001, "ST_X must be longitude");
    assert.ok(Math.abs(Number(row.st_y) - lat) < 0.0001, "ST_Y must be latitude");
  });

  // --- INV-CS-04 & AC-CS-02: Defensive Coordinate Rejection ---
  it("INV-CS-04 & AC-CS-02: Defensive Coordinate Rejection (Rejects NaN, null, and out-of-bounds coordinates with HTTP 400)", async () => {
    // 1. Missing / null coordinates
    await assert.rejects(
      async () => {
        await poiCompetitorService.createCompetitor({
          zone_id: testZoneId,
          name: `Null Coord Competitor ${testRunId}`,
          category: "DIRECT_STARLING",
          latitude: null,
          longitude: 112.75,
        });
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        return true;
      }
    );

    // 2. NaN coordinates
    await assert.rejects(
      async () => {
        await poiCompetitorService.createCompetitor({
          zone_id: testZoneId,
          name: `NaN Coord Competitor ${testRunId}`,
          category: "DIRECT_STARLING",
          latitude: "not-a-number",
          longitude: 112.75,
        });
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        return true;
      }
    );

    // 3. Out of Sidoarjo bounds (e.g. Latitude in Jakarta -6.20 or Sidoarjo out of bounds -8.10)
    await assert.rejects(
      async () => {
        await poiCompetitorService.createCompetitor({
          zone_id: testZoneId,
          name: `Out of Bounds Lat Competitor ${testRunId}`,
          category: "DIRECT_STARLING",
          latitude: -6.2088, // Jakarta lat
          longitude: 112.75,
        });
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        return true;
      }
    );

    // 4. Out of Sidoarjo bounds (e.g. Longitude in Bali 115.18 or out of bounds 111.00)
    await assert.rejects(
      async () => {
        await poiCompetitorService.createCompetitor({
          zone_id: testZoneId,
          name: `Out of Bounds Lon Competitor ${testRunId}`,
          category: "DIRECT_STARLING",
          latitude: -7.35,
          longitude: 115.1889, // Bali lon
        });
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        return true;
      }
    );
  });

  // --- INV-CS-05 & INV-CS-06: Strict Category Taxonomy & Weight Bounds ---
  it("INV-CS-05 & INV-CS-06: Strict Category Taxonomy & Weight Bounds (Validates category & integer weight 1..3)", async () => {
    // 1. Invalid Category rejected
    await assert.rejects(
      async () => {
        await poiCompetitorService.createCompetitor({
          zone_id: testZoneId,
          name: `Invalid Category Competitor ${testRunId}`,
          category: "ILLEGAL_CATEGORY",
          latitude: -7.35,
          longitude: 112.75,
        });
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        return true;
      }
    );

    // 2. Invalid Weight (> 3 or < 1) rejected
    await assert.rejects(
      async () => {
        await poiCompetitorService.createCompetitor({
          zone_id: testZoneId,
          name: `Invalid Weight Competitor ${testRunId}`,
          category: "DIRECT_STARLING",
          weight: 5,
          latitude: -7.35,
          longitude: 112.75,
        });
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        return true;
      }
    );

    // 3. Default weight assignment verification
    const c1 = await poiCompetitorService.createCompetitor({
      zone_id: testZoneId,
      name: `Direct Starling Default Weight ${testRunId}`,
      category: "DIRECT_STARLING",
      latitude: -7.35,
      longitude: 112.75,
    });
    createdCompetitorIds.push(c1.id);
    assert.equal(c1.weight, 3, "DIRECT_STARLING must default to weight 3");

    const c2 = await poiCompetitorService.createCompetitor({
      zone_id: testZoneId,
      name: `Low Price Takeaway Default Weight ${testRunId}`,
      category: "LOW_PRICE_TAKEAWAY",
      latitude: -7.35,
      longitude: 112.75,
    });
    createdCompetitorIds.push(c2.id);
    assert.equal(c2.weight, 2, "LOW_PRICE_TAKEAWAY must default to weight 2");

    const c3 = await poiCompetitorService.createCompetitor({
      zone_id: testZoneId,
      name: `Indirect Premium Default Weight ${testRunId}`,
      category: "INDIRECT_PREMIUM",
      latitude: -7.35,
      longitude: 112.75,
    });
    createdCompetitorIds.push(c3.id);
    assert.equal(c3.weight, 1, "INDIRECT_PREMIUM must default to weight 1");
  });

  // --- INV-CS-07: Unlinked Inception & Defensive Injection Protection ---
  it("INV-CS-07: Unlinked Inception & Defensive Injection Protection (Forces UNLINKED on creation)", async () => {
    const maliciousAttempt = await poiCompetitorService.createCompetitor({
      zone_id: testZoneId,
      name: `Injection Attempt Starling ${testRunId}`,
      category: "DIRECT_STARLING",
      latitude: -7.35,
      longitude: 112.75,
      reconciliation_status: "DEFINITIVE_MATCH",
      matched_logical_poi_id: crypto.randomUUID(),
      matched_external_id: "OSM-INJECTED-123",
      matched_poi_id: crypto.randomUUID(),
    });
    createdCompetitorIds.push(maliciousAttempt.id);

    assert.equal(maliciousAttempt.reconciliation_status, "UNLINKED", "Creation MUST force UNLINKED status");
    assert.equal(maliciousAttempt.matched_logical_poi_id, null, "Creation MUST sanitize matched_logical_poi_id to null");
    assert.equal(maliciousAttempt.matched_external_id, null, "Creation MUST sanitize matched_external_id to null");
    assert.equal(maliciousAttempt.matched_poi_id, null, "Creation MUST sanitize matched_poi_id to null");
  });

  // --- AC-CS-08: Batch Survey Ingestion Contract ---
  it("AC-CS-08: Batch Survey Ingestion Contract (Atomically processes batch survey points with initial UNLINKED status)", async () => {
    const batchData = [
      {
        zone_id: testZoneId,
        name: `Batch Starling 1 ${testRunId}`,
        category: "DIRECT_STARLING",
        latitude: -7.351,
        longitude: 112.751,
      },
      {
        zone_id: testZoneId,
        name: `Batch Takeaway 2 ${testRunId}`,
        category: "LOW_PRICE_TAKEAWAY",
        latitude: -7.352,
        longitude: 112.752,
      },
      {
        zone_id: testZoneId,
        name: `Batch Premium 3 ${testRunId}`,
        category: "INDIRECT_PREMIUM",
        latitude: -7.353,
        longitude: 112.753,
      },
    ];

    const result = await poiCompetitorService.bulkCreateCompetitors(batchData);
    assert.ok(result);
    assert.equal(result.total_submitted, 3);
    assert.equal(result.total_created, 3);
    assert.equal(result.records.length, 3);

    for (const record of result.records) {
      createdCompetitorIds.push(record.id);
      assert.equal(record.reconciliation_status, "UNLINKED");
      assert.ok(record.weight >= 1 && record.weight <= 3);
    }
  });
});

