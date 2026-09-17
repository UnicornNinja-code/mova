/*
 * OperationalPresenceEngine.ts
 * Stage 6 MOVA Architecture: Geofence & Operational Presence Engine
 * Translates high-frequency GPS into business operational transitions & compliance states.
 */

import { pool } from "../../config/database.js";
import { redisClient } from "../../config/redis.js";
import { withTenantContext } from "../../lib/tenantContext.js";
import { socketManager } from "../../socket/socketManager.js";

export type PresenceEventType = "ENTER" | "EXIT" | "ON_SITE" | "OUTSIDE_ZONE" | "DEVIATED";
export type ComplianceStatus = "COMPLIANT" | "DEVIATED" | "UNASSIGNED" | "OUTSIDE";

export interface PresenceEvaluationResult {
  rider_id: string;
  rider_name: string;
  is_inside_zone: boolean;
  actual_zone_id: string | null;
  actual_zone_name: string | null;
  assigned_zone_id: string | null;
  assigned_zone_name: string | null;
  event_type: PresenceEventType;
  compliance_status: ComplianceStatus;
  is_transition: boolean;
  captured_at: string;
  latitude: number;
  longitude: number;
}

export class OperationalPresenceEngine {
  private static instance: OperationalPresenceEngine | null = null;

  public static getInstance(): OperationalPresenceEngine {
    if (!OperationalPresenceEngine.instance) {
      OperationalPresenceEngine.instance = new OperationalPresenceEngine();
    }
    return OperationalPresenceEngine.instance;
  }

  private getPresenceStateKey(tenantId: string, riderId: string): string {
    return `tenant:${tenantId}:presence_state:${riderId}`;
  }

