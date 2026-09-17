/*
 * zoneModel.js
 * Model for Zone CRUD and Spatial Queries (PostGIS)
 * Optimized according to Postgres & SQL Best Practices.
 */

import { pool } from "../config/database.js";

/**
 * Format polygon data into a valid GeoJSON Geometry string for PostGIS ingestion
 * @param {any} polygon 
 * @returns {string|null}
 */
function normalizeToGeoJSONGeometry(polygon) {
  if (!polygon) return null;
  let parsed = polygon;
  if (typeof polygon === "string") {
    try {
      parsed = JSON.parse(polygon);
    } catch {
      return null;
    }
  }
  if (parsed?.type === "Polygon") return JSON.stringify(parsed);
  if (parsed?.type === "Feature" && parsed.geometry) return JSON.stringify(parsed.geometry);
  if (Array.isArray(parsed) && parsed.length >= 3) {
    const coordinates = parsed.map((pt) => {
      if (Array.isArray(pt)) {
        const isLonFirst = Math.abs(pt[0]) > Math.abs(pt[1]);
        return [parseFloat(isLonFirst ? pt[0] : pt[1]), parseFloat(isLonFirst ? pt[1] : pt[0])];
      }
      return [parseFloat(pt.lon ?? pt.lng ?? 0), parseFloat(pt.lat ?? 0)];
    });
    const first = coordinates[0];
    const last = coordinates[coordinates.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      coordinates.push([first[0], first[1]]);
    }
    return JSON.stringify({ type: "Polygon", coordinates: [coordinates] });
  }
  return null;
}

