/*
 * poiService.ts
 * POIEltPipelineService & POI Domain Orchestrator in TypeScript
 */

import { SystemSettingModel } from "../models/systemSettingModel.js";
import { PoiCategoryModel } from "../models/poiCategoryModel.js";
import { ZoneModel } from "../models/zoneModel.js";
import { overpassApiClient, OverpassApiClient } from "../utils/overpassClient.js";
import { poiClusterer, POIClusterer } from "./poi/POIClusterer.js";
import { spatialDeduplicator, SpatialDeduplicator } from "./poi/SpatialDeduplicator.js";
import { poiEntityFactory, POIEntityFactory } from "./poi/POIEntityFactory.js";
import { poiRawRepository, PoiRawRepository } from "../repositories/poiRawRepository.js";
import { poiRepository, PoiRepository } from "../repositories/poiRepository.js";
import { poiTimeCrowdService } from "./poi/POITimeCrowdService.js";
import { poiWeatherService } from "./poi/POIWeatherService.js";
import { poiDistanceService } from "./poi/POIDistanceService.js";
import { poiCompetitorService } from "./poi/POICompetitorService.js";

import { operationalContextService } from "./spatial/OperationalContextService.js";

/**
 * POI ELT Pipeline Service
 */
export class POIEltPipelineService {
  private overpassClient: OverpassApiClient;
  private clusterer: POIClusterer;
  private deduplicator: SpatialDeduplicator;
  private factory: POIEntityFactory;
  private rawRepo: PoiRawRepository;
  private repo: PoiRepository;

  constructor(
    overpassClient: OverpassApiClient = overpassApiClient,
    clusterer: POIClusterer = poiClusterer,
    deduplicator: SpatialDeduplicator = spatialDeduplicator,
    factory: POIEntityFactory = poiEntityFactory,
    rawRepo: PoiRawRepository = poiRawRepository,
    repo: PoiRepository = poiRepository
  ) {
    this.overpassClient = overpassClient;
    this.clusterer = clusterer;
    this.deduplicator = deduplicator;
    this.factory = factory;
    this.rawRepo = rawRepo;
    this.repo = repo;
  }

  /**
   * Helper to resolve active city name from Operational Context
   */
  public async getActiveHubCity(hubCityOverride: string | null = null): Promise<string> {
    if (hubCityOverride && hubCityOverride.trim()) {
      return hubCityOverride.trim();
    }
    const context = await operationalContextService.getOperationalContext();
    return context.hubCityName;
  }

  /**
   * ELT STAGE 1: Extract from Overpass API & Load to pois_raw Staging Table
   */
  public async fetchAndStoreRawPois(hubCityOverride: string | null = null): Promise<{ count: number; city: string }> {
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

    let overpassData: any[] = [];
    try {
      overpassData = await this.overpassClient.fetchOverpassData(query);
    } catch (err: any) {
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
      overpassData = await this.overpassClient.fetchOverpassData(fallbackQuery);
    }

    await this.rawRepo.saveRawData(hubCity, overpassData);
    console.log(`✅ Staging ELT Phase 1 (Extract & Load): ${overpassData.length} raw Overpass elements berhasil disimpan ke pois_raw (${hubCity}).`);
    return { count: overpassData.length, city: hubCity };
  }

  /**
   * ELT STAGE 2: Transform Staging Data from pois_raw & Bulk Upsert to Master pois Table
   */
  public async processAndSyncPois(hubCityOverride: string | null = null): Promise<any> {
    const hubCity = await this.getActiveHubCity(hubCityOverride);
    const rawData = await this.rawRepo.findRawDataByCity(hubCity);

    if (!rawData) {
      const error: any = new Error("Data staging belum tersedia di database (pois_raw). Jalankan sync-osm (Extract & Load) terlebih dahulu.");
      error.statusCode = 404;
      throw error;
    }

    const transformedPois = rawData
      .map((el: any) => this.factory.createFromOverpassElement(el, this.clusterer))
      .filter((poi: any) => poi.category !== "IGNORED" && !isNaN(poi.latitude) && !isNaN(poi.longitude));

    const deduplicatedPois = this.deduplicator.deduplicate(transformedPois, 15);

    const insertedPois = await this.repo.syncCityPoisWithTransaction(deduplicatedPois);

    return {
      message: "Data POI berhasil ditransformasi dan disinkronkan ke Master Database (Staging ELT Pipeline)",
      count: insertedPois.length,
      city: hubCity,
    };
  }

