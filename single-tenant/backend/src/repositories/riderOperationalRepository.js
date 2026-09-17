/*
 * riderOperationalRepository.js
 * Data Access Layer for Milestone B-11: Rider Daily Operations
 * Integrates PostGIS ST_Covers Geofencing, 5-Minute Hold Claim, and Operational Session State Transitions.
 */

import { pool } from "../config/database.js";
import { operationalSessionRepository } from "./operationalSessionRepository.js";

export class RiderOperationalRepository {
  static instance = null;

  constructor(dbPool = pool, sessionRepo = operationalSessionRepository) {
    if (RiderOperationalRepository.instance && dbPool === pool) {
      return RiderOperationalRepository.instance;
    }
    this.pool = dbPool;
    this.sessionRepo = sessionRepo;
    if (dbPool === pool) {
      RiderOperationalRepository.instance = this;
    }
  }

  static getInstance(dbPool = pool, sessionRepo = operationalSessionRepository) {
    if (!RiderOperationalRepository.instance) {
      RiderOperationalRepository.instance = new RiderOperationalRepository(dbPool, sessionRepo);
    }
    return RiderOperationalRepository.instance;
  }

  /**
   * Fetch active assignment & operational session for a rider today
   */
  async findActiveRiderSession(riderId) {
    // 1. Try finding active operational session first
    const activeSession = await this.sessionRepo.findActiveSessionByRiderId(riderId);
    if (activeSession) {
      return activeSession;
    }

    // 2. If no active session yet, check today's active assignment in zone_assignments
    const query = `
      SELECT 
        za.id AS assignment_id,
        za.rider_id,
        za.zone_id,
        za.armada_id,
        za.assignment_date,
        za.status AS assignment_status,
        za.topsis_rank,
        za.preference_score,
        z.name AS zone_name,
        z.polygon AS zone_polygon,
        ST_AsGeoJSON(z.geom) AS zone_geom_geojson,
        a.code AS armada_code,
        a.type AS armada_type,
        a.status AS armada_status,
        u.name AS rider_name,
        u.email AS rider_email
      FROM zone_assignments za
      JOIN users u ON za.rider_id = u.id
      JOIN zones z ON za.zone_id = z.id
      LEFT JOIN armadas a ON za.armada_id = a.id
      WHERE za.rider_id = $1 
        AND za.assignment_date = CURRENT_DATE
        AND za.status IN ('ASSIGNED', 'CHECKED_IN')
      ORDER BY za.created_at DESC
      LIMIT 1;
    `;
    const { rows } = await this.pool.query(query, [riderId]);
    const assignment = rows[0] || null;

    if (!assignment) {
      return null;
    }

    // Auto-create or get operational session for this assignment
    const session = await this.sessionRepo.createOrGetSession({
      riderId: assignment.rider_id,
      assignmentId: assignment.assignment_id,
      armadaId: assignment.armada_id,
      zoneId: assignment.zone_id,
      status: assignment.armada_id ? "CLAIMED" : "CLAIMED",
    });

    return {
      ...assignment,
      session_id: session.id,
      id: session.id,
      session_status: session.status,
      started_at: session.started_at,
      checked_in_at: session.checked_in_at,
      check_in_lat: session.check_in_lat,
      check_in_lon: session.check_in_lon,
    };
  }

  /**
   * Fetch all armadas in Hub with reservation availability status for UI rendering
   */
  async getAvailableArmadasForHub(riderId) {
    const query = `
      SELECT 
        a.id,
        a.code,
        a.type,
        a.status,
        a.reserved_by_rider_id,
        a.reserved_until,
        CASE 
          WHEN a.status = 'ACTIVE' AND (a.reserved_until IS NULL OR a.reserved_until < NOW() OR a.reserved_by_rider_id = $1) THEN true
          ELSE false
        END AS is_claimable,
        CASE 
          WHEN a.status = 'IN_USE' OR (a.status = 'RESERVED' AND a.reserved_by_rider_id != $1 AND a.reserved_until >= NOW()) THEN true
          ELSE false
        END AS is_faded_out
      FROM armadas a
      ORDER BY a.code ASC;
    `;
    const { rows } = await this.pool.query(query, [riderId]);
    return rows;
  }

  /**
   * Temporary hold reservation on armada unit (Ticket-Booking Lock)
   */
  async holdArmadaUnit({ riderId, armadaId, holdMinutes = 5 }) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      // Check current armada state (FOR UPDATE row lock)
      const checkQuery = `
        SELECT * FROM armadas 
        WHERE id = $1 FOR UPDATE;
      `;
      const { rows } = await client.query(checkQuery, [armadaId]);
      const armada = rows[0];

      if (!armada) {
        const error = new Error("Unit armada tidak ditemukan.");
        error.statusCode = 404;
        throw error;
      }

      // If armada is currently held by another rider and hold hasn't expired
      const isHeldByOther = armada.status === "RESERVED" &&
        armada.reserved_by_rider_id !== riderId &&
        armada.reserved_until &&
        new Date(armada.reserved_until) > new Date();

