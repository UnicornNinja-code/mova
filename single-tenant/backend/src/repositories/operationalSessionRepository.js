/*
 * operationalSessionRepository.js
 * Data Access Layer for Milestone B-11: Operational Sessions & Real-Time LBS Tracking
 * Implements PostgreSQL/PostGIS as 100% Single State Authority.
 */

import { pool } from "../config/database.js";

export class OperationalSessionRepository {
  static instance = null;

  constructor(dbPool = pool) {
    if (OperationalSessionRepository.instance && dbPool === pool) {
      return OperationalSessionRepository.instance;
    }
    this.pool = dbPool;
    if (dbPool === pool) {
      OperationalSessionRepository.instance = this;
    }
  }

  static getInstance(dbPool = pool) {
    if (!OperationalSessionRepository.instance) {
      OperationalSessionRepository.instance = new OperationalSessionRepository(dbPool);
    }
    return OperationalSessionRepository.instance;
  }

  /**
   * Create or resume an operational session linked to a zone assignment (1:1)
   */
  async createOrGetSession({ riderId, assignmentId, armadaId, zoneId, status = "CLAIMED" }) {
    const query = `
      INSERT INTO operational_sessions (rider_id, assignment_id, armada_id, zone_id, status, started_at)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      ON CONFLICT (assignment_id) DO UPDATE
      SET 
        armada_id = COALESCE(EXCLUDED.armada_id, operational_sessions.armada_id),
        zone_id = EXCLUDED.zone_id,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;
    const { rows } = await this.pool.query(query, [riderId, assignmentId, armadaId, zoneId, status]);
    return rows[0];
  }

  /**
   * Find active operational session for a rider
   */
  async findActiveSessionByRiderId(riderId) {
    const query = `
      SELECT 
        os.id AS session_id,
        os.id,
        os.rider_id,
        os.assignment_id,
        os.armada_id,
        os.zone_id,
        os.status AS session_status,
        os.started_at,
        os.checked_in_at,
        os.check_in_lat,
        os.check_in_lon,
        os.checked_out_at,
        os.checkout_lat,
        os.checkout_lon,
        os.completed_at,
        os.checkout_notes,
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
      FROM operational_sessions os
      JOIN users u ON os.rider_id = u.id
      JOIN zones z ON os.zone_id = z.id
      LEFT JOIN zone_assignments za ON os.assignment_id = za.id
      LEFT JOIN armadas a ON os.armada_id = a.id
      WHERE os.rider_id = $1 
        AND os.status IN ('CLAIMED', 'CHECKED_IN', 'OPERATING')
      ORDER BY os.started_at DESC
      LIMIT 1;
    `;
    const { rows } = await this.pool.query(query, [riderId]);
    return rows[0] || null;
  }

  /**
   * Find operational session by ID
   */
  async findSessionById(sessionId) {
    const query = `
      SELECT 
        os.*,
        z.name AS zone_name,
        a.code AS armada_code,
        u.name AS rider_name
      FROM operational_sessions os
      JOIN users u ON os.rider_id = u.id
      JOIN zones z ON os.zone_id = z.id
      LEFT JOIN armadas a ON os.armada_id = a.id
      WHERE os.id = $1;
    `;
    const { rows } = await this.pool.query(query, [sessionId]);
    return rows[0] || null;
  }

  /**
   * Find operational session by assignment ID
   */
  async findSessionByAssignmentId(assignmentId) {
    const query = `
      SELECT os.*, z.name AS zone_name, a.code AS armada_code
      FROM operational_sessions os
      JOIN zones z ON os.zone_id = z.id
      LEFT JOIN armadas a ON os.armada_id = a.id
      WHERE os.assignment_id = $1;
    `;
    const { rows } = await this.pool.query(query, [assignmentId]);
    return rows[0] || null;
  }

  /**
   * Transition session on Check-in: CHECKED_IN -> OPERATING
   */
  async checkInSession({ sessionId, assignmentId, checkInLat, checkInLon }) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      // Update operational_sessions to OPERATING
      const sessionQuery = `
        UPDATE operational_sessions
        SET 
          status = 'OPERATING',
          checked_in_at = CURRENT_TIMESTAMP,
          check_in_lat = $2,
          check_in_lon = $3,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *;
      `;
      const { rows: sessionRows } = await client.query(sessionQuery, [sessionId, checkInLat, checkInLon]);

      // Update zone_assignments status to CHECKED_IN
      if (assignmentId) {
        await client.query(
          `UPDATE zone_assignments SET status = 'CHECKED_IN', updated_at = CURRENT_TIMESTAMP WHERE id = $1;`,
          [assignmentId]
        );
      }

      await client.query("COMMIT");
      return sessionRows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Transition session on Checkout: OPERATING -> CHECKED_OUT / COMPLETED
   */
  async checkoutSession({ sessionId, assignmentId, armadaId, returnStatus = "ACTIVE", checkoutLat = null, checkoutLon = null, notes = null }) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      // 1. Update operational_sessions
      const sessionQuery = `
        UPDATE operational_sessions
        SET 
          status = 'COMPLETED',
          checked_out_at = CURRENT_TIMESTAMP,
          completed_at = CURRENT_TIMESTAMP,
          checkout_lat = $2,
          checkout_lon = $3,
          checkout_notes = $4,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *;
      `;
      const { rows: sessionRows } = await client.query(sessionQuery, [sessionId, checkoutLat, checkoutLon, notes]);

      // 2. Update zone_assignments to COMPLETED
      if (assignmentId) {
        await client.query(
          `UPDATE zone_assignments SET status = 'COMPLETED', updated_at = CURRENT_TIMESTAMP WHERE id = $1;`,
          [assignmentId]
        );
      }

      // 3. Return armada unit to Hub (ACTIVE or MAINTENANCE)
      if (armadaId) {
        const validReturnStatus = ["ACTIVE", "MAINTENANCE"].includes(returnStatus) ? returnStatus : "ACTIVE";
        await client.query(
          `UPDATE armadas 
           SET 
             status = $2, 
             current_rider_id = NULL, 
             reserved_by_rider_id = NULL, 
             reserved_until = NULL, 
             updated_at = CURRENT_TIMESTAMP 
           WHERE id = $1;`,
          [armadaId, validReturnStatus]
        );
      }

      await client.query("COMMIT");
      return sessionRows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Upsert Live Rider Position to latest_rider_positions (SSOT 1 row per rider)
   */
  async upsertLatestPosition({
    riderId,
    sessionId,
    riderName,
    latitude,
    longitude,
    speed = 0,
    heading = 0,
    isInsideZone = false,
    actualZoneId = null,
    actualZoneName = null,
    zoneCompliance = "OUTSIDE_ZONE",
    roadCompliance = "NO_ROAD_ALERT",
    prohibitedRoadId = null,
    prohibitedRoadName = null,
    recordedAt = new Date(),
  }) {
    const query = `
      INSERT INTO latest_rider_positions (
        rider_id, session_id, rider_name, latitude, longitude, speed, heading,
        is_inside_zone, actual_zone_id, actual_zone_name, zone_compliance,
        road_compliance, prohibited_road_id, prohibited_road_name, recorded_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, CURRENT_TIMESTAMP)
      ON CONFLICT (rider_id) DO UPDATE
      SET 
        session_id = EXCLUDED.session_id,
        rider_name = EXCLUDED.rider_name,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        speed = EXCLUDED.speed,
        heading = EXCLUDED.heading,
        is_inside_zone = EXCLUDED.is_inside_zone,
        actual_zone_id = EXCLUDED.actual_zone_id,
        actual_zone_name = EXCLUDED.actual_zone_name,
        zone_compliance = EXCLUDED.zone_compliance,
        road_compliance = EXCLUDED.road_compliance,
        prohibited_road_id = EXCLUDED.prohibited_road_id,
        prohibited_road_name = EXCLUDED.prohibited_road_name,
        recorded_at = EXCLUDED.recorded_at,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;
    const { rows } = await this.pool.query(query, [
      riderId,
      sessionId,
      riderName,
      latitude,
      longitude,
      speed,
      heading,
      isInsideZone,
      actualZoneId,
      actualZoneName,
      zoneCompliance,
      roadCompliance,
      prohibitedRoadId,
      prohibitedRoadName,
      recordedAt,
    ]);
    return rows[0];
  }

