/*
 * zoneService.ts
 * Zone Management & Spatial Validation Service in TypeScript
 */

import { pool } from "../config/database.js";
import { ZoneModel } from "../models/zoneModel.js";
import { zoneRepository } from "../repositories/zoneRepository.js";
import { SystemSettingModel } from "../models/systemSettingModel.js";
import { operationalRuleService } from "./operationalRuleService.js";
import { operationalContextService } from "./spatial/OperationalContextService.js";

export class ZoneService {
  private static instance: ZoneService | null = null;

  public static getInstance(): ZoneService {
    if (!ZoneService.instance) {
      ZoneService.instance = new ZoneService();
    }
    return ZoneService.instance;
  }

  /**
   * Helper to check if a polygon intersects prohibited operational roads
   */
  public async checkProhibitedRoadIntersection(polygonGeoJsonStr: string): Promise<any[] | null> {
    try {
      const query = `
        SELECT 
          pr.external_id AS id,
          pr.name,
          pr.highway_type,
          COALESCE(pr.restriction_type, 'PROHIBITED_ROAD') AS restriction_type
        FROM protocol_roads pr
        WHERE (pr.is_active = true OR pr.is_active IS NULL)
          AND ST_Intersects(
            pr.geom,
            ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)
          );
      `;

      const { rows } = await pool.query(query, [polygonGeoJsonStr]);
      if (rows && rows.length > 0) {
        return rows.map((r: any) => ({
          id: r.id || "way/unknown",
          name: r.name || "Jalan Terlarang Operasional",
          highway_type: r.highway_type || "secondary",
          restriction_type: r.restriction_type || "PROHIBITED_ROAD",
        }));
      }
    } catch (e: any) {
      console.warn("⚠️ Warning checking prohibited road intersection with PostGIS:", e.message);
    }

    return null;
  }

