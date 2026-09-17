/*
 *   Copyright (c) 2026 
 *   All rights reserved.
 *   CompetitorRepository (Data Access Layer for Competitors Table & PostGIS C6 Score Computation)
 *   Complies with Competitor Acquisition & C6 Evaluation Contract v1.0 (ADR-01..ADR-04)
 */

import { pool } from "../config/database.js";

/**
 * Helper to convert zone.polygon to GeoJSON geometry string
 */
function formatZonePolygonToGeoJSON(polygon) {
  if (!polygon) return null;

  let parsed = polygon;
  if (typeof polygon === "string") {
    try {
      parsed = JSON.parse(polygon);
    } catch {
      return null;
    }
  }

  if (parsed.type === "Polygon") {
    return JSON.stringify(parsed);
  }
  if (parsed.type === "Feature" && parsed.geometry) {
    return JSON.stringify(parsed.geometry);
  }

  if (Array.isArray(parsed) && parsed.length >= 3) {
    const coordinates = parsed.map((pt) => {
      if (Array.isArray(pt)) {
        const isLonFirst = Math.abs(pt[0]) > Math.abs(pt[1]);
        const lon = isLonFirst ? pt[0] : pt[1];
        const lat = isLonFirst ? pt[1] : pt[0];
        return [parseFloat(lon), parseFloat(lat)];
      } else if (pt && pt.lat !== undefined) {
        const lon = pt.lon !== undefined ? pt.lon : pt.lng;
        return [parseFloat(lon), parseFloat(pt.lat)];
      }
      return [0, 0];
    });

    const firstPt = coordinates[0];
    const lastPt = coordinates[coordinates.length - 1];
    if (firstPt[0] !== lastPt[0] || firstPt[1] !== lastPt[1]) {
      coordinates.push([firstPt[0], firstPt[1]]);
    }

    const geoJsonGeometry = {
      type: "Polygon",
      coordinates: [coordinates],
    };
    return JSON.stringify(geoJsonGeometry);
  }

  return null;
}

export class CompetitorRepository {
  static instance = null;

  constructor(dbPool = pool) {
    if (CompetitorRepository.instance && dbPool === pool) {
      return CompetitorRepository.instance;
    }
    this.pool = dbPool;
    if (dbPool === pool) {
      CompetitorRepository.instance = this;
    }
  }

  static getInstance(dbPool = pool) {
    if (!CompetitorRepository.instance) {
      CompetitorRepository.instance = new CompetitorRepository(dbPool);
    }
    return CompetitorRepository.instance;
  }

  /**
   * Fetch field survey competitors by zone ID
   */
  async findByZoneId(zoneId) {
    const query = `
      SELECT * FROM competitors 
      WHERE zone_id = $1 
      ORDER BY created_at DESC;
    `;
    const { rows } = await this.pool.query(query, [zoneId]);
    return rows;
  }

  /**
   * Fetch single competitor by ID
   */
  async findById(id) {
    const query = `SELECT * FROM competitors WHERE id = $1;`;
    const { rows } = await this.pool.query(query, [id]);
    return rows[0] || null;
  }

  /**
   * Insert new field competitor survey entry with persistent PostGIS geom (Contract v1.0 Section 3)
   * Enforces reconciliation_status = 'UNLINKED' on ordinary creation.
   */
  async createCompetitor({
    zone_id,
    name,
    category = "DIRECT_STARLING",
    weight = null,
    latitude = null,
    longitude = null,
    matched_external_id = null,
    matched_logical_poi_id = null,
    matched_poi_id = null,
    reconciliation_status = "UNLINKED",
  }) {
    // Canonical weight resolution (SSOT)
    let finalWeight = weight;
    if (!finalWeight) {
      if (category === "DIRECT_STARLING") finalWeight = 3;
      else if (category === "LOW_PRICE_TAKEAWAY") finalWeight = 2;
      else if (category === "INDIRECT_PREMIUM") finalWeight = 1;
      else finalWeight = 1;
    }

    const latNum = latitude !== null && latitude !== undefined ? parseFloat(latitude) : null;
    const lonNum = longitude !== null && longitude !== undefined ? parseFloat(longitude) : null;

    // Ordinary creation invariants: UNLINKED status
    const status = reconciliation_status === "DEFINITIVE_MATCH" ? "UNLINKED" : (reconciliation_status || "UNLINKED");

    const query = `
      INSERT INTO competitors (
        zone_id, name, category, weight, latitude, longitude,
        matched_external_id, matched_logical_poi_id, matched_poi_id, reconciliation_status,
        geom
      )
      VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10,
        CASE 
          WHEN $5::double precision IS NOT NULL AND $6::double precision IS NOT NULL 
          THEN ST_SetSRID(ST_MakePoint($6::double precision, $5::double precision), 4326)
          ELSE NULL 
        END
      )
      RETURNING *;
    `;
    const values = [
      zone_id,
      name,
      category,
      finalWeight,
      latNum,
      lonNum,
      status === "UNLINKED" ? null : matched_external_id,
      status === "UNLINKED" ? null : matched_logical_poi_id,
      status === "UNLINKED" ? null : matched_poi_id,
      status,
    ];
    const { rows } = await this.pool.query(query, values);
    return rows[0];
  }

