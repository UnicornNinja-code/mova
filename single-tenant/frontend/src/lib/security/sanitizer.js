/**
 * sanitizer.js
 * Inbound data sanitizer for untrusted external inputs:
 * OSM, POI, Competitors, GPS Telemetry, GeoJSON polygons, and user input strings.
 */

// Bounding box for Indonesia / Greater Jakarta Operational Area
export const INDONESIA_BOUNDS = {
  MIN_LAT: -11.0,
  MAX_LAT: 6.0,
  MIN_LNG: 95.0,
  MAX_LNG: 141.0,
};

export const JABODETABEK_BOUNDS = {
  MIN_LAT: -6.8,
  MAX_LAT: -5.9,
  MIN_LNG: 106.3,
  MAX_LNG: 107.2,
};

/**
 * Strips HTML tags, script tags, event handlers, control characters, and null bytes.
 * @param {string} input - Raw untrusted string
 * @param {object} options - Options { maxLength: number, allowNewline: boolean }
 * @returns {string} Sanitized string
 */
export function sanitizeText(input, options = {}) {
  if (input === null || input === undefined) return "";
  if (typeof input !== "string") {
    input = String(input);
  }

  const maxLength = options.maxLength || 500;
  const allowNewline = options.allowNewline || false;

  // 1. Strip null bytes and non-printable control characters (except newline/tab if allowed)
  let cleaned = input.replace(/\0/g, "");
  if (allowNewline) {
    cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  } else {
    cleaned = cleaned.replace(/[\x00-\x1F\x7F]/g, " ");
  }

  // 2. Strip HTML tags and dangerous javascript/vbscript protocols
  cleaned = cleaned
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<script\b[^>]*>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/javascript:/gi, "")
    .replace(/vbscript:/gi, "")
    .replace(/data:text\/html/gi, "")
    .replace(/on\w+\s*=/gi, "");

  // 3. Trim extra whitespace and limit length
  cleaned = cleaned.trim().replace(/\s+/g, " ");
  return cleaned.slice(0, maxLength);
}

/**
 * Validates and sanitizes a coordinate pair.
 * Rejects NaN, Infinity, and coordinates outside valid geographical bounds.
 * @param {number|string} lat - Latitude
 * @param {number|string} lng - Longitude
 * @param {boolean} restrictToOperationalArea - Restrict to Indonesia/Jabodetabek
 * @returns {{ valid: boolean, latitude: number, longitude: number, error?: string }}
 */
export function sanitizeCoordinates(lat, lng, restrictToOperationalArea = false) {
  const latitude = typeof lat === "string" ? parseFloat(lat) : Number(lat);
  const longitude = typeof lng === "string" ? parseFloat(lng) : Number(lng);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { valid: false, latitude: 0, longitude: 0, error: "Invalid non-finite coordinate values" };
  }

  // Global bounds check
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return { valid: false, latitude: 0, longitude: 0, error: "Coordinates out of WGS84 range" };
  }

  if (restrictToOperationalArea) {
    if (
      latitude < INDONESIA_BOUNDS.MIN_LAT ||
      latitude > INDONESIA_BOUNDS.MAX_LAT ||
      longitude < INDONESIA_BOUNDS.MIN_LNG ||
      longitude > INDONESIA_BOUNDS.MAX_LNG
    ) {
      return { valid: false, latitude, longitude, error: "Coordinates outside Indonesia territory" };
    }
  }

  // Normalize precision to 7 decimal places (~1.1cm precision)
  return {
    valid: true,
    latitude: Math.round(latitude * 1e7) / 1e7,
    longitude: Math.round(longitude * 1e7) / 1e7,
  };
}

/**
 * Sanitizes and validates a GeoJSON Polygon / MultiPolygon structure.
 * Limits coordinate points count to prevent client ReDoS or memory exhaustion.
 * @param {object} geojson - Raw GeoJSON object
 * @returns {{ valid: boolean, data?: object, error?: string }}
 */
export function sanitizeGeoJSON(geojson) {
  if (!geojson || typeof geojson !== "object") {
    return { valid: false, error: "GeoJSON must be a valid object" };
  }

  const validTypes = ["Polygon", "MultiPolygon", "Feature", "FeatureCollection"];
  if (!validTypes.includes(geojson.type)) {
    return { valid: false, error: `Unsupported GeoJSON type: ${geojson.type}` };
  }

  // For Feature / FeatureCollection, extract geometry
  let geometry = geojson;
  if (geojson.type === "Feature") {
    geometry = geojson.geometry;
  }

  if (!geometry || !Array.isArray(geometry.coordinates)) {
    return { valid: false, error: "Missing or invalid coordinates array" };
  }

  // Check point count limit (max 5,000 points per geometry)
  let totalPoints = 0;
  const MAX_POINTS = 5000;

  function countAndValidateCoordinates(coords, depth = 0) {
    if (depth > 5) return false; // Prevent circular / ultra-nested structures

    if (
      Array.isArray(coords) &&
      coords.length >= 2 &&
      typeof coords[0] === "number" &&
      typeof coords[1] === "number"
    ) {
      totalPoints++;
      if (totalPoints > MAX_POINTS) return false;
      const coordCheck = sanitizeCoordinates(coords[1], coords[0]);
      return coordCheck.valid;
    }

    if (Array.isArray(coords)) {
      for (const item of coords) {
        if (!countAndValidateCoordinates(item, depth + 1)) return false;
      }
      return true;
    }
    return false;
  }

  const isValid = countAndValidateCoordinates(geometry.coordinates);
  if (!isValid || totalPoints === 0) {
    return {
      valid: false,
      error: totalPoints > MAX_POINTS ? "Exceeded maximum polygon point limit (5000)" : "Invalid polygon coordinates",
    };
  }

  return { valid: true, data: geojson };
}

/**
 * Strips dangerous search regex / SQL injection sequences in search filters.
 * @param {string} query
 * @returns {string} Sanitized query
 */
export function sanitizeSearchQuery(query) {
  if (!query || typeof query !== "string") return "";
  let cleaned = sanitizeText(query);
  return cleaned
    .replace(/[\0\x08\x09\x1a\n\r"'\\;%]/g, " ")
    .replace(/--/g, " ")
    .replace(/[<>{}[\]()]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}