export const ZoneModel = {
  /**
   * Find a zone by UUID, including active rider count via indexed LEFT JOIN
   */
  async findById(id) {
    const query = `
      SELECT 
        z.id,
        z.name,
        z.description,
        z.max_capacity,
        z.status,
        z.polygon,
        z.created_at,
        z.updated_at,
        COALESCE(za.active_count, 0)::int AS active_riders_count
      FROM zones z
      LEFT JOIN (
        SELECT zone_id, COUNT(id)::int AS active_count
        FROM zone_assignments
        WHERE zone_id = $1
          AND status = 'CHECKED_IN'
          AND assignment_date = CURRENT_DATE
        GROUP BY zone_id
      ) za ON za.zone_id = z.id
      WHERE z.id = $1;
    `;
    const { rows } = await pool.query(query, [id]);
    return rows[0] || null;
  },

  /**
   * Find a zone by name (case-insensitive)
   */
  async findByName(name, excludeId = null) {
    let query = `
      SELECT id, name, description, max_capacity, status, polygon, created_at, updated_at
      FROM zones 
      WHERE LOWER(name) = LOWER($1)
    `;
    const values = [name.trim()];
    if (excludeId) {
      query += ` AND id != $2`;
      values.push(excludeId);
    }
    query += ` LIMIT 1;`;
    const { rows } = await pool.query(query, values);
    return rows[0] || null;
  },

  /**
   * Find all zones with optional status and search filter using indexed LEFT JOIN aggregation
   */
  async findAll({ status, search } = {}) {
    let query = `
      SELECT 
        z.id,
        z.name,
        z.description,
        z.max_capacity,
        z.status,
        z.polygon,
        z.created_at,
        z.updated_at,
        COALESCE(za.active_count, 0)::int AS active_riders_count
      FROM zones z
      LEFT JOIN (
        SELECT zone_id, COUNT(id)::int AS active_count
        FROM zone_assignments
        WHERE status = 'CHECKED_IN'
          AND assignment_date = CURRENT_DATE
        GROUP BY zone_id
      ) za ON za.zone_id = z.id
      WHERE 1=1
    `;
    const values = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND z.status = $${paramIndex}::"ZoneStatus"`;
      values.push(status.toUpperCase());
      paramIndex++;
    }

    if (search) {
      query += ` AND (z.name ILIKE $${paramIndex} OR z.description ILIKE $${paramIndex})`;
      values.push(`%${search}%`);
      paramIndex++;
    }

    query += ` ORDER BY z.name ASC;`;
    const { rows } = await pool.query(query, values);
    return rows;
  },

  /**
   * Create a new zone with synchronized native geometry (geom) for PostGIS index acceleration
   */
  async create({ name, description = "", max_capacity = 10, status = "ACTIVE", polygon }) {
    const geoJsonStr = normalizeToGeoJSONGeometry(polygon);
    const query = `
      INSERT INTO zones (name, description, max_capacity, status, polygon, geom)
      VALUES (
        $1, 
        $2, 
        $3, 
        $4::"ZoneStatus", 
        $5::jsonb,
        CASE WHEN $6::text IS NOT NULL THEN ST_SetSRID(ST_GeomFromGeoJSON($6), 4326) ELSE NULL END
      )
      RETURNING id, name, description, max_capacity, status, polygon, created_at, updated_at;
    `;
    const values = [
      name.trim(),
      description,
      parseInt(max_capacity, 10),
      status,
      JSON.stringify(polygon),
      geoJsonStr,
    ];
    const { rows } = await pool.query(query, values);
    return rows[0];
  },

  /**
   * Update all fields of an existing zone with synchronized native geometry
   */
  async update(id, { name, description, max_capacity, status, polygon }) {
    const setClauses = [];
    const values = [id];
    let paramIndex = 2;

    if (name !== undefined) {
      setClauses.push(`name = $${paramIndex}`);
      values.push(name.trim());
      paramIndex++;
    }
    if (description !== undefined) {
      setClauses.push(`description = $${paramIndex}`);
      values.push(description);
      paramIndex++;
    }
    if (max_capacity !== undefined) {
      setClauses.push(`max_capacity = $${paramIndex}`);
      values.push(parseInt(max_capacity, 10));
      paramIndex++;
    }
    if (status !== undefined) {
      setClauses.push(`status = $${paramIndex}::"ZoneStatus"`);
      values.push(status.toUpperCase());
      paramIndex++;
    }
    if (polygon !== undefined) {
      const geoJsonStr = normalizeToGeoJSONGeometry(polygon);
      setClauses.push(`polygon = $${paramIndex}::jsonb`);
      values.push(JSON.stringify(polygon));
      paramIndex++;

      setClauses.push(`geom = CASE WHEN $${paramIndex}::text IS NOT NULL THEN ST_SetSRID(ST_GeomFromGeoJSON($${paramIndex}), 4326) ELSE NULL END`);
      values.push(geoJsonStr);
      paramIndex++;
    }

    if (setClauses.length === 0) {
      return this.findById(id);
    }

    const query = `
      UPDATE zones
      SET ${setClauses.join(", ")}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, name, description, max_capacity, status, polygon, created_at, updated_at;
    `;
    const { rows } = await pool.query(query, values);
    return rows[0] || null;
  },

  /**
   * Quick Edit: Update Zone Status (ACTIVE, RESTRICTED, INACTIVE)
   */
  async updateStatus(id, status) {
    const query = `
      UPDATE zones
      SET status = $2::"ZoneStatus", updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, name, description, max_capacity, status, polygon, created_at, updated_at;
    `;
    const { rows } = await pool.query(query, [id, status.toUpperCase()]);
    return rows[0] || null;
  },

  /**
   * Quick Edit: Update Zone Max Capacity
   */
  async updateCapacity(id, max_capacity) {
    const query = `
      UPDATE zones
      SET max_capacity = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, name, description, max_capacity, status, polygon, created_at, updated_at;
    `;
    const { rows } = await pool.query(query, [id, parseInt(max_capacity, 10)]);
    return rows[0] || null;
  },

  /**
   * Delete a zone by ID
   */
  async delete(id) {
    const query = `
      DELETE FROM zones
      WHERE id = $1
      RETURNING id, name;
    `;
    const { rows } = await pool.query(query, [id]);
    return rows[0] || null;
  },

  /**
   * Check if there are active checked-in riders in a zone
   */
  async countActiveRiders(zoneId) {
    const query = `
      SELECT COUNT(id)::int AS count
      FROM zone_assignments
      WHERE zone_id = $1
        AND status = 'CHECKED_IN'
        AND assignment_date = CURRENT_DATE;
    `;
    const { rows } = await pool.query(query, [zoneId]);
    return rows[0]?.count || 0;
  },

  /**
   * Check spatial overlap using PostGIS ST_Intersects with native GiST index utilization
   * @param {string} polygonGeoJsonStr GeoJSON string of the polygon geometry
   * @param {string|null} excludeZoneId Zone ID to exclude (for updates)
   * @returns {Promise<{id: string, name: string}|null>} Overlapping zone if exists
   */
  async checkPolygonOverlap(polygonGeoJsonStr, excludeZoneId = null) {
    const query = `
      SELECT id, name
      FROM zones
      WHERE status != 'INACTIVE'
        AND ($1::uuid IS NULL OR id != $1)
        AND (geom IS NOT NULL OR polygon IS NOT NULL)
        AND ST_Intersects(
          ST_SetSRID(ST_GeomFromGeoJSON($2), 4326),
          COALESCE(
            geom,
            ST_SetSRID(ST_GeomFromGeoJSON(
              CASE 
                WHEN jsonb_typeof(polygon) = 'object' AND polygon->>'type' = 'Polygon' THEN polygon::text
                WHEN jsonb_typeof(polygon) = 'object' AND polygon->>'type' = 'Feature' THEN (polygon->>'geometry')::text
                ELSE polygon::text
              END
            ), 4326)
          )
        )
      LIMIT 1;
    `;

    try {
      const { rows } = await pool.query(query, [excludeZoneId || null, polygonGeoJsonStr]);
      return rows[0] || null;
    } catch (err) {
      console.warn("⚠️ Warning checking polygon overlap with PostGIS:", err.message);
      return null;
    }
  }
};
