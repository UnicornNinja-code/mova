import { lbsGeofenceService } from "../services/lbs/LbsGeofenceService.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";

const EARTH_RADIUS_KM = 6371;
const DEFAULT_NEARBY_RADIUS_KM = 5;
const DEFAULT_NEARBY_LIMIT = 50;

const handleControllerError = (res, error, defaultStatus = 500) => {
  const statusCode = error.statusCode || defaultStatus;
  return sendError(res, error.message || "Internal server error", statusCode, error.details || null);
};

export const pingRiderLocation = async (req, res) => {
  try {
    const { rider_id, rider_name, latitude, longitude, lat, lon, speed, heading, recorded_at } = req.body;
    const isRider = req.user?.role === "RIDER";
    const riderId = isRider ? req.user.id : (rider_id || req.user?.id || req.user?.userId);
    const riderName = isRider
      ? (req.user?.name || "Rider Operasional")
      : (rider_name || req.user?.name || "Rider Operasional");

    const result = await lbsGeofenceService.processRiderGpsPing({
      riderId,
      riderName,
      latitude,
      longitude,
      lat,
      lon,
      speed,
      heading,
      recorded_at,
    });

    return sendSuccess(res, result, "Rider location ping processed");
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const getLiveRiders = async (req, res) => {
  try {
    const { zone_id, compliance } = req.query;
    const riders = await lbsGeofenceService.getLiveRiderPositions({
      zoneId: zone_id,
      compliance,
    });

    return sendSuccess(res, riders, "Live rider positions retrieved", 200, {
      total_active: riders.length,
    });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const getNearbyRiders = async (req, res) => {
  try {
    const lon = req.query.lon !== undefined ? req.query.lon : req.query.longitude;
    const lat = req.query.lat !== undefined ? req.query.lat : req.query.latitude;
    const radius = req.query.radius !== undefined ? req.query.radius : (req.query.radiusKm || DEFAULT_NEARBY_RADIUS_KM);
    const limit = req.query.limit || DEFAULT_NEARBY_LIMIT;

    const startTime = Date.now();
    const result = await lbsGeofenceService.getNearbyRiders({
      lon,
      lat,
      radiusKm: radius,
      limit,
    });
    const executionMs = Date.now() - startTime;

    return sendSuccess(res, result.riders || result, "Nearby riders retrieved", 200, {
      execution_ms: executionMs,
      ...result,
    });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const getRiderLocation = async (req, res) => {
  try {
    const { riderId } = req.params;
    const rows = await lbsGeofenceService.getLiveRiderPositions();
    const rider = rows.find((r) => r.rider_id === riderId);

    if (!rider) {
      return sendError(res, `Posisi live untuk Rider ID '${riderId}' tidak ditemukan.`, 404);
    }

    return sendSuccess(res, rider, "Rider live position retrieved");
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const getZoneLogs = async (req, res) => {
  try {
    const { rider_id, zone_id, session_id, page, limit } = req.query;
    const result = await lbsGeofenceService.getZoneLogs({
      riderId: rider_id,
      zoneId: zone_id,
      sessionId: session_id,
      page,
      limit,
    });

    return sendSuccess(res, result.logs || result.data || result, "Zone logs retrieved", 200, {
      ...result,
    });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const calculateRiderDistance = async (req, res) => {
  try {
    const { rider1, rider2 } = req.query;

    if (!rider1 || !rider2) {
      return sendError(res, "Parameter 'rider1' dan 'rider2' harus diisi.", 400);
    }

    const rows = await lbsGeofenceService.getLiveRiderPositions();
    const pos1 = rows.find((r) => r.rider_id === rider1);
    const pos2 = rows.find((r) => r.rider_id === rider2);

    if (!pos1 || !pos2) {
      return sendError(res, "Salah satu atau kedua Rider tidak memiliki data posisi live.", 404);
    }

    const dLat = ((pos2.latitude - pos1.latitude) * Math.PI) / 180;
    const dLon = ((pos2.longitude - pos1.longitude) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((pos1.latitude * Math.PI) / 180) *
        Math.cos((pos2.latitude * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceKm = EARTH_RADIUS_KM * c;

    return sendSuccess(
      res,
      {
        rider1: { id: rider1, name: pos1.rider_name, location: { lat: pos1.latitude, lon: pos1.longitude } },
        rider2: { id: rider2, name: pos2.rider_name, location: { lat: pos2.latitude, lon: pos2.longitude } },
        distance_km: parseFloat(distanceKm.toFixed(3)),
        distance_meters: parseFloat((distanceKm * 1000).toFixed(1)),
      },
      "Distance calculated successfully",
      200,
      {
        rider1: { id: rider1, name: pos1.rider_name, location: { lat: pos1.latitude, lon: pos1.longitude } },
        rider2: { id: rider2, name: pos2.rider_name, location: { lat: pos2.latitude, lon: pos2.longitude } },
        distance_km: parseFloat(distanceKm.toFixed(3)),
        distance_meters: parseFloat((distanceKm * 1000).toFixed(1)),
      }
    );
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const getZonesDistanceSummary = async (req, res) => {
  try {
    const summary = await lbsGeofenceService.getZonesDistanceSummary();
    return sendSuccess(res, summary, "Zones distance summary retrieved");
  } catch (error) {
    return handleControllerError(res, error);
  }
};

