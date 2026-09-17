/*
 * LbsGeofenceService.js
 * Domain Service for Milestone B-11: Actual Field Execution & Real-Time LBS Monitoring Layer
 * Integrates:
 * - PostGIS ST_Covers Zone Geofencing
 * - Prohibited Protocol Road Proximity Alerting (50m ST_DWithin)
 * - SSOT Live Position Upsert (latest_rider_positions)
 * - Continuous Historical Telemetry Logging (rider_telemetry_logs)
 * - Discrete State Transition Event Detection (rider_zone_logs)
 * - Decoupled Socket.IO Real-Time Push Notification
 */

import { pool } from "../../config/database.js";
import { operationalSessionRepository } from "../../repositories/operationalSessionRepository.js";
import { eventPublisher } from "../../events/eventPublisher.js";

export class LbsGeofenceService {
  static instance = null;

  constructor(sessionRepo = operationalSessionRepository, eventPub = eventPublisher) {
    if (LbsGeofenceService.instance && sessionRepo === operationalSessionRepository) {
      return LbsGeofenceService.instance;
    }
    this.sessionRepo = sessionRepo;
    this.eventPublisher = eventPub;

    if (sessionRepo === operationalSessionRepository) {
      LbsGeofenceService.instance = this;
    }
  }

  static getInstance(sessionRepo = operationalSessionRepository, eventPub = eventPublisher) {
    if (!LbsGeofenceService.instance) {
      LbsGeofenceService.instance = new LbsGeofenceService(sessionRepo, eventPub);
    }
    return LbsGeofenceService.instance;
  }

  /**
   * Parse and validate GPS telemetry payload with strict bounds checking
   */
  parseAndValidatePing({ latitude, longitude, lat, lon, speed = 0, heading = 0, recorded_at = null, recordedAt = null }) {
    const rawLat = latitude !== undefined ? latitude : (lat !== undefined ? lat : NaN);
    const rawLon = longitude !== undefined ? longitude : (lon !== undefined ? lon : NaN);

    const parsedLat = parseFloat(rawLat);
    const parsedLon = parseFloat(rawLon);

    if (isNaN(parsedLat) || parsedLat < -90 || parsedLat > 90) {
      const error = new Error("Parameter 'latitude' tidak valid (harus berupa angka di antara -90 dan 90).");
      error.statusCode = 400;
      throw error;
    }

    if (isNaN(parsedLon) || parsedLon < -180 || parsedLon > 180) {
      const error = new Error("Parameter 'longitude' tidak valid (harus berupa angka di antara -180 dan 180).");
      error.statusCode = 400;
      throw error;
    }

    const finalSpeed = Math.max(0, parseFloat(speed) || 0);
    const rawHeading = parseFloat(heading) || 0;
    const finalHeading = ((rawHeading % 360) + 360) % 360;

    let timestamp = new Date();
    const rawTime = recorded_at || recordedAt;
    if (rawTime) {
      const parsed = new Date(rawTime);
      if (!isNaN(parsed.getTime())) {
        timestamp = parsed;
      }
    }

    return {
      latitude: parsedLat,
      longitude: parsedLon,
      speed: finalSpeed,
      heading: finalHeading,
      timestamp,
    };
  }

  /**
   * Pure Zone Compliance evaluation matrix
   */
  determineZoneCompliance({ actualZoneId, assignedZoneId }) {
    if (!actualZoneId) {
      return "OUTSIDE_ZONE";
    }
    if (!assignedZoneId || actualZoneId === assignedZoneId) {
      return "COMPLIANT";
    }
    return "DEVIATED";
  }

  /**
   * State Transition Machine for Discrete Geofence Event Detection
   */
  determineDiscreteEvent({ lastLog, isInsideZone, currentZoneId, currentCompliance }) {
    const isInitial = !lastLog;
    const zoneChanged = lastLog && lastLog.zone_id !== currentZoneId;
    const complianceChanged = lastLog && lastLog.zone_compliance !== currentCompliance;

    if (isInitial || zoneChanged || complianceChanged) {
      if (isInsideZone) {
        return currentCompliance === "COMPLIANT" ? "ENTER" : "DEVIATED_ENTER";
      } else if (!isInsideZone && lastLog && lastLog.event_type !== "EXIT") {
        return "EXIT";
      }
    }
    return "NONE";
  }