  /**
   * Evaluates prohibited road intersection list and throws structured HTTP 409 errors (if BLOCKING)
   * or returns advisory warnings array (if ADVISORY)
   */
  public async evaluateProhibitedRoadError(prohibitedRoads: any[] | null, isUpdate: boolean = false): Promise<any[] | null> {
    if (!prohibitedRoads || prohibitedRoads.length === 0) return null;

    const rules = await operationalRuleService.getOperationalRules();

    const blockingRoads: any[] = [];
    const advisoryRoads: any[] = [];

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
        const error: any = new Error(
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
      const error: any = new Error(
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

    if (advisoryRoads.length > 0) {
      const warnings: any[] = [];
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
  public async getZoneConfig(): Promise<{
    hub_city_name: string;
    hub_latitude: number;
    hub_longitude: number;
    operational_bounds: {
      min_lat: number;
      max_lat: number;
      min_lng: number;
      max_lng: number;
    };
  }> {
    const opContext = await operationalContextService.getOperationalContext();
    const hubBuffer = await SystemSettingModel.getByKey("HUB_BOUNDS_BUFFER");

    const cityName = opContext.hubCityName;
    const latitude = opContext.latitude;
    const longitude = opContext.longitude;
    const boundsBuffer = Number(hubBuffer?.value || "0.25");

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
      const error: any = new Error("Invalid hub spatial configuration in system_settings.");
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
   */
  public validateAndFormatPolygon(polygon: any): string {
    if (!polygon) {
      const error: any = new Error("Polygon zona wajib diisi.");
      error.statusCode = 400;
      throw error;
    }

    const geoJsonStr = zoneRepository.formatPolygonToGeoJSON(polygon);
    if (!geoJsonStr) {
      const error: any = new Error("Format polygon tidak valid. Pastikan poligon memiliki minimal 3 titik koordinat.");
      error.statusCode = 400;
      throw error;
    }

    let parsed: any;
    try {
      parsed = JSON.parse(geoJsonStr);
    } catch (e) {
      const error: any = new Error("Gagal mem-parsing data polygon GeoJSON.");
      error.statusCode = 400;
      throw error;
    }

    const coordinates = parsed.coordinates?.[0] || [];
    if (coordinates.length < 4) {
      const error: any = new Error("Polygon tidak valid. Pastikan poligon memiliki minimal 3 titik sudut.");
      error.statusCode = 400;
      throw error;
    }

    return geoJsonStr;
  }

  /**
   * Get all zones with optional status and search filters
   */
  public async getAllZones({ status, search }: { status?: string; search?: string } = {}): Promise<{ total: number; zones: any[] }> {
    const zones = await ZoneModel.findAll({ status, search });
    return {
      total: zones.length,
      zones,
    };
  }

  /**
   * Get a single zone by ID
   */
  public async getZoneById(id: number | string): Promise<any> {
    if (!id) {
      const error: any = new Error("ID Zona wajib disertakan.");
      error.statusCode = 400;
      throw error;
    }

    const zone = await ZoneModel.findById(id);
    if (!zone) {
      const error: any = new Error(`Zona dengan ID '${id}' tidak ditemukan.`);
      error.statusCode = 404;
      throw error;
    }

    return zone;
  }

  /**
   * Check if a polygon is within the operational coverage radius from Central Hub
   */
  public async checkOperationalCoverage(polygonGeoJsonStr: string): Promise<{
    is_within_radius: boolean;
    max_distance_km: number;
    radius_limit_km: number;
    hub_name: string;
    area_km2: number;
  }> {
    const opContext = await operationalContextService.getOperationalContext();
    const hubLat = opContext.latitude;
    const hubLng = opContext.longitude;
    const radiusKm = opContext.radiusKm;
    const hubName = opContext.centralHubName;

    const query = `
      SELECT 
        ST_MaxDistance(
          ST_SetSRID(ST_GeomFromGeoJSON($1), 4326),
          ST_SetSRID(ST_MakePoint($2, $3), 4326)
        ) * 111.32 AS max_distance_km,
        ST_Area(
          ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)::geography
        ) / 1000000.0 AS area_km2;
    `;
    const { rows } = await pool.query(query, [polygonGeoJsonStr, hubLng, hubLat]);
    const maxDistance = parseFloat(rows[0]?.max_distance_km || "0");
    const areaKm2 = parseFloat(rows[0]?.area_km2 || "0");

    const isWithin = maxDistance <= radiusKm;
    return {
      is_within_radius: isWithin,
      max_distance_km: maxDistance,
      radius_limit_km: radiusKm,
      hub_name: hubName,
      area_km2: areaKm2,
    };
  }

  /**
   * Interactive Pre-Validation of Zone Polygon without modifying the database
   */
  public async preValidateZonePolygon({
    polygon,
    name,
    excludeId = null,
  }: {
    polygon: any;
    name?: string;
    excludeId?: string | number | null;
  }): Promise<{
    is_valid: boolean;
    errors: string[];
    warnings: string[];
    metrics: {
      area_km2: number;
      max_distance_from_hub_km: number;
      radius_limit_km: number;
    };
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let metrics = {
      area_km2: 0,
      max_distance_from_hub_km: 0,
      radius_limit_km: 12,
    };

    try {
      const geoJsonStr = this.validateAndFormatPolygon(polygon);

      // 1. Check Operational Coverage
      const coverage = await this.checkOperationalCoverage(geoJsonStr);
      metrics = {
        area_km2: parseFloat(coverage.area_km2.toFixed(3)),
        max_distance_from_hub_km: parseFloat(coverage.max_distance_km.toFixed(2)),
        radius_limit_km: coverage.radius_limit_km,
      };

      if (!coverage.is_within_radius) {
        errors.push(
          `Sebagian area zona berada di luar batas operasional (${coverage.max_distance_km.toFixed(1)} KM dari ${coverage.hub_name}, batas maksimal: ${coverage.radius_limit_km} KM).`
        );
      }

      // 2. Check Prohibited Roads (Toll / Protocol)
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

      // 3. Check Overlap against other active zones
      const overlapZone = await ZoneModel.checkPolygonOverlap(geoJsonStr, excludeId);
      if (overlapZone) {
        errors.push(`Zona bertumpang tindih (overlap) dengan zona aktif lain ('${overlapZone.name}').`);
      }

      // 4. Check Duplicate Name if provided
      if (name && name.trim()) {
        const existing = await ZoneModel.findByName(name, excludeId);
        if (existing) {
          errors.push(`Nama zona '${name.trim()}' sudah digunakan.`);
        }
      }
    } catch (err: any) {
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
   * Create a new zone with full spatial validation (Coverage, Toll Roads, Overlap)
   */
  public async createZone({
    name,
    description = "",
    max_capacity = 10,
    status = "ACTIVE",
    polygon,
  }: {
    name: string;
    description?: string;
    max_capacity?: number;
    status?: string;
    polygon: any;
  }): Promise<any> {
    if (!name || !name.trim()) {
      const error: any = new Error("Nama zona wajib diisi.");
      error.statusCode = 400;
      throw error;
    }

    const capacityNum = parseInt(String(max_capacity), 10);
    if (isNaN(capacityNum) || capacityNum < 1) {
      const error: any = new Error("Kapasitas maksimum harus berupa angka positif minimal 1.");
      error.statusCode = 400;
      throw error;
    }

    const validStatuses = ["ACTIVE", "RESTRICTED", "INACTIVE"];
    const normalizedStatus = (status || "ACTIVE").toUpperCase();
    if (!validStatuses.includes(normalizedStatus)) {
      const error: any = new Error("Status zona tidak valid. Pilihan: ACTIVE, RESTRICTED, INACTIVE.");
      error.statusCode = 400;
      throw error;
    }

    const existingName = await ZoneModel.findByName(name);
    if (existingName) {
      const error: any = new Error(`Zona dengan nama '${name.trim()}' sudah terdaftar. Silakan gunakan nama lain.`);
      error.statusCode = 400;
      throw error;
    }

    const geoJsonStr = this.validateAndFormatPolygon(polygon);
    const parsedGeoJson = JSON.parse(geoJsonStr);

    let warnings: any[] | null = null;

    if (normalizedStatus !== "INACTIVE") {
      // 1. Operational Coverage Validation
      const coverage = await this.checkOperationalCoverage(geoJsonStr);
      if (!coverage.is_within_radius) {
        const error: any = new Error(
          `Zona tidak dapat dibuat karena berada di luar area operasional (${coverage.max_distance_km.toFixed(1)} KM dari ${coverage.hub_name}, batas maksimal: ${coverage.radius_limit_km} KM).`
        );
        error.statusCode = 400;
        error.code = "ZONE_EXCEEDS_OPERATIONAL_AREA";
        throw error;
      }

      // 2. Road Restriksi Validation
      const prohibitedRoads = await this.checkProhibitedRoadIntersection(geoJsonStr);
      warnings = await this.evaluateProhibitedRoadError(prohibitedRoads, false);

      // 3. Overlap Validation
      const overlapZone = await ZoneModel.checkPolygonOverlap(geoJsonStr, null);
      if (overlapZone) {
        const error: any = new Error(
          `Zona tidak dapat dibuat karena bertumpang tindih (overlap) dengan zona lain ('${overlapZone.name}').`
        );
        error.statusCode = 400;
        error.code = "ZONE_OVERLAPS_EXISTING_ZONE";
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
   * Update full zone data
   */
  public async updateZone(
    id: number | string,
    {
      name,
      description,
      max_capacity,
      status,
      polygon,
    }: {
      name?: string;
      description?: string;
      max_capacity?: number;
      status?: string;
      polygon?: any;
    }
  ): Promise<any> {
    const zone = await this.getZoneById(id);

    const updatePayload: any = {};

    if (name !== undefined) {
      if (!name.trim()) {
        const error: any = new Error("Nama zona tidak boleh kosong.");
        error.statusCode = 400;
        throw error;
      }
      const existingName = await ZoneModel.findByName(name, id);
      if (existingName) {
        const error: any = new Error(`Zona dengan nama '${name.trim()}' sudah digunakan oleh zona lain.`);
        error.statusCode = 400;
        throw error;
      }
      updatePayload.name = name.trim();
    }

    if (description !== undefined) {
      updatePayload.description = description;
    }

    if (max_capacity !== undefined) {
      const capacityNum = parseInt(String(max_capacity), 10);
      if (isNaN(capacityNum) || capacityNum < 1) {
        const error: any = new Error("Kapasitas maksimum harus berupa angka positif minimal 1.");
        error.statusCode = 400;
        throw error;
      }
      updatePayload.max_capacity = capacityNum;
    }

    if (status !== undefined) {
      const validStatuses = ["ACTIVE", "RESTRICTED", "INACTIVE"];
      const normalizedStatus = status.toUpperCase();
      if (!validStatuses.includes(normalizedStatus)) {
        const error: any = new Error("Status zona tidak valid. Pilihan: ACTIVE, RESTRICTED, INACTIVE.");
        error.statusCode = 400;
        throw error;
      }

      if (normalizedStatus === "INACTIVE") {
        const activeRiders = await ZoneModel.countActiveRiders(id);
        if (activeRiders > 0) {
          const error: any = new Error(
            `Tidak dapat menonaktifkan zona '${zone.name}' karena masih ada ${activeRiders} Rider yang sedang aktif beroperasi.`
          );
          error.statusCode = 400;
          throw error;
        }
      }

      updatePayload.status = normalizedStatus;
    }

    let warnings: any[] | null = null;

    if (polygon !== undefined) {
      const geoJsonStr = this.validateAndFormatPolygon(polygon);
      const parsedGeoJson = JSON.parse(geoJsonStr);

      const targetStatus = updatePayload.status || zone.status;
      if (targetStatus !== "INACTIVE") {
        // 1. Operational Coverage Validation
        const coverage = await this.checkOperationalCoverage(geoJsonStr);
        if (!coverage.is_within_radius) {
          const error: any = new Error(
            `Zona tidak dapat diperbarui karena berada di luar area operasional (${coverage.max_distance_km.toFixed(1)} KM dari ${coverage.hub_name}, batas maksimal: ${coverage.radius_limit_km} KM).`
          );
          error.statusCode = 400;
          error.code = "ZONE_EXCEEDS_OPERATIONAL_AREA";
          throw error;
        }

        // 2. Road Restriksi Validation
        const prohibitedRoads = await this.checkProhibitedRoadIntersection(geoJsonStr);
        warnings = await this.evaluateProhibitedRoadError(prohibitedRoads, true);

        // 3. Overlap Validation
        const overlapZone = await ZoneModel.checkPolygonOverlap(geoJsonStr, id);
        if (overlapZone) {
          const error: any = new Error(
            `Zona tidak dapat diperbarui karena bertumpang tindih (overlap) dengan zona lain ('${overlapZone.name}').`
          );
          error.statusCode = 400;
          error.code = "ZONE_OVERLAPS_EXISTING_ZONE";
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
  public async updateZoneStatus(id: number | string, status: string): Promise<any> {
    const zone = await this.getZoneById(id);

    const validStatuses = ["ACTIVE", "RESTRICTED", "INACTIVE"];
    const normalizedStatus = (status || "").toUpperCase();
    if (!validStatuses.includes(normalizedStatus)) {
      const error: any = new Error("Status zona tidak valid. Pilihan: ACTIVE, RESTRICTED, INACTIVE.");
      error.statusCode = 400;
      throw error;
    }

    if (normalizedStatus === "INACTIVE") {
      const activeRiders = await ZoneModel.countActiveRiders(id);
      if (activeRiders > 0) {
        const error: any = new Error(
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
  public async updateZoneCapacity(id: number | string, max_capacity: number | string): Promise<any> {
    await this.getZoneById(id);

    const capacityNum = parseInt(String(max_capacity), 10);
    if (isNaN(capacityNum) || capacityNum < 1) {
      const error: any = new Error("Kapasitas maksimum harus berupa angka positif minimal 1.");
      error.statusCode = 400;
      throw error;
    }

    const updated = await ZoneModel.updateCapacity(id, capacityNum);
    return updated;
  }

  /**
   * Delete a zone by ID with safety checks
   */
  public async deleteZone(id: number | string): Promise<any> {
    const zone = await this.getZoneById(id);

    const activeRiders = await ZoneModel.countActiveRiders(id);
    if (activeRiders > 0) {
      const error: any = new Error(
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
   */
  public async reevaluateAffectedZonesForOperationalRules(
    previousRules: { protocol_road_prohibited: boolean; toll_road_prohibited: boolean },
    newRules: { protocol_road_prohibited: boolean; toll_road_prohibited: boolean }
  ): Promise<{ total_reevaluated: number; newly_restricted: number; restored_active: number }> {
    const affectedRestrictionTypes: string[] = [];
    if (previousRules.protocol_road_prohibited !== newRules.protocol_road_prohibited) {
      affectedRestrictionTypes.push("PROHIBITED_ROAD");
    }
    if (previousRules.toll_road_prohibited !== newRules.toll_road_prohibited) {
      affectedRestrictionTypes.push("PROHIBITED_TOLL_ROAD");
    }

    if (affectedRestrictionTypes.length === 0) {
      return { total_reevaluated: 0, newly_restricted: 0, restored_active: 0 };
    }

    const query = `
      SELECT DISTINCT z.id, z.name, z.status, z.polygon, z.invalid_reason
      FROM zones z
      JOIN protocol_roads pr 
        ON ST_Intersects(ST_SetSRID(ST_GeomFromGeoJSON(z.polygon::text), 4326), pr.geom)
      WHERE z.status != 'INACTIVE'
        AND COALESCE(pr.restriction_type, 'PROHIBITED_ROAD') = ANY($1::varchar[]);
    `;

    const { rows: affectedZones } = await pool.query(query, [affectedRestrictionTypes]);

    let newlyRestricted = 0;
    let restoredActive = 0;

    for (const z of affectedZones) {
      const geoJsonStr = JSON.stringify(z.polygon);
      const intersectedRoads = await this.checkProhibitedRoadIntersection(geoJsonStr);

      const activeBlockingRoads = (intersectedRoads || []).filter((r: any) => {
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
}

export const zoneService = ZoneService.getInstance();
