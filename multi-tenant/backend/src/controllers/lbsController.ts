/*
 * lbsController.ts
 * HTTP Controller for High-Frequency GPS Ingestion, Spatial Presence & Redis Proximity
 * Stage 5 MOVA Architecture
 */

import type { Request, Response } from "express";
import { lbsIngestionService } from "../services/lbs/LbsIngestionService.js";
import { redisGeoService } from "../services/lbs/RedisGeoService.js";
import { operationalPresenceEngine } from "../services/lbs/OperationalPresenceEngine.js";
import { pool } from "../config/database.js";

/**
 * 1. High-Frequency GPS Position Ingestion (Stage 5 Canonical Endpoint)
 * POST /api/lbs/positions
 */
export const ingestPositions = async (req: Request, res: Response): Promise<any> => {
  try {
    const tenantId = req.user?.tenantId || (req.user as any)?.tenant_id || "thesis-default";
    const riderId = String(req.user?.id || (req.user as any)?.userId);
    const riderName = req.user?.name || "Rider Operasional";

    const {
      latitude,
      longitude,
      accuracy_meters,
      altitude_meters,
      speed_mps,
      heading_degrees,
      captured_at,
      device_id,
      sequence,
    } = req.body;

    const result = await lbsIngestionService.ingestGpsPosition(tenantId, riderId, riderName, {
      latitude,
      longitude,
      accuracy_meters,
      altitude_meters,
      speed_mps,
      heading_degrees,
      captured_at,
      device_id,
      sequence,
    });

    if (result.persisted) {
      return res.status(202).json({
        status: "success",
        statusCode: 202,
        msg: "GPS position accepted",
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          request_id: (req as any).traceId || `req-${Date.now()}`,
        },
      });
    } else {
      return res.status(202).json({
        status: "success",
        statusCode: 202,
        msg: "GPS position accepted but persistence skipped by distance filter",
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          request_id: (req as any).traceId || `req-${Date.now()}`,
        },
      });
    }
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    const code = error.code || (statusCode === 429 ? "GPS_RATE_LIMITED" : "GPS_INGESTION_ERROR");
    return res.status(statusCode).json({
      status: "error",
      statusCode,
      msg: error.message || "GPS ingestion temporarily unavailable",
      error: {
        code,
        message: error.message,
      },
      meta: {
        timestamp: new Date().toISOString(),
        request_id: (req as any).traceId || `req-${Date.now()}`,
      },
    });
  }
};

/**
 * 2. Get Current Authenticated Rider Position
 * GET /api/lbs/me/position
 */
export const getMyPosition = async (req: Request, res: Response): Promise<any> => {
  try {
    const tenantId = req.user?.tenantId || (req.user as any)?.tenant_id || "thesis-default";
    const riderId = String(req.user?.id || (req.user as any)?.userId);

    const result = await redisGeoService.getRiderLocation(tenantId, riderId);
    if (!result) {
      return res.status(404).json({
        status: "error",
        statusCode: 404,
        msg: "No active live position found for current rider",
        error: { code: "RIDER_POSITION_NOT_FOUND", message: "No active GPS ping recorded in Redis" },
      });
    }

    return res.status(200).json({
      status: "success",
      statusCode: 200,
      data: result,
    });
  } catch (error: any) {
    return res.status(500).json({ status: "error", statusCode: 500, msg: error.message });
  }
};

/**
 * 3. Get Specific Rider Live Position
 * GET /api/lbs/riders/:riderId/position
 */
export const getRiderPosition = async (req: Request, res: Response): Promise<any> => {
  try {
    const tenantId = req.user?.tenantId || (req.user as any)?.tenant_id || "thesis-default";
    const riderId = req.params.riderId;

    const result = await redisGeoService.getRiderLocation(tenantId, riderId);
    if (!result) {
      return res.status(404).json({
        status: "error",
        statusCode: 404,
        msg: `No active live position found for rider '${riderId}'`,
        error: { code: "RIDER_POSITION_NOT_FOUND", message: "Rider is offline or has no active location ping" },
      });
    }

    return res.status(200).json({
      status: "success",
      statusCode: 200,
      data: result,
    });
  } catch (error: any) {
    return res.status(500).json({ status: "error", statusCode: 500, msg: error.message });
  }
};

/**
 * 4. Proximity Radius Search for Nearby Active Riders
 * GET /api/lbs/riders/nearby & GET /api/lbs/nearby
 */
export const getNearbyRiders = async (req: Request, res: Response): Promise<any> => {
  try {
    const tenantId = req.user?.tenantId || (req.user as any)?.tenant_id || "thesis-default";
    const rawLon = req.query.lon ?? req.query.lng ?? req.query.longitude;
    const rawLat = req.query.lat ?? req.query.latitude;
    const rawRadius = req.query.radiusKm ?? req.query.radius_meters ?? req.query.radius ?? 5;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;

    if (rawLon === undefined || rawLat === undefined || rawLon === "" || rawLat === "") {
      return res.status(400).json({
        status: "error",
        statusCode: 400,
        msg: "Parameter 'latitude' dan 'longitude' wajib diisi.",
        error: { code: "GPS_MISSING_COORDINATES", message: "Missing lat/lon query params" },
      });
    }

    let radiusKm = parseFloat(String(rawRadius));
    // If radius is given in meters (> 1000), convert to km
    if (radiusKm > 1000) {
      radiusKm = radiusKm / 1000;
    }

    const startTime = Date.now();
    const result = await redisGeoService.getNearbyRiders({
      tenantId,
      lon: parseFloat(String(rawLon)),
      lat: parseFloat(String(rawLat)),
      radiusKm,
      limit,
    });

    const executionMs = Date.now() - startTime;

    return res.status(200).json({
      status: "success",
      statusCode: 200,
      execution_ms: executionMs,
      ...result,
    });
  } catch (error: any) {
    return res.status(500).json({ status: "error", statusCode: 500, msg: error.message });
  }
};

