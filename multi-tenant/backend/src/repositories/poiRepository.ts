/*
 * poiRepository.ts
 * Data Access Layer for Master pois Table & PostGIS Spatial Operations in TypeScript
 */

import { pool } from "../config/database.js";
import type { Pool, PoolClient } from "pg";
import { spatialDeduplicator } from "../services/poi/SpatialDeduplicator.js";

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

export class POIRepository {
  private static instance: POIRepository | null = null;
  private pool: Pool;

  constructor(dbPool: Pool = pool) {
    if (POIRepository.instance && dbPool === pool) {
      return POIRepository.instance;
    }
    this.pool = dbPool;
    if (dbPool === pool) {
      POIRepository.instance = this;
    }
  }

  public static getInstance(dbPool: Pool = pool): POIRepository {
    if (!POIRepository.instance) {
      POIRepository.instance = new POIRepository(dbPool);
    }
    return POIRepository.instance;
  }

  /**
   * Fetch all Master Data POIs (with active categories, optionally scoped by hub_id)
   */
  public async findAll(hubId?: string | null): Promise<any[]> {
    const query = `
      SELECT 
        p.*,
        p.zone_id,
        p.hub_id,
        COALESCE(p.is_clustered, false) AS is_clustered
      FROM pois p
      LEFT JOIN poi_categories c ON p.category = c.name
      WHERE (c.is_active IS NULL OR c.is_active = true)
        AND p.status = 'APPROVED'
        AND (p.is_active = true OR p.is_active IS NULL)
        AND (p.operational_status = 'ELIGIBLE' OR p.operational_status IS NULL)
        AND ($1::varchar IS NULL OR p.hub_id = $1 OR p.hub_id IS NULL)
      ORDER BY p.name ASC;
    `;
    const { rows } = await this.pool.query(query, [hubId || null]);
    return rows;
  }

  /**
   * Fetch POI by ID
   */
  public async findById(id: number | string): Promise<any | null> {
    const query = `SELECT * FROM pois WHERE id = $1;`;
    const { rows } = await this.pool.query(query, [id]);
    return rows[0] || null;
  }

  /**
   * Fetch all POIs with status 'PENDING_APPROVAL'
   */
  public async findPendingPois(): Promise<any[]> {
    const query = `
      SELECT p.* 
      FROM pois p
      WHERE p.status = 'PENDING_APPROVAL'
      ORDER BY p.created_at DESC;
    `;
    const { rows } = await this.pool.query(query);
    return rows;
  }

  /**
   * Update POI status ('APPROVED', 'REJECTED')
   */
  public async updatePoiStatus(poiId: number | string, status: string): Promise<any | null> {
    const query = `
      UPDATE pois 
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *;
    `;
    const { rows } = await this.pool.query(query, [status, poiId]);
    return rows[0] || null;
  }

  /**
   * Fetch POIs located inside a specific zone polygon using PostGIS ST_Contains (Logical POI Representative Only)
   */
  public async findByZonePolygon(zonePolygon: any): Promise<any[]> {
    const geoJsonStr = formatZonePolygonToGeoJSON(zonePolygon);
    if (!geoJsonStr) return [];

    const query = `
      SELECT DISTINCT ON (p.logical_poi_id) p.* 
      FROM pois p
      JOIN poi_categories pc ON p.category = pc.name
      WHERE pc.is_active = true
        AND COALESCE(p.approval_status, 'APPROVED') = 'APPROVED'
        AND p.operational_status = 'ELIGIBLE'
        AND p.logical_poi_id IS NOT NULL
        AND ST_Contains(
          ST_GeomFromGeoJSON($1), 
          ST_SetSRID(ST_MakePoint(p.longitude, p.latitude), 4326)
        )
      ORDER BY p.logical_poi_id, (p.duplicate_of IS NULL) DESC, p.created_at ASC, p.id ASC;
    `;
    const { rows } = await this.pool.query(query, [geoJsonStr]);
    return rows;
  }

