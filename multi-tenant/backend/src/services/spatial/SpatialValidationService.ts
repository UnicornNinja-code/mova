/*
 * SpatialValidationService.ts
 *
 * Comprehensive PostGIS & Mathematical Spatial Validation Engine for MOVA
 * Enforces geometry validity, topological integrity, SRID consistency,
 * operational bounding box constraints, and deduplication.
 */

import { pool } from "../../config/database.js";

// Bounding Box Definition
export interface BoundingBox {
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
}

// Preset Bounding Boxes for Indonesian Metropolitan Cities (East Java Focus)
export const CITY_BBOX_PRESETS: Record<string, BoundingBox> = {
  Sidoarjo: { minLon: 112.50, maxLon: 112.85, minLat: -7.58, maxLat: -7.33 },
  Pasuruan: { minLon: 112.65, maxLon: 113.10, minLat: -7.85, maxLat: -7.60 },
  Surabaya: { minLon: 112.58, maxLon: 112.86, minLat: -7.36, maxLat: -7.18 },
  Malang: { minLon: 112.55, maxLon: 112.72, minLat: -8.05, maxLat: -7.90 },
  Gresik: { minLon: 112.45, maxLon: 112.70, minLat: -7.30, maxLat: -7.05 },
  Mojokerto: { minLon: 112.35, maxLon: 112.55, minLat: -7.55, maxLat: -7.42 },
};

// Default Wide Operational Envelope (covers Sidoarjo + Pasuruan metropolitan region)
export const OPERATIONAL_BBOX: BoundingBox = {
  minLon: 112.30,
  maxLon: 113.30,
  minLat: -8.00,
  maxLat: -7.10,
};

export interface ValidationReport {
  isValid: boolean;
  totalFeatures: number;
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  outOfBoundsCount: number;
  errors: Array<{ index: number; id?: string; reason: string; coordinates?: any }>;
}

export class SpatialValidationService {
  private static instance: SpatialValidationService | null = null;

  public static getInstance(): SpatialValidationService {
    if (!SpatialValidationService.instance) {
      SpatialValidationService.instance = new SpatialValidationService();
    }
    return SpatialValidationService.instance;
  }

  /**
   * Validate if a coordinate point [lon, lat] is within the operational bounding box
   */
  public isWithinOperationalBounds(lon: number, lat: number, customBbox?: BoundingBox): boolean {
    const bbox = customBbox || OPERATIONAL_BBOX;
    return (
      lon >= bbox.minLon &&
      lon <= bbox.maxLon &&
      lat >= bbox.minLat &&
      lat <= bbox.maxLat
    );
  }

