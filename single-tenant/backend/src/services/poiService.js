/*
 *   Copyright (c) 2026 
 *   All rights reserved.
 *   POIEltPipelineService & POI Domain Orchestrator (Clean Architecture OOP)
 */

import fs from "fs";
import path from "path";
import { pool } from "../config/database.js";
import { SystemSettingModel } from "../models/systemSettingModel.js";
import { PoiCategoryModel } from "../models/poiCategoryModel.js";
import { ZoneModel } from "../models/zoneModel.js";
import { overpassApiClient } from "../utils/overpassClient.js";
import { poiClusterer } from "./poi/POIClusterer.js";
import { spatialDeduplicator } from "./poi/SpatialDeduplicator.js";
import { poiEntityFactory } from "./poi/POIEntityFactory.js";
import { poiRawRepository } from "../repositories/poiRawRepository.js";
import { poiRepository } from "../repositories/poiRepository.js";
import { syncRunRepository } from "../repositories/syncRunRepository.js";

/**
 * POI ELT Pipeline Service (Clean Architecture OOP Orchestrator)
 */
export class POIEltPipelineService {
  constructor(
    overpassClient = overpassApiClient,
    clusterer = poiClusterer,
    deduplicator = spatialDeduplicator,
    factory = poiEntityFactory,
    rawRepo = poiRawRepository,
    repo = poiRepository,
    syncRunRepo = syncRunRepository
  ) {
    this.overpassClient = overpassClient;
    this.clusterer = clusterer;
    this.deduplicator = deduplicator;
    this.factory = factory;
    this.rawRepo = rawRepo;
    this.repo = repo;
    this.syncRunRepo = syncRunRepo;
  }

