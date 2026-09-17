import { pool } from "../../config/database.js";

const MIN_ZONE_AREA_SQM = 1000;
const MAX_ZONE_AREA_SQM = 5000000;
const ROAD_BUFFER_METERS = 10;
const MIN_POLYGON_POINTS = 3;

export class SpatialRestrictionService {
  static instance = null;

  constructor(dbPool = pool) {
    if (SpatialRestrictionService.instance && dbPool === pool) {
      return SpatialRestrictionService.instance;
    }
    this.pool = dbPool;
    if (dbPool === pool) {
      SpatialRestrictionService.instance = this;
    }
  }

  static getInstance(dbPool = pool) {
    if (!SpatialRestrictionService.instance) {
      SpatialRestrictionService.instance = new SpatialRestrictionService(dbPool);
    }
    return SpatialRestrictionService.instance;
  }

  formatPolygonToGeoJSON(polygon) {
    if (!polygon) return null;
    let parsed = polygon;
    if (typeof polygon === "string") {
      try {
        parsed = JSON.parse(polygon);
      } catch (e) {
        return null;
      }
    }
    if (parsed.type === "Polygon") return JSON.stringify(parsed);
    if (parsed.type === "Feature" && parsed.geometry) return JSON.stringify(parsed.geometry);
    if (Array.isArray(parsed) && parsed.length >= MIN_POLYGON_POINTS) {
      const coordinates = parsed.map((pt) => {
        if (Array.isArray(pt)) {
          const isLonFirst = Math.abs(pt[0]) > Math.abs(pt[1]);
          return [parseFloat(isLonFirst ? pt[0] : pt[1]), parseFloat(isLonFirst ? pt[1] : pt[0])];
        }
        return [parseFloat(pt.lon || pt.lng || 0), parseFloat(pt.lat || 0)];
      });
      const first = coordinates[0];
      const last = coordinates[coordinates.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        coordinates.push([first[0], first[1]]);
      }
      return JSON.stringify({ type: "Polygon", coordinates: [coordinates] });
    }
    return null;
  }

  async validateZonePolygon(polygon, excludeZoneId = null) {
    const geoJsonStr = this.formatPolygonToGeoJSON(polygon);
    if (!geoJsonStr) {
      return {
        valid: false,
        area_sqm: 0,
        area_valid: false,
        overlap_check: { has_overlap: false, overlapping_zones: [] },
        restricted_road_check: { intersects_restricted_road: false, road_names: [] },
        warnings: ["Format geometri poligon GeoJSON tidak valid."],
      };
    }

    const query = `
      WITH input_geom AS (
        SELECT ST_SetSRID(ST_GeomFromGeoJSON($1), 4326) AS geom
      )
      SELECT 
        ST_IsValid(geom) AS is_valid_geometry,
        ST_IsValidReason(geom) AS invalid_reason,
        ST_Area(geom::geography) AS area_sqm,
        (
          SELECT COALESCE(json_agg(json_build_object('id', z.id, 'name', z.name)), '[]'::json)
          FROM zones z, input_geom ig
          WHERE z.status = 'ACTIVE'
            AND ($2::uuid IS NULL OR z.id <> $2::uuid)
            AND ST_Overlaps(z.geom, ig.geom)
        ) AS overlapping_zones,
        (
          SELECT COALESCE(json_agg(pr.name), '[]'::json)
          FROM protocol_roads pr, input_geom ig
          WHERE pr.restriction_type = 'PROHIBITED_TOLL_ROAD'
            AND ST_Intersects(pr.geom, ig.geom)
        ) AS restricted_toll_roads
      FROM input_geom;
    `;

    const { rows } = await this.pool.query(query, [geoJsonStr, excludeZoneId || null]);
    const res = rows[0];

    const warnings = [];
    let isValid = true;

    if (!res.is_valid_geometry) {
      isValid = false;
      warnings.push(`Geometri poligon rusak/self-intersecting: ${res.invalid_reason}`);
    }

    const areaSqm = parseFloat(res.area_sqm || 0);
    const areaValid = areaSqm >= MIN_ZONE_AREA_SQM && areaSqm <= MAX_ZONE_AREA_SQM;
    if (!areaValid) {
      isValid = false;
      warnings.push(
        `Luas area (${areaSqm.toFixed(1)} m²) berada di luar batas operasional (Min: ${MIN_ZONE_AREA_SQM} m², Max: ${MAX_ZONE_AREA_SQM} m²).`
      );
    }

    const overlappingZones = res.overlapping_zones || [];
    if (overlappingZones.length > 0) {
      isValid = false;
      warnings.push(
        `Poligon bertumpukan (overlap) dengan ${overlappingZones.length} zona aktif lain: ${overlappingZones.map((z) => z.name).join(", ")}`
      );
    }

    const tollRoads = res.restricted_toll_roads || [];
    if (tollRoads.length > 0) {
      isValid = false;
      warnings.push(`Poligon zona memotong jalur Jalan Tol Bebas Hambatan (${tollRoads.join(", ")}).`);
    }

    return {
      valid: isValid,
      area_sqm: areaSqm,
      area_valid: areaValid,
      overlap_check: {
        has_overlap: overlappingZones.length > 0,
        overlapping_zones: overlappingZones,
      },
      restricted_road_check: {
        intersects_restricted_road: tollRoads.length > 0,
        road_names: tollRoads,
      },
      warnings,
    };
  }

  async validateCandidateSpot(latitude, longitude, zoneId) {
    if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) {
      return { validation_status: "REJECTED", rejection_reason: "INVALID_COORDINATES" };
    }

    const lat = Number(latitude);
    const lon = Number(longitude);

    if (isNaN(lat) || isNaN(lon) || !isFinite(lat) || !isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return { validation_status: "REJECTED", rejection_reason: "INVALID_COORDINATES" };
    }

    if (!zoneId) {
      return { validation_status: "REJECTED", rejection_reason: "OUTSIDE_ZONE" };
    }

    const zoneQuery = `
      SELECT id, name 
      FROM zones 
      WHERE id = $1 
        AND ST_Contains(
          geom,
          ST_SetSRID(ST_MakePoint($3, $2), 4326)
        );
    `;
    const { rows: zoneRows } = await this.pool.query(zoneQuery, [zoneId, lat, lon]);
    if (zoneRows.length === 0) {
      return { validation_status: "REJECTED", rejection_reason: "OUTSIDE_ZONE" };
    }

    const roadQuery = `
      SELECT id, name, restriction_type
      FROM protocol_roads 
      WHERE (restriction_type = 'PROHIBITED_ROAD' OR restriction_type = 'PROHIBITED_TOLL_ROAD')
        AND ST_Intersects(
          geom,
          ST_Buffer(ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, ${ROAD_BUFFER_METERS})::geometry
        )
      LIMIT 1;
    `;
    const { rows: roadRows } = await this.pool.query(roadQuery, [lat, lon]);
    if (roadRows.length > 0) {
      return {
        validation_status: "REJECTED",
        rejection_reason:
          roadRows[0].restriction_type === "PROHIBITED_TOLL_ROAD" ? "PROHIBITED_TOLL_ROAD" : "PROHIBITED_ROAD",
        road_name: roadRows[0].name,
      };
    }

    return { validation_status: "ALLOWED", rejection_reason: null, zone_name: zoneRows[0].name };
  }
}

export const spatialRestrictionService = SpatialRestrictionService.getInstance();
