/*
 * LbsIngestionService.ts
 * Clean Architecture Domain Service for High-Frequency GPS Ingestion & Spatial Presence
 * Stage 5 MOVA Architecture
 */

import { redisGeoService } from "./RedisGeoService.js";
import { operationalPresenceEngine } from "./OperationalPresenceEngine.js";
import { withTenantContext } from "../../lib/tenantContext.js";
import { socketManager } from "../../socket/socketManager.js";
import { pool } from "../../config/database.js";

export interface GpsIngestionInput {
  latitude: number;
  longitude: number;
  accuracy_meters: number;
  altitude_meters?: number;
  speed_mps?: number;
  heading_degrees?: number;
  captured_at: string;
  device_id: string;
  sequence: number;
}

export interface IngestionResult {
  accepted: boolean;
  persisted: boolean;
  filter?: string;
  position_id?: string;
  rider_id?: string;
  latitude?: number;
  longitude?: number;
  distance_from_previous_meters?: number;
  presence?: {
    status: "ON_SITE" | "OUTSIDE_ZONE" | "UNZONED";
    zone_id?: string | null;
    zone_name?: string | null;
  };
}

export class LbsIngestionService {
  private static instance: LbsIngestionService | null = null;

  public static getInstance(): LbsIngestionService {
    if (!LbsIngestionService.instance) {
      LbsIngestionService.instance = new LbsIngestionService();
    }
    return LbsIngestionService.instance;
  }

