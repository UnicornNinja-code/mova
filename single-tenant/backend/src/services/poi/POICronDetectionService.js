/*
 * POICronDetectionService.js
 * Automated Background POI Detection & Pending Approval Ingestion Pipeline
 * Integrates: Overpass Extraction -> Classification -> Deduplication -> Pending Ingestion -> data_sync_runs Audit
 */

import { overpassApiClient } from "../../utils/overpassClient.js";
import { poiClusterer } from "./POIClusterer.js";
import { spatialDeduplicator } from "./SpatialDeduplicator.js";
import { poiEntityFactory } from "./POIEntityFactory.js";
import { poiRepository } from "../../repositories/poiRepository.js";
import { syncRunRepository } from "../../repositories/syncRunRepository.js";

const DEFAULT_HUB_CITY = "Sidoarjo";
const OVERPASS_TIMEOUT_SECONDS = 300;
const SPATIAL_DEDUP_TOLERANCE_METERS = 15;
const DATA_TYPE_POI = "POI";
const DATA_SOURCE_OVERPASS = "OVERPASS_API";

export class POICronDetectionService {
  static instance = null;

  constructor(
    client = overpassApiClient,
    clusterer = poiClusterer,
    deduplicator = spatialDeduplicator,
    factory = poiEntityFactory,
    repo = poiRepository,
    syncRepo = syncRunRepository
  ) {
    if (POICronDetectionService.instance && client === overpassApiClient) {
      return POICronDetectionService.instance;
    }
    this.overpassClient = client;
    this.clusterer = clusterer;
    this.deduplicator = deduplicator;
    this.factory = factory;
    this.repo = repo;
    this.syncRepo = syncRepo;

    if (client === overpassApiClient) {
      POICronDetectionService.instance = this;
    }
  }

  static getInstance() {
    if (!POICronDetectionService.instance) {
      POICronDetectionService.instance = new POICronDetectionService();
    }
    return POICronDetectionService.instance;
  }

  /**
   * Run full POI cron detection workflow with provenance tracking in data_sync_runs
   */
  async runCronPOIDetection(hubCity = DEFAULT_HUB_CITY) {
    return await this.detectNewPois(hubCity);
  }

  /**
   * Scans Overpass API for new POIs and saves newly discovered POIs with status 'PENDING_APPROVAL'
   */
  async detectNewPois(hubCity = DEFAULT_HUB_CITY) {
    const syncRun = await this.syncRepo.startRun({
      data_type: DATA_TYPE_POI,
      source: DATA_SOURCE_OVERPASS,
      metadata: { hub_city: hubCity, timeout: OVERPASS_TIMEOUT_SECONDS },
    });

    const query = `
      [out:json][timeout:${OVERPASS_TIMEOUT_SECONDS}];
      area["name"="${hubCity}"]["admin_level"="5"]->.searchArea;
      (
        nwr["amenity"](area.searchArea); nwr["shop"](area.searchArea);
        nwr["leisure"](area.searchArea); nwr["office"](area.searchArea);
        nwr["tourism"](area.searchArea); nwr["healthcare"](area.searchArea);
      );
      out center;
    `;

    let overpassData = [];
    try {
      overpassData = await this.overpassClient.fetchOverpassData(query);
    } catch (err) {
      console.warn("⚠️ [POICronDetection] Overpass API error:", err.message);
      if (syncRun?.id) {
        await this.syncRepo.failRun(syncRun.id, err.message, { hub_city: hubCity });
      }
      return { detectedCount: 0, pendingCount: 0, message: `Overpass API error: ${err.message}` };
    }

    if (!overpassData || overpassData.length === 0) {
      if (syncRun?.id) {
        await this.syncRepo.completeRun(syncRun.id, {
          records_fetched: 0,
          records_processed: 0,
          records_rejected: 0,
          metadata: { note: "No data returned from Overpass" },
        });
      }
      return { detectedCount: 0, pendingCount: 0, message: "No data returned from Overpass" };
    }

    const recordsFetched = overpassData.length;

    // 1. Transform Overpass elements
    const transformedPois = overpassData
      .map((el) => this.factory.createFromOverpassElement(el, this.clusterer))
      .filter((p) => p.category !== "IGNORED" && !isNaN(p.latitude) && !isNaN(p.longitude));

    const recordsRejected = recordsFetched - transformedPois.length;

    // 2. Deduplicate spatially
    const deduplicatedPois = this.deduplicator.deduplicate(transformedPois, SPATIAL_DEDUP_TOLERANCE_METERS);

    // 3. Fetch existing POIs from database
    const existingPois = await this.repo.findAll();
    const existingOsmIds = new Set(existingPois.map((p) => p.osm_id).filter(Boolean));

    // 4. Filter for NEW POIs not present in database
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
          return dist <= SPATIAL_DEDUP_TOLERANCE_METERS;
        }
        return false;
      });
      return !isDuplicate;
    });

    // 5. Insert new POIs with status 'PENDING_APPROVAL'
    let newlyInserted = [];
    if (newPois.length > 0) {
      const pendingPoisToInsert = newPois.map((p) => ({
        ...p,
        status: "PENDING_APPROVAL",
      }));
      newlyInserted = await this.repo.syncCityPoisWithTransaction(pendingPoisToInsert);
    }

    const currentPending = await this.repo.findPendingPois();

    if (syncRun?.id) {
      await this.syncRepo.completeRun(syncRun.id, {
        records_fetched: recordsFetched,
        records_processed: newlyInserted.length,
        records_rejected: recordsRejected,
        metadata: {
          hub_city: hubCity,
          deduplicated_count: deduplicatedPois.length,
          new_pending_inserted: newlyInserted.length,
        },
      });
    }

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

