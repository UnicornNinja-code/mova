/**
 * geoJsonAdapter.js
 * Spatial adapter utility for converting between Leaflet LatLng formats
 * and GeoJSON [longitude, latitude] standards.
 */

/**
 * Converts Leaflet latLng points into a standard GeoJSON Polygon geometry object.
 * @param {Array<Array<number>|{lat: number, lng: number}>} points Array of [lat, lng] or LatLng objects
 * @returns {Object|null} GeoJSON Polygon object or null if invalid
 */
export function latLngsToGeoJsonPolygon(points) {
  if (!Array.isArray(points) || points.length < 3) {
    return null;
  }

  const ring = points
    .map((pt) => {
      if (Array.isArray(pt) && pt.length >= 2) {
        const lat = Number(pt[0]);
        const lng = Number(pt[1]);
        if (!isNaN(lat) && !isNaN(lng)) return [lng, lat];
      } else if (pt && typeof pt === "object" && pt.lat !== undefined && pt.lng !== undefined) {
        const lat = Number(pt.lat);
        const lng = Number(pt.lng);
        if (!isNaN(lat) && !isNaN(lng)) return [lng, lat];
      }
      return null;
    })
    .filter(Boolean);

  if (ring.length < 3) {
    return null;
  }

  // Ensure ring closure: first point must equal last point
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push([first[0], first[1]]);
  }

  return {
    type: "Polygon",
    coordinates: [ring],
  };
}

/**
 * Extracts Leaflet-compatible [lat, lng] array from GeoJSON Polygon geometry.
 * @param {Object|string|Array} geojson GeoJSON object, JSON string, or coordinate array
 * @returns {Array<Array<number>>} Array of [lat, lng] points for Leaflet L.polygon
 */
export function geoJsonToLatLngs(geojson) {
  if (!geojson) return [];

  let obj = geojson;
  if (typeof geojson === "string") {
    try {
      obj = JSON.parse(geojson);
    } catch (e) {
      return [];
    }
  }

  let coords = [];
  if (Array.isArray(obj)) {
    coords = obj;
  } else if (obj && typeof obj === "object") {
    if (obj.type === "Feature" && obj.geometry) {
      coords = obj.geometry.coordinates?.[0] || [];
    } else if (obj.type === "Polygon") {
      coords = obj.coordinates?.[0] || [];
    } else if (obj.coordinates) {
      coords = Array.isArray(obj.coordinates[0]) ? obj.coordinates[0] : obj.coordinates;
    }
  }

  if (!Array.isArray(coords)) return [];

  return coords
    .map((pt) => {
      if (Array.isArray(pt) && pt.length >= 2) {
        const lng = Number(pt[0]);
        const lat = Number(pt[1]);
        if (!isNaN(lat) && !isNaN(lng)) return [lat, lng];
      } else if (pt && typeof pt === "object" && pt.lat !== undefined && pt.lng !== undefined) {
        return [Number(pt.lat), Number(pt.lng)];
      }
      return null;
    })
    .filter(Boolean);
}

/**
 * Calculates the bounding centroid [lat, lng] of a set of latLng points.
 * @param {Array<Array<number>>} latLngs Array of [lat, lng]
 * @param {Array<number>|null} fallbackCenter Dynamic fallback center [lat, lng] from backend config
 * @returns {[number, number]|null} [centroidLat, centroidLng] or null if empty
 */
export function calculatePolygonCentroid(latLngs, fallbackCenter = null) {
  if (!Array.isArray(latLngs) || latLngs.length === 0) {
    return fallbackCenter;
  }

  let sumLat = 0;
  let sumLng = 0;
  let count = 0;

  latLngs.forEach((pt) => {
    if (Array.isArray(pt) && pt.length >= 2) {
      sumLat += pt[0];
      sumLng += pt[1];
      count++;
    }
  });

  if (count === 0) return fallbackCenter;

  return [sumLat / count, sumLng / count];
}