  /**
   * Helper to resolve active city name from System Settings
   */
  async getActiveHubCity(hubCityOverride = null) {
    let hubCity = hubCityOverride;
    if (!hubCity) {
      const citySetting = await SystemSettingModel.getByKey("HUB_CITY_NAME");
      hubCity = citySetting?.value || citySetting?.setting_value || "Sidoarjo";
    }
    return String(hubCity).replace(/["\\]/g, "").trim() || "Sidoarjo";
  }

  /**
   * ELT STAGE 1: Extract from Overpass API & Load to pois_raw Staging Table
   */
  async fetchAndStoreRawPois(hubCityOverride = null) {
    const hubCity = await this.getActiveHubCity(hubCityOverride);

    const query = `
      [out:json][timeout:300];
      area["name"="${hubCity}"]["admin_level"="5"]->.searchArea;
      (
        nwr["amenity"](area.searchArea); nwr["shop"](area.searchArea);
        nwr["leisure"](area.searchArea); nwr["office"](area.searchArea);
        nwr["tourism"](area.searchArea); nwr["healthcare"](area.searchArea);
        nwr["historic"](area.searchArea); nwr["landuse"="cemetery"](area.searchArea);
      );
      out center;
    `;

    let overpassData = [];
    try {
      overpassData = await this.overpassClient.fetchOverpassData(query);
    } catch (err) {
      console.warn("⚠️ Error Overpass API admin_level=5:", err.message);
    }

    if (!overpassData || overpassData.length === 0) {
      console.warn("⚠️ Query admin_level=5 tidak mengembalikan data, mencoba fallback query nama kota standar...");
      const fallbackQuery = `
        [out:json][timeout:300];
        area["name"="${hubCity}"]->.searchArea;
        (
          nwr["amenity"](area.searchArea); nwr["shop"](area.searchArea);
          nwr["leisure"](area.searchArea); nwr["office"](area.searchArea);
          nwr["tourism"](area.searchArea); nwr["healthcare"](area.searchArea);
          nwr["historic"](area.searchArea); nwr["landuse"="cemetery"](area.searchArea);
        );
        out center;
      `;
      try {
        overpassData = await this.overpassClient.fetchOverpassData(fallbackQuery);
      } catch (err2) {
        console.warn("⚠️ Error Overpass API standard query:", err2.message);
      }
    }

    if (!overpassData || overpassData.length === 0) {
      console.warn("⚠️ Overpass API gagal/tidak mengembalikan data, mencoba fallback ke snapshot lokal 'poi_snapshot.geojson'...");
      const localPath = path.resolve(process.cwd(), "public/geojson/poi_snapshot.geojson");
      if (fs.existsSync(localPath)) {
        const raw = fs.readFileSync(localPath, "utf8");
        const parsed = JSON.parse(raw);
        const feats = parsed.features || [];
        overpassData = feats.map((f, idx) => ({
          type: "node",
          id: f.properties?.osm_id || idx + 1000000,
          lat: f.geometry?.coordinates?.[1] || 0,
          lon: f.geometry?.coordinates?.[0] || 0,
          tags: {
            name: f.properties?.name || "POI",
            amenity: f.properties?.category || "cafe",
            ...f.properties,
          },
        }));
      }
    }

    await this.rawRepo.saveRawData(hubCity, overpassData || []);
    console.log(`✅ Staging ELT Phase 1 (Extract & Load): ${(overpassData || []).length} raw Overpass elements berhasil disimpan ke pois_raw (${hubCity}).`);
    return { count: (overpassData || []).length, city: hubCity };
  }

  /**
   * ELT STAGE 2: Transform Staging Data from pois_raw & Bulk Upsert to Master pois Table
   */
  async processAndSyncPois(hubCityOverride = null) {
    const hubCity = await this.getActiveHubCity(hubCityOverride);
    const rawData = await this.rawRepo.findRawDataByCity(hubCity);

    if (!rawData) {
      const error = new Error("Data staging belum tersedia di database (pois_raw). Jalankan sync-osm (Extract & Load) terlebih dahulu.");
      error.statusCode = 404;
      throw error;
    }

    // 1. Transform raw elements to POI DTOs via Factory
    const transformedPois = rawData
      .map((el) => this.factory.createFromOverpassElement(el, this.clusterer))
      .filter((poi) => poi.category !== "IGNORED" && !isNaN(poi.latitude) && !isNaN(poi.longitude));

    // 2. Spatial Deduplication (<=15m Haversine Threshold)
    const deduplicatedPois = this.deduplicator.deduplicate(transformedPois, 15);

    // 3. Bulk Upsert to Master pois table via Repository
    const insertedPois = await this.repo.syncCityPoisWithTransaction(deduplicatedPois);

    return {
      message: "Data POI berhasil ditransformasi dan disinkronkan ke Master Database (Staging ELT Pipeline)",
      count: insertedPois.length,
      city: hubCity,
    };
  }

  /**
   * Full City Sync (Run Stage 1 & Stage 2 in sequence with Provenance Audit)
   */
  async syncCityPois(hubCityOverride = null) {
    const hubCity = await this.getActiveHubCity(hubCityOverride);
    const run = await this.syncRunRepo.startRun({
      data_type: "POI",
      source: "OVERPASS_API",
      metadata: { city: hubCity },
    });

    try {
      const stage1 = await this.fetchAndStoreRawPois(hubCity);
      const stage2 = await this.processAndSyncPois(hubCity);

      await this.syncRunRepo.completeRun(run.id, {
        records_fetched: stage1.count || 0,
        records_processed: stage2.count || 0,
        records_rejected: (stage1.count || 0) - (stage2.count || 0),
        metadata: { city: hubCity, message: stage2.message },
      });

      return stage2;
    } catch (error) {
      await this.syncRunRepo.failRun(run.id, error.message, { city: hubCity });
      throw error;
    }
  }

  /**
   * Re-cluster existing Master pois table in-memory without contacting Overpass API
   */
  async reclusterExistingPois() {
    const allPois = await this.repo.findAll();
    const updates = [];
    const deleteIds = [];

    for (const poi of allPois) {
      const mockTags = { ...(poi.metadata || {}), name: poi.name };
      const newCategory = this.clusterer.cluster(mockTags);

      if (newCategory === "IGNORED") {
        deleteIds.push(poi.id);
      } else if (newCategory !== poi.category) {
        updates.push({
          id: poi.id,
          name: poi.name,
          category: newCategory,
        });
      }
    }

    const result = await this.repo.reclusterExistingPoisWithTransaction(updates, deleteIds);
    return {
      message: "Re-clustering kategori POI berbasis database berhasil diproses.",
      updatedCount: result.updatedCount,
      deletedCount: result.deletedCount,
      totalChecked: allPois.length,
    };
  }

  /**
   * Fetch POIs by Zone Polygon
   */
  async getPoisByZone(zoneId) {
    const zone = await ZoneModel.findById(zoneId);
    if (!zone) {
      const error = new Error("Zona tidak ditemukan");
      error.statusCode = 404;
      throw error;
    }
    return await this.repo.findByZonePolygon(zone.polygon);
  }

  /**
   * Calculate DSS Scores C1 & C2 by Zone Polygon
   */
  async getDensitasDanDiversitasC1C2(zoneId) {
    const zone = await ZoneModel.findById(zoneId);
    if (!zone) {
      const error = new Error("Zona tidak ditemukan");
      error.statusCode = 404;
      throw error;
    }
    return await this.repo.getDensitasDanDiversitasByZonePolygon(zone.polygon);
  }

  /**
   * Leakage Report for Unclassified POIs
   */
  async getLeakageReport() {
    return await this.repo.getLeakageReport(50);
  }

  /**
   * Fetch all approved POIs in the operational area
   */
  async getAllOperationalPois() {
    return await this.repo.findAll();
  }

  /**
   * Fetch POIs waiting for Admin/Supervisor Approval ('PENDING_APPROVAL')
   */
  async getPendingPois() {
    return await this.repo.findPendingPois();
  }

  /**
   * Approve or Reject a Pending POI and record audit log
   */
  async approveOrRejectPoi(poiId, status, actionByUserId, notes = "") {
    if (!["APPROVED", "REJECTED"].includes(status)) {
      const error = new Error("Status harus 'APPROVED' atau 'REJECTED'");
      error.statusCode = 400;
      throw error;
    }

    const poi = await this.repo.findById(poiId);
    if (!poi) {
      const error = new Error("Data POI tidak ditemukan");
      error.statusCode = 404;
      throw error;
    }

    const updatedPoi = await this.repo.updatePoiStatus(poiId, status);
    
    // Record audit log via poiApprovalLogRepository (N+1 Guarded)
    const { poiApprovalLogRepository } = await import("../repositories/poiApprovalLogRepository.js");
    const log = await poiApprovalLogRepository.createLog(poiId, status, actionByUserId, notes);

    return {
      message: `Status POI '${poi.name}' berhasil diperbarui menjadi ${status}`,
      poi: updatedPoi,
      log,
    };
  }

  /**
   * Fetch POI Approval Logs History (N+1 Query Guarded with Eager Loaded User Details)
   */
  async getApprovalLogs(limit = 50) {
    const { poiApprovalLogRepository } = await import("../repositories/poiApprovalLogRepository.js");
    return await poiApprovalLogRepository.findAllWithUser(limit);
  }

  /**
   * Trigger Automated Cron POI Detection Scan
   */
  async triggerCronDetection(hubCityOverride = null) {
    const hubCity = await this.getActiveHubCity(hubCityOverride);
    const { poiCronDetectionService } = await import("./poi/POICronDetectionService.js");
    return await poiCronDetectionService.detectNewPois(hubCity);
  }

  async getQualitySummary() {
    const { rows: rawCount } = await pool.query("SELECT COUNT(*)::int AS count FROM pois_raw");
    const { rows: poiStats } = await pool.query(`
      SELECT 
        COUNT(*)::int AS total_pois,
        COUNT(CASE WHEN status = 'APPROVED' AND operational_status <> 'EXCLUDED' THEN 1 END)::int AS valid_count,
        COUNT(CASE WHEN duplicate_of IS NOT NULL OR status = 'DUPLICATE' THEN 1 END)::int AS duplicate_count,
        COUNT(CASE WHEN status = 'PENDING' OR category = 'Lainnya' THEN 1 END)::int AS anomaly_count
      FROM pois
    `);

    const rawTotal = rawCount[0]?.count || 0;
    const stats = poiStats[0] || { total_pois: 0, valid_count: 0, duplicate_count: 0, anomaly_count: 0 };
    const totalFound = Math.max(rawTotal, stats.total_pois);
    const validCount = stats.valid_count;
    const duplicateCount = stats.duplicate_count;
    const anomalyCount = stats.anomaly_count;

    let qualityStatus = "VALID";
    if (validCount === 0 && totalFound === 0) {
      qualityStatus = "INVALID";
    } else if (anomalyCount > 0) {
      qualityStatus = "DEGRADED";
    }

    return {
      total_found: totalFound,
      valid_count: validCount,
      duplicate_count: duplicateCount,
      anomaly_count: anomalyCount,
      status: qualityStatus,
      last_sync_at: new Date().toISOString(),
    };
  }

  async resolveAnomaly(poiId, resolvedCategory, action = "APPROVE", userId = null) {
    if (action === "EXCLUDE") {
      await pool.query("UPDATE pois SET operational_status = 'EXCLUDED', status = 'REJECTED' WHERE id = $1", [poiId]);
      return { success: true, message: "POI berhasil dikecualikan dari operasional" };
    }
    await pool.query("UPDATE pois SET category = COALESCE($1, category), status = 'APPROVED', operational_status = 'OPERATIONAL' WHERE id = $2", [resolvedCategory, poiId]);
    return { success: true, message: "Anomali POI berhasil dipetakan dan disetujui" };
  }

  async getPoiStats() {
    return await poiRepository.getPoiStatsData();
  }

  /**
   * Get single POI by ID
   */
  async getPoiById(id) {
    const poi = await this.repo.findById(id);
    if (!poi) {
      const error = new Error("Data POI tidak ditemukan");
      error.statusCode = 404;
      throw error;
    }
    return poi;
  }

  /**
   * Create a manual POI (with auto-clustering support)
   */
  async createManualPoi(data, user = {}) {
    if (!data || typeof data !== "object") {
      const error = new Error("Data POI wajib diisi");
      error.statusCode = 400;
      throw error;
    }

    const name = String(data.name || "").trim();
    if (!name) {
      const error = new Error("Nama POI ('name') wajib diisi");
      error.statusCode = 400;
      throw error;
    }

    const lat = Number(data.latitude);
    const lon = Number(data.longitude);
    if (isNaN(lat) || lat < -90 || lat > 90) {
      const error = new Error("Nilai latitude tidak valid (-90 s/d 90)");
      error.statusCode = 400;
      throw error;
    }
    if (isNaN(lon) || lon < -180 || lon > 180) {
      const error = new Error("Nilai longitude tidak valid (-180 s/d 180)");
      error.statusCode = 400;
      throw error;
    }

    let category = data.category ? String(data.category).trim() : null;
    if (!category || category === "") {
      category = this.clusterer.cluster({ name, ...(data.metadata || {}) });
      if (category === "IGNORED") {
        category = "Lainnya";
      }
    }

    const poiPayload = {
      name,
      category,
      latitude: lat,
      longitude: lon,
      approval_status: data.approval_status || "APPROVED",
      operational_status: data.operational_status || "ELIGIBLE",
      exclusion_reason: data.exclusion_reason || null,
      metadata: {
        ...(data.metadata || {}),
        created_by_user_id: user.id || user.userId || null,
        created_by_role: user.role || null,
        creation_source: "MANUAL_ENTRY",
      },
    };

    const created = await this.repo.createManualPoi(poiPayload);

    // Audit log
    try {
      await pool.query(
        `INSERT INTO audit_logs (user_id, user_role, action, entity_type, details, status)
         VALUES ($1, $2, 'CREATE_MANUAL_POI', 'POI', $3::jsonb, 'SUCCESS');`,
        [user.id || user.userId || null, user.role || "SUPERADMIN", JSON.stringify({ poi_id: created.id, name: created.name })]
      );
    } catch (e) {
      // Non-blocking audit log
    }

    return created;
  }

  /**
   * Update an existing manual POI
   */
  async updateManualPoi(id, updateData, user = {}) {
    const existing = await this.getPoiById(id);

    const payload = {};
    if (updateData.name !== undefined) payload.name = String(updateData.name).trim();
    if (updateData.category !== undefined) payload.category = String(updateData.category).trim();
    if (updateData.latitude !== undefined) payload.latitude = Number(updateData.latitude);
    if (updateData.longitude !== undefined) payload.longitude = Number(updateData.longitude);
    if (updateData.approval_status !== undefined) payload.approval_status = updateData.approval_status;
    if (updateData.operational_status !== undefined) payload.operational_status = updateData.operational_status;
    if (updateData.exclusion_reason !== undefined) payload.exclusion_reason = updateData.exclusion_reason;
    if (updateData.metadata !== undefined) {
      payload.metadata = { ...(existing.metadata || {}), ...updateData.metadata };
    }

    const updated = await this.repo.updateManualPoi(id, payload);

    try {
      await pool.query(
        `INSERT INTO audit_logs (user_id, user_role, action, entity_type, details, status)
         VALUES ($1, $2, 'UPDATE_MANUAL_POI', 'POI', $3::jsonb, 'SUCCESS');`,
        [user.id || user.userId || null, user.role || "SUPERADMIN", JSON.stringify({ poi_id: id, updates: payload })]
      );
    } catch (e) {
      // Non-blocking
    }

    return updated;
  }

  /**
   * Delete an existing manual POI
   */
  async deleteManualPoi(id, user = {}) {
    const existing = await this.getPoiById(id);
    const deleted = await this.repo.deleteManualPoi(id);

    try {
      await pool.query(
        `INSERT INTO audit_logs (user_id, user_role, action, entity_type, details, status)
         VALUES ($1, $2, 'DELETE_MANUAL_POI', 'POI', $3::jsonb, 'SUCCESS');`,
        [user.id || user.userId || null, user.role || "SUPERADMIN", JSON.stringify({ poi_id: id, name: existing.name })]
      );
    } catch (e) {
      // Non-blocking
    }

    return deleted;
  }

  /**
   * Bulk ingest POIs from array (CSV / JSON upload) with auto-clustering & deduplication
   */
  async bulkCreateManualPois(items, user = {}) {
    if (!Array.isArray(items) || items.length === 0) {
      const error = new Error("Daftar POI bulk wajib berupa array tidak kosong");
      error.statusCode = 400;
      throw error;
    }

    const processedPois = items.map((item, idx) => {
      const name = String(item.name || `POI-${idx + 1}`).trim();
      const lat = Number(item.latitude || item.lat);
      const lon = Number(item.longitude || item.lon || item.lng);

      if (isNaN(lat) || isNaN(lon)) {
        throw new Error(`Item baris ke-${idx + 1} ('${name}') memiliki koordinat tidak valid.`);
      }

      let category = item.category ? String(item.category).trim() : null;
      if (!category || category === "") {
        category = this.clusterer.cluster({ name, ...(item.tags || item.metadata || {}) });
      }

      return {
        external_id: item.external_id || (item.osm_id ? `osm:${item.osm_type || 'node'}:${item.osm_id}` : null),
        osm_type: item.osm_type || null,
        osm_id: item.osm_id || null,
        name,
        category: category === "IGNORED" ? "Lainnya" : category,
        latitude: lat,
        longitude: lon,
        approval_status: item.approval_status || "APPROVED",
        operational_status: item.operational_status || (category === "IGNORED" ? "EXCLUDED" : "ELIGIBLE"),
        exclusion_reason: item.exclusion_reason || null,
        metadata: {
          ...(item.metadata || {}),
          ingested_by: user.id || null,
          source: "MANUAL_BULK_UPLOAD",
        },
      };
    });

    const deduplicatedPois = this.deduplicator.deduplicate(processedPois, 15);
    const savedPois = await this.repo.syncCityPoisWithTransaction(deduplicatedPois);

    return {
      total_submitted: items.length,
      total_deduplicated: deduplicatedPois.length,
      total_saved: savedPois.length,
      pois: savedPois,
    };
  }
}

// Singleton Instance Export
export const poiEltPipelineService = new POIEltPipelineService();

// Backward-Compatible Export Functions
export const clusterPOITags = (tags) => poiClusterer.cluster(tags);
export const getAllPoiCategoriesService = async () => PoiCategoryModel.findAll();
export const togglePoiCategoryStatusService = async (id) => {
  const existing = await PoiCategoryModel.findById(id);
  if (!existing) {
    const error = new Error("POI Category not found");
    error.statusCode = 404;
    throw error;
  }
  return PoiCategoryModel.toggleStatus(id);
};

export const fetchAndStoreRawPoisService = (hubCity) => poiEltPipelineService.fetchAndStoreRawPois(hubCity);
export const processAndSyncPoisService = (hubCity) => poiEltPipelineService.processAndSyncPois(hubCity);
export const syncCityPoisService = (hubCity) => poiEltPipelineService.syncCityPois(hubCity);
export const reprocessLocalPoisService = (hubCity) => poiEltPipelineService.processAndSyncPois(hubCity);
export const reclusterExistingPoisService = () => poiEltPipelineService.reclusterExistingPois();
export const getPoisByZoneService = (zoneId) => poiEltPipelineService.getPoisByZone(zoneId);
export const getAllOperationalPoisService = () => poiEltPipelineService.getAllOperationalPois();
export const getDensitasDanDiversitasC1C2Service = (zoneId) => poiEltPipelineService.getDensitasDanDiversitasC1C2(zoneId);
export const getLeakageReportService = () => poiEltPipelineService.getLeakageReport();
export const getPoiStatsService = () => poiEltPipelineService.getPoiStats();
export const getPoiByIdService = (id) => poiEltPipelineService.getPoiById(id);
export const createManualPoiService = (data, user) => poiEltPipelineService.createManualPoi(data, user);
export const updateManualPoiService = (id, data, user) => poiEltPipelineService.updateManualPoi(id, data, user);
export const deleteManualPoiService = (id, user) => poiEltPipelineService.deleteManualPoi(id, user);
export const bulkCreateManualPoisService = (items, user) => poiEltPipelineService.bulkCreateManualPois(items, user);


// New POI Approval Workflow Exports
export const getQualitySummaryService = () => poiEltPipelineService.getQualitySummary();
export const resolveAnomalyService = (poiId, category, action, userId) => poiEltPipelineService.resolveAnomaly(poiId, category, action, userId);
export const getPendingPoisService = () => poiEltPipelineService.getPendingPois();
export const approveOrRejectPoiService = (poiId, status, userId, notes) => poiEltPipelineService.approveOrRejectPoi(poiId, status, userId, notes);
export const getApprovalLogsService = (limit) => poiEltPipelineService.getApprovalLogs(limit);
export const triggerCronDetectionService = (hubCity) => poiEltPipelineService.triggerCronDetection(hubCity);

// C3 Time-Based Crowd Score Exports
import { poiTimeCrowdService } from "./poi/POITimeCrowdService.js";
export const updatePoiCategoryTimeScoresService = (id, scores) => poiTimeCrowdService.updateCategoryTimeScores(id, scores);
export const bulkUpdatePoiCategoryTimeScoresService = (items) => poiTimeCrowdService.bulkUpdateCategoryTimeScores(items);
export const getZoneC3ScoreService = async (zoneId, timeInput) => {
  const zone = await ZoneModel.findById(zoneId);
  if (!zone) {
    const error = new Error("Zona tidak ditemukan");
    error.statusCode = 404;
    throw error;
  }
  return await poiTimeCrowdService.calculateZoneC3Score(zone.polygon, timeInput);
};

// C4 Weather Condition Exports
import { poiWeatherService } from "./poi/POIWeatherService.js";
export const getZoneC4ScoreService = (zoneId, timeInput, targetDate) => poiWeatherService.calculateZoneC4Score(zoneId, timeInput, targetDate);
export const getZoneWeatherTimelineService = (params) => poiWeatherService.getZoneWeatherTimeline(params);
export const getHubWeatherOverviewService = (cityName, timeInput, targetDate, targetSlot) => poiWeatherService.getHubWeatherOverview(cityName, timeInput, targetDate, targetSlot);
export const syncAllZonesWeatherService = () => poiWeatherService.syncAllZonesWeather();

// C5 Distance Cost Exports
import { poiDistanceService } from "./poi/POIDistanceService.js";
export const getZoneC5ScoreService = (zoneId, lat, lon) => poiDistanceService.calculateZoneC5Score(zoneId, lat, lon);

// C6 Competitor Cost Exports
import { poiCompetitorService } from "./poi/POICompetitorService.js";
export const getZoneC6ScoreService = (zoneId) => poiCompetitorService.getZoneC6Score(zoneId);
export const getCompetitorsByZoneService = (zoneId) => poiCompetitorService.getCompetitorsByZone(zoneId);
export const getCompetitorsSummaryService = () => poiCompetitorService.getCompetitorsSummary();
export const createCompetitorService = (data) => poiCompetitorService.createCompetitor(data);
export const bulkCreateCompetitorsService = (items) => poiCompetitorService.bulkCreateCompetitors(items);
export const deleteCompetitorService = (id) => poiCompetitorService.deleteCompetitor(id);
export const reconcileExplicitLinkService = (payload) => poiCompetitorService.reconcileExplicitLink(payload);
export const detectCandidateMatchesService = (zoneId) => poiCompetitorService.detectCandidateMatches(zoneId);
export const unlinkReconciliationService = (id) => poiCompetitorService.unlinkReconciliation(id);