  /**
   * Dynamic PostGIS Spatial DSS Evaluation for Criteria C1 (Density) & C2 (Diversity) per Zone Polygon
   */
  public async getDensitasDanDiversitasByZonePolygon(zonePolygon: any): Promise<{ skor_c1: number; skor_c2: number }> {
    const geoJsonStr = formatZonePolygonToGeoJSON(zonePolygon);
    if (!geoJsonStr) {
      return { skor_c1: 0, skor_c2: 0 };
    }

    const query = `
      SELECT 
        COUNT(DISTINCT p.logical_poi_id)::int AS skor_c1,
        COUNT(DISTINCT p.category)::int AS skor_c2
      FROM pois p
      JOIN poi_categories pc ON p.category = pc.name
      WHERE pc.is_active = true
        AND COALESCE(p.approval_status, 'APPROVED') = 'APPROVED'
        AND p.operational_status = 'ELIGIBLE'
        AND p.logical_poi_id IS NOT NULL
        AND ST_Contains(
          ST_GeomFromGeoJSON($1), 
          p.geom
        );
    `;
    const { rows } = await this.pool.query(query, [geoJsonStr]);
    return rows[0] || { skor_c1: 0, skor_c2: 0 };
  }

  /**
   * PostGIS Evaluation for Criteria C3 (Time-Based Crowd Score) per Zone Polygon (Logical POI Aware)
   */
  public async getTimeCrowdScoreByZonePolygon(
    zonePolygon: any,
    slotName: string
  ): Promise<{ total_pois: number; total_c3_score: number; avg_c3_score: number; time_slot: string }> {
    const geoJsonStr = formatZonePolygonToGeoJSON(zonePolygon);
    if (!geoJsonStr) {
      return { total_pois: 0, total_c3_score: 0, avg_c3_score: 0, time_slot: slotName };
    }

    const query = `
      WITH representative_logical_pois AS (
        SELECT DISTINCT ON (p.logical_poi_id)
          p.logical_poi_id,
          p.category,
          CASE 
            WHEN $2 = 'pagi' THEN pc.score_pagi
            WHEN $2 = 'siang' THEN pc.score_siang
            WHEN $2 = 'sore' THEN pc.score_sore
            WHEN $2 = 'malam' THEN pc.score_malam
            ELSE 1
          END AS time_score
        FROM pois p
        JOIN poi_categories pc ON p.category = pc.name
        WHERE pc.is_active = true
          AND COALESCE(p.approval_status, 'APPROVED') = 'APPROVED'
          AND p.operational_status = 'ELIGIBLE'
          AND p.logical_poi_id IS NOT NULL
          AND ST_Contains(
            ST_GeomFromGeoJSON($1), 
            p.geom
          )
        ORDER BY p.logical_poi_id, (p.duplicate_of IS NULL) DESC, p.created_at ASC, p.id ASC
      )
      SELECT 
        COUNT(DISTINCT logical_poi_id)::int AS total_pois,
        COALESCE(SUM(time_score), 0)::float AS total_c3_score,
        COALESCE(AVG(time_score), 0)::float AS avg_c3_score
      FROM representative_logical_pois;
    `;
    const { rows } = await this.pool.query(query, [geoJsonStr, slotName]);
    const res = rows[0] || { total_pois: 0, total_c3_score: 0, avg_c3_score: 0 };
    return { ...res, time_slot: slotName };
  }

  /**
   * Fetch detailed POI breakdown for C3 Crowd Score Explainability
   */
  public async getTimeCrowdDetailsByZonePolygon(zonePolygon: any, slotName: string): Promise<any[]> {
    const geoJsonStr = formatZonePolygonToGeoJSON(zonePolygon);
    if (!geoJsonStr) {
      return [];
    }

    const query = `
      SELECT DISTINCT ON (p.logical_poi_id)
        p.id AS poi_id,
        p.name,
        p.category,
        CASE 
          WHEN $2 = 'pagi' THEN pc.score_pagi
          WHEN $2 = 'siang' THEN pc.score_siang
          WHEN $2 = 'sore' THEN pc.score_sore
          WHEN $2 = 'malam' THEN pc.score_malam
          ELSE 1
        END AS time_score,
        p.latitude,
        p.longitude
      FROM pois p
      JOIN poi_categories pc ON p.category = pc.name
      WHERE pc.is_active = true
        AND COALESCE(p.approval_status, 'APPROVED') = 'APPROVED'
        AND p.operational_status = 'ELIGIBLE'
        AND p.logical_poi_id IS NOT NULL
        AND ST_Contains(
          ST_GeomFromGeoJSON($1), 
          p.geom
        )
      ORDER BY p.logical_poi_id, (p.duplicate_of IS NULL) DESC, p.created_at ASC, p.id ASC;
    `;
    const { rows } = await this.pool.query(query, [geoJsonStr, slotName]);
    return rows;
  }