  /**
   * Full City Sync
   */
  public async syncCityPois(hubCityOverride: string | null = null): Promise<any> {
    const hubCity = await this.getActiveHubCity(hubCityOverride);
    await this.fetchAndStoreRawPois(hubCity);
    return await this.processAndSyncPois(hubCity);
  }

  /**
   * Re-cluster existing Master pois table in-memory without contacting Overpass API
   */
  public async reclusterExistingPois(): Promise<any> {
    const allPois = await this.repo.findAll();
    const updates: any[] = [];
    const deleteIds: any[] = [];

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
  public async getPoisByZone(zoneId: number | string): Promise<any[]> {
    const zone = await ZoneModel.findById(zoneId);
    if (!zone) {
      const error: any = new Error("Zona tidak ditemukan");
      error.statusCode = 404;
      throw error;
    }
    return await this.repo.findByZonePolygon(zone.polygon);
  }

  /**
   * Calculate DSS Scores C1 & C2 by Zone Polygon
   */
  public async getDensitasDanDiversitasC1C2(zoneId: number | string): Promise<any> {
    const zone = await ZoneModel.findById(zoneId);
    if (!zone) {
      const error: any = new Error("Zona tidak ditemukan");
      error.statusCode = 404;
      throw error;
    }
    return await this.repo.getDensitasDanDiversitasByZonePolygon(zone.polygon);
  }

  /**
   * Leakage Report for Unclassified POIs
   */
  public async getLeakageReport(): Promise<any[]> {
    return await this.repo.getLeakageReport(50);
  }

  /**
   * Fetch all approved POIs in the operational area scoped by hub
   */
  public async getAllOperationalPois(hubIdOverride: string | null = null): Promise<any[]> {
    let hubId = hubIdOverride;
    if (!hubId) {
      try {
        const ctx = await operationalContextService.getOperationalContext();
        hubId = ctx.hubCityName;
      } catch (e) {
        // Fallback to null (all)
      }
    }
    return await this.repo.findAll(hubId);
  }

  /**
   * Fetch POIs waiting for Admin/Supervisor Approval
   */
  public async getPendingPois(): Promise<any[]> {
    return await this.repo.findPendingPois();
  }

  /**
   * Approve or Reject a Pending POI and record audit log
   */
  public async approveOrRejectPoi(
    poiId: number | string,
    status: string,
    actionByUserId: number | string | null,
    notes: string = ""
  ): Promise<any> {
    if (!["APPROVED", "REJECTED"].includes(status)) {
      const error: any = new Error("Status harus 'APPROVED' atau 'REJECTED'");
      error.statusCode = 400;
      throw error;
    }

    const poi = await this.repo.findById(poiId);
    if (!poi) {
      const error: any = new Error("Data POI tidak ditemukan");
      error.statusCode = 404;
      throw error;
    }

    const updatedPoi = await this.repo.updatePoiStatus(poiId, status);
    
    const { poiApprovalLogRepository } = await import("../repositories/poiApprovalLogRepository.js");
    const log = await poiApprovalLogRepository.createLog(poiId, status, actionByUserId, notes);

    return {
      message: `Status POI '${poi.name}' berhasil diperbarui menjadi ${status}`,
      poi: updatedPoi,
      log,
    };
  }

  /**
   * Fetch POI Approval Logs History
   */
  public async getApprovalLogs(limit: number = 50): Promise<any[]> {
    const { poiApprovalLogRepository } = await import("../repositories/poiApprovalLogRepository.js");
    return await poiApprovalLogRepository.findAllWithUser(limit);
  }

  /**
   * Trigger Automated Cron POI Detection Scan
   */
  public async triggerCronDetection(hubCityOverride: string | null = null): Promise<any> {
    const hubCity = await this.getActiveHubCity(hubCityOverride);
    const { poiCronDetectionService } = await import("./poi/POICronDetectionService.js");
    return await poiCronDetectionService.detectNewPois(hubCity);
  }
}

export const poiEltPipelineService = new POIEltPipelineService();

// Backward-Compatible Export Functions
export const clusterPOITags = (tags: any) => poiClusterer.cluster(tags);
export const getAllPoiCategoriesService = async () => PoiCategoryModel.findAll();
export const togglePoiCategoryStatusService = async (id: number | string) => {
  const existing = await PoiCategoryModel.findById(id);
  if (!existing) {
    const error: any = new Error("POI Category not found");
    error.statusCode = 404;
    throw error;
  }
  return PoiCategoryModel.toggleStatus(id);
};

export const fetchAndStoreRawPoisService = (hubCity?: string | null) => poiEltPipelineService.fetchAndStoreRawPois(hubCity);
export const processAndSyncPoisService = (hubCity?: string | null) => poiEltPipelineService.processAndSyncPois(hubCity);
export const syncCityPoisService = (hubCity?: string | null) => poiEltPipelineService.syncCityPois(hubCity);
export const reprocessLocalPoisService = (hubCity?: string | null) => poiEltPipelineService.processAndSyncPois(hubCity);
export const reclusterExistingPoisService = () => poiEltPipelineService.reclusterExistingPois();
export const getPoisByZoneService = (zoneId: number | string) => poiEltPipelineService.getPoisByZone(zoneId);
export const getAllOperationalPoisService = (hubCity?: string | null) => poiEltPipelineService.getAllOperationalPois(hubCity);
export const getDensitasDanDiversitasC1C2Service = (zoneId: number | string) => poiEltPipelineService.getDensitasDanDiversitasC1C2(zoneId);
export const getLeakageReportService = () => poiEltPipelineService.getLeakageReport();

export const getPendingPoisService = () => poiEltPipelineService.getPendingPois();
export const approveOrRejectPoiService = (poiId: number | string, status: string, userId: number | string | null, notes: string = "") =>
  poiEltPipelineService.approveOrRejectPoi(poiId, status, userId, notes);
export const getApprovalLogsService = (limit?: number) => poiEltPipelineService.getApprovalLogs(limit);
export const triggerCronDetectionService = (hubCity?: string | null) => poiEltPipelineService.triggerCronDetection(hubCity);

export const updatePoiCategoryTimeScoresService = (id: number | string, scores: any) => poiTimeCrowdService.updateCategoryTimeScores(id, scores);
export const bulkUpdatePoiCategoryTimeScoresService = (items: any[]) => poiTimeCrowdService.bulkUpdateCategoryTimeScores(items);
export const getZoneC3ScoreService = async (zoneId: number | string, timeInput?: any) => {
  const zone = await ZoneModel.findById(zoneId);
  if (!zone) {
    const error: any = new Error("Zona tidak ditemukan");
    error.statusCode = 404;
    throw error;
  }
  return await poiTimeCrowdService.calculateZoneC3Score(zone.polygon, timeInput);
};

export const getZoneC4ScoreService = (zoneId: number | string, timeInput?: any) => poiWeatherService.calculateZoneC4Score(zoneId, timeInput);
export const getHubWeatherOverviewService = (cityName?: string, timeInput?: any) => poiWeatherService.getHubWeatherOverview(cityName, timeInput);
export const syncAllZonesWeatherService = () => poiWeatherService.syncAllZonesWeather();

export const getZoneC5ScoreService = (zoneId: number | string, lat: number, lon: number) => poiDistanceService.calculateZoneC5Score(zoneId, lat, lon);

export const getZoneC6ScoreService = (zoneId: number | string) => poiCompetitorService.getZoneC6Score(zoneId);
export const getAllCompetitorsService = (zoneId?: number | string | null) => poiCompetitorService.getAllCompetitors(zoneId);
export const getCompetitorsByZoneService = (zoneId: number | string) => poiCompetitorService.getCompetitorsByZone(zoneId);
export const createCompetitorService = (data: any) => poiCompetitorService.createCompetitor(data);
export const deleteCompetitorService = (id: number | string) => poiCompetitorService.deleteCompetitor(id);