      if (armada.status === "IN_USE" || isHeldByOther || armada.status === "MAINTENANCE") {
        const error = new Error(`Unit ${armada.code} sedang diulas / diklaim oleh Rider lain dan tidak tersedia.`);
        error.statusCode = 400;
        throw error;
      }

      // Set temporary reservation hold
      const holdQuery = `
        UPDATE armadas 
        SET 
          status = 'RESERVED',
          reserved_by_rider_id = $2,
          reserved_until = NOW() + ($3 || ' minutes')::interval,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *;
      `;
      const { rows: updatedRows } = await client.query(holdQuery, [
        armadaId,
        riderId,
        holdMinutes,
      ]);

      await client.query("COMMIT");
      return updatedRows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Cancel temporary reservation hold
   */
  async cancelArmadaHold({ riderId, armadaId }) {
    const query = `
      UPDATE armadas 
      SET 
        status = 'ACTIVE',
        reserved_by_rider_id = NULL,
        reserved_until = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 
        AND reserved_by_rider_id = $2
      RETURNING *;
    `;
    const { rows } = await this.pool.query(query, [armadaId, riderId]);
    return rows[0] || null;
  }

  /**
   * Confirm final claim on armada unit (Converts status to IN_USE permanently)
   */
  async confirmArmadaClaim({ riderId, armadaId, assignmentId }) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      // Verify hold or claim eligibility
      const checkQuery = `SELECT * FROM armadas WHERE id = $1 FOR UPDATE;`;
      const { rows } = await client.query(checkQuery, [armadaId]);
      const armada = rows[0];

      if (!armada) {
        const error = new Error("Unit armada tidak ditemukan.");
        error.statusCode = 404;
        throw error;
      }

      // Check if held by another rider
      const isHeldByOther = armada.status === "RESERVED" &&
        armada.reserved_by_rider_id !== riderId &&
        armada.reserved_until &&
        new Date(armada.reserved_until) > new Date();

      if (armada.status === "IN_USE" || isHeldByOther) {
        const error = new Error(`Unit ${armada.code} baru saja diklaim oleh Rider lain. Silakan pilih unit lain.`);
        error.statusCode = 400;
        throw error;
      }

      // Set armada status to IN_USE permanently and bind to rider
      const updateArmadaQuery = `
        UPDATE armadas
        SET 
          status = 'IN_USE',
          current_rider_id = $2,
          reserved_by_rider_id = NULL,
          reserved_until = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *;
      `;
      const { rows: updatedArmadas } = await client.query(updateArmadaQuery, [armadaId, riderId]);

      // Bind armada to assignment
      if (assignmentId) {
        await client.query(
          `UPDATE zone_assignments SET armada_id = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1;`,
          [assignmentId, armadaId]
        );

        // Update or create operational session
        const assignQuery = `SELECT zone_id FROM zone_assignments WHERE id = $1;`;
        const { rows: assignRows } = await client.query(assignQuery, [assignmentId]);
        if (assignRows[0]) {
          await client.query(
            `INSERT INTO operational_sessions (rider_id, assignment_id, armada_id, zone_id, status, started_at)
             VALUES ($1, $2, $3, $4, 'CLAIMED', CURRENT_TIMESTAMP)
             ON CONFLICT (assignment_id) DO UPDATE
             SET armada_id = EXCLUDED.armada_id, status = 'CLAIMED', updated_at = CURRENT_TIMESTAMP;`,
            [riderId, assignmentId, armadaId, assignRows[0].zone_id]
          );
        }
      }