  /**
   * Audit report for top unclassified POIs in 'Lainnya' category
   */
  public async getLeakageReport(limit: number = 50): Promise<any[]> {
    const query = `
      SELECT 
        name as bocoran_nama, 
        COUNT(id)::int as jumlah_kemunculan
      FROM pois
      WHERE category = 'Lainnya' 
        AND name NOT LIKE '%(Tanpa Nama)%'
      GROUP BY name
      ORDER BY jumlah_kemunculan DESC
      LIMIT $1;
    `;
    const { rows } = await this.pool.query(query, [limit]);
    return rows;
  }

  /**
   * Safe Transactional Duplicate Reconciliation & Cleanup
   */
  public async reconcileAndCleanupDuplicatePois(providedClient: PoolClient | null = null): Promise<{
    totalDeleted: number;
    totalRelinked: number;
    duplicateGroupsProcessed: number;
  }> {
    const client = providedClient || (await this.pool.connect());
    const isLocalTransaction = !providedClient;

    try {
      if (isLocalTransaction) await client.query("BEGIN");

      const { rows: dupGroups } = await client.query(`
        SELECT osm_id
        FROM pois
        WHERE osm_id IS NOT NULL AND osm_type IS NULL
        GROUP BY osm_id
        HAVING COUNT(*) > 1;
      `);

      let totalDeleted = 0;
      let totalRelinked = 0;

      for (const group of dupGroups) {
        const osmId = group.osm_id;
        const { rows: members } = await client.query(
          `SELECT id, osm_type, osm_id, external_id, name, category, created_at, logical_poi_id, duplicate_of
           FROM pois
           WHERE osm_id = $1
           ORDER BY created_at ASC;`,
          [osmId]
        );

        if (members.length <= 1) continue;

        const authoritative = members.find((m: any) => m.osm_type !== null) || members[0];
        const canonicalOsmType = members.find((m: any) => m.osm_type !== null)?.osm_type || "node";
        const canonicalExternalId = `osm:${canonicalOsmType}:${osmId}`;

        await client.query(
          `UPDATE pois 
           SET osm_type = COALESCE(osm_type, $1),
               external_id = $2,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $3;`,
          [canonicalOsmType, canonicalExternalId, authoritative.id]
        );

        const duplicateIds = members.filter((m: any) => m.id !== authoritative.id).map((m: any) => m.id);

        if (duplicateIds.length > 0) {
          const { rowCount: relinkedCount } = await client.query(
            `UPDATE candidate_selling_locations
             SET poi_id = $1
             WHERE poi_id = ANY($2::uuid[]);`,
            [authoritative.id, duplicateIds]
          );
          totalRelinked += relinkedCount || 0;

          await client.query(
            `UPDATE pois
             SET duplicate_of = $1
             WHERE duplicate_of = ANY($2::uuid[]);`,
            [authoritative.id, duplicateIds]
          );

          const { rowCount: deletedCount } = await client.query(
            `DELETE FROM pois WHERE id = ANY($1::uuid[]);`,
            [duplicateIds]
          );
          totalDeleted += deletedCount || 0;
        }
      }

      if (isLocalTransaction) await client.query("COMMIT");
      return { totalDeleted, totalRelinked, duplicateGroupsProcessed: dupGroups.length };
    } catch (err: any) {
      if (isLocalTransaction) await client.query("ROLLBACK");
      console.error("💥 Error saat reconcile and cleanup duplicate POIs:", err.message);
      throw err;
    } finally {
      if (isLocalTransaction) client.release();
    }
  }