  /**
   * Calculate Geodesic Haversine Distance in meters between two coordinates
   */
  calculateGeodesicDistance(pointA, pointB) {
    if (!pointA || !pointB) return 0;
    const lat1 = parseFloat(pointA.lat ?? pointA.latitude);
    const lon1 = parseFloat(pointA.lon ?? pointA.longitude);
    const lat2 = parseFloat(pointB.lat ?? pointB.latitude);
    const lon2 = parseFloat(pointB.lon ?? pointB.longitude);

    if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) return 0;
    if (lat1 === lat2 && lon1 === lon2) return 0;

    const R = 6371000; // Earth radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  }

  /**
   * Process Rider Live GPS Telemetry Ping
   */
  async processRiderGpsPing({
    riderId,
    riderName = "Rider Operasional",
    latitude,
    longitude,
    lat,
    lon,
    speed = 0,
    heading = 0,
    recorded_at = null,
    recordedAt = null,
  }) {
    if (!riderId) {
      const error = new Error("Parameter 'rider_id' wajib diisi.");
      error.statusCode = 400;
      throw error;
    }

    // 1. Telemetry input parsing and validation
    const {
      latitude: finalLat,
      longitude: finalLon,
      speed: finalSpeed,
      heading: finalHeading,
      timestamp,
    } = this.parseAndValidatePing({
      latitude,
      longitude,
      lat,
      lon,
      speed,
      heading,
      recorded_at,
      recordedAt,
    });

    // 2. Resolve Active Operational Session from PostgreSQL (if any)
    const activeSession = await this.sessionRepo.findActiveSessionByRiderId(riderId);

    const sessionId = activeSession ? (activeSession.session_id || activeSession.id) : null;
    const assignedZoneId = activeSession ? activeSession.zone_id : null;
    const assignedZoneName = activeSession ? activeSession.zone_name : null;
    const resolvedRiderName = activeSession ? (activeSession.rider_name || riderName) : riderName;

    // 3. Evaluate Zone Spatial Coverage via PostGIS ST_Covers (Prioritizing assigned zone)
    const geofenceQuery = `
      SELECT id, name, status, ST_AsGeoJSON(geom) AS geom_geojson
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

    let actualZone = null;
    try {
      const { rows } = await pool.query(geofenceQuery, [finalLon, finalLat, assignedZoneId]);
      actualZone = rows[0] || null;
    } catch (dbErr) {
      console.warn("⚠️ PostGIS ST_Covers query warning:", dbErr.message);
      actualZone = null;
    }

    const isInsideZone = actualZone !== null;
    const actualZoneId = actualZone ? actualZone.id : null;
    const actualZoneName = actualZone ? actualZone.name : "OUTSIDE_OPERATIONAL_ZONES";

    // 4. Determine Zone Compliance (COMPLIANT, DEVIATED, OUTSIDE_ZONE)
    const zoneCompliance = this.determineZoneCompliance({ actualZoneId, assignedZoneId });

    // 5. Evaluate Prohibited Road Restriction (50m Radius)
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

    let roadViolation = null;
    try {
      const { rows: roadRows } = await pool.query(roadViolationQuery, [finalLon, finalLat]);
      roadViolation = roadRows[0] || null;
    } catch (rErr) {
      // Non-fatal if protocol_roads is empty or spatial query errors
    }

    const roadCompliance = roadViolation ? "PROHIBITED_ROAD_ALERT" : "NO_ROAD_ALERT";

    // 6. Upsert SSOT Live Position into latest_rider_positions
    const latestPosition = await this.sessionRepo.upsertLatestPosition({
      riderId,
      sessionId,
      riderName: resolvedRiderName,
      latitude: finalLat,
      longitude: finalLon,
      speed: finalSpeed,
      heading: finalHeading,
      isInsideZone,
      actualZoneId,
      actualZoneName,
      zoneCompliance,
      roadCompliance,
      prohibitedRoadId: roadViolation?.id || null,
      prohibitedRoadName: roadViolation?.name || null,
      recordedAt: timestamp,
    });

    // 7. Insert Continuous Telemetry History Log
    await this.sessionRepo.insertTelemetryLog({
      sessionId,
      riderId,
      latitude: finalLat,
      longitude: finalLon,
      speed: finalSpeed,
      heading: finalHeading,
      actualZoneId,
      zoneCompliance,
      roadCompliance,
      recordedAt: timestamp,
    });

    // 8. Discrete Geofence State Transition Event Detection
    let discreteEvent = "NONE";
    try {
      const lastLog = await this.sessionRepo.getLatestZoneLog(riderId);
      discreteEvent = this.determineDiscreteEvent({
        lastLog,
        isInsideZone,
        currentZoneId: actualZoneId,
        currentCompliance: zoneCompliance,
      });

      if (discreteEvent !== "NONE") {
        const loggedZoneId = isInsideZone ? actualZoneId : (lastLog?.zone_id || assignedZoneId);
        await this.sessionRepo.insertZoneLog({
          sessionId,
          riderId,
          zoneId: loggedZoneId,
          eventType: discreteEvent,
          zoneCompliance,
          latitude: finalLat,
          longitude: finalLon,
        });
      }
    } catch (logErr) {
      console.warn("⚠️ Geofence discrete log warning:", logErr.message);
    }

    // 9. Non-blocking Socket.IO Event Push
    try {
      if (zoneCompliance !== "COMPLIANT" && isInsideZone === false) {
        this.eventPublisher.publishGeofenceBreach({
          riderId,
          riderName: resolvedRiderName,
          zoneName: assignedZoneName,
          lat: finalLat,
          lon: finalLon,
          message: `Peringatan: Rider ${resolvedRiderName} berada di luar zona tugas '${assignedZoneName}'.`,
        });
      }
    } catch (sockErr) {
      console.warn("⚠️ Non-blocking Socket.IO error:", sockErr.message);
    }

    return {
      rider_id: riderId,
      rider_name: resolvedRiderName,
      session_id: sessionId,
      location: {
        latitude: finalLat,
        longitude: finalLon,
        speed: finalSpeed,
        heading: finalHeading,
      },
      geofence: {
        is_inside_zone: isInsideZone,
        actual_zone_id: actualZoneId,
        actual_zone_name: actualZoneName,
        event_type: discreteEvent,
      },
      compliance: {
        zone_compliance: zoneCompliance,
        road_compliance: roadCompliance,
        assigned_zone_id: assignedZoneId,
        assigned_zone_name: assignedZoneName,
      },
      road_violation: roadViolation ? {
        is_violating: true,
        road_id: roadViolation.id,
        road_name: roadViolation.name,
        highway_type: roadViolation.highway_type,
        restriction_type: roadViolation.restriction_type || "PROHIBITED_ROAD",
        message: `PERINGATAN: Rider berada dalam radius 50m dari jalan terlarang '${roadViolation.name}'.`,
      } : {
        is_violating: false,
      },
      violation_alert: roadViolation ? {
        is_violating: true,
        road_id: roadViolation.id,
        road_name: roadViolation.name,
        highway_type: roadViolation.highway_type,
        restriction_type: roadViolation.restriction_type || "PROHIBITED_ROAD",
        message: `PERINGATAN: Rider berada dalam radius 50m dari jalan terlarang '${roadViolation.name}'.`,
      } : {
        is_violating: false,
      },
      recorded_at: timestamp.toISOString(),
      updated_at: latestPosition.updated_at,
    };
  }

  /**
   * Query all Live Rider Positions from PostgreSQL SSOT
   */
  async getLiveRiderPositions(filter = {}) {
    return await this.sessionRepo.getAllLiveRiderPositions(filter);
  }

  /**
   * Search Nearby Riders within Radius (in km)
   */
  async getNearbyRiders({ lon, lat, radiusKm = 5, limit = 50 }) {
    if (lon === undefined || lat === undefined) {
      const error = new Error("Parameter 'lon' dan 'lat' harus diisi.");
      error.statusCode = 400;
      throw error;
    }

    const riders = await this.sessionRepo.findNearbyRiders({
      lon: parseFloat(lon),
      lat: parseFloat(lat),
      radiusKm: parseFloat(radiusKm) || 5,
      limit: parseInt(limit, 10) || 50,
    });

    return {
      riders,
      total: riders.length,
      radius_km: parseFloat(radiusKm) || 5,
    };
  }

  /**
   * Get Geofence Transition Logs for Auditing
   */
  async getZoneLogs(query = {}) {
    return await this.sessionRepo.getZoneLogs(query);
  }

  /**
   * Calculate Fleet Multi-Rider Distance Summary to All Operational Zones
   */
  async getZonesDistanceSummary() {
    const { SystemSettingModel } = await import("../../models/systemSettingModel.js");
    const latSetting = await SystemSettingModel.getByKey("HUB_LATITUDE");
    const lonSetting = await SystemSettingModel.getByKey("HUB_LONGITUDE");

    const hubLat = parseFloat(latSetting?.value || "-7.397402184098715");
    const hubLon = parseFloat(lonSetting?.value || "112.71195887495875");

    // 1. Fetch all active live riders
    const liveRiders = await this.sessionRepo.getAllLiveRiderPositions();

    // 2. Fetch all active zones with centroids and hub distances
    const zoneQuery = `
      SELECT 
        z.id AS zone_id,
        z.name AS zone_name,
        z.status AS zone_status,
        z.max_capacity,
        ST_Y(ST_Centroid(z.polygon)) AS centroid_lat,
        ST_X(ST_Centroid(z.polygon)) AS centroid_lon,
        ROUND(
          (ST_Distance(
            ST_Centroid(z.polygon)::geography, 
            ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
          ) / 1000.0)::numeric, 
          2
        ) AS hub_distance_km
      FROM zones z
      WHERE z.status = 'ACTIVE'
      ORDER BY z.name ASC;
    `;
    const { rows: zones } = await pool.query(zoneQuery, [hubLon, hubLat]);

    const zoneSummaries = zones.map((z) => {
      const cLat = parseFloat(z.centroid_lat);
      const cLon = parseFloat(z.centroid_lon);
      const hubDist = parseFloat(z.hub_distance_km);

      // Distances from all live riders to this zone centroid via geodesic distance helper
      const riderDistances = liveRiders
        .filter((r) => r.latitude !== null && r.longitude !== null && !isNaN(r.latitude) && !isNaN(r.longitude))
        .map((r) => parseFloat((this.calculateGeodesicDistance({ lat: r.latitude, lon: r.longitude }, { lat: cLat, lon: cLon }) / 1000.0).toFixed(2)));

      const assignedCount = liveRiders.filter((r) => r.current_zone_id === z.zone_id).length;

      let avgRiderDist = hubDist;
      let nearestRiderDist = hubDist;

      if (riderDistances.length > 0) {
        const sum = riderDistances.reduce((a, b) => a + b, 0);
        avgRiderDist = parseFloat((sum / riderDistances.length).toFixed(2));
        nearestRiderDist = Math.min(...riderDistances);
      }

      return {
        zone_id: z.zone_id,
        zone_name: z.zone_name,
        zone_status: z.zone_status,
        max_capacity: z.max_capacity,
        centroid: {
          latitude: cLat,
          longitude: cLon,
        },
        hub_distance_km: hubDist,
        avg_rider_distance_km: avgRiderDist,
        nearest_rider_distance_km: nearestRiderDist,
        assigned_riders_count: assignedCount,
      };
    });

    return {
      total_active_riders: liveRiders.length,
      hub_origin: {
        latitude: hubLat,
        longitude: hubLon,
      },
      zones: zoneSummaries,
    };
  }
}

export const lbsGeofenceService = LbsGeofenceService.getInstance();