  /**
   * Resolve BoundingBox from city name, system_settings, or calculate from operational coordinates
   */
  public async resolveBoundingBox(cityName?: string): Promise<BoundingBox> {
    if (cityName && CITY_BBOX_PRESETS[cityName]) {
      return CITY_BBOX_PRESETS[cityName];
    }

    if (cityName) {
      const match = Object.keys(CITY_BBOX_PRESETS).find(
        (c) => c.toLowerCase() === cityName.toLowerCase()
      );
      if (match) return CITY_BBOX_PRESETS[match];
    }

    try {
      const query = `
        SELECT key, value FROM system_settings 
        WHERE key IN ('OPERATIONAL_BBOX', 'HUB_CITY_NAME', 'CENTRAL_HUB_LAT', 'CENTRAL_HUB_LNG', 'HUB_LATITUDE', 'HUB_LONGITUDE', 'OPERATIONAL_RADIUS_KM');
      `;
      const { rows } = await pool.query(query);
      const settings: Record<string, string> = {};
      for (const r of rows) settings[r.key] = r.value;

      if (settings['OPERATIONAL_BBOX']) {
        const parsed = typeof settings['OPERATIONAL_BBOX'] === "string" ? JSON.parse(settings['OPERATIONAL_BBOX']) : settings['OPERATIONAL_BBOX'];
        if (
          typeof parsed.minLon === "number" &&
          typeof parsed.maxLon === "number" &&
          typeof parsed.minLat === "number" &&
          typeof parsed.maxLat === "number"
        ) {
          return parsed;
        }
      }

      const configuredCity = settings['HUB_CITY_NAME'];
      if (configuredCity && !cityName) {
        const match = Object.keys(CITY_BBOX_PRESETS).find(
          (c) => c.toLowerCase() === configuredCity.toLowerCase()
        );
        if (match) return CITY_BBOX_PRESETS[match];
      }

      // Dynamic calculation if lat, lon, and radius are present
      const rawLat = settings['CENTRAL_HUB_LAT'] || settings['HUB_LATITUDE'];
      const rawLon = settings['CENTRAL_HUB_LNG'] || settings['HUB_LONGITUDE'];
      if (rawLat && rawLon) {
        const lat = parseFloat(rawLat);
        const lon = parseFloat(rawLon);
        const radiusKm = parseFloat(settings['OPERATIONAL_RADIUS_KM'] || '12');
        if (!isNaN(lat) && !isNaN(lon)) {
          const deltaLat = (radiusKm * 1.15) / 111.32;
          const deltaLon = (radiusKm * 1.15) / (111.32 * Math.max(0.1, Math.abs(Math.cos((lat * Math.PI) / 180))));
          return {
            minLat: parseFloat((lat - deltaLat).toFixed(4)),
            maxLat: parseFloat((lat + deltaLat).toFixed(4)),
            minLon: parseFloat((lon - deltaLon).toFixed(4)),
            maxLon: parseFloat((lon + deltaLon).toFixed(4)),
          };
        }
      }
    } catch {}

    return OPERATIONAL_BBOX;
  }

  /**
   * Calculate Haversine distance in meters between two lat/lon coordinates
   */
  public calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth radius in meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Validate a batch of POI elements with dynamic Bounding Box support
   */
  public validatePois(pois: any[], customBbox?: BoundingBox): { validPois: any[]; report: ValidationReport } {
    const report: ValidationReport = {
      isValid: true,
      totalFeatures: pois.length,
      validCount: 0,
      invalidCount: 0,
      duplicateCount: 0,
      outOfBoundsCount: 0,
      errors: [],
    };

    const validPois: any[] = [];
    const seenExternalIds = new Set<string>();

    for (let i = 0; i < pois.length; i++) {
      const p = pois[i];
      const extId = p.external_id || (p.osm_id ? `osm:${p.osm_type || "node"}:${p.osm_id}` : null);

      // 1. Check coordinates presence & validity
      if (typeof p.latitude !== "number" || typeof p.longitude !== "number" || isNaN(p.latitude) || isNaN(p.longitude)) {
        report.invalidCount++;
        report.errors.push({ index: i, id: extId, reason: "INVALID_COORDINATES", coordinates: [p.longitude, p.latitude] });
        continue;
      }

      // 2. Range check
      if (p.longitude < -180 || p.longitude > 180 || p.latitude < -90 || p.latitude > 90) {
        report.invalidCount++;
        report.errors.push({ index: i, id: extId, reason: "COORDINATES_OUT_OF_WORLD_RANGE", coordinates: [p.longitude, p.latitude] });
        continue;
      }

      // 3. Operational Bounding Box check (Dynamic or Default Envelope)
      if (!this.isWithinOperationalBounds(p.longitude, p.latitude, customBbox)) {
        report.outOfBoundsCount++;
        report.errors.push({ index: i, id: extId, reason: "OUT_OF_OPERATIONAL_BOUNDS", coordinates: [p.longitude, p.latitude] });
        continue;
      }

      // 4. Duplicate external_id check in the incoming batch
      if (extId && seenExternalIds.has(extId)) {
        report.duplicateCount++;
        report.errors.push({ index: i, id: extId, reason: "DUPLICATE_EXTERNAL_ID" });
        continue;
      }

      if (extId) seenExternalIds.add(extId);

      validPois.push({
        ...p,
        external_id: extId || `mova:poi:gen-${i + 1}`,
      });
      report.validCount++;
    }

    // If more than 30% features are invalid, reject the whole batch as fatally corrupt
    if (report.totalFeatures > 10 && report.invalidCount / report.totalFeatures > 0.3) {
      report.isValid = false;
    }

    return { validPois, report };
  }

