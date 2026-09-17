import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pool } from "../config/database.js";
import { ZoneModel } from "../models/zoneModel.js";
import { zoneRepository } from "../repositories/zoneRepository.js";
import { SystemSettingModel } from "../models/systemSettingModel.js";
import { operationalRuleService } from "./operationalRuleService.js";
import { spatialRestrictionService } from "./spatial/SpatialRestrictionService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ZoneService {
  static instance = null;

  static getInstance() {
    if (!ZoneService.instance) {
      ZoneService.instance = new ZoneService();
    }
    return ZoneService.instance;
  }

  /**
   * Helper to check if a polygon intersects prohibited operational roads (protocol_roads table in PostGIS)
   * Uses GIST spatial index ST_Intersects returning structured road objects
   */
  async checkProhibitedRoadIntersection(polygonGeoJsonStr) {
    try {
      const query = `
        SELECT 
          pr.external_id AS id,
          pr.name,
          pr.highway_type,
          COALESCE(pr.restriction_type, 'PROHIBITED_ROAD') AS restriction_type
        FROM protocol_roads pr
        WHERE ST_Intersects(
          pr.geom,
          ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)
        );
      `;

      const { rows } = await pool.query(query, [polygonGeoJsonStr]);
      if (rows && rows.length > 0) {
        return rows.map((r) => ({
          id: r.id || "way/unknown",
          name: r.name || "Jalan Terlarang Operasional",
          highway_type: r.highway_type || "secondary",
          restriction_type: r.restriction_type || "PROHIBITED_ROAD",
        }));
      }
    } catch (e) {
      console.warn("⚠️ Warning checking prohibited road intersection with PostGIS:", e.message);
    }

    return null;
  }

  /**
   * Evaluates prohibited road intersection list and throws structured HTTP 409 errors (if BLOCKING)
   * or returns advisory warnings array (if ADVISORY)
   */
  async evaluateProhibitedRoadError(prohibitedRoads, isUpdate = false) {
    if (!prohibitedRoads || prohibitedRoads.length === 0) return null;

    const rules = await operationalRuleService.getOperationalRules();

    const blockingRoads = [];
    const advisoryRoads = [];

    for (const r of prohibitedRoads) {
      if (r.restriction_type === "PROHIBITED_TOLL_ROAD") {
        if (rules.toll_road_prohibited) {
          blockingRoads.push(r);
        } else {
          advisoryRoads.push(r);
        }
      } else {
        if (rules.protocol_road_prohibited) {
          blockingRoads.push(r);
        } else {
          advisoryRoads.push(r);
        }
      }
    }

    if (blockingRoads.length > 0) {
      const actionText = isUpdate ? "diperbarui" : "dibuat";
      const hasTollRoad = blockingRoads.some((r) => r.restriction_type === "PROHIBITED_TOLL_ROAD");
      const hasProtocolRoad = blockingRoads.some((r) => r.restriction_type === "PROHIBITED_ROAD");

      if (hasTollRoad && !hasProtocolRoad) {
        const roadNamesStr = blockingRoads.map((r) => r.name).filter(Boolean).join(", ");
        const roadLabel = roadNamesStr ? `Jalan Tol: ${roadNamesStr}` : "Jalan Tol";
        const error = new Error(
          `Zona tidak dapat ${actionText} karena memasuki area Jalan Tol (${roadLabel}). Kopi keliling dilarang beroperasi di area jalan tol.`
        );
        error.statusCode = 409;
        error.code = "ZONE_INTERSECTS_TOLL_ROAD";
        error.details = {
          restriction_type: "PROHIBITED_TOLL_ROAD",
          intersected_roads: blockingRoads,
        };
        throw error;
      }

      const roadNamesStr = blockingRoads.map((r) => r.name).filter(Boolean).join(", ");
      const roadLabel = roadNamesStr ? `Jalan Terlarang: ${roadNamesStr}` : "Jalan Terlarang Operasional";
      const error = new Error(
        `Zona tidak dapat ${actionText} karena memasuki area terlarang operasional (${roadLabel}).`
      );
      error.statusCode = 409;
      error.code = "ZONE_INTERSECTS_RESTRICTED_AREA";
      error.details = {
        restriction_type: hasTollRoad ? "PROHIBITED_ROAD_AND_TOLL" : "PROHIBITED_ROAD",
        intersected_roads: blockingRoads,
      };
      throw error;
    }

    // Build advisory warnings if advisoryRoads exist
    if (advisoryRoads.length > 0) {
      const warnings = [];
      const protocolAdv = advisoryRoads.filter((r) => r.restriction_type !== "PROHIBITED_TOLL_ROAD");
      const tollAdv = advisoryRoads.filter((r) => r.restriction_type === "PROHIBITED_TOLL_ROAD");

      if (protocolAdv.length > 0) {
        const namesStr = protocolAdv.map((r) => r.name).filter(Boolean).join(", ");
        warnings.push({
          type: "PROTOCOL_ROAD",
          severity: "WARNING",
          enforcement: "ADVISORY",
          message: `Zona bersinggungan dengan jalan protokol (${namesStr || "Jalan Protokol Utama"}).`,
        });
      }

      if (tollAdv.length > 0) {
        const namesStr = tollAdv.map((r) => r.name).filter(Boolean).join(", ");
        warnings.push({
          type: "TOLL_ROAD",
          severity: "WARNING",
          enforcement: "ADVISORY",
          message: `Zona bersinggungan dengan jalan tol (${namesStr || "Jalan Tol"}).`,
        });
      }

      return warnings;
    }

    return null;
  }

  /**
   * Get spatial hub configuration & operational bounds from system_settings
   */
  async getZoneConfig() {
    const hubCity = await SystemSettingModel.getByKey("HUB_CITY_NAME");
    const hubLat = await SystemSettingModel.getByKey("HUB_LATITUDE");
    const hubLng = await SystemSettingModel.getByKey("HUB_LONGITUDE");
    const hubBuffer = await SystemSettingModel.getByKey("HUB_BOUNDS_BUFFER");

    if (
      !hubCity?.value ||
      !hubCity.value.trim() ||
      !hubLat?.value ||
      !hubLng?.value ||
      !hubBuffer?.value
    ) {
      const error = new Error("Hub spatial configuration is incomplete in system_settings.");
      error.statusCode = 500;
      throw error;
    }

    const cityName = hubCity.value.trim();
    const latitude = Number(hubLat.value);
    const longitude = Number(hubLng.value);
    const boundsBuffer = Number(hubBuffer.value);

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      !Number.isFinite(boundsBuffer) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180 ||
      boundsBuffer <= 0
    ) {
      const error = new Error("Invalid hub spatial configuration in system_settings.");
      error.statusCode = 500;
      throw error;
    }

    const minLat = latitude - boundsBuffer;
    const maxLat = latitude + boundsBuffer;
    const minLng = longitude - boundsBuffer;
    const maxLng = longitude + boundsBuffer;

    return {
      hub_city_name: cityName,
      hub_latitude: latitude,
      hub_longitude: longitude,
      operational_bounds: {
        min_lat: minLat,
        max_lat: maxLat,
        min_lng: minLng,
        max_lng: maxLng,
      },
    };
  }

  /**
   * Helper to validate polygon format & coordinate count
   * @param {*} polygon 
   * @returns {string} Valid GeoJSON string
   */
  validateAndFormatPolygon(polygon) {
    if (!polygon) {
      const error = new Error("Polygon zona wajib diisi.");
      error.statusCode = 400;
      throw error;
    }

    const geoJsonStr = zoneRepository.formatPolygonToGeoJSON(polygon);
    if (!geoJsonStr) {
      const error = new Error("Format polygon tidak valid. Pastikan poligon memiliki minimal 3 titik koordinat.");
      error.statusCode = 400;
      throw error;
    }

    let parsed;
    try {
      parsed = JSON.parse(geoJsonStr);
    } catch (e) {
      const error = new Error("Gagal mem-parsing data polygon GeoJSON.");
      error.statusCode = 400;
      throw error;
    }

    const coordinates = parsed.coordinates?.[0] || [];
    // At least 4 points (3 unique points + 1 closing point)
    if (coordinates.length < 4) {
      const error = new Error("Polygon tidak valid. Pastikan poligon memiliki minimal 3 titik sudut.");
      error.statusCode = 400;
      throw error;
    }

    return geoJsonStr;
  }

  /**
   * Interactive Pre-Validation of Zone Polygon without modifying the database (Dry-run)
   */
  async preValidateZonePolygon({ polygon, name, excludeId = null }) {
    const errors = [];
    const warnings = [];
    let metrics = {
      area_km2: 0,
      max_distance_from_hub_km: 0,
    };

    try {
      const geoJsonStr = this.validateAndFormatPolygon(polygon);

      // 1. Check Prohibited Roads (Toll / Protocol) via PostGIS
      const prohibitedRoads = await this.checkProhibitedRoadIntersection(geoJsonStr);
      if (prohibitedRoads && prohibitedRoads.length > 0) {
        const tollRoads = prohibitedRoads.filter((r) => r.restriction_type === "PROHIBITED_TOLL_ROAD");
        const protocolRoads = prohibitedRoads.filter((r) => r.restriction_type !== "PROHIBITED_TOLL_ROAD");

        if (tollRoads.length > 0) {
          errors.push(
            `Zona memotong Jalan Tol (${tollRoads.map((r) => r.name).join(", ")}). Kopi keliling dilarang beroperasi di area tol.`
          );
        }
        if (protocolRoads.length > 0) {
          warnings.push(`Zona bersinggungan dengan Jalan Protokol (${protocolRoads.map((r) => r.name).join(", ")}).`);
        }
      }

      // 2. Check Overlap against other active zones in PostGIS
      const overlapZone = await ZoneModel.checkPolygonOverlap(geoJsonStr, excludeId);
      if (overlapZone) {
        errors.push(`Zona bertumpang tindih (overlap) dengan zona aktif lain ('${overlapZone.name}').`);
      }

      // 3. Check Duplicate Name if provided
      if (name && name.trim()) {
        const existing = await ZoneModel.findByName(name, excludeId);
        if (existing) {
          errors.push(`Nama zona '${name.trim()}' sudah digunakan.`);
        }
      }

      // 4. Calculate Area Size
      const queryArea = `
        SELECT ST_Area(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)::geography) / 1000000.0 AS area_km2;
      `;
      const { rows: areaRows } = await pool.query(queryArea, [geoJsonStr]);
      if (areaRows && areaRows.length > 0) {
        metrics.area_km2 = parseFloat(parseFloat(areaRows[0].area_km2 || "0").toFixed(3));
      }
    } catch (err) {
      errors.push(err.message || "Format geometri poligon tidak valid.");
    }

    return {
      is_valid: errors.length === 0,
      errors,
      warnings,
      metrics,
    };
  }

  /**
   * Get all zones with optional status and search filters
   */
  async getAllZones({ status, search } = {}) {
    const zones = await ZoneModel.findAll({ status, search });
    return {
      total: zones.length,
      zones,
    };
  }

  /**
   * Get a single zone by ID
   */
  async getZoneById(id) {
    if (!id) {
      const error = new Error("ID Zona wajib disertakan.");
      error.statusCode = 400;
      throw error;
    }

    const zone = await ZoneModel.findById(id);
    if (!zone) {
      const error = new Error(`Zona dengan ID '${id}' tidak ditemukan.`);
      error.statusCode = 404;
      throw error;
    }

    return zone;
  }

  /**
   * Create a new zone with PostGIS spatial validation
   */
  async createZone({ name, description = "", max_capacity = 10, status = "ACTIVE", polygon }) {
    if (!name || !name.trim()) {
      const error = new Error("Nama zona wajib diisi.");
      error.statusCode = 400;
      throw error;
    }

    const capacityNum = parseInt(max_capacity, 10);
    if (isNaN(capacityNum) || capacityNum < 1) {
      const error = new Error("Kapasitas maksimum harus berupa angka positif minimal 1.");
      error.statusCode = 400;
      throw error;
    }

    const validStatuses = ["ACTIVE", "RESTRICTED", "INACTIVE"];
    const normalizedStatus = (status || "ACTIVE").toUpperCase();
    if (!validStatuses.includes(normalizedStatus)) {
      const error = new Error("Status zona tidak valid. Pilihan: ACTIVE, RESTRICTED, INACTIVE.");
      error.statusCode = 400;
      throw error;
    }

    // Check duplicate name
    const existingName = await ZoneModel.findByName(name);
    if (existingName) {
      const error = new Error(`Zona dengan nama '${name.trim()}' sudah terdaftar. Silakan gunakan nama lain.`);
      error.statusCode = 400;
      throw error;
    }

    // Validate polygon geometry
    const geoJsonStr = this.validateAndFormatPolygon(polygon);
    const parsedGeoJson = JSON.parse(geoJsonStr);

    let warnings = null;

    // Check spatial restriction & overlap with existing active zones in PostGIS
    if (normalizedStatus !== "INACTIVE") {
      const prohibitedRoads = await this.checkProhibitedRoadIntersection(geoJsonStr);
      warnings = await this.evaluateProhibitedRoadError(prohibitedRoads, false);

      const overlapZone = await ZoneModel.checkPolygonOverlap(geoJsonStr, null);
      if (overlapZone) {
        const error = new Error(
          `Zona tidak dapat dibuat karena bertumpang tindih (overlap) dengan zona lain ('${overlapZone.name}').`
        );
        error.statusCode = 400;
        throw error;
      }
    }

    const newZone = await ZoneModel.create({
      name: name.trim(),
      description,
      max_capacity: capacityNum,
      status: normalizedStatus,
      polygon: parsedGeoJson,
    });

    if (warnings && warnings.length > 0) {
      return { ...newZone, warnings };
    }

    return newZone;
  }

  /**
   * Update full zone data (Name, Description, Capacity, Status, Polygon)
   */
  async updateZone(id, { name, description, max_capacity, status, polygon }) {
    const zone = await this.getZoneById(id);

    const updatePayload = {};

    if (name !== undefined) {
      if (!name.trim()) {
        const error = new Error("Nama zona tidak boleh kosong.");
        error.statusCode = 400;
        throw error;
      }
      const existingName = await ZoneModel.findByName(name, id);
      if (existingName) {
        const error = new Error(`Zona dengan nama '${name.trim()}' sudah digunakan oleh zona lain.`);
        error.statusCode = 400;
        throw error;
      }
      updatePayload.name = name.trim();
    }

    if (description !== undefined) {
      updatePayload.description = description;
    }

    if (max_capacity !== undefined) {
      const capacityNum = parseInt(max_capacity, 10);
      if (isNaN(capacityNum) || capacityNum < 1) {
        const error = new Error("Kapasitas maksimum harus berupa angka positif minimal 1.");
        error.statusCode = 400;
        throw error;
      }
      updatePayload.max_capacity = capacityNum;
    }

    if (status !== undefined) {
      const validStatuses = ["ACTIVE", "RESTRICTED", "INACTIVE"];
      const normalizedStatus = status.toUpperCase();
      if (!validStatuses.includes(normalizedStatus)) {
        const error = new Error("Status zona tidak valid. Pilihan: ACTIVE, RESTRICTED, INACTIVE.");
        error.statusCode = 400;
        throw error;
      }

      // If deactivating, verify if active riders are in this zone
      if (normalizedStatus === "INACTIVE") {
        const activeRiders = await ZoneModel.countActiveRiders(id);
        if (activeRiders > 0) {
          const error = new Error(
            `Tidak dapat menonaktifkan zona '${zone.name}' karena masih ada ${activeRiders} Rider yang sedang aktif beroperasi.`
          );
          error.statusCode = 400;
          throw error;
        }
      }

      updatePayload.status = normalizedStatus;
    }

    let warnings = null;

    if (polygon !== undefined) {
      const geoJsonStr = this.validateAndFormatPolygon(polygon);
      const parsedGeoJson = JSON.parse(geoJsonStr);

      const targetStatus = updatePayload.status || zone.status;
      if (targetStatus !== "INACTIVE") {
        const prohibitedRoads = await this.checkProhibitedRoadIntersection(geoJsonStr);
        warnings = await this.evaluateProhibitedRoadError(prohibitedRoads, true);

        const overlapZone = await ZoneModel.checkPolygonOverlap(geoJsonStr, id);
        if (overlapZone) {
          const error = new Error(
            `Zona tidak dapat diperbarui karena bertumpang tindih (overlap) dengan zona lain ('${overlapZone.name}').`
          );
          error.statusCode = 400;
          throw error;
        }
      }

      updatePayload.polygon = parsedGeoJson;
    }

    const updatedZone = await ZoneModel.update(id, updatePayload);

    if (warnings && warnings.length > 0) {
      return { ...updatedZone, warnings };
    }

    return updatedZone;
  }

  /**
   * Quick Edit: Update Zone Status
   */
  async updateZoneStatus(id, status) {
    const zone = await this.getZoneById(id);

    const validStatuses = ["ACTIVE", "RESTRICTED", "INACTIVE"];
    const normalizedStatus = (status || "").toUpperCase();
    if (!validStatuses.includes(normalizedStatus)) {
      const error = new Error("Status zona tidak valid. Pilihan: ACTIVE, RESTRICTED, INACTIVE.");
      error.statusCode = 400;
      throw error;
    }

    if (normalizedStatus === "INACTIVE") {
      const activeRiders = await ZoneModel.countActiveRiders(id);
      if (activeRiders > 0) {
        const error = new Error(
          `Tidak dapat menonaktifkan zona '${zone.name}' karena masih ada ${activeRiders} Rider yang sedang aktif beroperasi.`
        );
        error.statusCode = 400;
        throw error;
      }
    }

    const updated = await ZoneModel.updateStatus(id, normalizedStatus);
    return updated;
  }

  /**
   * Quick Edit: Update Zone Max Capacity
   */
  async updateZoneCapacity(id, max_capacity) {
    await this.getZoneById(id);

    const capacityNum = parseInt(max_capacity, 10);
    if (isNaN(capacityNum) || capacityNum < 1) {
      const error = new Error("Kapasitas maksimum harus berupa angka positif minimal 1.");
      error.statusCode = 400;
      throw error;
    }

    const updated = await ZoneModel.updateCapacity(id, capacityNum);
    return updated;
  }

  /**
   * Delete a zone by ID with safety checks
   */
  async deleteZone(id) {
    const zone = await this.getZoneById(id);

    const activeRiders = await ZoneModel.countActiveRiders(id);
    if (activeRiders > 0) {
      const error = new Error(
        `Zona '${zone.name}' tidak dapat dihapus karena terdapat ${activeRiders} Rider yang sedang aktif beroperasi (check-in).`
      );
      error.statusCode = 400;
      throw error;
    }

    const deleted = await ZoneModel.delete(id);
    return deleted;
  }

  /**
   * PostGIS Scalable Zone Status Re-Evaluation when Operational Rules Change
   * Incorporates User Refinements 2 & 3:
   * - Uses PostGIS ST_Intersects spatial query to select ONLY zones potentially affected by changed rule restrictions.
   * - Sets status to RESTRICTED if any active blocking restriction intersects it.
   * - Sets status to ACTIVE ONLY if ZERO active blocking restrictions intersect it (Multi-reason safety).
   */
  async reevaluateAffectedZonesForOperationalRules(previousRules, newRules) {
    const affectedRestrictionTypes = [];
    if (previousRules.protocol_road_prohibited !== newRules.protocol_road_prohibited) {
      affectedRestrictionTypes.push("PROHIBITED_ROAD");
    }
    if (previousRules.toll_road_prohibited !== newRules.toll_road_prohibited) {
      affectedRestrictionTypes.push("PROHIBITED_TOLL_ROAD");
    }

    if (affectedRestrictionTypes.length === 0) {
      return { total_reevaluated: 0, newly_restricted: 0, restored_active: 0 };
    }

    // Scalable PostGIS Query: Fetch ONLY non-INACTIVE zones intersecting affected restriction layers
    const query = `
      SELECT DISTINCT z.id, z.name, z.status, z.polygon, z.invalid_reason
      FROM zones z
      JOIN protocol_roads pr 
        ON ST_Intersects(COALESCE(z.geom, ST_SetSRID(ST_GeomFromGeoJSON(z.polygon::text), 4326)), pr.geom)
      WHERE z.status != 'INACTIVE'
        AND COALESCE(pr.restriction_type, 'PROHIBITED_ROAD') = ANY($1::varchar[]);
    `;

    const { rows: affectedZones } = await pool.query(query, [affectedRestrictionTypes]);

    let newlyRestricted = 0;
    let restoredActive = 0;

    for (const z of affectedZones) {
      const geoJsonStr = JSON.stringify(z.polygon);
      const intersectedRoads = await this.checkProhibitedRoadIntersection(geoJsonStr);

      const activeBlockingRoads = (intersectedRoads || []).filter((r) => {
        if (r.restriction_type === "PROHIBITED_TOLL_ROAD") {
          return newRules.toll_road_prohibited;
        }
        return newRules.protocol_road_prohibited;
      });

      let targetStatus = z.status;
      let targetInvalidReason = z.invalid_reason || null;

      if (activeBlockingRoads.length > 0) {
        targetStatus = "RESTRICTED";
        const mainRestriction = activeBlockingRoads[0];
        targetInvalidReason = {
          type: mainRestriction.restriction_type,
          code:
            mainRestriction.restriction_type === "PROHIBITED_TOLL_ROAD"
              ? "ZONE_INTERSECTS_TOLL_ROAD"
              : "ZONE_INTERSECTS_RESTRICTED_AREA",
          detected_at: new Date().toISOString(),
          intersected_roads: activeBlockingRoads,
        };
        if (z.status !== "RESTRICTED") newlyRestricted++;
      } else {
        // Only restore to ACTIVE if ZERO active blocking restrictions remain!
        targetStatus = "ACTIVE";
        targetInvalidReason = null;
        if (z.status === "RESTRICTED") restoredActive++;
      }

      await pool.query(
        "UPDATE zones SET status = $1, invalid_reason = $2::jsonb, updated_at = CURRENT_TIMESTAMP WHERE id = $3;",
        [targetStatus, targetInvalidReason ? JSON.stringify(targetInvalidReason) : null, z.id]
      );
    }

    return {
      total_reevaluated: affectedZones.length,
      newly_restricted: newlyRestricted,
      restored_active: restoredActive,
    };
  }

  /**
   * Dry-Run Spatial Validation for Zone Polygon via SpatialRestrictionService (SSOT)
   */
  async preValidateZonePolygon(polygon, excludeZoneId = null) {
    return await spatialRestrictionService.validateZonePolygon(polygon, excludeZoneId);
  }
}

export const zoneService = ZoneService.getInstance();

