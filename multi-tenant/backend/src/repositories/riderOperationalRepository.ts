/*
 * riderOperationalRepository.ts
 * Data Access Layer for Use Case 6: Rider Daily Operations in TypeScript
 */

import { pool } from "../config/database.js";
import type { Pool } from "pg";

export class RiderOperationalRepository {
  private static instance: RiderOperationalRepository | null = null;
  private pool: Pool;

  constructor(dbPool: Pool = pool) {
    if (RiderOperationalRepository.instance && dbPool === pool) {
      return RiderOperationalRepository.instance;
    }
    this.pool = dbPool;
    if (dbPool === pool) {
      RiderOperationalRepository.instance = this;
    }
  }

  public static getInstance(dbPool: Pool = pool): RiderOperationalRepository {
    if (!RiderOperationalRepository.instance) {
      RiderOperationalRepository.instance = new RiderOperationalRepository(dbPool);
    }
    return RiderOperationalRepository.instance;
  }

  /**
   * Fetch active assignment session for a rider today
   */
  public async findActiveRiderSession(riderId: number | string): Promise<any | null> {
    const query = `
      SELECT 
        za.id AS assignment_id,
        za.rider_id,
        za.zone_id,
        za.armada_id,
        za.assignment_date,
        za.status AS assignment_status,
        z.name AS zone_name,
        z.polygon AS zone_polygon,
        a.code AS armada_code,
        a.type AS armada_type,
        a.status AS armada_status
      FROM zone_assignments za
      JOIN zones z ON za.zone_id = z.id
      LEFT JOIN armadas a ON za.armada_id = a.id
      WHERE za.rider_id = $1 
        AND za.assignment_date = CURRENT_DATE
        AND za.status IN ('ASSIGNED', 'CHECKED_IN')
      LIMIT 1;
    `;
    const { rows } = await this.pool.query(query, [riderId]);
    return rows[0] || null;
  }

  /**
   * Fetch all armadas in Hub with reservation availability status for UI rendering
   */
  /**
   * Fetch all armadas in Hub with reservation availability status for UI rendering
   */
  public async getAvailableArmadasForHub(riderId: number | string): Promise<any[]> {
    const query = `
      SELECT 
        a.id,
        a.code,
        a.type,
        a.status,
        a.status AS fleet_status,
        a.current_rider_id,
        a.reserved_by_rider_id,
        a.reserved_until,
        CASE 
          WHEN a.status = 'ACTIVE' AND a.current_rider_id IS NULL AND (a.reserved_until IS NULL OR a.reserved_until <= NOW() OR a.reserved_by_rider_id = $1) THEN true
          ELSE false
        END AS is_claimable,
        CASE 
          WHEN a.status = 'MAINTENANCE' OR a.status = 'RETIRED' THEN true
          WHEN a.current_rider_id IS NOT NULL THEN true
          WHEN a.status = 'ACTIVE' AND a.reserved_by_rider_id != $1 AND a.reserved_until > NOW() THEN true
          ELSE false
        END AS is_faded_out,
        CASE 
          WHEN a.status = 'ACTIVE' AND a.reserved_until IS NOT NULL AND a.reserved_until > NOW() THEN 'HELD'
          ELSE 'AVAILABLE'
        END AS reservation_state,
        CASE
          WHEN a.current_rider_id IS NOT NULL THEN 'IN_USE'
          ELSE 'UNASSIGNED'
        END AS assignment_state
      FROM armadas a
      ORDER BY a.code ASC;
    `;
    const { rows } = await this.pool.query(query, [riderId]);
    return rows;
  }

  /**
   * Temporary hold reservation on armada unit when rider inspects detail page (Ticket-Booking Lock)
   * BR-FLEET-03 (Exclusive Hold), BR-FLEET-04 (5-Minute Hold), BR-FLEET-09 (Maintenance Protection)
   */
  public async holdArmadaUnit({
    riderId,
    armadaId,
    holdMinutes = 5,
  }: {
    riderId: number | string;
    armadaId: number | string;
    holdMinutes?: number;
  }): Promise<any> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      // 1. Check & lock target armada
      const checkQuery = `SELECT * FROM armadas WHERE id = $1 FOR UPDATE;`;
      const { rows } = await client.query(checkQuery, [armadaId]);
      const armada = rows[0];

      if (!armada) {
        const error: any = new Error("Unit armada tidak ditemukan.");
        error.statusCode = 404;
        throw error;
      }

