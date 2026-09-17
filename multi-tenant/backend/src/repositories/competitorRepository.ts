/*
 * competitorRepository.ts
 * Data Access Layer for Competitors Table & PostGIS C6 Score Computation in TypeScript
 */

import { pool } from "../config/database.js";
import type { Pool } from "pg";

function formatZonePolygonToGeoJSON(polygon: any): string | null {
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
    const coordinates = parsed.map((pt: any) => {
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
  private static instance: CompetitorRepository | null = null;
  private pool: Pool;

  constructor(dbPool: Pool = pool) {
    if (CompetitorRepository.instance && dbPool === pool) {
      return CompetitorRepository.instance;
    }
    this.pool = dbPool;
    if (dbPool === pool) {
      CompetitorRepository.instance = this;
    }
  }

  public static getInstance(dbPool: Pool = pool): CompetitorRepository {
    if (!CompetitorRepository.instance) {
      CompetitorRepository.instance = new CompetitorRepository(dbPool);
    }
    return CompetitorRepository.instance;
  }

  /**
   * Fetch all field survey competitors (optionally by zone ID) with zone name join
   */
  public async findAll(zoneId?: number | string | null): Promise<any[]> {
    if (zoneId) {
      const query = `
        SELECT c.*, z.name as zone_name 
        FROM competitors c
        LEFT JOIN zones z ON c.zone_id = z.id
        WHERE c.zone_id = $1 
        ORDER BY c.created_at DESC;
      `;
      const { rows } = await this.pool.query(query, [zoneId]);
      return rows;
    }
    const query = `
      SELECT c.*, z.name as zone_name 
      FROM competitors c
      LEFT JOIN zones z ON c.zone_id = z.id
      ORDER BY c.created_at DESC;
    `;
    const { rows } = await this.pool.query(query);
    return rows;
  }

  /**
   * Fetch field survey competitors by zone ID
   */
  public async findByZoneId(zoneId: number | string): Promise<any[]> {
    const query = `
      SELECT c.*, z.name as zone_name 
      FROM competitors c
      LEFT JOIN zones z ON c.zone_id = z.id
      WHERE c.zone_id = $1 
      ORDER BY c.created_at DESC;
    `;
    const { rows } = await this.pool.query(query, [zoneId]);
    return rows;
  }

  /**
   * Insert new field competitor survey entry
   */
  public async createCompetitor({
    zone_id,
    name,
    category = "DIRECT_STARLING",
    weight = 1,
    latitude = null,
    longitude = null,
  }: {
    zone_id: number | string;
    name: string;
    category?: string;
    weight?: number;
    latitude?: number | null;
    longitude?: number | null;
  }): Promise<any> {
    let finalWeight = weight;
    if (category === "DIRECT_STARLING") finalWeight = 3;
    else if (category === "LOW_PRICE_TAKEAWAY") finalWeight = 2;
    else if (category === "INDIRECT_PREMIUM") finalWeight = 1;

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
  public async deleteCompetitor(id: number | string): Promise<any | null> {
    const query = `DELETE FROM competitors WHERE id = $1 RETURNING *;`;
    const { rows } = await this.pool.query(query, [id]);
    return rows[0] || null;
  }

  /**
   * Compute DSS Criteria C6 (Weighted Competitor Index) per Zone Polygon
   */
  public async getZoneCompetitorScore(zonePolygon: any): Promise<{
    skor_c6: number;
    total_competitors_count: number;
    field_competitors_count: number;
    coffee_poi_count: number;
    details: any[];
  }> {
    const geoJsonStr = formatZonePolygonToGeoJSON(zonePolygon);
    if (!geoJsonStr) {
      return { skor_c6: 0, total_competitors_count: 0, field_competitors_count: 0, coffee_poi_count: 0, details: [] };
    }

    const surveyQuery = `
      SELECT c.id, c.name, c.category, COALESCE(c.weight, 1) as weight, c.latitude, c.longitude, 'SURVEY' as source
      FROM competitors c
      JOIN zones z ON c.zone_id = z.id
      WHERE ST_Contains(
        ST_GeomFromGeoJSON($1),
        ST_SetSRID(ST_MakePoint(COALESCE(c.longitude, 0), COALESCE(c.latitude, 0)), 4326)
      ) OR z.polygon::text = $1;
    `;
    const { rows: surveyRows } = await this.pool.query(surveyQuery, [geoJsonStr]);

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
          ST_GeomFromGeoJSON($1),
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
}

export const competitorRepository = CompetitorRepository.getInstance();
