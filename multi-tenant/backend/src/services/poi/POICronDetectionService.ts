/*
 * POICronDetectionService.ts
 * Automated Background POI Detection & Pending Approval Ingestion in TypeScript
 */

import { overpassApiClient, OverpassApiClient } from "../../utils/overpassClient.js";
import { poiClusterer, POIClusterer } from "./POIClusterer.js";
import { spatialDeduplicator, SpatialDeduplicator } from "./SpatialDeduplicator.js";
import { poiEntityFactory, POIEntityFactory } from "./POIEntityFactory.js";
import { poiRepository, POIRepository } from "../../repositories/poiRepository.js";
import { operationalContextService } from "../spatial/OperationalContextService.js";

export class POICronDetectionService {
  private static instance: POICronDetectionService | null = null;
  private overpassClient: OverpassApiClient;
  private clusterer: POIClusterer;
  private deduplicator: SpatialDeduplicator;
  private factory: POIEntityFactory;
  private repo: POIRepository;

  constructor(
    client: OverpassApiClient = overpassApiClient,
    clusterer: POIClusterer = poiClusterer,
    deduplicator: SpatialDeduplicator = spatialDeduplicator,
    factory: POIEntityFactory = poiEntityFactory,
    repo: POIRepository = poiRepository
  ) {
    if (POICronDetectionService.instance && client === overpassApiClient) {
      return POICronDetectionService.instance;
    }
    this.overpassClient = client;
    this.clusterer = clusterer;
    this.deduplicator = deduplicator;
    this.factory = factory;
    this.repo = repo;

    if (client === overpassApiClient) {
      POICronDetectionService.instance = this;
    }
  }

  public static getInstance(): POICronDetectionService {
    if (!POICronDetectionService.instance) {
      POICronDetectionService.instance = new POICronDetectionService();
    }
    return POICronDetectionService.instance;
  }

  /**
   * Scans Overpass API for new POIs and saves newly discovered POIs with status 'PENDING_APPROVAL'
   */
  public async detectNewPois(hubCity?: string): Promise<any> {
    const opContext = await operationalContextService.getOperationalContext();
    const targetCity = (hubCity && hubCity.trim()) || opContext.hubCityName;

    const query = `
      [out:json][timeout:300];
      area["name"="${targetCity}"]["admin_level"="5"]->.searchArea;
      (
        nwr["amenity"](area.searchArea); nwr["shop"](area.searchArea);
        nwr["leisure"](area.searchArea); nwr["office"](area.searchArea);
        nwr["tourism"](area.searchArea); nwr["healthcare"](area.searchArea);
      );
      out center;
    `;

    let overpassData: any[] = [];
    try {
      overpassData = await this.overpassClient.fetchOverpassData(query);
    } catch (err: any) {
      console.warn("⚠️ [POICronDetection] Overpass API error:", err.message);
      return { detectedCount: 0, pendingCount: 0, message: "Overpass API unreachable" };
    }

    if (!overpassData || overpassData.length === 0) {
      return { detectedCount: 0, pendingCount: 0, message: "No data returned from Overpass" };
    }

    const transformedPois = overpassData
      .map((el) => this.factory.createFromOverpassElement(el, this.clusterer))
      .filter((p) => p.category !== "IGNORED" && !isNaN(p.latitude) && !isNaN(p.longitude));

    const deduplicatedPois = this.deduplicator.deduplicate(transformedPois, 15);

    const existingPois = await this.repo.findAll();
    const existingOsmIds = new Set(existingPois.map((p) => p.osm_id).filter(Boolean));

    const newPois = deduplicatedPois.filter((p) => {
      if (p.osm_id && existingOsmIds.has(p.osm_id)) {
        return false;
      }
      const isDuplicate = existingPois.some((existing) => {
        if (
          existing.category === p.category &&
          existing.name.toLowerCase().trim() === p.name.toLowerCase().trim()
        ) {
          const dist = this.deduplicator.calculateHaversineDistanceMeter(
            existing.latitude,
            existing.longitude,
            p.latitude,
            p.longitude
          );
          return dist <= 15;
        }
        return false;
      });
      return !isDuplicate;
    });

    let newlyInserted: any[] = [];
    if (newPois.length > 0) {
      const pendingPoisToInsert = newPois.map((p) => ({
        ...p,
        status: "PENDING_APPROVAL",
      }));
      newlyInserted = await this.repo.syncCityPoisWithTransaction(pendingPoisToInsert);
    }

    const currentPending = await this.repo.findPendingPois();

    console.log(`🤖 [POICronDetection] Scan Complete: ${newlyInserted.length} POI baru terdeteksi & disimpan dengan status PENDING_APPROVAL.`);
    return {
      message: "Proses pemindaian POI otomatis selesai.",
      newlyDetectedCount: newlyInserted.length,
      totalPendingCount: currentPending.length,
      pendingPois: currentPending,
    };
  }
}

export const poiCronDetectionService = POICronDetectionService.getInstance();
