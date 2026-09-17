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
    return hubCity;
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
export const getZoneC4ScoreService = (zoneId, timeInput) => poiWeatherService.calculateZoneC4Score(zoneId, timeInput);
export const getZoneWeatherTimelineService = (params) => poiWeatherService.getZoneWeatherTimeline(params);
export const getHubWeatherOverviewService = (cityName, timeInput) => poiWeatherService.getHubWeatherOverview(cityName, timeInput);
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
export const deleteCompetitorService = (id) => poiCompetitorService.deleteCompetitor(id);