      if (armada.status === "MAINTENANCE" || armada.status === "RETIRED") {
        const error: any = new Error(`Unit ${armada.code} sedang dalam masa pemeliharaan/nonaktif dan tidak dapat digunakan.`);
        error.statusCode = 400;
        throw error;
      }

      if (armada.current_rider_id) {
        const error: any = new Error(`Unit ${armada.code} sedang bertugas di lapangan oleh Rider lain.`);
        error.statusCode = 400;
        throw error;
      }

      const isHeldByOther =
        armada.reserved_by_rider_id &&
        String(armada.reserved_by_rider_id) !== String(riderId) &&
        armada.reserved_until &&
        new Date(armada.reserved_until) > new Date();

      if (isHeldByOther) {
        const error: any = new Error(`Unit ${armada.code} sedang diinspeksi oleh Rider lain. Silakan pilih unit lain.`);
        error.statusCode = 409;
        throw error;
      }

      // 2. Cancel any previous active hold by this rider on other units
      await client.query(
        `UPDATE fleet_reservations 
         SET status = 'CANCELLED', released_at = CURRENT_TIMESTAMP 
         WHERE rider_id = $1 AND status = 'ACTIVE';`,
        [riderId]
      );
      await client.query(
        `UPDATE armadas 
         SET reserved_by_rider_id = NULL, reserved_until = NULL 
         WHERE reserved_by_rider_id = $1 AND id != $2;`,
        [riderId, armadaId]
      );

      // 3. Create active reservation record in fleet_reservations
      await client.query(
        `INSERT INTO fleet_reservations (armada_id, rider_id, status, expires_at)
         VALUES ($1, $2, 'ACTIVE', NOW() + ($3 || ' minutes')::interval);`,
        [armadaId, riderId, holdMinutes]
      );

      // 4. Update armada reservation fields
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
  public async cancelArmadaHold({
    riderId,
    armadaId,
  }: {
    riderId: number | string;
    armadaId: number | string;
  }): Promise<any | null> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      await client.query(
        `UPDATE fleet_reservations 
         SET status = 'CANCELLED', released_at = CURRENT_TIMESTAMP 
         WHERE armada_id = $1 AND rider_id = $2 AND status = 'ACTIVE';`,
        [armadaId, riderId]
      );

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
      const { rows } = await client.query(query, [armadaId, riderId]);

      await client.query("COMMIT");
      return rows[0] || null;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Confirm final claim on armada unit (Converts status to IN_USE)
   * BR-FLEET-06 (Claim Authorization), BR-FLEET-07 (One Fleet Per Session), BR-FLEET-08 (One Rider Per Fleet)
   */
  public async confirmArmadaClaim({
    riderId,
    armadaId,
    assignmentId,
    checklist = {},
    notes,
  }: {
    riderId: number | string;
    armadaId: number | string;
    assignmentId?: number | string;
    checklist?: Record<string, any>;
    notes?: string;
  }): Promise<any> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      const checkQuery = `SELECT * FROM armadas WHERE id = $1 FOR UPDATE;`;
      const { rows } = await client.query(checkQuery, [armadaId]);
      const armada = rows[0];

      if (!armada) {
        const error: any = new Error("Unit armada tidak ditemukan.");
        error.statusCode = 404;
        throw error;
      }

      if (armada.status === "MAINTENANCE" || armada.status === "RETIRED") {
        const error: any = new Error(`Unit ${armada.code} sedang dalam masa pemeliharaan.`);
        error.statusCode = 400;
        throw error;
      }

      // Check Lazy Expiration & Exclusive Hold
      const isHoldValid =
        armada.reserved_by_rider_id &&
        String(armada.reserved_by_rider_id) === String(riderId) &&
        armada.reserved_until &&
        new Date(armada.reserved_until) > new Date();

      if (!isHoldValid && armada.current_rider_id && String(armada.current_rider_id) !== String(riderId)) {
        const error: any = new Error(`Masa reservasi inspeksi telah berakhir atau unit telah diklaim rider lain.`);
        error.statusCode = 409;
        throw error;
      }

      // 1. Complete fleet_reservations
      await client.query(
        `UPDATE fleet_reservations 
         SET status = 'CLAIMED', inspection_checklist = $3, inspection_notes = $4, released_at = CURRENT_TIMESTAMP 
         WHERE armada_id = $1 AND rider_id = $2 AND status = 'ACTIVE';`,
        [armadaId, riderId, JSON.stringify(checklist), notes || null]
      );

