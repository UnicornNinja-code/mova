/*
 *   Copyright (c) 2026 
 *   All rights reserved.
 *   POIRepository (Data Access Layer for Master pois Table & PostGIS Spatial Operations)
 */

import format from "pg-format";
import { pool } from "../config/database.js";
import { spatialDeduplicator } from "../services/poi/SpatialDeduplicator.js";

/**
 * Helper to convert zone.polygon (array of points or GeoJSON object) to GeoJSON geometry JSON string
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

  // If already a GeoJSON object with type "Polygon" or "Feature"
  if (parsed.type === "Polygon") {
    return JSON.stringify(parsed);
  }
  if (parsed.type === "Feature" && parsed.geometry) {
    return JSON.stringify(parsed.geometry);
  }

  // If array of points [[lon, lat], [lon, lat], ...]
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

export class POIRepository {
  static instance = null;

  constructor(dbPool = pool) {
    if (POIRepository.instance && dbPool === pool) {
      return POIRepository.instance;
    }
    this.pool = dbPool;
    if (dbPool === pool) {
      POIRepository.instance = this;
    }
  }

  static getInstance(dbPool = pool) {
    if (!POIRepository.instance) {
      POIRepository.instance = new POIRepository(dbPool);
    }
    return POIRepository.instance;
  }

  /**
   * Fetch all Master Data POIs (with active categories)
   */
  async findAll() {
    const query = `
      SELECT p.* 
      FROM pois p
      LEFT JOIN poi_categories c ON p.category = c.name
      WHERE (c.is_active IS NULL OR c.is_active = true)
        AND p.status = 'APPROVED'
      ORDER BY p.name ASC;
    `;
    const { rows } = await this.pool.query(query);
    return rows;
  }

  /**
   * Fetch POI by ID
   */
  async findById(id) {
    const query = `SELECT * FROM pois WHERE id = $1;`;
    const { rows } = await this.pool.query(query, [id]);
    return rows[0] || null;
  }

  /**
   * Fetch all POIs with status 'PENDING_APPROVAL'
   */
  async findPendingPois() {
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
  async updatePoiStatus(poiId, status) {
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
   * Fetch POIs located inside a specific zone polygon using PostGIS ST_Contains
   */
  /**
   * Fetch POIs located inside a specific zone polygon using PostGIS ST_Contains (Logical POI Representative Only)
   */
  async findByZonePolygon(zonePolygon) {
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
          ST_SetSRID(ST_GeomFromGeoJSON($1), 4326), 
          p.geom
        )
      ORDER BY p.logical_poi_id, (p.duplicate_of IS NULL) DESC, p.created_at ASC, p.id ASC;
    `;
    const { rows } = await this.pool.query(query, [geoJsonStr]);
    return rows;
  }

  /**
   * Dynamic PostGIS Spatial DSS Evaluation for Criteria C1 (Density) & C2 (Diversity) per Zone Polygon
   */
  async getDensitasDanDiversitasByZonePolygon(zonePolygon) {
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
          ST_SetSRID(ST_GeomFromGeoJSON($1), 4326), 
          p.geom
        );
    `;
    const { rows } = await this.pool.query(query, [geoJsonStr]);
    return rows[0] || { skor_c1: 0, skor_c2: 0 };
  }

  /**
   * PostGIS Evaluation for Criteria C3 (Time-Based Crowd Score) per Zone Polygon (Logical POI Aware)
   */
  async getTimeCrowdScoreByZonePolygon(zonePolygon, slotName) {
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
            ST_SetSRID(ST_GeomFromGeoJSON($1), 4326), 
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
  async getTimeCrowdDetailsByZonePolygon(zonePolygon, slotName) {
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
          ST_SetSRID(ST_GeomFromGeoJSON($1), 4326), 
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
  async getLeakageReport(limit = 50) {
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
   * Re-links foreign keys, standardizes external_id, and deletes physical duplicate rows
   */
  async reconcileAndCleanupDuplicatePois(providedClient = null) {
    const client = providedClient || (await this.pool.connect());
    const isLocalTransaction = !providedClient;

    try {
      if (isLocalTransaction) await client.query("BEGIN");

      // Find all legacy duplicate groups sharing the same osm_id where osm_type is NULL
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

        // Select Authoritative Record: older created_at or record with non-null osm_type
        const authoritative = members.find((m) => m.osm_type !== null) || members[0];
        const canonicalOsmType = members.find((m) => m.osm_type !== null)?.osm_type || "node";
        const canonicalExternalId = `osm:${canonicalOsmType}:${osmId}`;

        await client.query(
          `UPDATE pois 
           SET osm_type = COALESCE(osm_type, $1),
               external_id = $2,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $3;`,
          [canonicalOsmType, canonicalExternalId, authoritative.id]
        );

        const duplicateIds = members.filter((m) => m.id !== authoritative.id).map((m) => m.id);

        if (duplicateIds.length > 0) {
          // Re-link foreign key references in candidate_selling_locations
          const { rowCount: relinkedCount } = await client.query(
            `UPDATE candidate_selling_locations
             SET poi_id = $1
             WHERE poi_id = ANY($2::uuid[]);`,
            [authoritative.id, duplicateIds]
          );
          totalRelinked += relinkedCount || 0;

          // Re-link any duplicate_of references in pois
          await client.query(
            `UPDATE pois
             SET duplicate_of = $1
             WHERE duplicate_of = ANY($2::uuid[]);`,
            [authoritative.id, duplicateIds]
          );

          // Delete redundant physical duplicate rows
          const { rowCount: deletedCount } = await client.query(
            `DELETE FROM pois WHERE id = ANY($1::uuid[]);`,
            [duplicateIds]
          );
          totalDeleted += deletedCount || 0;
        }
      }

      if (isLocalTransaction) await client.query("COMMIT");
      console.log(`✅ Duplicate Reconcile & Cleanup Selesai: ${totalDeleted} physical duplicate rows dihapus, ${totalRelinked} candidate references re-linked.`);
      return { totalDeleted, totalRelinked, duplicateGroupsProcessed: dupGroups.length };
    } catch (err) {
      if (isLocalTransaction) await client.query("ROLLBACK");
      console.error("💥 Error saat reconcile and cleanup duplicate POIs:", err.message);
      throw err;
    } finally {
      if (isLocalTransaction) client.release();
    }
  }

  /**
   * Idempotent Bulk UPSERT Transaction for Overpass POI Synchronization
   * Resolves POI identity by external_id OR osm_id, updating existing records in place.
   */
  async syncCityPoisWithTransaction(poisData) {
    if (!Array.isArray(poisData) || poisData.length === 0) {
      return [];
    }

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      // 1. First run reconcile and cleanup on existing duplicates if any exist
      await this.reconcileAndCleanupDuplicatePois(client);

      // 2. Fetch all existing POIs for identity resolution
      const { rows: existingPois } = await client.query(
        "SELECT id, external_id, osm_type, osm_id, logical_poi_id, duplicate_of, approval_status, operational_status FROM pois;"
      );

      const existingByExternalId = new Map();
      const existingByOsmId = new Map();

      existingPois.forEach((p) => {
        if (p.external_id) existingByExternalId.set(p.external_id, p);
        if (p.osm_id !== null && p.osm_id !== undefined && !p.osm_type) {
          existingByOsmId.set(String(p.osm_id), p);
        }
      });

      const insertedOrUpdated = [];

      for (const p of poisData) {
        const osmType = p.osm_type || null;
        const osmId = p.osm_id || null;
        const canonicalExternalId = p.external_id || (osmId ? `osm:${osmType || 'node'}:${osmId}` : null);

        let safeCategory = p.category;
        let safeOpStatus = p.operational_status || "ELIGIBLE";
        let safeExclusionReason = p.exclusion_reason || null;

        if (safeCategory === "IGNORED" || !safeCategory) {
          safeCategory = "Lainnya";
          safeOpStatus = "EXCLUDED";
          safeExclusionReason = safeExclusionReason || "BLACKLIST_NOISE";
        }

        // Match existing POI by external_id OR by legacy osm_id (only when osmType is NULL)
        let existingMatch = null;
        if (canonicalExternalId && existingByExternalId.has(canonicalExternalId)) {
          existingMatch = existingByExternalId.get(canonicalExternalId);
        } else if (osmId && !osmType && existingByOsmId.has(String(osmId))) {
          existingMatch = existingByOsmId.get(String(osmId));
        }

        if (existingMatch) {
          // UPDATE existing POI in place
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
            safeCategory,
            p.latitude,
            p.longitude,
            p.approval_status || "APPROVED",
            safeOpStatus,
            safeExclusionReason,
            JSON.stringify(p.metadata || {}),
            existingMatch.id,
          ]);

          if (rows[0]) {
            insertedOrUpdated.push(rows[0]);
            existingByExternalId.set(rows[0].external_id, rows[0]);
            if (rows[0].osm_id) existingByOsmId.set(String(rows[0].osm_id), rows[0]);
          }
        } else {
          // INSERT genuinely new POI
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
            safeCategory,
            p.latitude,
            p.longitude,
            p.approval_status || "APPROVED",
            safeOpStatus,
            safeExclusionReason,
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
      console.log(`✅ Bulk UPSERT COMMIT: ${insertedOrUpdated.length} Master Data POI skala kota berhasil disimpan/diperbarui ke PostgreSQL DB (Tanpa Hapus ID / Tanpa Duplikat).`);
      return insertedOrUpdated;
    } catch (err) {
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
  async reclusterExistingPoisWithTransaction(updates = [], deleteIds = []) {
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
      console.log(`✅ Re-clustering DB Berhasil: ${updatedCount} POI diperbarui, ${deleteIds.length} titik hantu dibuang.`);
      return { updatedCount, deletedCount: deleteIds.length };
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(`💥 SQL Transaction ROLLBACK saat Re-clustering:`, err.message);
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Aggregate POI Statistics & Spatial Density Summary (Control Center Metrics)
   */
  async getPoiStatsData() {
    // 1. Total POIs, Valid, Eligible, Excluded, Pending, Duplicate, Last Sync, Last Update
    const { rows: summaryRows } = await this.pool.query(`
      SELECT 
        COUNT(*)::int AS total_pois,
        COUNT(CASE WHEN status = 'APPROVED' AND operational_status <> 'EXCLUDED' THEN 1 END)::int AS valid_count,
        COUNT(CASE WHEN status = 'APPROVED' AND operational_status = 'ELIGIBLE' THEN 1 END)::int AS eligible_count,
        COUNT(CASE WHEN operational_status = 'EXCLUDED' THEN 1 END)::int AS excluded_count,
        COUNT(CASE WHEN status = 'PENDING' OR approval_status = 'PENDING' THEN 1 END)::int AS pending_count,
        COUNT(CASE WHEN duplicate_of IS NOT NULL OR status = 'DUPLICATE' THEN 1 END)::int AS duplicate_count,
        COUNT(DISTINCT category)::int AS total_categories,
        MAX(updated_at) AS last_updated_at,
        MAX(created_at) FILTER (WHERE metadata->>'source' = 'OVERPASS_API' OR external_id LIKE 'osm:%') AS last_sync_at
      FROM pois
    `);

    // 2. Breakdown per Category
    const { rows: categoryRows } = await this.pool.query(`
      SELECT 
        category,
        COUNT(*)::int AS count,
        ROUND((COUNT(*)::numeric / NULLIF((SELECT COUNT(*) FROM pois WHERE status = 'APPROVED' AND operational_status <> 'EXCLUDED'), 0)::numeric) * 100, 1) AS percentage
      FROM pois
      WHERE status = 'APPROVED' AND operational_status <> 'EXCLUDED'
      GROUP BY category
      ORDER BY count DESC
    `);

    // 3. Breakdown per Data Source
    const { rows: sourceRows } = await this.pool.query(`
      SELECT 
        COALESCE(
          metadata->>'source', 
          CASE 
            WHEN external_id LIKE 'osm:%' THEN 'OVERPASS_API'
            WHEN external_id LIKE 'manual:%' THEN 'MANUAL_ENTRY'
            ELSE 'SYSTEM'
          END
        ) AS source_key,
        COUNT(*)::int AS count,
        ROUND((COUNT(*)::numeric / NULLIF((SELECT COUNT(*) FROM pois), 0)::numeric) * 100, 1) AS percentage
      FROM pois
      GROUP BY 1
      ORDER BY count DESC
    `);

    // 4. Density & Count per Zone
    const { rows: zoneRows } = await this.pool.query(`
      SELECT 
        z.id AS zone_id,
        z.name AS zone_name,
        z.status AS zone_status,
        COUNT(p.id)::int AS poi_count,
        COUNT(DISTINCT p.category)::int AS category_count,
        ROUND(
          (COUNT(p.id)::numeric / NULLIF(ST_Area(z.geom::geography) / 1000000.0, 0)::numeric), 
          2
        ) AS poi_density_km2
      FROM zones z
      LEFT JOIN pois p 
        ON p.status = 'APPROVED' 
        AND p.operational_status <> 'EXCLUDED' 
        AND ST_Contains(z.geom, p.geom)
      GROUP BY z.id, z.name, z.status, z.geom
      ORDER BY poi_count DESC
    `);

    const summary = summaryRows[0] || {
      total_pois: 0,
      valid_count: 0,
      eligible_count: 0,
      excluded_count: 0,
      pending_count: 0,
      duplicate_count: 0,
      total_categories: 0,
      last_updated_at: null,
      last_sync_at: null,
    };

    // Calculate Dataset Health Status
    let health_status = "OPTIMAL";
    let health_message = "Dataset normal, terverifikasi, dan siap digunakan";
    if (summary.total_pois === 0) {
      health_status = "EMPTY";
      health_message = "Belum ada dataset POI tersimpan";
    } else if (summary.pending_count > 0) {
      health_status = "NEEDS_REVIEW";
      health_message = `${summary.pending_count} POI memerlukan peninjauan persetujuan`;
    }

    return {
      summary: {
        ...summary,
        health_status,
        health_message,
      },
      categories_summary: categoryRows,
      sources_summary: sourceRows,
      density_by_zone: zoneRows,
    };
  }

  /**
   * Create a single manual POI record
   */
  async createManualPoi(poiData) {
    const genUuid = poiData.id || crypto.randomUUID();
    const extId = poiData.external_id || `manual:${genUuid}`;
    const logicalPoiId = poiData.logical_poi_id || genUuid;
    const approvalStatus = poiData.approval_status || "APPROVED";
    const status = poiData.status || (approvalStatus === "PENDING" || approvalStatus === "PENDING_APPROVAL" ? "PENDING" : "APPROVED");

    const insertQuery = `
      INSERT INTO pois (
        id, external_id, osm_type, osm_id, name, category, latitude, longitude,
        approval_status, operational_status, exclusion_reason, metadata, logical_poi_id, geom, status
      )
      VALUES (
        $1::uuid, $2, $3, $4, $5, $6,
        $7::double precision, $8::double precision,
        $9, $10, $11, $12::jsonb, $13::uuid,
        ST_SetSRID(ST_MakePoint($8::double precision, $7::double precision), 4326),
        $14
      )
      RETURNING *;
    `;
    const { rows } = await this.pool.query(insertQuery, [
      genUuid,
      extId,
      poiData.osm_type || null,
      poiData.osm_id || null,
      poiData.name,
      poiData.category || "Lainnya",
      poiData.latitude,
      poiData.longitude,
      approvalStatus,
      poiData.operational_status || "ELIGIBLE",
      poiData.exclusion_reason || null,
      JSON.stringify(poiData.metadata || {}),
      logicalPoiId,
      status,
    ]);
    return rows[0];
  }

  /**
   * Update an existing POI record
   */
  async updateManualPoi(id, updateData) {
    const fields = [];
    const values = [];
    let idx = 1;

    if (updateData.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(updateData.name);
    }
    if (updateData.category !== undefined) {
      fields.push(`category = $${idx++}`);
      values.push(updateData.category);
    }
    if (updateData.latitude !== undefined) {
      fields.push(`latitude = $${idx++}::double precision`);
      values.push(Number(updateData.latitude));
    }
    if (updateData.longitude !== undefined) {
      fields.push(`longitude = $${idx++}::double precision`);
      values.push(Number(updateData.longitude));
    }
    if (updateData.latitude !== undefined && updateData.longitude !== undefined) {
      fields.push(`geom = ST_SetSRID(ST_MakePoint($${idx - 1}::double precision, $${idx - 2}::double precision), 4326)`);
    }
    if (updateData.approval_status !== undefined) {
      fields.push(`approval_status = $${idx++}`);
      values.push(updateData.approval_status);
      fields.push(`status = $${idx++}`);
      values.push(updateData.approval_status === "APPROVED" ? "APPROVED" : (updateData.approval_status === "REJECTED" ? "REJECTED" : "PENDING"));
    }
    if (updateData.operational_status !== undefined) {
      fields.push(`operational_status = $${idx++}`);
      values.push(updateData.operational_status);
    }
    if (updateData.exclusion_reason !== undefined) {
      fields.push(`exclusion_reason = $${idx++}`);
      values.push(updateData.exclusion_reason);
    }
    if (updateData.metadata !== undefined) {
      fields.push(`metadata = $${idx++}::jsonb`);
      values.push(JSON.stringify(updateData.metadata));
    }

    if (fields.length === 0) {
      return await this.findById(id);
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const query = `
      UPDATE pois
      SET ${fields.join(", ")}
      WHERE id = $${idx}::uuid
      RETURNING *;
    `;
    const { rows } = await this.pool.query(query, values);
    return rows[0] || null;
  }

  /**
   * Delete POI record and clean related links
   */
  async deleteManualPoi(id) {
    await this.pool.query("UPDATE candidate_selling_locations SET poi_id = NULL WHERE poi_id = $1", [id]);
    await this.pool.query("DELETE FROM poi_approval_logs WHERE poi_id = $1", [id]);
    const { rows } = await this.pool.query("DELETE FROM pois WHERE id = $1 RETURNING *;", [id]);
    return rows[0] || null;
  }
}

export const poiRepository = POIRepository.getInstance();