  /**
   * Evaluates operational presence and detects zone state transitions
   */
  public async evaluatePresence({
    tenantId,
    riderId,
    riderName,
    latitude,
    longitude,
    capturedAt,
  }: {
    tenantId: string;
    riderId: string;
    riderName: string;
    latitude: number;
    longitude: number;
    capturedAt: string;
  }): Promise<PresenceEvaluationResult> {
    // 1. Evaluate Geofence Zone Containment via PostGIS ST_Contains
    let actualZoneId: string | null = null;
    let actualZoneName: string | null = null;

    try {
      const geofenceQuery = `
        SELECT z.id, z.name
        FROM zones z
        WHERE z.tenant_id = $1
          AND z.status = 'ACTIVE'
          AND ST_Contains(
            ST_SetSRID(ST_GeomFromGeoJSON(
              CASE 
                WHEN z.polygon::text LIKE '{"type"%' THEN z.polygon::text
                ELSE concat('{"type":"Polygon","coordinates":[', z.polygon::text, ']}')
              END
            ), 4326),
            ST_SetSRID(ST_MakePoint($2, $3), 4326)
          )
        LIMIT 1;
      `;
      const { rows } = await pool.query(geofenceQuery, [tenantId, longitude, latitude]);
      if (rows.length > 0) {
        actualZoneId = rows[0].id;
        actualZoneName = rows[0].name;
      }
    } catch (e: any) {
      console.warn(`[OperationalPresenceEngine] Geofence query error for rider ${riderId}:`, e.message);
    }

    const isInsideZone = actualZoneId !== null;

    // 2. Query Active Zone Assignment for today
    let assignedZoneId: string | null = null;
    let assignedZoneName: string | null = null;

    try {
      const assignmentQuery = `
        SELECT za.zone_id, z.name AS zone_name
        FROM zone_assignments za
        JOIN zones z ON za.zone_id = z.id
        JOIN users u ON za.rider_id = u.id
        WHERE u.tenant_id = $1
          AND za.rider_id = $2
          AND za.assignment_date = CURRENT_DATE
          AND za.status IN ('ASSIGNED', 'CHECKED_IN')
        ORDER BY za.created_at DESC
        LIMIT 1;
      `;
      const { rows } = await pool.query(assignmentQuery, [tenantId, riderId]);
      if (rows.length > 0) {
        assignedZoneId = rows[0].zone_id;
        assignedZoneName = rows[0].zone_name;
      }
    } catch {}

    // 3. Determine Operational Compliance
    let complianceStatus: ComplianceStatus = "OUTSIDE";
    if (isInsideZone) {
      if (assignedZoneId) {
        complianceStatus = actualZoneId === assignedZoneId ? "COMPLIANT" : "DEVIATED";
      } else {
        complianceStatus = "UNASSIGNED";
      }
    } else {
      complianceStatus = "OUTSIDE";
    }

    // 4. Retrieve Previous Presence State from Redis
    const stateKey = this.getPresenceStateKey(tenantId, riderId);
    let prevState: { zone_id: string | null; event_type: PresenceEventType } | null = null;

    try {
      let raw: any = null;
      if (typeof (redisClient as any).hGetAll === "function") {
        raw = await (redisClient as any).hGetAll(stateKey);
      } else if (typeof (redisClient as any).hgetall === "function") {
        raw = await (redisClient as any).hgetall(stateKey);
      }
      if (raw && raw.event_type) {
        prevState = {
          zone_id: raw.zone_id ? raw.zone_id : null,
          event_type: raw.event_type as PresenceEventType,
        };
      }
    } catch {}

    // 5. Detect State Transition
    let eventType: PresenceEventType = "ON_SITE";
    let isTransition = false;

    if (!prevState) {
      // First recorded presence
      if (isInsideZone) {
        eventType = "ENTER";
        isTransition = true;
      } else {
        eventType = "OUTSIDE_ZONE";
        isTransition = false;
      }
    } else {
      const prevZoneId = prevState.zone_id;

      if (!prevZoneId && actualZoneId) {
        // Outside -> Entered a zone
        eventType = "ENTER";
        isTransition = true;
      } else if (prevZoneId && !actualZoneId) {
        // Left previous zone -> Outside
        eventType = "EXIT";
        isTransition = true;
      } else if (prevZoneId && actualZoneId && prevZoneId !== actualZoneId) {
        // Zone Hop: Moved directly from Zone A to Zone B
        // Persist EXIT from prevZoneId first, then current is ENTER actualZoneId
        await this.persistPresenceEvent({
          tenantId,
          riderId,
          zoneId: prevZoneId,
          eventType: "EXIT",
          complianceStatus: "OUTSIDE",
          assignedZoneId,
          latitude,
          longitude,
          capturedAt,
        });
        eventType = "ENTER";
        isTransition = true;
      } else if (isInsideZone) {
        eventType = "ON_SITE";
      } else {
        eventType = "OUTSIDE_ZONE";
      }
    }

    // 6. Update Redis Presence Cache
    try {
      const cachePayload: Record<string, string> = {
        zone_id: actualZoneId || "",
        zone_name: actualZoneName || "",
        event_type: eventType,
        compliance_status: complianceStatus,
        assigned_zone_id: assignedZoneId || "",
        assigned_zone_name: assignedZoneName || "",
        updated_at: capturedAt,
      };

      if (typeof (redisClient as any).hSet === "function") {
        await (redisClient as any).hSet(stateKey, cachePayload);
      } else if (typeof (redisClient as any).hset === "function") {
        await (redisClient as any).hset(stateKey, cachePayload);
      }
      if (typeof (redisClient as any).expire === "function") {
        await (redisClient as any).expire(stateKey, 86400);
      }
    } catch {}

    // 7. Persist Event & Broadcast Real-Time Alerts on Transition or Deviation
    if (isTransition || complianceStatus === "DEVIATED") {
      await this.persistPresenceEvent({
        tenantId,
        riderId,
        zoneId: actualZoneId,
        eventType,
        complianceStatus,
        assignedZoneId,
        latitude,
        longitude,
        capturedAt,
      });

      const socketPayload = {
        tenant_id: tenantId,
        rider_id: riderId,
        rider_name: riderName,
        event_type: eventType,
        compliance_status: complianceStatus,
        actual_zone_id: actualZoneId,
        actual_zone_name: actualZoneName,
        assigned_zone_id: assignedZoneId,
        assigned_zone_name: assignedZoneName,
        latitude,
        longitude,
        captured_at: capturedAt,
      };

      socketManager.broadcastToTenantSupervisors(tenantId, "presence:transition", socketPayload);

      if (complianceStatus === "DEVIATED") {
        socketManager.broadcastToTenantSupervisors(tenantId, "presence:deviation_alert", {
          ...socketPayload,
          alert_message: `⚠️ DEVIASI TUGAS: Rider '${riderName}' ditugaskan di '${assignedZoneName}' tetapi terdeteksi di '${actualZoneName}'.`,
        });
      }
    }

    return {
      rider_id: riderId,
      rider_name: riderName,
      is_inside_zone: isInsideZone,
      actual_zone_id: actualZoneId,
      actual_zone_name: actualZoneName,
      assigned_zone_id: assignedZoneId,
      assigned_zone_name: assignedZoneName,
      event_type: eventType,
      compliance_status: complianceStatus,
      is_transition: isTransition,
      captured_at: capturedAt,
      latitude,
      longitude,
    };
  }