  /**
   * Idempotent Bulk UPSERT Transaction for Overpass POI Synchronization
   */
  public async syncCityPoisWithTransaction(poisData: any[]): Promise<any[]> {
    if (!Array.isArray(poisData) || poisData.length === 0) {
      return [];
    }

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      await this.reconcileAndCleanupDuplicatePois(client);

      const { rows: existingPois } = await client.query(
        "SELECT id, external_id, osm_type, osm_id, logical_poi_id, duplicate_of, approval_status, operational_status FROM pois;"
      );

      const existingByExternalId = new Map<string, any>();
      const existingByOsmId = new Map<string, any>();

      existingPois.forEach((p: any) => {
        if (p.external_id) existingByExternalId.set(p.external_id, p);
        if (p.osm_id !== null && p.osm_id !== undefined && !p.osm_type) {
          existingByOsmId.set(String(p.osm_id), p);
        }
      });

      const insertedOrUpdated: any[] = [];

      for (const p of poisData) {
        const osmType = p.osm_type || null;
        const osmId = p.osm_id || null;
        const canonicalExternalId = p.external_id || (osmId ? `osm:${osmType || "node"}:${osmId}` : null);

        let existingMatch = null;
        if (canonicalExternalId && existingByExternalId.has(canonicalExternalId)) {
          existingMatch = existingByExternalId.get(canonicalExternalId);
        } else if (osmId && !osmType && existingByOsmId.has(String(osmId))) {
          existingMatch = existingByOsmId.get(String(osmId));
        }

        if (existingMatch) {
          const updateQuery = `
            UPDATE pois
            SET osm_type = COALESCE($1, osm_type),
                osm_id = COALESCE($2, osm_id),
                external_id = $3,
                name = $4,
                category = $5,
                latitude = $6::double precision,
                longitude = $7::double precision,
                approval_status = COALESCE($8, approval_status),
                operational_status = COALESCE($9, operational_status),
                exclusion_reason = COALESCE($10, exclusion_reason),
                metadata = $11::jsonb,
                geom = ST_SetSRID(ST_MakePoint($7::double precision, $6::double precision), 4326),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $12
            RETURNING *;
          `;
          const { rows } = await client.query(updateQuery, [
            osmType,
            osmId,
            canonicalExternalId || existingMatch.external_id,
            p.name,
            p.category,
            p.latitude,
            p.longitude,
            p.approval_status || "APPROVED",
            p.operational_status || "ELIGIBLE",
            p.exclusion_reason || null,
            JSON.stringify(p.metadata || {}),
            existingMatch.id,
          ]);

          if (rows[0]) {
            insertedOrUpdated.push(rows[0]);
            existingByExternalId.set(rows[0].external_id, rows[0]);
            if (rows[0].osm_id) existingByOsmId.set(String(rows[0].osm_id), rows[0]);
          }
        } else {
          const genUuid = crypto.randomUUID();
          const extId = canonicalExternalId || `custom:${genUuid}`;

          const insertQuery = `
            INSERT INTO pois (
              id, external_id, osm_type, osm_id, name, category, latitude, longitude,
              approval_status, operational_status, exclusion_reason, metadata, logical_poi_id, geom
            )
            VALUES (
              $1::uuid, $2, $3, $4, $5, $6,
              $7::double precision, $8::double precision,
              $9, $10, $11, $12::jsonb, $1::uuid,
              ST_SetSRID(ST_MakePoint($8::double precision, $7::double precision), 4326)
            )
            RETURNING *;
          `;
          const { rows } = await client.query(insertQuery, [
            genUuid,
            extId,
            osmType,
            osmId,
            p.name,
            p.category,
            p.latitude,
            p.longitude,
            p.approval_status || "APPROVED",
            p.operational_status || "ELIGIBLE",
            p.exclusion_reason || null,
            JSON.stringify(p.metadata || {}),
          ]);

          if (rows[0]) {
            insertedOrUpdated.push(rows[0]);
            existingByExternalId.set(rows[0].external_id, rows[0]);
            if (rows[0].osm_id) existingByOsmId.set(String(rows[0].osm_id), rows[0]);
          }
        }
      }

      await spatialDeduplicator.processDatabaseDeduplication(client);

      await client.query("COMMIT");
      return insertedOrUpdated;
    } catch (err: any) {
      await client.query("ROLLBACK");
      console.error(`💥 SQL Transaction ROLLBACK saat Bulk UPSERT POI:`, err.message);
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Re-cluster and clean existing database POIs without calling Overpass API
   */
  public async reclusterExistingPoisWithTransaction(
    updates: any[] = [],
    deleteIds: any[] = []
  ): Promise<{ updatedCount: number; deletedCount: number }> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      if (Array.isArray(deleteIds) && deleteIds.length > 0) {
        await client.query("DELETE FROM pois WHERE id = ANY($1::uuid[]);", [deleteIds]);
      }

      let updatedCount = 0;
      if (Array.isArray(updates) && updates.length > 0) {
        for (const item of updates) {
          const updateQuery = `
            UPDATE pois 
            SET name = $1, category = $2, updated_at = CURRENT_TIMESTAMP
            WHERE id = $3;
          `;
          await client.query(updateQuery, [item.name, item.category, item.id]);
          updatedCount++;
        }
      }

      await client.query("COMMIT");
      return { updatedCount, deletedCount: deleteIds.length };
    } catch (err: any) {
      await client.query("ROLLBACK");
      console.error(`💥 SQL Transaction ROLLBACK saat Re-clustering:`, err.message);
      throw err;
    } finally {
      client.release();
    }
  }
}

export const poiRepository = POIRepository.getInstance();
export { POIRepository as PoiRepository };