  /**
   * Calculate Haversine Geodesic Distance in meters between two lat/lon points
   */
  public calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 100) / 100;
  }

  /**
   * Main Pipeline for GPS Position Ingestion
   */
  public async ingestGpsPosition(
    tenantId: string,
    riderId: string,
    riderName: string,
    input: GpsIngestionInput
  ): Promise<IngestionResult> {
    if (!tenantId) {
      const err: any = new Error("Tenant authentication required.");
      err.code = "TENANT_ACCESS_DENIED";
      err.statusCode = 403;
      throw err;
    }

    // 1. Coordinate Validation
    const { latitude, longitude, accuracy_meters, altitude_meters, speed_mps, heading_degrees, captured_at, device_id, sequence } = input;

    if (typeof latitude !== "number" || isNaN(latitude) || !isFinite(latitude) || latitude < -90 || latitude > 90) {
      const err: any = new Error("Invalid latitude. Must be a finite number between -90 and 90.");
      err.code = "GPS_INVALID_LATITUDE";
      err.statusCode = 400;
      throw err;
    }

    if (typeof longitude !== "number" || isNaN(longitude) || !isFinite(longitude) || longitude < -180 || longitude > 180) {
      const err: any = new Error("Invalid longitude. Must be a finite number between -180 and 180.");
      err.code = "GPS_INVALID_LONGITUDE";
      err.statusCode = 400;
      throw err;
    }

    if (typeof accuracy_meters !== "number" || isNaN(accuracy_meters) || !isFinite(accuracy_meters) || accuracy_meters <= 0) {
      const err: any = new Error("Invalid accuracy. Must be a positive number.");
      err.code = "GPS_INVALID_ACCURACY";
      err.statusCode = 400;
      throw err;
    }

    if (accuracy_meters > 1000) {
      const err: any = new Error("GPS accuracy too low (> 1000 meters). Rejected.");
      err.code = "GPS_ACCURACY_TOO_LOW";
      err.statusCode = 422;
      throw err;
    }

    if (speed_mps !== undefined && (typeof speed_mps !== "number" || isNaN(speed_mps) || speed_mps < 0 || speed_mps > 100)) {
      const err: any = new Error("Invalid speed. Must be between 0 and 100 m/s.");
      err.code = "GPS_INVALID_SPEED";
      err.statusCode = 400;
      throw err;
    }

    if (heading_degrees !== undefined && (typeof heading_degrees !== "number" || isNaN(heading_degrees) || heading_degrees < 0 || heading_degrees >= 360)) {
      const err: any = new Error("Invalid heading. Must be between 0 and 359.99 degrees.");
      err.code = "GPS_INVALID_HEADING";
      err.statusCode = 400;
      throw err;
    }

    if (!device_id || typeof device_id !== "string" || device_id.trim().length === 0 || device_id.length > 128) {
      const err: any = new Error("Invalid device_id. Must be a non-empty string with max 128 characters.");
      err.code = "GPS_INVALID_DEVICE";
      err.statusCode = 400;
      throw err;
    }

    if (typeof sequence !== "number" || !Number.isInteger(sequence) || sequence < 0) {
      const err: any = new Error("Invalid sequence. Must be a non-negative integer.");
      err.code = "GPS_INVALID_SEQUENCE";
      err.statusCode = 400;
      throw err;
    }

    // 2. Timestamp Validation
    const capturedTime = new Date(captured_at).getTime();
    if (isNaN(capturedTime)) {
      const err: any = new Error("Invalid captured_at ISO-8601 date string.");
      err.code = "GPS_INVALID_TIMESTAMP";
      err.statusCode = 400;
      throw err;
    }

    const now = Date.now();
    if (capturedTime > now + 30_000) {
      const err: any = new Error("GPS timestamp is too far in the future (> 30s clock drift).");
      err.code = "GPS_TIMESTAMP_IN_FUTURE";
      err.statusCode = 409;
      throw err;
    }

    if (now - capturedTime > 300_000) {
      const err: any = new Error("GPS timestamp is stale (> 5 minutes old).");
      err.code = "GPS_TIMESTAMP_STALE";
      err.statusCode = 409;
      throw err;
    }

    // 3. Monotonic Sequence Check (Anti-Replay)
    const isSequenceValid = await redisGeoService.validateAndSetSequence(tenantId, riderId, device_id, sequence);
    if (!isSequenceValid) {
      const err: any = new Error("GPS sequence replay or out-of-order packet detected.");
      err.code = "GPS_SEQUENCE_REPLAY";
      err.statusCode = 409;
      throw err;
    }

    // 4. Rate Limiting (5-Second Ingestion Throttle)
    const isWithinRate = await redisGeoService.checkAndSetThrottle(tenantId, riderId, 5);
    if (!isWithinRate) {
      const err: any = new Error("Minimum GPS update interval is 5 seconds.");
      err.code = "GPS_RATE_LIMITED";
      err.statusCode = 429;
      throw err;
    }

    // 5. Distance Filter Check
    const prevPos = await redisGeoService.getLastPosition(tenantId, riderId);
    let distanceMeters = 0;
    let skipPersistence = false;

    if (prevPos) {
      distanceMeters = this.calculateHaversineDistance(prevPos.latitude, prevPos.longitude, latitude, longitude);
      if (distanceMeters < 5.0) {
        skipPersistence = true;
      }
    }

    // 6. Geofence & Operational Presence Evaluation (PostGIS ST_Contains & State Machine)
    const presenceEval = await operationalPresenceEngine.evaluatePresence({
      tenantId,
      riderId,
      riderName,
      latitude,
      longitude,
      capturedAt: captured_at,
    });

    const zoneId = presenceEval.actual_zone_id;
    const zoneName = presenceEval.actual_zone_name;
    const isInside = presenceEval.is_inside_zone;

    // 7. Update Live Position in Redis Geospatial Set
    await redisGeoService.updateRiderLocation({
      tenantId,
      riderId,
      riderName,
      lat: latitude,
      lon: longitude,
      accuracy: accuracy_meters,
      speed: speed_mps || 0,
      heading: heading_degrees || 0,
      capturedAt: captured_at,
      zoneId,
      isInsideGeofence: isInside,
    });

    // 8. Distance Filter Branch: Skip Database Persistence if < 5m
    if (skipPersistence) {
      return {
        accepted: true,
        persisted: false,
        filter: "DISTANCE",
        distance_from_previous_meters: distanceMeters,
      };
    }

    // 9. Database Persistence (Distance >= 5m)
    await redisGeoService.setLastPosition(tenantId, riderId, latitude, longitude, captured_at);

    const positionId = await withTenantContext(tenantId, async (client) => {
      const insertQuery = `
        INSERT INTO rider_positions (
          tenant_id,
          rider_id,
          device_id,
          sequence,
          latitude,
          longitude,
          geom,
          accuracy_meters,
          altitude_meters,
          speed_mps,
          heading_degrees,
          captured_at,
          zone_id,
          is_inside_geofence
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          ST_SetSRID(ST_MakePoint($6, $5), 4326),
          $7, $8, $9, $10, $11, $12, $13
        ) RETURNING id;
      `;
      const { rows } = await client.query(insertQuery, [
        tenantId,
        riderId,
        device_id,
        sequence,
        latitude,
        longitude,
        accuracy_meters,
        altitude_meters || null,
        speed_mps || null,
        heading_degrees || null,
        captured_at,
        zoneId,
        isInside,
      ]);
      return rows[0]?.id;
    });

    // 10. Real-Time Socket.IO Broadcast to Tenant Rooms
    const liveUpdatePayload = {
      tenant_id: tenantId,
      rider_id: riderId,
      rider_name: riderName,
      latitude,
      longitude,
      accuracy_meters,
      speed_mps: speed_mps || 0,
      heading_degrees: heading_degrees || 0,
      zone_id: zoneId,
      zone_name: zoneName,
      is_inside_geofence: isInside,
      captured_at,
    };

    socketManager.broadcastToTenantSupervisors(tenantId, "rider:position_updated", liveUpdatePayload);
    if (!isInside && zoneName) {
      socketManager.broadcastToTenantSupervisors(tenantId, "rider:geofence_breach", {
        ...liveUpdatePayload,
        alert_message: `⚠️ PERINGATAN GEOFENCE: Rider '${riderName}' berada di luar batas operasional zona.`,
      });
    }

    return {
      accepted: true,
      persisted: true,
      position_id: positionId,
      rider_id: riderId,
      latitude,
      longitude,
      distance_from_previous_meters: distanceMeters,
      presence: {
        status: isInside ? (zoneId ? "ON_SITE" : "UNZONED") : "OUTSIDE_ZONE",
        zone_id: zoneId,
        zone_name: zoneName,
      },
    };
  }
}

export const lbsIngestionService = LbsIngestionService.getInstance();
