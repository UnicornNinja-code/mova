/*
 *   Copyright (c) 2026 
 *   All rights reserved.
 *   CompetitorRepository (Data Access Layer for Competitors Table & PostGIS C6 Score Computation)
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
    } catch (e) {
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
   * Insert new field competitor survey entry
   */
  async createCompetitor({ zone_id, name, category = 'DIRECT_STARLING', weight = 1, latitude = null, longitude = null }) {
    // Determine default weight based on category if not explicitly passed
    let finalWeight = weight;
    if (category === 'DIRECT_STARLING') finalWeight = 3;
    else if (category === 'LOW_PRICE_TAKEAWAY') finalWeight = 2;
    else if (category === 'INDIRECT_PREMIUM') finalWeight = 1;

    const query = `
      INSERT INTO competitors (zone_id, name, category, weight, latitude, longitude)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    const values = [zone_id, name, category, finalWeight, latitude, longitude];
    const { rows } = await this.pool.query(query, values);
    return rows[0];
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
   * Combines:
   * 1. Field survey competitors from `competitors` table
   * 2. Coffee & beverage POIs from `pois` table inside zone polygon
   */
  async getZoneCompetitorScore(zonePolygon) {
    const geoJsonStr = formatZonePolygonToGeoJSON(zonePolygon);
    if (!geoJsonStr) {
      return { skor_c6: 0, total_competitors_count: 0, field_competitors_count: 0, coffee_poi_count: 0, details: [] };
    }

    // 1. Fetch survey competitors inside zone polygon (or assigned to zone_id)
    const surveyQuery = `
      SELECT c.id, c.name, c.category, COALESCE(c.weight, 1) as weight, c.latitude, c.longitude, 'SURVEY' as source
      FROM competitors c
      JOIN zones z ON c.zone_id = z.id
      WHERE ST_Contains(
        ST_SetSRID(ST_GeomFromGeoJSON($1), 4326),
        COALESCE(c.geom, ST_SetSRID(ST_MakePoint(COALESCE(c.longitude, 0), COALESCE(c.latitude, 0)), 4326))
      ) OR z.polygon::text = $1;
    `;
    const { rows: surveyRows } = await this.pool.query(surveyQuery, [geoJsonStr]);

    // 2. Fetch Coffee POIs inside zone polygon (categories: 'Kafe & Kedai Kopi', 'Cepat Saji', 'Toko Minuman') - Logical POI Representative Only
    const poiQuery = `
      SELECT DISTINCT ON (p.logical_poi_id)
             p.id, p.name, p.category, 
             CASE 
               WHEN p.category = 'Kafe & Kedai Kopi' THEN 2
               WHEN p.category = 'Cepat Saji' THEN 2
               WHEN p.category = 'Toko Minuman' THEN 1
               ELSE 1
             END as weight,
             p.latitude, p.longitude, 'POI_AUTOMATED' as source
      FROM pois p
      JOIN poi_categories pc ON p.category = pc.name
      WHERE pc.is_active = true
        AND COALESCE(p.approval_status, 'APPROVED') = 'APPROVED'
        AND p.operational_status = 'ELIGIBLE'
        AND p.logical_poi_id IS NOT NULL
        AND p.category IN ('Kafe & Kedai Kopi', 'Cepat Saji', 'Toko Minuman')
        AND ST_Contains(
          ST_SetSRID(ST_GeomFromGeoJSON($1), 4326),
          p.geom
        )
      ORDER BY p.logical_poi_id, (p.duplicate_of IS NULL) DESC, p.created_at ASC, p.id ASC;
    `;
    const { rows: poiRows } = await this.pool.query(poiQuery, [geoJsonStr]);

    const allCompetitors = [...surveyRows, ...poiRows];
    const totalScore = allCompetitors.reduce((acc, curr) => acc + parseInt(curr.weight || 1, 10), 0);

    return {
      skor_c6: totalScore,
      total_competitors_count: allCompetitors.length,
      field_competitors_count: surveyRows.length,
      coffee_poi_count: poiRows.length,
      details: allCompetitors,
    };
  }

  /**
   * Aggregate Citywide Competitor Summary
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

    // 4. Per Zone Breakdown
    const { rows: zoneBreakdownRows } = await this.pool.query(`
      SELECT 
        z.id AS zone_id,
        z.name AS zone_name,
        z.status AS zone_status,
        (
          SELECT COUNT(*)::int 
          FROM competitors c 
          WHERE c.zone_id = z.id 
             OR ST_Contains(z.polygon, ST_SetSRID(ST_MakePoint(COALESCE(c.longitude, 0), COALESCE(c.latitude, 0)), 4326))
        ) AS field_competitors_count,
        (
          SELECT COUNT(DISTINCT p.logical_poi_id)::int 
          FROM pois p 
          WHERE p.category IN ('Kafe & Kedai Kopi', 'Cepat Saji', 'Toko Minuman')
            AND p.status = 'APPROVED'
            AND p.operational_status <> 'EXCLUDED'
            AND ST_Contains(z.polygon, p.geom)
        ) AS coffee_poi_count
      FROM zones z
      ORDER BY (
        (SELECT COUNT(*) FROM competitors c WHERE c.zone_id = z.id) + 
        (SELECT COUNT(DISTINCT p.logical_poi_id) FROM pois p WHERE p.category IN ('Kafe & Kedai Kopi', 'Cepat Saji', 'Toko Minuman') AND p.status = 'APPROVED' AND p.operational_status <> 'EXCLUDED' AND ST_Contains(z.polygon, p.geom))
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