  /**
   * Persist Presence Event to PostgreSQL with Tenant RLS Protection
   */
  public async persistPresenceEvent({
    tenantId,
    riderId,
    zoneId,
    eventType,
    complianceStatus,
    assignedZoneId,
    latitude,
    longitude,
    capturedAt,
  }: {
    tenantId: string;
    riderId: string;
    zoneId: string | null;
    eventType: PresenceEventType;
    complianceStatus: ComplianceStatus;
    assignedZoneId: string | null;
    latitude: number;
    longitude: number;
    capturedAt: string;
  }): Promise<string | null> {
    try {
      return await withTenantContext(tenantId, async (client) => {
        const query = `
          INSERT INTO rider_presence_events (
            tenant_id,
            rider_id,
            zone_id,
            event_type,
            compliance_status,
            assigned_zone_id,
            latitude,
            longitude,
            geom,
            captured_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8,
            ST_SetSRID(ST_MakePoint($8, $7), 4326),
            $9
          ) RETURNING id;
        `;
        const { rows } = await client.query(query, [
          tenantId,
          riderId,
          zoneId,
          eventType,
          complianceStatus,
          assignedZoneId,
          latitude,
          longitude,
          capturedAt,
        ]);
        return rows[0]?.id || null;
      });
    } catch (err: any) {
      console.warn(`[OperationalPresenceEngine] Failed to persist presence event:`, err.message);
      return null;
    }
  }

  /**
   * Query historical presence events for a rider (Tenant RLS bounded)
   */
  public async getRiderPresenceHistory(tenantId: string, riderId: string, limit = 50): Promise<any[]> {
    return await withTenantContext(tenantId, async (client) => {
      const query = `
        SELECT 
          rpe.id,
          rpe.event_type,
          rpe.compliance_status,
          rpe.latitude,
          rpe.longitude,
          rpe.captured_at,
          rpe.created_at,
          z.id AS zone_id,
          z.name AS zone_name,
          az.id AS assigned_zone_id,
          az.name AS assigned_zone_name
        FROM rider_presence_events rpe
        LEFT JOIN zones z ON rpe.zone_id = z.id
        LEFT JOIN zones az ON rpe.assigned_zone_id = az.id
        WHERE rpe.tenant_id = $1 AND rpe.rider_id = $2
        ORDER BY rpe.captured_at DESC
        LIMIT $3;
      `;
      const { rows } = await client.query(query, [tenantId, riderId, limit]);
      return rows;
    });
  }

  /**
   * Query zone compliance summary (Tenant RLS bounded)
   */
  public async getZoneComplianceSummary(tenantId: string, zoneId: string): Promise<any> {
    return await withTenantContext(tenantId, async (client) => {
      // 1. Get zone info
      const zoneRes = await client.query(`SELECT id, name FROM zones WHERE tenant_id = $1 AND id = $2;`, [tenantId, zoneId]);
      if (zoneRes.rows.length === 0) {
        return null;
      }
      const zone = zoneRes.rows[0];

      // 2. Count active riders currently in zone from rider_positions (latest 15 minutes)
      const query = `
        WITH latest_positions AS (
          SELECT DISTINCT ON (rider_id)
            rider_id, zone_id, captured_at
          FROM rider_positions
          WHERE tenant_id = $1 AND captured_at >= NOW() - INTERVAL '15 minutes'
          ORDER BY rider_id, captured_at DESC
        )
        SELECT 
          COUNT(*) FILTER (WHERE lp.zone_id = $2) AS total_present_riders,
          COUNT(*) FILTER (
            WHERE lp.zone_id = $2 AND EXISTS (
              SELECT 1 FROM zone_assignments za 
              JOIN users u ON za.rider_id = u.id
              WHERE u.tenant_id = $1 AND za.zone_id = $2 AND za.rider_id = lp.rider_id 
                AND za.assignment_date = CURRENT_DATE AND za.status IN ('ASSIGNED', 'CHECKED_IN')
            )
          ) AS compliant_riders,
          COUNT(*) FILTER (
            WHERE lp.zone_id = $2 AND NOT EXISTS (
              SELECT 1 FROM zone_assignments za 
              JOIN users u ON za.rider_id = u.id
              WHERE u.tenant_id = $1 AND za.zone_id = $2 AND za.rider_id = lp.rider_id 
                AND za.assignment_date = CURRENT_DATE AND za.status IN ('ASSIGNED', 'CHECKED_IN')
            )
          ) AS unassigned_or_deviated_riders
        FROM latest_positions lp;
      `;
      const { rows } = await client.query(query, [tenantId, zoneId]);
      const counts = rows[0] || { total_present_riders: 0, compliant_riders: 0, unassigned_or_deviated_riders: 0 };

      return {
        zone_id: zone.id,
        zone_name: zone.name,
        total_present: parseInt(counts.total_present_riders, 10) || 0,
        compliant_count: parseInt(counts.compliant_riders, 10) || 0,
        deviated_count: parseInt(counts.unassigned_or_deviated_riders, 10) || 0,
      };
    });
  }
}

export const operationalPresenceEngine = OperationalPresenceEngine.getInstance();