  /**
   * Bulk insert survey competitor entries atomically within a transaction (Contract v1.0 AC-CS-08)
   */
  async bulkCreateCompetitors(items) {
    if (!items || items.length === 0) return [];

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN;");
      const insertedRows = [];

      for (const item of items) {
        const query = `
          INSERT INTO competitors (
            zone_id, name, category, weight, latitude, longitude,
            reconciliation_status, matched_external_id, matched_logical_poi_id, matched_poi_id,
            geom
          )
          VALUES (
            $1, $2, $3, $4, $5, $6,
            'UNLINKED', NULL, NULL, NULL,
            ST_SetSRID(ST_MakePoint($6::double precision, $5::double precision), 4326)
          )
          RETURNING *;
        `;
        const { rows } = await client.query(query, [
          item.zone_id,
          item.name,
          item.category,
          item.weight,
          item.latitude,
          item.longitude,
        ]);
        insertedRows.push(rows[0]);
      }

      await client.query("COMMIT;");
      return insertedRows;
    } catch (err) {
      await client.query("ROLLBACK;");
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Update competitor reconciliation state (Dedicated Workflow - Contract v1.0 Section 4)
   */
  async updateReconciliation(id, {
    reconciliation_status,
    matched_external_id = null,
    matched_logical_poi_id = null,
    matched_poi_id = null,
  }) {
    const query = `
      UPDATE competitors
      SET reconciliation_status = $1,
          matched_external_id = $2,
          matched_logical_poi_id = $3,
          matched_poi_id = $4,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING *;
    `;
    const { rows } = await this.pool.query(query, [
      reconciliation_status,
      matched_external_id,
      matched_logical_poi_id,
      matched_poi_id,
      id,
    ]);
    return rows[0] || null;
  }

  /**
   * Spatial candidate query for candidate matching (Level 3 / Contract v1.0 Section 5)
   */
  async findNearbyCoffeePoisForCompetitor(competitorId, radiusMeters = 15) {
    const query = `
      SELECT 
        p.id AS poi_id,
        p.name AS poi_name,
        p.category AS poi_category,
        p.logical_poi_id,
        p.external_id,
        ST_Distance(c.geom::geography, p.geom::geography) AS distance_meters
      FROM competitors c
      CROSS JOIN pois p
      JOIN poi_categories pc ON p.category = pc.name
      WHERE c.id = $1
        AND c.geom IS NOT NULL
        AND p.geom IS NOT NULL
        AND pc.is_active = true
        AND p.operational_status = 'ELIGIBLE'
        AND COALESCE(p.approval_status, 'APPROVED') = 'APPROVED'
        AND p.category IN ('Kafe & Kedai Kopi', 'Cepat Saji', 'Toko Minuman')
        AND ST_DWithin(c.geom::geography, p.geom::geography, $2)
      ORDER BY distance_meters ASC;
    `;
    const { rows } = await this.pool.query(query, [competitorId, radiusMeters]);
    return rows;
  }

  /**
   * Delete field competitor entry by ID
   */
  async deleteCompetitor(id) {
    const query = `DELETE FROM competitors WHERE id = $1 RETURNING *;`;
    const { rows } = await this.pool.query(query, [id]);
    return rows[0] || null;
  }

  /**
   * Compute DSS Criteria C6 (Weighted Competitor Index) per Zone Polygon
   * Complies with ADR-01 (ST_Covers), ADR-03 (Reconciliation), and ADR-04 (Precedence).
   */
  async getZoneCompetitorScore(zonePolygon) {
    const geoJsonStr = formatZonePolygonToGeoJSON(zonePolygon);
    if (!geoJsonStr) {
      return {
        skor_c6: 0,
        total_competitors_count: 0,
        field_competitors_count: 0,
        coffee_poi_count: 0,
        reconciliation_summary: {
          definitive_matches: 0,
          candidate_matches: 0,
          excluded_duplicate_pois: 0,
        },
        details: [],
      };
    }

    // 1. Fetch Survey Competitors inside or on boundary of zone polygon (ST_Covers only, NO zone_id fallback)
    const surveyQuery = `
      SELECT 
        c.id, 
        c.name, 
        c.category, 
        COALESCE(c.weight, 1) AS weight, 
        c.latitude, 
        c.longitude,
        c.matched_logical_poi_id,
        c.matched_external_id,
        c.matched_poi_id,
        c.reconciliation_status,
        'SURVEY' AS source,
        true AS contributing
      FROM competitors c
      WHERE c.geom IS NOT NULL 
        AND ST_Covers(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326), c.geom);
    `;
    const { rows: surveyRows } = await this.pool.query(surveyQuery, [geoJsonStr]);

    // Build set of definitively excluded logical POI IDs for survey precedence (DEFINITIVE_MATCH only)
    const definitiveMatchedLogicalIds = surveyRows
      .filter((s) => s.reconciliation_status === "DEFINITIVE_MATCH" && s.matched_logical_poi_id)
      .map((s) => s.matched_logical_poi_id);

    // 2. Fetch Coffee POIs inside or on boundary of zone polygon (ST_Covers)
    const poiQuery = `
      SELECT DISTINCT ON (p.logical_poi_id)
        p.id, 
        p.name, 
        p.category, 
        CASE 
          WHEN p.category IN ('Kafe & Kedai Kopi', 'Cepat Saji') THEN 2
          WHEN p.category = 'Toko Minuman' THEN 1
          ELSE 1
        END AS base_weight,
        p.latitude, 
        p.longitude, 
        p.logical_poi_id,
        p.external_id,
        'POI_AUTOMATED' AS source
      FROM pois p
      JOIN poi_categories pc ON p.category = pc.name
      WHERE pc.is_active = true
        AND COALESCE(p.approval_status, 'APPROVED') = 'APPROVED'
        AND p.operational_status = 'ELIGIBLE'
        AND p.logical_poi_id IS NOT NULL
        AND p.category IN ('Kafe & Kedai Kopi', 'Cepat Saji', 'Toko Minuman')
        AND p.geom IS NOT NULL
        AND ST_Covers(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326), p.geom)
      ORDER BY p.logical_poi_id, (p.duplicate_of IS NULL) DESC, p.created_at ASC, p.id ASC;
    `;
    const { rows: poiRows } = await this.pool.query(poiQuery, [geoJsonStr]);

    // Process Survey competitors with normalized properties
    const processedSurveys = surveyRows.map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category,
      weight: parseInt(s.weight || 0, 10),
      latitude: s.latitude !== null ? parseFloat(s.latitude) : null,
      longitude: s.longitude !== null ? parseFloat(s.longitude) : null,
      coordinates: {
        lat: s.latitude !== null ? parseFloat(s.latitude) : 0,
        lon: s.longitude !== null ? parseFloat(s.longitude) : 0,
      },
      matched_logical_poi_id: s.matched_logical_poi_id,
      matched_external_id: s.matched_external_id,
      matched_poi_id: s.matched_poi_id,
      reconciliation_status: s.reconciliation_status || "UNLINKED",
      source: "SURVEY",
      contributing: true,
      excluded_reason: null,
    }));

    const definitiveLogicalSet = new Set(definitiveMatchedLogicalIds);

    // Process POIs with explicit source precedence & exclusion annotations (ADR-04)
    const processedPois = poiRows.map((p) => {
      const isExcluded = definitiveLogicalSet.has(p.logical_poi_id);
      return {
        id: p.id,
        name: p.name,
        category: p.category,
        weight: isExcluded ? 0 : p.base_weight,
        latitude: p.latitude !== null ? parseFloat(p.latitude) : null,
        longitude: p.longitude !== null ? parseFloat(p.longitude) : null,
        coordinates: {
          lat: p.latitude !== null ? parseFloat(p.latitude) : 0,
          lon: p.longitude !== null ? parseFloat(p.longitude) : 0,
        },
        logical_poi_id: p.logical_poi_id,
        external_id: p.external_id,
        source: "POI_AUTOMATED",
        reconciliation_status: "UNLINKED",
        contributing: !isExcluded,
        excluded_reason: isExcluded ? "MATCHED_SURVEY_COMPETITOR" : null,
      };
    });

    const allEntities = [...processedSurveys, ...processedPois];

    // Compute C6 total score from strictly contributing entities
    const totalScore = allEntities.reduce((acc, curr) => {
      return curr.contributing ? acc + parseInt(curr.weight || 0, 10) : acc;
    }, 0);

    const contributingSurveys = processedSurveys.filter((s) => s.contributing);
    const contributingPois = processedPois.filter((p) => p.contributing);
    const excludedPoisCount = processedPois.filter((p) => !p.contributing).length;
    const definitiveCount = processedSurveys.filter((s) => s.reconciliation_status === "DEFINITIVE_MATCH").length;
    const candidateCount = processedSurveys.filter((s) => s.reconciliation_status === "CANDIDATE_MATCH").length;

    return {
      skor_c6: totalScore,
      total_competitors_count: contributingSurveys.length + contributingPois.length,
      field_competitors_count: contributingSurveys.length,
      coffee_poi_count: contributingPois.length,
      reconciliation_summary: {
        definitive_matches: definitiveCount,
        candidate_matches: candidateCount,
        excluded_duplicate_pois: excludedPoisCount,
      },
      details: allEntities,
    };
  }

  /**
   * Aggregate Citywide Competitor Summary with ST_Covers spatial precision
   */
  async getCompetitorsSummary() {
    // 1. Total survey competitors count
    const { rows: surveyCountRows } = await this.pool.query(`
      SELECT 
        COUNT(*)::int AS total_survey_competitors,
        COUNT(DISTINCT category)::int AS total_categories
      FROM competitors;
    `);

    // 2. Total automated coffee POIs count
    const { rows: coffeeCountRows } = await this.pool.query(`
      SELECT COUNT(DISTINCT logical_poi_id)::int AS total_coffee_pois
      FROM pois
      WHERE category IN ('Kafe & Kedai Kopi', 'Cepat Saji', 'Toko Minuman')
        AND status = 'APPROVED'
        AND operational_status <> 'EXCLUDED';
    `);

    // 3. Category Breakdown (Combined Survey + POI)
    const { rows: categoryBreakdownRows } = await this.pool.query(`
      SELECT category, COUNT(*)::int AS count
      FROM (
        SELECT category FROM competitors
        UNION ALL
        SELECT category FROM pois 
        WHERE category IN ('Kafe & Kedai Kopi', 'Cepat Saji', 'Toko Minuman')
          AND status = 'APPROVED'
          AND operational_status <> 'EXCLUDED'
      ) combined
      GROUP BY category
      ORDER BY count DESC;
    `);

    // 4. Per Zone Breakdown using ST_Covers
    const { rows: zoneBreakdownRows } = await this.pool.query(`
      SELECT 
        z.id AS zone_id,
        z.name AS zone_name,
        z.status AS zone_status,
        (
          SELECT COUNT(*)::int 
          FROM competitors c 
          WHERE c.geom IS NOT NULL AND ST_Covers(z.geom, c.geom)
        ) AS field_competitors_count,
        (
          SELECT COUNT(DISTINCT p.logical_poi_id)::int 
          FROM pois p 
          WHERE p.category IN ('Kafe & Kedai Kopi', 'Cepat Saji', 'Toko Minuman')
            AND p.status = 'APPROVED'
            AND p.operational_status <> 'EXCLUDED'
            AND p.geom IS NOT NULL
            AND ST_Covers(z.geom, p.geom)
        ) AS coffee_poi_count
      FROM zones z
      ORDER BY (
        (SELECT COUNT(*) FROM competitors c WHERE c.geom IS NOT NULL AND ST_Covers(z.geom, c.geom)) + 
        (SELECT COUNT(DISTINCT p.logical_poi_id) FROM pois p WHERE p.category IN ('Kafe & Kedai Kopi', 'Cepat Saji', 'Toko Minuman') AND p.status = 'APPROVED' AND p.operational_status <> 'EXCLUDED' AND p.geom IS NOT NULL AND ST_Covers(z.geom, p.geom))
      ) DESC;
    `);

    const surveyTotal = surveyCountRows[0]?.total_survey_competitors || 0;
    const coffeeTotal = coffeeCountRows[0]?.total_coffee_pois || 0;

    const formattedZones = zoneBreakdownRows.map((z) => {
      const fieldCount = z.field_competitors_count || 0;
      const coffeeCount = z.coffee_poi_count || 0;
      const totalCount = fieldCount + coffeeCount;
      return {
        zone_id: z.zone_id,
        zone_name: z.zone_name,
        zone_status: z.zone_status,
        field_competitors_count: fieldCount,
        coffee_poi_count: coffeeCount,
        total_competitors_count: totalCount,
        estimated_skor_c6: (fieldCount * 2) + coffeeCount,
      };
    });

    return {
      total_competitors: surveyTotal + coffeeTotal,
      field_survey_count: surveyTotal,
      coffee_poi_count: coffeeTotal,
      category_breakdown: categoryBreakdownRows,
      zones_summary: formattedZones,
    };
  }
}

export const competitorRepository = CompetitorRepository.getInstance();
