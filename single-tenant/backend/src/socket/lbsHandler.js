/*
 *   Copyright (c) 2026 
 *   All rights reserved.
 *   lbsHandler.js (Real-Time Location-Based Services & PostGIS Geofencing Socket Handler)
 */

import { socketManager } from "./socketManager.js";
import { redisGeoService } from "../services/lbs/RedisGeoService.js";
import { pool } from "../config/database.js";
import { auditLogger } from "../utils/AuditLogger.js";
import { eventPublisher } from "../events/eventPublisher.js";

// In-Memory LRU/TTL Cache for Active Zone Assignments (TTL: 30 Seconds)
const assignmentCache = new Map(); // Map<riderId, { data: Object, expiresAt: number }>
const CACHE_TTL_MS = 30000;

/**
 * Fast-path Point-In-Polygon Algorithm (Ray-Casting)
 * @param {[number, number]} point [lon, lat]
 * @param {Array<[number, number]>} vs Polygon vertices array [[lon, lat], ...]
 * @returns {boolean}
 */
export function isPointInPolygonRing(point, vs) {
  if (!Array.isArray(vs) || vs.length < 3) return true;
  const x = point[0];
  const y = point[1];
  let inside = false;

  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0];
    const yi = vs[i][1];
    const xj = vs[j][0];
    const yj = vs[j][1];

    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Normalizes GeoJSON coordinates to a flat ring of vertices
 */
function extractPolygonVertices(geoJsonObj) {
  if (!geoJsonObj) return null;
  let coords = geoJsonObj;
  if (geoJsonObj.type === "Polygon" && Array.isArray(geoJsonObj.coordinates)) {
    coords = geoJsonObj.coordinates[0];
  } else if (Array.isArray(geoJsonObj) && Array.isArray(geoJsonObj[0])) {
    coords = Array.isArray(geoJsonObj[0][0]) ? geoJsonObj[0] : geoJsonObj;
  } else if (geoJsonObj.geometry && geoJsonObj.geometry.coordinates) {
    coords = geoJsonObj.geometry.coordinates[0];
  }
  return Array.isArray(coords) ? coords : null;
}

/**
 * Retrieves cached active zone assignment or queries DB
 */
async function getCachedZoneAssignment(riderId) {
  const now = Date.now();
  const cached = assignmentCache.get(riderId);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const queryAssignedZone = `
    SELECT 
      za.id AS assignment_id,
      z.id AS zone_id,
      z.name AS zone_name,
      z.polygon
    FROM zone_assignments za
    JOIN zones z ON za.zone_id = z.id
    WHERE za.rider_id = $1
      AND za.status IN ('ASSIGNED', 'CHECKED_IN')
    ORDER BY za.created_at DESC
    LIMIT 1;
  `;

  try {
    const { rows } = await pool.query(queryAssignedZone, [riderId]);
    if (rows.length === 0) {
      assignmentCache.set(riderId, { data: null, expiresAt: now + CACHE_TTL_MS });
      return null;
    }

    const assignment = rows[0];
    let rawPoly = assignment.polygon;
    if (typeof rawPoly === "string") {
      try {
        rawPoly = JSON.parse(rawPoly);
      } catch (e) {}
    }

    let geoJsonObj = rawPoly;
    if (Array.isArray(geoJsonObj)) {
      const coords = Array.isArray(geoJsonObj[0][0]) ? geoJsonObj : [geoJsonObj];
      geoJsonObj = {
        type: "Polygon",
        coordinates: coords,
      };
    } else if (geoJsonObj && geoJsonObj.geometry) {
      geoJsonObj = geoJsonObj.geometry;
    }

    const vertices = extractPolygonVertices(geoJsonObj);
    const parsedData = {
      assignment_id: assignment.assignment_id,
      zone_id: assignment.zone_id,
      zone_name: assignment.zone_name,
      geoJsonObj,
      vertices,
    };

    assignmentCache.set(riderId, { data: parsedData, expiresAt: now + CACHE_TTL_MS });
    return parsedData;
  } catch (err) {
    console.warn("⚠️ [LBS Handler] Failed to query zone assignment:", err.message);
    return null;
  }
}