      await client.query("COMMIT");
      return updatedArmadas[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Validate rider GPS coordinates against assigned zone polygon via PostGIS ST_Covers
   */
  async validateAndCheckInRider({ riderId, assignmentId, sessionId, zoneId, lat, lon }) {
    const zoneQuery = `SELECT id, name, polygon, geom FROM zones WHERE id = $1;`;
    const { rows: zoneRows } = await this.pool.query(zoneQuery, [zoneId]);
    const zone = zoneRows[0];

    if (!zone) {
      const error = new Error("Zona tugas tidak ditemukan di database.");
      error.statusCode = 404;
      throw error;
    }

    // PostGIS Spatial Geofence Check: ST_Covers(zone.geom, Point(lon, lat))
    const spatialCheckQuery = `
      SELECT ST_Covers(
        COALESCE(
          geom,
          ST_SetSRID(ST_GeomFromGeoJSON(
            CASE 
              WHEN polygon::text LIKE '{"type"%' THEN polygon::text
              ELSE concat('{"type":"Polygon","coordinates":[', polygon::text, ']}')
            END
          ), 4326)
        ),
        ST_SetSRID(ST_MakePoint($1, $2), 4326)
      ) AS is_inside
      FROM zones
      WHERE id = $3;
    `;
    const { rows: spatialRows } = await this.pool.query(spatialCheckQuery, [
      parseFloat(lon),
      parseFloat(lat),
      zoneId,
    ]);

    const isInside = spatialRows[0]?.is_inside || false;

    if (!isInside) {
      const error = new Error(`Anda berada di luar batas polygon ${zone.name}! Harap menuju ke dalam zona tugas untuk Check-in.`);
      error.statusCode = 400;
      throw error;
    }

    // Explicit Transition: CHECKED_IN -> OPERATING in operational_sessions
    const resolvedSessionId = sessionId || (await this.sessionRepo.findActiveSessionByRiderId(riderId))?.session_id;
    const updatedSession = await this.sessionRepo.checkInSession({
      sessionId: resolvedSessionId,
      assignmentId,
      checkInLat: parseFloat(lat),
      checkInLon: parseFloat(lon),
    });

    return {
      session: updatedSession,
      assignment: { id: assignmentId, status: "CHECKED_IN" },
      assignment_id: assignmentId,
      zone_name: zone.name,
      check_in_lat: parseFloat(lat),
      check_in_lon: parseFloat(lon),
      checked_in_at: updatedSession?.checked_in_at || new Date(),
      status: updatedSession?.status || "OPERATING",
    };
  }

  /**
   * Insert product sales log with monetary snapshot and operational session binding
   */
  async insertSalesLog({
    sessionId = null,
    assignmentId = null,
    riderId,
    zoneId,
    actualZoneId = null,
    complianceAtSale = "COMPLIANT",
    productId,
    quantity,
    unitPrice,
    totalPrice,
    lat = -7.4478,
    lon = 112.7183,
  }) {
    return await this.sessionRepo.insertFieldSale({
      sessionId,
      assignmentId,
      riderId,
      assignedZoneId: zoneId,
      actualZoneId,
      complianceAtSale,
      productId,
      quantity,
      unitPrice,
      totalPrice,
      lat,
      lon,
    });
  }

  /**
   * Fetch paginated sales history for a specific rider
   */
  async getRiderSalesHistory({ riderId, date = null, page = 1, limit = 20 }) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    let whereClause = `WHERE sl.rider_id = $1`;
    const values = [riderId];
    let paramIndex = 2;

    if (date) {
      whereClause += ` AND sl.created_at::date = $${paramIndex}::date`;
      values.push(date);
      paramIndex++;
    }

    const query = `
      SELECT 
        sl.id AS sale_id,
        sl.session_id,
        sl.rider_id,
        sl.zone_id AS assigned_zone_id,
        sl.actual_zone_id,
        sl.compliance_at_sale,
        sl.product_id,
        sl.qty,
        sl.unit_price,
        sl.total_price,
        sl.latitude,
        sl.longitude,
        sl.created_at,
        p.name AS product_name,
        p.description AS product_description,
        z.name AS zone_name
      FROM sales_logs sl
      JOIN products p ON sl.product_id = p.id
      LEFT JOIN zones z ON sl.zone_id = z.id
      ${whereClause}
      ORDER BY sl.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1};
    `;
    values.push(limitNum, offset);

    const countQuery = `
      SELECT COUNT(*)::int AS total, COALESCE(SUM(total_price), 0)::numeric(14,2) AS total_revenue
      FROM sales_logs sl
      ${whereClause};
    `;
    const countValues = values.slice(0, paramIndex - 1);

    const [{ rows: sales }, { rows: countRows }] = await Promise.all([
      this.pool.query(query, values),
      this.pool.query(countQuery, countValues),
    ]);

    const total = countRows[0]?.total || 0;
    const totalRevenue = parseFloat(countRows[0]?.total_revenue || 0);

    return {
      sales,
      total_revenue: totalRevenue,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        total_pages: Math.ceil(total / limitNum) || 1,
      },
    };
  }

  /**
   * Checkout rider session & return armada unit to Hub
   */
  async checkoutRiderSession({ sessionId, assignmentId, armadaId, returnStatus = "ACTIVE", lat = null, lon = null, notes = null }) {
    return await this.sessionRepo.checkoutSession({
      sessionId,
      assignmentId,
      armadaId,
      returnStatus,
      checkoutLat: lat,
      checkoutLon: lon,
      notes,
    });
  }

  /**
   * Find zone covering a spatial point using PostGIS ST_Covers (prioritizing assigned zone)
   */
  async findZoneCoveringPoint({ lon, lat, prioritizedZoneId = null }) {
    const query = `
      SELECT id, name, status
      FROM zones
      WHERE ST_Covers(
        COALESCE(
          geom,
          ST_SetSRID(ST_GeomFromGeoJSON(
            CASE 
              WHEN polygon::text LIKE '{"type"%' THEN polygon::text
              ELSE concat('{"type":"Polygon","coordinates":[', polygon::text, ']}')
            END
          ), 4326)
        ),
        ST_SetSRID(ST_MakePoint($1, $2), 4326)
      )
      ORDER BY (CASE WHEN id = $3 THEN 0 ELSE 1 END) ASC
      LIMIT 1;
    `;
    try {
      const { rows } = await this.pool.query(query, [lon, lat, prioritizedZoneId]);
      return rows[0] || null;
    } catch (err) {
      console.warn("⚠️ PostGIS findZoneCoveringPoint error:", err.message);
      return null;
    }
  }
}

export const riderOperationalRepository = RiderOperationalRepository.getInstance();