      // 2. Create fleet_assignments record
      await client.query(
        `INSERT INTO fleet_assignments (armada_id, rider_id, zone_id, status, initial_condition)
         VALUES ($1, $2, (SELECT zone_id FROM zone_assignments WHERE id = $3 LIMIT 1), 'IN_USE', $4);`,
        [armadaId, riderId, assignmentId || null, JSON.stringify(checklist)]
      );

      // 3. Update armada table (Status transitions to IN_USE, bound to rider)
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

      // 4. Update zone_assignments link
      if (assignmentId) {
        await client.query(
          `UPDATE zone_assignments SET armada_id = $2 WHERE id = $1;`,
          [assignmentId, armadaId]
        );
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
   * Validate rider GPS coordinates against assigned zone polygon via PostGIS ST_Contains
   */
  public async validateAndCheckInRider({
    riderId,
    assignmentId,
    zoneId,
    lat,
    lon,
  }: {
    riderId?: number | string;
    assignmentId: number | string;
    zoneId: number | string;
    lat: number | string;
    lon: number | string;
  }): Promise<any> {
    const zoneQuery = `SELECT id, name, polygon FROM zones WHERE id = $1;`;
    const { rows: zoneRows } = await this.pool.query(zoneQuery, [zoneId]);
    const zone = zoneRows[0];

    if (!zone) {
      const error: any = new Error("Zona tugas tidak ditemukan di database.");
      error.statusCode = 404;
      throw error;
    }

    let geoJsonObj: any = zone.polygon;
    if (typeof geoJsonObj === "string") {
      try {
        geoJsonObj = JSON.parse(geoJsonObj);
      } catch (e) {}
    }

    if (Array.isArray(geoJsonObj)) {
      const coords = [...geoJsonObj];
      const first = coords[0];
      const last = coords[coords.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        coords.push(first);
      }
      geoJsonObj = {
        type: "Polygon",
        coordinates: [coords],
      };
    } else if (geoJsonObj && geoJsonObj.geometry) {
      geoJsonObj = geoJsonObj.geometry;
    }

    const spatialCheckQuery = `
      SELECT ST_Covers(
        ST_Buffer(ST_GeomFromGeoJSON($1), 0.0002),
        ST_SetSRID(ST_MakePoint($2, $3), 4326)
      ) AS is_inside,
      ROUND(ST_Distance(
        ST_GeomFromGeoJSON($1)::geography,
        ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography
      )) AS distance_meters;
    `;
    const { rows: spatialRows } = await this.pool.query(spatialCheckQuery, [
      JSON.stringify(geoJsonObj),
      parseFloat(String(lon)),
      parseFloat(String(lat)),
    ]);

    const isInside = spatialRows[0]?.is_inside || false;
    const distanceMeters = parseInt(spatialRows[0]?.distance_meters || "0", 10);

    if (!isInside) {
      const error: any = new Error(`Anda berada di luar batas polygon ${zone.name} (Kurang ±${distanceMeters}m)! Harap menuju ke dalam zona tugas untuk Check-in.`);
      error.statusCode = 400;
      error.code = "OUTSIDE_ZONE";
      error.distance_meters = distanceMeters;
      throw error;
    }

    const checkInQuery = `
      UPDATE zone_assignments 
      SET 
        status = 'CHECKED_IN',
        check_in_time = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *;
    `;
    const { rows: updatedAssignment } = await this.pool.query(checkInQuery, [assignmentId]);

    return {
      assignment: updatedAssignment[0],
      zone_name: zone.name,
      check_in_lat: parseFloat(String(lat)),
      check_in_lon: parseFloat(String(lon)),
      checked_in_at: new Date(),
    };
  }

  /**
   * Insert product sales log with monetary snapshot, payment method, and assignment binding
   */
  public async insertSalesLog({
    riderId,
    zoneId,
    assignmentId,
    productId,
    quantity,
    unitPrice,
    totalPrice,
    paymentMethod = "CASH",
    lat = -7.4478,
    lon = 112.7183,
  }: {
    riderId: number | string;
    zoneId?: number | string | null;
    assignmentId?: number | string | null;
    productId: number | string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    paymentMethod?: string;
    lat?: number;
    lon?: number;
  }): Promise<any> {
    const finalLat = lat !== null && lat !== undefined ? lat : -7.4478;
    const finalLon = lon !== null && lon !== undefined ? lon : 112.7183;
    const finalPayment = ["CASH", "QRIS"].includes(paymentMethod) ? paymentMethod : "CASH";

    const query = `
      INSERT INTO sales_logs (rider_id, zone_id, assignment_id, product_id, qty, unit_price, total_price, latitude, longitude, payment_method)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *;
    `;
    const { rows } = await this.pool.query(query, [
      riderId,
      zoneId || null,
      assignmentId || null,
      productId,
      quantity,
      unitPrice,
      totalPrice,
      finalLat,
      finalLon,
      finalPayment,
    ]);
    return rows[0];
  }

  /**
   * Fetch paginated sales history for a specific rider
   */
  public async getRiderSalesHistory({
    riderId,
    date = null,
    page = 1,
    limit = 20,
  }: {
    riderId: number | string;
    date?: string | null;
    page?: number;
    limit?: number;
  }): Promise<any> {
    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    const conditions: string[] = ["sl.rider_id = $1"];
    const values: any[] = [riderId];
    let paramIndex = 2;

    if (date) {
      conditions.push(`sl.created_at::date = $${paramIndex}`);
      values.push(date);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const query = `
      SELECT 
        sl.id AS sale_id,
        sl.rider_id,
        sl.zone_id,
        sl.assignment_id,
        sl.product_id,
        sl.qty,
        sl.unit_price,
        sl.total_price,
        sl.payment_method,
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
   * BR-FLEET-11 (Fleet Return Inspection) + Battery Charging Threshold (<30% -> CHARGING)
   */
  public async checkoutRiderSession({
    assignmentId,
    armadaId,
    riderId,
    returnStatus = "ACTIVE",
    inspectionCondition = {},
    notes,
    remainingCups = 0,
    actualCashSubmitted = 0,
    discrepancyAmount = 0,
    discrepancyReason = "",
  }: {
    assignmentId: number | string;
    armadaId?: number | string | null;
    riderId?: number | string | null;
    returnStatus?: string;
    inspectionCondition?: Record<string, any>;
    notes?: string;
    remainingCups?: number;
    actualCashSubmitted?: number;
    discrepancyAmount?: number;
    discrepancyReason?: string;
  }): Promise<any> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      const updateAssignQuery = `
        UPDATE zone_assignments 
        SET 
          status = 'COMPLETED',
          check_out_time = CURRENT_TIMESTAMP,
          remaining_cups = $2,
          actual_cash_submitted = $3,
          discrepancy_amount = $4,
          discrepancy_reason = $5,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 
        RETURNING *;
      `;
      const { rows: assignRows } = await client.query(updateAssignQuery, [
        assignmentId,
        remainingCups,
        actualCashSubmitted,
        discrepancyAmount,
        discrepancyReason || null,
      ]);

      let finalArmadaStatus = returnStatus === "MAINTENANCE" ? "MAINTENANCE" : "AVAILABLE";

      if (armadaId) {
        // 1. Update fleet_assignments record
        await client.query(
          `UPDATE fleet_assignments 
           SET 
             status = $3,
             returned_at = CURRENT_TIMESTAMP,
             return_condition = $4,
             updated_at = CURRENT_TIMESTAMP
           WHERE armada_id = $1 AND ($2::uuid IS NULL OR rider_id = $2) AND status = 'IN_USE';`,
          [
            armadaId, 
            riderId || null, 
            finalArmadaStatus === 'MAINTENANCE' ? 'DAMAGED' : 'RETURNED', 
            JSON.stringify({ ...inspectionCondition, notes: notes || null })
          ]
        );

        // 2. Update armada table
        await client.query(
          `UPDATE armadas 
           SET 
             status = $2, 
             current_rider_id = NULL, 
             reserved_by_rider_id = NULL, 
             reserved_until = NULL,
             updated_at = CURRENT_TIMESTAMP 
           WHERE id = $1;`,
          [armadaId, finalArmadaStatus]
        );
      }

      // 3. Record shift settlement if cash reconciliation data provided
      if (riderId && (actualCashSubmitted > 0 || discrepancyAmount !== 0)) {
        await client.query(
          `INSERT INTO shift_settlements (
             assignment_id, rider_id, expected_cash, actual_cash, discrepancy_amount, discrepancy_reason, remaining_cups, status
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
          [
            assignmentId,
            riderId,
            actualCashSubmitted - discrepancyAmount,
            actualCashSubmitted,
            discrepancyAmount,
            discrepancyReason || null,
            remainingCups,
            discrepancyAmount !== 0 ? 'SETTLED_WITH_DISCREPANCY' : 'APPROVED',
          ]
        );
      }

      await client.query("COMMIT");
      return {
        ...assignRows[0],
        armada_status: finalArmadaStatus,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

export const riderOperationalRepository = RiderOperationalRepository.getInstance();