  /**
   * Validate a batch of Road (LineString) features with dynamic Bounding Box support
   */
  public validateRoads(roads: any[], customBbox?: BoundingBox): { validRoads: any[]; report: ValidationReport } {
    const report: ValidationReport = {
      isValid: true,
      totalFeatures: roads.length,
      validCount: 0,
      invalidCount: 0,
      duplicateCount: 0,
      outOfBoundsCount: 0,
      errors: [],
    };

    const validRoads: any[] = [];
    const seenExternalIds = new Set<string>();

    for (let i = 0; i < roads.length; i++) {
      const r = roads[i];
      const extId = r.external_id || (r.osm_id ? `osm:way:${r.osm_id}` : null);
      const coords = r.geometry?.coordinates;

      // 1. LineString geometry check
      if (!Array.isArray(coords) || coords.length < 2) {
        report.invalidCount++;
        report.errors.push({ index: i, id: extId, reason: "INVALID_LINESTRING_COORDINATES_LENGTH" });
        continue;
      }

      // 2. Validate points inside LineString
      let hasInvalidPoint = false;
      let allPointsOutOfBounds = true;

      for (const pt of coords) {
        if (!Array.isArray(pt) || pt.length < 2 || typeof pt[0] !== "number" || typeof pt[1] !== "number" || isNaN(pt[0]) || isNaN(pt[1])) {
          hasInvalidPoint = true;
          break;
        }
        if (this.isWithinOperationalBounds(pt[0], pt[1], customBbox)) {
          allPointsOutOfBounds = false;
        }
      }

      if (hasInvalidPoint) {
        report.invalidCount++;
        report.errors.push({ index: i, id: extId, reason: "CORRUPT_POINT_IN_LINESTRING" });
        continue;
      }

      if (allPointsOutOfBounds) {
        report.outOfBoundsCount++;
        report.errors.push({ index: i, id: extId, reason: "ROAD_OUT_OF_OPERATIONAL_BOUNDS" });
        continue;
      }

      // 3. Duplicate check
      if (extId && seenExternalIds.has(extId)) {
        report.duplicateCount++;
        report.errors.push({ index: i, id: extId, reason: "DUPLICATE_ROAD_EXTERNAL_ID" });
        continue;
      }

      if (extId) seenExternalIds.add(extId);

      validRoads.push({
        ...r,
        external_id: extId || `mova:way:gen-${i + 1}`,
      });
      report.validCount++;
    }

    if (report.totalFeatures > 5 && report.invalidCount / report.totalFeatures > 0.3) {
      report.isValid = false;
    }

    return { validRoads, report };
  }

  /**
   * PostGIS Server-side validation check (checks ST_IsValid and ST_SRID in database)
   */
  public async validateStagingGeometries(
    stagingTable: "pois_staging" | "protocol_roads_staging",
    versionId: string
  ): Promise<{ valid: boolean; invalidCount: number }> {
    const query = `
      SELECT COUNT(*)::int AS invalid_count
      FROM ${stagingTable}
      WHERE version_id = $1
        AND (geom IS NULL OR NOT ST_IsValid(geom) OR ST_SRID(geom) != 4326);
    `;
    const { rows } = await pool.query(query, [versionId]);
    const invalidCount = rows[0]?.invalid_count || 0;
    return {
      valid: invalidCount === 0,
      invalidCount,
    };
  }
}

export const spatialValidationService = SpatialValidationService.getInstance();
