/*
 * operationalScope.js
 * Single Source of Truth (SSOT) & Spatial Guard for MOVA Operational Regional Scope
 */

import { env } from "./env.js";

export const operationalScope = Object.freeze({
  city: env.OPERATIONAL_SCOPE?.CITY || "Sidoarjo",
  province: env.OPERATIONAL_SCOPE?.PROVINCE || "Jawa Timur",
  country: env.OPERATIONAL_SCOPE?.COUNTRY || "Indonesia",
  adminLevel: env.OPERATIONAL_SCOPE?.ADMIN_LEVEL || 5,
  bbox: Object.freeze({
    minLat: env.OPERATIONAL_SCOPE?.BBOX?.minLat ?? -7.65,
    maxLat: env.OPERATIONAL_SCOPE?.BBOX?.maxLat ?? -7.25,
    minLon: env.OPERATIONAL_SCOPE?.BBOX?.minLon ?? 112.45,
    maxLon: env.OPERATIONAL_SCOPE?.BBOX?.maxLon ?? 112.95,
  }),
  center: Object.freeze({
    latitude: env.OPERATIONAL_SCOPE?.CENTER?.latitude ?? -7.4478,
    longitude: env.OPERATIONAL_SCOPE?.CENTER?.longitude ?? 112.7183,
  }),
});

/**
 * Validates whether numeric latitude & longitude coordinates fall strictly inside
 * the authoritative operational bounding box.
 */
export function isWithinOperationalScope(lat, lon) {
  const numLat = Number(lat);
  const numLon = Number(lon);

  if (Number.isNaN(numLat) || Number.isNaN(numLon)) {
    return false;
  }

  const { minLat, maxLat, minLon, maxLon } = operationalScope.bbox;
  return (
    numLat >= minLat &&
    numLat <= maxLat &&
    numLon >= minLon &&
    numLon <= maxLon
  );
}

/**
 * Throws a formatted Error with HTTP 400 if the provided coordinate is outside
 * the operational scope.
 */
export function assertWithinOperationalScope(lat, lon, label = "Koordinat") {
  const numLat = Number(lat);
  const numLon = Number(lon);

  if (Number.isNaN(numLat) || Number.isNaN(numLon)) {
    const error = new Error(`${label} harus berupa angka numerik valid.`);
    error.statusCode = 400;
    throw error;
  }

  const { minLat, maxLat, minLon, maxLon } = operationalScope.bbox;
  if (!isWithinOperationalScope(numLat, numLon)) {
    const error = new Error(
      `${label} (${numLat}, ${numLon}) berada di luar batas otoritatif wilayah operasional ${operationalScope.city} [Lat: ${minLat}..${maxLat}, Lon: ${minLon}..${maxLon}].`
    );
    error.statusCode = 400;
    throw error;
  }
}

/**
 * Validates a GeoJSON LineString or MultiLineString geometry.
 * Returns true if at least one coordinate vertex falls inside the operational boundary.
 */
export function isGeometryWithinScope(geometry) {
  if (!geometry || !geometry.coordinates) return false;

  const checkCoord = (pt) => {
    if (Array.isArray(pt) && pt.length >= 2) {
      // GeoJSON is [lon, lat]
      return isWithinOperationalScope(pt[1], pt[0]);
    }
    return false;
  };

  if (geometry.type === "Point") {
    return checkCoord(geometry.coordinates);
  }

  if (geometry.type === "LineString") {
    return geometry.coordinates.some(checkCoord);
  }

  if (geometry.type === "MultiLineString" || geometry.type === "Polygon") {
    return geometry.coordinates.some((ring) => ring.some(checkCoord));
  }

  return true;
}

/**
 * Returns Overpass QL BBox filter string
 */
export function getOverpassBboxFilter() {
  const { minLat, minLon, maxLat, maxLon } = operationalScope.bbox;
  return `(${minLat},${minLon},${maxLat},${maxLon})`;
}