/**
 * Invalidate assignment cache for a specific rider (e.g., after checkout/reassignment)
 */
export function invalidateRiderAssignmentCache(riderId) {
  if (riderId) {
    assignmentCache.delete(riderId);
  }
}

export const registerLbsSocketHandlers = (io) => {
  io.on("connection", (socket) => {
    const user = socket.user;
    if (!user) return;

    // Only Riders can emit location updates
    if (user.role === "RIDER") {
      socket.on("rider:location_update", async (data) => {
        try {
          const { lat, lon, speed = 0, heading = 0 } = data || {};
          if (lat === undefined || lon === undefined) return;

          const numLat = parseFloat(lat);
          const numLon = parseFloat(lon);
          const numSpeed = parseFloat(speed);
          const numHeading = parseFloat(heading);

          const locationData = {
            rider_id: user.id,
            rider_name: user.name,
            latitude: numLat,
            longitude: numLon,
            speed: numSpeed,
            heading: numHeading,
            updated_at: new Date().toISOString(),
          };

          // 1. Store Live Location in Redis Geospatial Index Set (GEOADD & HMSET)
          await redisGeoService.updateRiderLocation({
            riderId: user.id,
            riderName: user.name,
            lat: numLat,
            lon: numLon,
            speed: numSpeed,
            heading: numHeading,
          });

          // 2. Real-Time Broadcast to Supervisors Room
          socketManager.broadcastToSupervisors("supervisor:rider_moved", locationData);

          // 3. Fast In-Memory Geofence Boundary Check (with PostGIS Fallback)
          const assignment = await getCachedZoneAssignment(user.id);
          if (assignment && assignment.geoJsonObj) {
            let isInside = true;

            if (assignment.vertices) {
              // Fast in-memory ray-casting calculation (< 0.01ms)
              isInside = isPointInPolygonRing([numLon, numLat], assignment.vertices);
            } else {
              // Fallback to PostGIS if vertices could not be extracted in-memory
              try {
                const spatialCheckQuery = `
                  SELECT ST_Contains(
                    ST_SetSRID(ST_GeomFromGeoJSON($1), 4326),
                    ST_SetSRID(ST_MakePoint($2, $3), 4326)
                  ) AS is_inside;
                `;
                const { rows: spatialRows } = await pool.query(spatialCheckQuery, [
                  JSON.stringify(assignment.geoJsonObj),
                  numLon,
                  numLat,
                ]);
                isInside = spatialRows[0]?.is_inside || false;
              } catch (spatialErr) {
                console.warn("⚠️ Warning: Socket geofence spatial check fallback failed:", spatialErr.message);
                isInside = true; // Non-fatal default
              }
            }

            if (!isInside) {
              const breachMessage = `⚠️ PERINGATAN GEOFENCE: Anda berada di luar batas operasional ${assignment.zone_name}! Harap kembali ke dalam zona tugas.`;

              // Emit via canonical eventPublisher (10s sliding window deduplication)
              const warningEnvelope = eventPublisher.publishGeofenceBreach({
                riderId: user.id,
                riderName: user.name,
                zoneName: assignment.zone_name,
                lat: numLat,
                lon: numLon,
                message: breachMessage,
              });

              // Log audit event asynchronously (non-blocking)
              auditLogger.logAction({
                action: "GEOFENCE_BREACH_DETECTED",
                entityType: "RIDER_LBS",
                entityId: user.id,
                details: warningEnvelope,
              }).catch(() => {});
            }
          }
        } catch (error) {
          console.error(`💥 [LBS HANDLER ERROR] Error processing location update for Rider '${user?.name}':`, error.message);
        }
      });
    }
  });
};