  /**
   * Insert Continuous Telemetry History Log
   */
  async insertTelemetryLog({
    sessionId,
    riderId,
    latitude,
    longitude,
    speed = 0,
    heading = 0,
    actualZoneId = null,
    zoneCompliance = "OUTSIDE_ZONE",
    roadCompliance = "NO_ROAD_ALERT",
    recordedAt = new Date(),
  }) {
    const query = `
      INSERT INTO rider_telemetry_logs (
        session_id, rider_id, latitude, longitude, speed, heading,
        actual_zone_id, zone_compliance, road_compliance, recorded_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *;
    `;
    const { rows } = await this.pool.query(query, [
      sessionId,
      riderId,
      latitude,
      longitude,
      speed,
      heading,
      actualZoneId,
      zoneCompliance,
      roadCompliance,
      recordedAt,
    ]);
    return rows[0];
  }

  /**
   * Insert Discrete Geofence State Transition Event Log
   */
  async insertZoneLog({ sessionId, riderId, zoneId, eventType, zoneCompliance = null, latitude, longitude }) {
    const query = `
      INSERT INTO rider_zone_logs (session_id, rider_id, zone_id, event_type, zone_compliance, latitude, longitude)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;
    const { rows } = await this.pool.query(query, [
      sessionId,
      riderId,
      zoneId,
      eventType,
      zoneCompliance,
      latitude,
      longitude,
    ]);
    return rows[0];
  }

  /**
   * Get latest recorded zone log for a rider to evaluate discrete state transition
   */
  async getLatestZoneLog(riderId) {
    const query = `
      SELECT * FROM rider_zone_logs
      WHERE rider_id = $1
      ORDER BY created_at DESC
      LIMIT 1;
    `;
    const { rows } = await this.pool.query(query, [riderId]);
    return rows[0] || null;
  }

  /**
   * Query all Live Rider Positions
   */
  async getAllLiveRiderPositions({ zoneId = null, compliance = null } = {}) {
    let whereClauses = [];
    let values = [];
    let paramIndex = 1;

    if (zoneId) {
      whereClauses.push(`lrp.actual_zone_id = $${paramIndex}`);
      values.push(zoneId);
      paramIndex++;
    }

    if (compliance) {
      whereClauses.push(`lrp.zone_compliance = $${paramIndex}`);
      values.push(compliance);
      paramIndex++;
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const query = `
      SELECT 
        lrp.rider_id,
        lrp.session_id,
        lrp.rider_name,
        lrp.latitude,
        lrp.longitude,
        lrp.speed,
        lrp.heading,
        lrp.is_inside_zone,
        lrp.actual_zone_id,
        lrp.actual_zone_name,
        lrp.zone_compliance,
        lrp.road_compliance,
        lrp.prohibited_road_id,
        lrp.prohibited_road_name,
        lrp.recorded_at,
        lrp.updated_at,
        os.status AS session_status,
        os.zone_id AS assigned_zone_id,
        az.name AS assigned_zone_name,
        a.code AS armada_code,
        a.type AS armada_type
      FROM latest_rider_positions lrp
      LEFT JOIN operational_sessions os ON lrp.session_id = os.id
      LEFT JOIN zones az ON os.zone_id = az.id
      LEFT JOIN armadas a ON os.armada_id = a.id
      ${whereSql}
      ORDER BY lrp.updated_at DESC;
    `;
    const { rows } = await this.pool.query(query, values);
    return rows;
  }

  /**
   * Find Nearby Riders using PostGIS ST_DWithin & ST_Distance
   */
  async findNearbyRiders({ lon, lat, radiusKm = 5, limit = 50 }) {
    const radiusMeters = radiusKm * 1000;
    const query = `
      SELECT 
        lrp.rider_id,
        lrp.session_id,
        lrp.rider_name,
        lrp.latitude,
        lrp.longitude,
        lrp.speed,
        lrp.heading,
        lrp.is_inside_zone,
        lrp.actual_zone_id,
        lrp.actual_zone_name,
        lrp.zone_compliance,
        lrp.road_compliance,
        lrp.recorded_at,
        ROUND((ST_Distance(
          lrp.geom::geography,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        ))::numeric, 2) AS distance_meters,
        ROUND((ST_Distance(
          lrp.geom::geography,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        ) / 1000.0)::numeric, 3) AS distance_km
      FROM latest_rider_positions lrp
      WHERE ST_DWithin(
        lrp.geom::geography,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
        $3
      )
      ORDER BY distance_meters ASC
      LIMIT $4;
    `;
    const { rows } = await this.pool.query(query, [lon, lat, radiusMeters, limit]);
    return rows;
  }

  /**
   * Get Geofence Transition Logs (Auditing)
   */
  async getZoneLogs({ riderId = null, zoneId = null, sessionId = null, page = 1, limit = 50 } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const offset = (pageNum - 1) * limitNum;

    let whereClauses = [];
    let values = [];
    let paramIdx = 1;

    if (riderId) {
      whereClauses.push(`rzl.rider_id = $${paramIdx}`);
      values.push(riderId);
      paramIdx++;
    }
    if (zoneId) {
      whereClauses.push(`rzl.zone_id = $${paramIdx}`);
      values.push(zoneId);
      paramIdx++;
    }
    if (sessionId) {
      whereClauses.push(`rzl.session_id = $${paramIdx}`);
      values.push(sessionId);
      paramIdx++;
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const query = `
      SELECT 
        rzl.id,
        rzl.session_id,
        rzl.rider_id,
        rzl.zone_id,
        rzl.event_type,
        rzl.zone_compliance,
        rzl.latitude,
        rzl.longitude,
        rzl.created_at,
        u.name AS rider_name,
        z.name AS zone_name
      FROM rider_zone_logs rzl
      LEFT JOIN users u ON rzl.rider_id = u.id
      LEFT JOIN zones z ON rzl.zone_id = z.id
      ${whereSql}
      ORDER BY rzl.created_at DESC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1};
    `;
    values.push(limitNum, offset);

    const countQuery = `
      SELECT COUNT(*)::int AS total FROM rider_zone_logs rzl ${whereSql};
    `;
    const countValues = values.slice(0, paramIdx - 1);

    const [{ rows: logs }, { rows: countRows }] = await Promise.all([
      this.pool.query(query, values),
      this.pool.query(countQuery, countValues),
    ]);

    const total = countRows[0]?.total || 0;

    return {
      logs,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        total_pages: Math.ceil(total / limitNum) || 1,
      },
    };
  }

  /**
   * Insert Field Sales Transaction anchored to operational session
   */
  async insertFieldSale({
    sessionId,
    assignmentId = null,
    riderId,
    assignedZoneId,
    actualZoneId = null,
    complianceAtSale = "COMPLIANT",
    productId,
    quantity,
    unitPrice,
    totalPrice,
    lat = -7.4478,
    lon = 112.7183,
  }) {
    let finalAssignmentId = assignmentId;
    if (!finalAssignmentId && sessionId) {
      const { rows: sessRows } = await this.pool.query("SELECT assignment_id FROM operational_sessions WHERE id = $1;", [sessionId]);
      if (sessRows.length > 0 && sessRows[0].assignment_id) {
        finalAssignmentId = sessRows[0].assignment_id;
      }
    }
    if (!finalAssignmentId && riderId) {
      const { rows: zaRows } = await this.pool.query("SELECT id FROM zone_assignments WHERE rider_id = $1 AND assignment_date = CURRENT_DATE LIMIT 1;", [riderId]);
      if (zaRows.length > 0) {
        finalAssignmentId = zaRows[0].id;
      }
    }

    const query = `
      INSERT INTO sales_logs (
        session_id, assignment_id, rider_id, zone_id, actual_zone_id, compliance_at_sale,
        product_id, qty, unit_price, total_price, latitude, longitude
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *;
    `;
    const { rows } = await this.pool.query(query, [
      sessionId,
      finalAssignmentId,
      riderId,
      assignedZoneId,
      actualZoneId,
      complianceAtSale,
      productId,
      quantity,
      unitPrice,
      totalPrice,
      lat,
      lon,
    ]);
    return rows[0];
  }
}

export const operationalSessionRepository = OperationalSessionRepository.getInstance();