/**
 * 5. Get Zone Spatial Presence
 * GET /api/lbs/zones/:zoneId/presence
 */
export const getZonePresence = async (req: Request, res: Response): Promise<any> => {
  try {
    const tenantId = req.user?.tenantId || (req.user as any)?.tenant_id || "thesis-default";
    const zoneId = req.params.zoneId;

    // Get zone details and all active rider positions within this zone
    const query = `
      SELECT 
        rp.rider_id,
        u.name AS rider_name,
        rp.latitude,
        rp.longitude,
        rp.speed_mps,
        rp.heading_degrees,
        rp.accuracy_meters,
        rp.captured_at
      FROM rider_positions rp
      JOIN users u ON rp.rider_id = u.id
      WHERE rp.tenant_id = $1 
        AND rp.zone_id = $2
        AND rp.captured_at >= NOW() - INTERVAL '15 minutes'
      ORDER BY rp.captured_at DESC;
    `;

    const { rows } = await pool.query(query, [tenantId, zoneId]);

    // Deduplicate by rider_id (keep latest)
    const activeMap = new Map<string, any>();
    for (const r of rows) {
      if (!activeMap.has(r.rider_id)) {
        activeMap.set(r.rider_id, {
          rider_id: r.rider_id,
          rider_name: r.rider_name,
          location: { latitude: r.latitude, longitude: r.longitude },
          telemetry: { speed_mps: r.speed_mps, heading_degrees: r.heading_degrees },
          captured_at: r.captured_at,
        });
      }
    }

    const activeRiders = Array.from(activeMap.values());

    return res.status(200).json({
      status: "success",
      statusCode: 200,
      zone_id: zoneId,
      total_active_riders: activeRiders.length,
      riders: activeRiders,
    });
  } catch (error: any) {
    return res.status(500).json({ status: "error", statusCode: 500, msg: error.message });
  }
};

/**
 * 6. Get Rider Historical Presence Events (Stage 6)
 * GET /api/lbs/riders/:riderId/presence-history
 */
export const getRiderPresenceHistory = async (req: Request, res: Response): Promise<any> => {
  try {
    const tenantId = req.user?.tenantId || (req.user as any)?.tenant_id || "thesis-default";
    const riderId = req.params.riderId;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;

    const history = await operationalPresenceEngine.getRiderPresenceHistory(tenantId, riderId, limit);
    return res.status(200).json({
      status: "success",
      statusCode: 200,
      rider_id: riderId,
      total_events: history.length,
      data: history,
    });
  } catch (error: any) {
    return res.status(500).json({ status: "error", statusCode: 500, msg: error.message });
  }
};

/**
 * 7. Get Zone Operational Compliance Summary (Stage 6)
 * GET /api/lbs/zones/:zoneId/compliance-summary
 */
export const getZoneComplianceSummary = async (req: Request, res: Response): Promise<any> => {
  try {
    const tenantId = req.user?.tenantId || (req.user as any)?.tenant_id || "thesis-default";
    const zoneId = req.params.zoneId;

    const summary = await operationalPresenceEngine.getZoneComplianceSummary(tenantId, zoneId);
    if (!summary) {
      return res.status(404).json({
        status: "error",
        statusCode: 404,
        msg: `Zone with ID '${zoneId}' not found.`,
      });
    }

    return res.status(200).json({
      status: "success",
      statusCode: 200,
      data: summary,
    });
  } catch (error: any) {
    return res.status(500).json({ status: "error", statusCode: 500, msg: error.message });
  }
};

/**
 * Legacy Support: Track Live Rider Location Ping
 * POST /api/lbs/track
 */
export const trackRiderLocation = async (req: Request, res: Response): Promise<any> => {
  return ingestPositions(req, res);
};

/**
 * Legacy Support: Get Rider Location
 * GET /api/lbs/riders/:riderId
 */
export const getRiderLocation = async (req: Request, res: Response): Promise<any> => {
  return getRiderPosition(req, res);
};

/**
 * Legacy Support: Calculate Distance
 * GET /api/lbs/distance
 */
export const calculateRiderDistance = async (req: Request, res: Response): Promise<any> => {
  try {
    const tenantId = req.user?.tenantId || (req.user as any)?.tenant_id || "thesis-default";
    const { rider1, rider2 } = req.query as { rider1?: string; rider2?: string };

    if (!rider1 || !rider2) {
      return res.status(400).json({ msg: "Parameter 'rider1' dan 'rider2' harus diisi." });
    }

    const pos1 = await redisGeoService.getRiderLocation(tenantId, rider1);
    const pos2 = await redisGeoService.getRiderLocation(tenantId, rider2);

    if (!pos1 || !pos2) {
      return res.status(404).json({ msg: "Salah satu atau kedua Rider tidak memiliki data posisi di Redis." });
    }

    const distanceMeters = lbsIngestionService.calculateHaversineDistance(
      pos1.location.latitude,
      pos1.location.longitude,
      pos2.location.latitude,
      pos2.location.longitude
    );

    return res.status(200).json({
      rider1_id: rider1,
      rider2_id: rider2,
      distance_km: Math.round((distanceMeters / 1000) * 100) / 100,
      distance_meters: distanceMeters,
    });
  } catch (error: any) {
    return res.status(500).json({ msg: error.message });
  }
};
