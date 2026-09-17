/*
 * LbsGeofenceService.ts
 * Domain Service for Phase 6 — Infrastructure & Location-Based Services (LBS) Audit in TypeScript
 */

import { pool } from "../../config/database.js";
import { redisGeoService } from "./RedisGeoService.js";

export class LbsGeofenceService {
  private static instance: LbsGeofenceService | null = null;

  constructor() {
    if (LbsGeofenceService.instance) {
      return LbsGeofenceService.instance;
    }
    this.initTable();
    LbsGeofenceService.instance = this;
  }

  public async initTable(): Promise<void> {
    try {
      const query = `
        CREATE TABLE IF NOT EXISTS rider_zone_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          rider_id VARCHAR(255) NOT NULL,
          zone_id VARCHAR(255),
          event_type VARCHAR(50) NOT NULL,
          latitude DOUBLE PRECISION,
          longitude DOUBLE PRECISION,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;
      await pool.query(query);
    } catch (e) {}
  }

  public static getInstance(): LbsGeofenceService {
    if (!LbsGeofenceService.instance) {
      LbsGeofenceService.instance = new LbsGeofenceService();
    }
    return LbsGeofenceService.instance;
  }

  /**
   * Process Rider Live GPS Location Ping
   */
  public async processRiderGpsPing({
    riderId,
    riderName = "Rider Operasional",
    lat,
    lon,
    speed = 0,
    heading = 0,
    assignedZoneId = null,
  }: {
    riderId: string | number;
    riderName?: string;
    lat: number | string;
    lon: number | string;
    speed?: number;
    heading?: number;
    assignedZoneId?: string | number | null;
  }): Promise<any> {
    if (!riderId || lat === undefined || lon === undefined) {
      const error: any = new Error("riderId, lat, dan lon wajib diisi.");
      error.statusCode = 400;
      throw error;
    }

    const latitude = parseFloat(String(lat));
    const longitude = parseFloat(String(lon));

    // 1. Update Redis Geospatial Index
    try {
      await redisGeoService.updateRiderLocation({
        riderId,
        riderName,
        lat: latitude,
        lon: longitude,
        speed,
        heading,
      });
    } catch (redisErr: any) {
      console.warn("⚠️ Warning: Redis GEO update fallback:", redisErr.message);
    }

    // 2. PostGIS ST_Contains Geofencing
    const geofenceQuery = `
      SELECT id, name, status, polygon
      FROM zones
      WHERE ST_Contains(
        ST_SetSRID(ST_GeomFromGeoJSON(
          CASE 
            WHEN polygon::text LIKE '{"type"%' THEN polygon::text
            ELSE concat('{"type":"Polygon","coordinates":[', polygon::text, ']}')
          END
        ), 4326),
        ST_SetSRID(ST_MakePoint($1, $2), 4326)
      )
      LIMIT 1;
    `;

    let actualZone: any = null;
    try {
      const { rows } = await pool.query(geofenceQuery, [longitude, latitude]);
      actualZone = rows[0] || null;
    } catch (dbErr) {
      actualZone = null;
    }

    const isInsideZone = actualZone !== null;
    const actualZoneId = actualZone ? actualZone.id : null;
    const actualZoneName = actualZone ? actualZone.name : "OUTSIDE_OPERATIONAL_ZONES";

    // 3. Prohibited road violation
    const roadViolationQuery = `
      SELECT id, name, highway_type, restriction_type
      FROM protocol_roads
      WHERE restriction_type IS NOT NULL
        AND ST_DWithin(
          ST_SetSRID(geom, 4326)::geography,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
          50
        )
      LIMIT 1;
    `;

    let roadViolation: any = null;
    try {
      const { rows: roadRows } = await pool.query(roadViolationQuery, [longitude, latitude]);
      roadViolation = roadRows[0] || null;
    } catch (rErr) {}

    // 4. Passive check-in / check-out logging
    let logEvent = "NONE";
    try {
      const { rows: lastLogs } = await pool.query(
        "SELECT zone_id, event_type FROM rider_zone_logs WHERE rider_id = $1 ORDER BY created_at DESC LIMIT 1;",
        [riderId]
      );
      const lastLog = lastLogs[0] || null;

      if (isInsideZone && (!lastLog || lastLog.zone_id !== actualZoneId)) {
        logEvent = "ENTER";
        await pool.query(
          "INSERT INTO rider_zone_logs (rider_id, zone_id, event_type, latitude, longitude) VALUES ($1, $2, 'ENTER', $3, $4);",
          [riderId, actualZoneId, latitude, longitude]
        );
      } else if (!isInsideZone && lastLog && lastLog.event_type !== "EXIT") {
        logEvent = "EXIT";
        await pool.query(
          "INSERT INTO rider_zone_logs (rider_id, zone_id, event_type, latitude, longitude) VALUES ($1, $2, 'EXIT', $3, $4);",
          [riderId, lastLog.zone_id, latitude, longitude]
        );
      }
    } catch (logErr) {}

    // 5. Compliance status
    let activeAssignedZoneId = assignedZoneId;
    let activeAssignedZoneName = null;

    if (!activeAssignedZoneId) {
      try {
        const assignQuery = `
          SELECT za.zone_id, z.name AS zone_name
          FROM zone_assignments za
          JOIN zones z ON za.zone_id = z.id
          WHERE za.rider_id = $1 AND za.assignment_date = CURRENT_DATE AND za.status IN ('ASSIGNED', 'CHECKED_IN')
          ORDER BY za.created_at DESC LIMIT 1;
        `;
        const { rows: assignRows } = await pool.query(assignQuery, [riderId]);
        if (assignRows.length > 0) {
          activeAssignedZoneId = assignRows[0].zone_id;
          activeAssignedZoneName = assignRows[0].zone_name;
        }
      } catch (aErr) {}
    }

    let complianceStatus = "UNKNOWN";
    if (actualZoneId) {
      if (activeAssignedZoneId) {
        complianceStatus = (actualZoneId === activeAssignedZoneId) ? "COMPLIANT" : "DEVIATED";
      } else {
        complianceStatus = "COMPLIANT";
      }
    } else {
      complianceStatus = "OUTSIDE_ZONE";
    }

    return {
      rider_id: riderId,
      rider_name: riderName,
      location: { latitude, longitude, speed, heading },
      geofence: {
        is_inside_zone: isInsideZone,
        actual_zone_id: actualZoneId,
        actual_zone_name: actualZoneName,
        event_type: logEvent,
      },
      compliance: {
        status: complianceStatus,
        assigned_zone_id: activeAssignedZoneId || null,
        assigned_zone_name: activeAssignedZoneName || null,
      },
      violation_alert: roadViolation ? {
        is_violating: true,
        road_name: roadViolation.name,
        road_type: roadViolation.highway_type || roadViolation.road_type,
        restriction_type: roadViolation.restriction_type || "PROHIBITED_ROAD",
        message: `PERINGATAN: Rider berada dalam radius 50m dari jalan terlarang '${roadViolation.name}'.`,
      } : {
        is_violating: false,
      },
      timestamp: new Date().toISOString(),
    };
  }
}

export const lbsGeofenceService = LbsGeofenceService.getInstance();
