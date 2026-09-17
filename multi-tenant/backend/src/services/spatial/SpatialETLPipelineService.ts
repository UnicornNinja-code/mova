/*
 * SpatialETLPipelineService.ts
 *
 * Full End-to-End Ingestion, Validation, Staging, and Promotion Orchestrator
 * Implements the 11-step pipeline:
 * 1. FETCH -> 2. STORE RAW -> 3. VALIDATE -> 4. NORMALIZE -> 5. CLASSIFY ->
 * 6. DEDUPLICATE -> 7. TRANSFORM -> 8. LOAD STAGING -> 9. QUALITY CHECK ->
 * 10. ATOMIC PROMOTION -> 11. ACTIVE DATASET
 */

import { overpassApiClient } from "../../utils/overpassClient.js";
import { spatialSnapshotService } from "./SpatialSnapshotService.js";
import { spatialValidationService, type BoundingBox } from "./SpatialValidationService.js";
import { datasetPromotionService } from "./DatasetPromotionService.js";
import { datasetVersionRepository } from "../../repositories/datasetVersionRepository.js";
import { datasetSyncJobRepository } from "../../repositories/datasetSyncJobRepository.js";
import { poiEntityFactory } from "../poi/POIEntityFactory.js";
import { poiClusterer } from "../poi/POIClusterer.js";
import { spatialDeduplicator } from "../poi/SpatialDeduplicator.js";
import { resolveProtocolGeoJsonPath } from "../roadService.js";
import { pool } from "../../config/database.js";
import format from "pg-format";
import fs from "fs";
import type { SyncLockLease } from "../../queues/overpassQueue.js";
import { operationalContextService } from "./OperationalContextService.js";

export class SpatialETLPipelineService {
  private static instance: SpatialETLPipelineService | null = null;

  public static getInstance(): SpatialETLPipelineService {
    if (!SpatialETLPipelineService.instance) {
      SpatialETLPipelineService.instance = new SpatialETLPipelineService();
    }
    return SpatialETLPipelineService.instance;
  }

  /**
   * Execute Full Spatial Sync Pipeline for POI with Dynamic BBox and CAS
   */
  public async syncPoisPipeline(
    jobId: string,
    hubCity?: string,
    onProgress?: (percent: number) => Promise<void>,
    lockLease?: SyncLockLease | null,
    initialExpectedActiveVersionId?: string | null,
    customBbox?: BoundingBox,
    signal?: AbortSignal
  ): Promise<any> {
    const startTime = Date.now();
    const opContext = await operationalContextService.getOperationalContext();
    const effectiveCity = (hubCity && hubCity.trim()) || opContext.hubCityName;
    console.log(`🚀 [PIPELINE:POI] Memulai pipeline sinkronisasi POI untuk '${effectiveCity}' (Job: ${jobId})...`);

    // Capture baseline expected active version ID for True CAS
    const activePoi = await datasetVersionRepository.findActiveVersion("POI");
    const expectedActiveVersionId = initialExpectedActiveVersionId !== undefined ? initialExpectedActiveVersionId : activePoi?.id ?? null;

    const activeBbox = customBbox || (await spatialValidationService.resolveBoundingBox(effectiveCity));

    await onProgress?.(10);
    await datasetSyncJobRepository.updateJob(jobId, { status: "FETCHING", progress: 10 });

    // Step 1: FETCH Overpass Data (Dynamic BBox or City Area)
    let query: string;
    if (customBbox) {
      const bboxClause = `(${activeBbox.minLat},${activeBbox.minLon},${activeBbox.maxLat},${activeBbox.maxLon})`;
      query = `
        [out:json][timeout:300];
        (
          nwr["amenity"]${bboxClause}; nwr["shop"]${bboxClause};
          nwr["leisure"]${bboxClause}; nwr["office"]${bboxClause};
          nwr["tourism"]${bboxClause}; nwr["healthcare"]${bboxClause};
          nwr["historic"]${bboxClause}; nwr["landuse"="cemetery"]${bboxClause};
        );
        out center;
      `;
    } else {
      query = `
        [out:json][timeout:300];
        area["name"="${effectiveCity}"]["admin_level"="5"]->.searchArea;
        (
          nwr["amenity"](area.searchArea); nwr["shop"](area.searchArea);
          nwr["leisure"](area.searchArea); nwr["office"](area.searchArea);
          nwr["tourism"](area.searchArea); nwr["healthcare"](area.searchArea);
          nwr["historic"](area.searchArea); nwr["landuse"="cemetery"](area.searchArea);
        );
        out center;
      `;
    }

    let rawElements: any[] = [];
    try {
      rawElements = await overpassApiClient.fetchOverpassData(query, signal);
    } catch (fetchErr: any) {
      if (signal?.aborted || fetchErr.message?.includes("ABORTED")) {
        throw fetchErr;
      }
      console.warn("⚠️ [PIPELINE:POI] Overpass admin_level=5 error, mencoba fallback query nama kota standar...");
      const fallbackQuery = `
        [out:json][timeout:300];
        area["name"="${effectiveCity}"]->.searchArea;
        (
          nwr["amenity"](area.searchArea); nwr["shop"](area.searchArea);
          nwr["leisure"](area.searchArea); nwr["office"](area.searchArea);
          nwr["tourism"](area.searchArea); nwr["healthcare"](area.searchArea);
          nwr["historic"](area.searchArea); nwr["landuse"="cemetery"](area.searchArea);
        );
        out center;
      `;
      rawElements = await overpassApiClient.fetchOverpassData(fallbackQuery, signal);
    }

    if (!Array.isArray(rawElements) || rawElements.length === 0) {
      throw new Error(`Overpass API tidak mengembalikan elemen data untuk kota ${effectiveCity}.`);
    }

    await onProgress?.(25);
    await datasetSyncJobRepository.updateJob(jobId, {
      status: "PROCESSING",
      progress: 25,
      records_fetched: rawElements.length,
    });

    // Step 2: STORE RAW SNAPSHOT
    const rawPath = await spatialSnapshotService.saveRawSnapshot("poi", rawElements);

    // Step 3, 4, 5: TRANSFORM, NORMALIZE & CLASSIFY
    const transformedPois = rawElements
      .map((el) => poiEntityFactory.createFromOverpassElement(el, poiClusterer))
      .filter((p) => p.category !== "IGNORED" && !isNaN(p.latitude) && !isNaN(p.longitude));

    // Step 6: DEDUPLICATE (Haversine 15m proximity)
    const deduplicatedPois = spatialDeduplicator.deduplicate(transformedPois, 15);
    const duplicatesCount = transformedPois.length - deduplicatedPois.length;

    // Step 7: SPATIAL VALIDATION (Bounding box, numbers, range)
    await onProgress?.(45);
    await datasetSyncJobRepository.updateJob(jobId, { status: "VALIDATING", progress: 45 });

    const { validPois, report } = spatialValidationService.validatePois(deduplicatedPois, activeBbox);

    if (!report.isValid) {
      throw new Error(`Spatial Validation Gagal: Rasio data rusak > 30% (${report.invalidCount} rusak dari ${report.totalFeatures} total).`);
    }

    // Step 8: CREATE STAGING VERSION & LOAD TO STAGING
    await onProgress?.(65);
    await datasetSyncJobRepository.updateJob(jobId, { status: "LOADING", progress: 65 });

    const latestVersionNum = await datasetVersionRepository.getLatestVersionNumber("POI");
    const newVersionNum = latestVersionNum + 1;

    // Save Intermediate GeoJSON Snapshot
    const geoJsonFeatures = validPois.map((p) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [p.longitude, p.latitude] },
      properties: {
        id: p.external_id,
        name: p.name,
        category: p.category,
        osm_id: p.osm_id,
        osm_type: p.osm_type,
        metadata: p.metadata,
      },
    }));

    const featureCollection = {
      type: "FeatureCollection",
      features: geoJsonFeatures,
    };

    const { filePath: snapshotPath, checksum } = await spatialSnapshotService.saveGeoJsonSnapshot(
      "poi",
      newVersionNum,
      featureCollection
    );

    // Create STAGING version in database
    const versionRecord = await datasetVersionRepository.createVersion({
      dataset_type: "POI",
      version: newVersionNum,
      status: "STAGING",
      source: "OVERPASS_API",
      feature_count: validPois.length,
      checksum,
      snapshot_path: snapshotPath,
      validation_summary: report,
    });

    // Insert batch to pois_staging
    if (validPois.length > 0) {
      const values = validPois.map((p) => [
        versionRecord.id,
        effectiveCity,
        p.external_id,
        p.osm_type || null,
        p.osm_id || null,
        p.name,
        p.category,
        p.latitude,
        p.longitude,
        JSON.stringify({ type: "Point", coordinates: [p.longitude, p.latitude] }),
        JSON.stringify(p.metadata || {}),
        "VALID",
      ]);

      const batchSize = 250;
      for (let i = 0; i < values.length; i += batchSize) {
        const batch = values.slice(i, i + batchSize);
        const insertSql = format(
          `
          INSERT INTO pois_staging (
            version_id, hub_id, external_id, osm_type, osm_id, name, category,
            latitude, longitude, geom, metadata, validation_status
          )
          SELECT 
            v.version_id::uuid, v.hub_id, v.external_id, v.osm_type, v.osm_id::bigint, v.name, v.category,
            v.latitude::double precision, v.longitude::double precision,
            ST_SetSRID(ST_GeomFromGeoJSON(v.geojson), 4326),
            v.metadata::jsonb, v.validation_status
          FROM (VALUES %L) AS v(version_id, hub_id, external_id, osm_type, osm_id, name, category, latitude, longitude, geojson, metadata, validation_status);
        `,
          batch
        );
        await pool.query(insertSql);
      }
    }

    // Step 9: QUALITY GATE CHECK
    await onProgress?.(85);
    await datasetSyncJobRepository.updateJob(jobId, { status: "PROMOTING", progress: 85 });

    // Verify lock ownership before starting database transaction
    if (lockLease) {
      const isStillOwner = await lockLease.verify();
      if (!isStillOwner || lockLease.isLost()) {
        console.error(`💥 [LOCK_LOST] Worker kehilangan kepemilikan lock sebelum promosi POI.`);
        const lockErr: any = new Error("DISTRIBUTED_LOCK_LOST: Worker telah kehilangan hak kepemilikan distributed lock.");
        lockErr.code = "LOCK_LOST";
        throw lockErr;
      }
    }

    // Step 10 & 11: ATOMIC PROMOTION & SAVE MANIFEST (True CAS)
    const promotionResult = await datasetPromotionService.promoteVersion(
      versionRecord.id,
      expectedActiveVersionId
    );

    const manifestPath = await spatialSnapshotService.saveManifest("poi", newVersionNum, {
      dataset: "poi",
      version: newVersionNum,
      source: "OpenStreetMap Overpass API",
      fetched_at: new Date().toISOString(),
      feature_count: validPois.length,
      checksum_sha256: checksum,
      validation_status: "VALIDATED",
      status: "ACTIVE",
      metadata: { city: effectiveCity, raw_elements: rawElements.length, duplicates_filtered: duplicatesCount },
    });

    await datasetVersionRepository.updateVersion(versionRecord.id, { manifest_path: manifestPath });

    const durationMs = Date.now() - startTime;
    await onProgress?.(100);
    await datasetSyncJobRepository.updateJob(jobId, {
      status: "COMPLETED",
      progress: 100,
      records_inserted: validPois.length,
      duplicates_count: duplicatesCount,
      target_version: newVersionNum,
      duration_ms: durationMs,
      completed_at: new Date(),
    });

    console.log(`🎉 [PIPELINE:POI] Pipeline POI Berhasil! Versi ${newVersionNum} ACTIVE (${validPois.length} POI, ${durationMs}ms).`);
    return {
      success: true,
      dataset_type: "POI",
      version: newVersionNum,
      features_count: validPois.length,
      duration_ms: durationMs,
    };
  }

  /**
   * Execute Full Spatial Sync Pipeline for TOLL ROADS with CAS and Lock Ownership Verification
   */
  public async syncTollRoadsPipeline(
    jobId: string,
    onProgress?: (percent: number) => Promise<void>,
    lockLease?: SyncLockLease | null,
    initialExpectedActiveVersionId?: string | null,
    hubCities?: string[],
    customBbox?: BoundingBox,
    signal?: AbortSignal
  ): Promise<any> {
    const startTime = Date.now();
    const opContext = await operationalContextService.getOperationalContext();
    const effectiveCities = (hubCities && hubCities.length > 0) ? hubCities : [opContext.hubCityName];
    console.log(`🚀 [PIPELINE:TOLL] Memulai pipeline Jalan Tol untuk '${effectiveCities.join(", ")}' (Job: ${jobId})...`);

    // Capture baseline expected active version ID for True CAS
    const activeToll = await datasetVersionRepository.findActiveVersion("TOLL_ROADS");
    const expectedActiveVersionId = initialExpectedActiveVersionId !== undefined ? initialExpectedActiveVersionId : activeToll?.id ?? null;

    const activeBbox = customBbox || (await spatialValidationService.resolveBoundingBox(effectiveCities[0]));

    await onProgress?.(10);
    await datasetSyncJobRepository.updateJob(jobId, { status: "FETCHING", progress: 10 });

    let query: string;
    if (customBbox) {
      const bboxStr = `(${activeBbox.minLat},${activeBbox.minLon},${activeBbox.maxLat},${activeBbox.maxLon})`;
      query = `
        [out:json][timeout:180];
        (
          way["highway"="motorway"]${bboxStr};
          way["highway"="motorway_link"]${bboxStr};
          way["toll"="yes"]${bboxStr};
        );
        out geom;
      `;
    } else {
      const areasClause = effectiveCities.map((c) => `area["name"="${c}"]["admin_level"="5"];`).join("\n        ");
      query = `
        [out:json][timeout:180];
        (
          ${areasClause}
        )->.searchAreas;
        (
          way["highway"="motorway"](area.searchAreas);
          way["highway"="motorway_link"](area.searchAreas);
          way["toll"="yes"](area.searchAreas);
        );
        out geom;
      `;
    }

    const elements = await overpassApiClient.fetchOverpassData(query, signal);

    await onProgress?.(30);
    await datasetSyncJobRepository.updateJob(jobId, {
      status: "PROCESSING",
      progress: 30,
      records_fetched: elements.length,
    });

    // Save Raw
    await spatialSnapshotService.saveRawSnapshot("toll_roads", elements);

    // Transform into LineStrings
    const candidateRoads: any[] = [];
    for (const el of elements) {
      if (el.type === "way" && Array.isArray(el.geometry) && el.geometry.length >= 2) {
        const coords = el.geometry
          .filter((pt: any) => typeof pt.lat === "number" && typeof pt.lon === "number")
          .map((pt: any) => [pt.lon, pt.lat]);

        if (coords.length >= 2) {
          const tags = el.tags || {};
          candidateRoads.push({
            external_id: `osm:way:${el.id}`,
            osm_id: el.id,
            name: tags.name || tags.ref || `Way #${el.id}`,
            highway_type: tags.highway || "motorway",
            restriction_type: "PROHIBITED_TOLL_ROAD",
            geometry: { type: "LineString", coordinates: coords },
            metadata: tags,
          });
        }
      }
    }

    // Validate with active Bbox
    await onProgress?.(50);
    await datasetSyncJobRepository.updateJob(jobId, { status: "VALIDATING", progress: 50 });

    const { validRoads, report } = spatialValidationService.validateRoads(candidateRoads, activeBbox);

    // Staging
    await onProgress?.(70);
    await datasetSyncJobRepository.updateJob(jobId, { status: "LOADING", progress: 70 });

    const latestVersionNum = await datasetVersionRepository.getLatestVersionNumber("TOLL_ROADS");
    const newVersionNum = latestVersionNum + 1;

    const featureCollection = {
      type: "FeatureCollection",
      features: validRoads.map((r) => ({
        type: "Feature",
        geometry: r.geometry,
        properties: {
          id: r.external_id,
          name: r.name,
          highway: r.highway_type,
          restriction_type: r.restriction_type,
          metadata: r.metadata,
        },
      })),
    };

    const { filePath: snapshotPath, checksum } = await spatialSnapshotService.saveGeoJsonSnapshot(
      "toll_roads",
      newVersionNum,
      featureCollection
    );

    const versionRecord = await datasetVersionRepository.createVersion({
      dataset_type: "TOLL_ROADS",
      version: newVersionNum,
      status: "STAGING",
      source: "OpenStreetMap Overpass API",
      feature_count: validRoads.length,
      checksum,
      snapshot_path: snapshotPath,
      validation_summary: report,
    });

    if (validRoads.length > 0) {
      const values = validRoads.map((r) => [
        versionRecord.id,
        r.external_id,
        r.name,
        r.highway_type,
        r.restriction_type,
        JSON.stringify(r.geometry),
        JSON.stringify(r.metadata),
        "VALID",
      ]);

      const insertSql = format(
        `
        INSERT INTO protocol_roads_staging (
          version_id, external_id, name, highway_type, restriction_type, geom, metadata, validation_status
        )
        SELECT 
          v.version_id::uuid, v.external_id, v.name, v.highway_type, v.restriction_type,
          ST_SetSRID(ST_GeomFromGeoJSON(v.geojson), 4326),
          v.metadata::jsonb, v.validation_status
        FROM (VALUES %L) AS v(version_id, external_id, name, highway_type, restriction_type, geojson, metadata, validation_status);
      `,
        values
      );
      await pool.query(insertSql);
    }

    // Atomic Promotion
    await onProgress?.(90);
    await datasetSyncJobRepository.updateJob(jobId, { status: "PROMOTING", progress: 90 });

    // Verify lock ownership before starting database transaction
    if (lockLease) {
      const isStillOwner = await lockLease.verify();
      if (!isStillOwner || lockLease.isLost()) {
        console.error(`💥 [LOCK_LOST] Worker kehilangan kepemilikan lock sebelum promosi Jalan Tol.`);
        const lockErr: any = new Error("DISTRIBUTED_LOCK_LOST: Worker telah kehilangan hak kepemilikan distributed lock.");
        lockErr.code = "LOCK_LOST";
        throw lockErr;
      }
    }

    // Step 10 & 11: ATOMIC PROMOTION & SAVE MANIFEST (True CAS)
    await datasetPromotionService.promoteVersion(
      versionRecord.id,
      expectedActiveVersionId
    );

    const manifestPath = await spatialSnapshotService.saveManifest("toll_roads", newVersionNum, {
      dataset: "toll_roads",
      version: newVersionNum,
      source: "OpenStreetMap Overpass API",
      fetched_at: new Date().toISOString(),
      feature_count: validRoads.length,
      checksum_sha256: checksum,
      validation_status: "VALIDATED",
      status: "ACTIVE",
    });

    await datasetVersionRepository.updateVersion(versionRecord.id, { manifest_path: manifestPath });

    const durationMs = Date.now() - startTime;
    await onProgress?.(100);
    await datasetSyncJobRepository.updateJob(jobId, {
      status: "COMPLETED",
      progress: 100,
      records_inserted: validRoads.length,
      target_version: newVersionNum,
      duration_ms: durationMs,
      completed_at: new Date(),
    });

    console.log(`🎉 [PIPELINE:TOLL] Pipeline Jalan Tol Berhasil! Versi ${newVersionNum} ACTIVE (${validRoads.length} segmen).`);
    return {
      success: true,
      dataset_type: "TOLL_ROADS",
      version: newVersionNum,
      features_count: validRoads.length,
      duration_ms: durationMs,
    };
  }

  /**
   * Execute Full Spatial Sync Pipeline for PROTOCOL ROADS with CAS and Lock Ownership Verification
   */
  public async syncProtocolRoadsPipeline(
    jobId: string,
    hubCities?: string[],
    onProgress?: (percent: number) => Promise<void>,
    lockLease?: SyncLockLease | null,
    initialExpectedActiveVersionId?: string | null,
    customBbox?: BoundingBox,
    signal?: AbortSignal
  ): Promise<any> {
    const startTime = Date.now();
    const opContext = await operationalContextService.getOperationalContext();
    const effectiveCities = (hubCities && hubCities.length > 0) ? hubCities : [opContext.hubCityName];
    console.log(`🚀 [PIPELINE:PROTOCOL] Memulai pipeline Jalan Protokol untuk '${effectiveCities.join(", ")}' (Job: ${jobId})...`);

    // Capture baseline expected active version ID for True CAS
    const activeProto = await datasetVersionRepository.findActiveVersion("PROTOCOL_ROADS");
    const expectedActiveVersionId = initialExpectedActiveVersionId !== undefined ? initialExpectedActiveVersionId : activeProto?.id ?? null;

    const activeBbox = customBbox || (await spatialValidationService.resolveBoundingBox(effectiveCities[0]));

    await onProgress?.(10);
    await datasetSyncJobRepository.updateJob(jobId, { status: "FETCHING", progress: 10 });

    let query: string;
    if (customBbox) {
      const bboxStr = `(${activeBbox.minLat},${activeBbox.minLon},${activeBbox.maxLat},${activeBbox.maxLon})`;
      query = `
        [out:json][timeout:180];
        (
          way["highway"~"^(trunk|primary|secondary)$"]${bboxStr};
        );
        out geom;
      `;
    } else {
      const areas = effectiveCities.map((c) => `area["name"="${c}"]["admin_level"="5"];`).join("\n        ");
      query = `
        [out:json][timeout:180];
        (
          ${areas}
        )->.searchAreas;
        (
          way["highway"~"^(trunk|primary|secondary)$"](area.searchAreas);
        );
        out geom;
      `;
    }

    let elements: any[] = [];
    try {
      elements = await overpassApiClient.fetchOverpassData(query, signal);
    } catch (fetchErr: any) {
      if (signal?.aborted || fetchErr.message?.includes("ABORTED")) {
        throw fetchErr;
      }
      console.warn("⚠️ [PIPELINE:PROTOCOL] Overpass API gagal atau timeout, mencoba fallback ke snapshot lokal 'jalan_protokol.geojson'...");
      const localGeoJsonPath = resolveProtocolGeoJsonPath();
      if (localGeoJsonPath && fs.existsSync(localGeoJsonPath)) {
        const raw = fs.readFileSync(localGeoJsonPath, "utf8");
        const parsed = JSON.parse(raw);
        const feats = parsed.features || [];
        elements = feats.map((f: any, idx: number) => ({
          type: "way",
          id: f.properties?.osm_id || idx + 100000,
          tags: {
            name: f.properties?.name || "Jalan Protokol",
            highway: f.properties?.highway || "secondary",
            ...f.properties,
          },
          geometry: (f.geometry?.coordinates || []).map((coord: [number, number]) => ({
            lon: coord[0],
            lat: coord[1],
          })),
        }));
      } else {
        throw fetchErr;
      }
    }

    await onProgress?.(30);
    await datasetSyncJobRepository.updateJob(jobId, {
      status: "PROCESSING",
      progress: 30,
      records_fetched: elements.length,
    });

    // Save Raw
    await spatialSnapshotService.saveRawSnapshot("protocol_roads", elements);

    // Transform into LineStrings
    const candidateRoads: any[] = [];
    for (const el of elements) {
      if (el.type === "way" && Array.isArray(el.geometry) && el.geometry.length >= 2) {
        const coords = el.geometry
          .filter((pt: any) => typeof pt.lat === "number" && typeof pt.lon === "number")
          .map((pt: any) => [pt.lon, pt.lat]);

        if (coords.length >= 2) {
          const tags = el.tags || {};
          candidateRoads.push({
            external_id: `osm:way:${el.id}`,
            osm_id: el.id,
            name: tags.name || tags.ref || `Way #${el.id}`,
            highway_type: tags.highway || "secondary",
            restriction_type: "PROHIBITED_ROAD",
            geometry: { type: "LineString", coordinates: coords },
            metadata: tags,
          });
        }
      }
    }

    // Validate with active Bbox
    await onProgress?.(50);
    await datasetSyncJobRepository.updateJob(jobId, { status: "VALIDATING", progress: 50 });

    const { validRoads, report } = spatialValidationService.validateRoads(candidateRoads, activeBbox);

    // Staging
    await onProgress?.(70);
    await datasetSyncJobRepository.updateJob(jobId, { status: "LOADING", progress: 70 });

    const latestVersionNum = await datasetVersionRepository.getLatestVersionNumber("PROTOCOL_ROADS");
    const newVersionNum = latestVersionNum + 1;

    const featureCollection = {
      type: "FeatureCollection",
      features: validRoads.map((r) => ({
        type: "Feature",
        geometry: r.geometry,
        properties: {
          id: r.external_id,
          name: r.name,
          highway: r.highway_type,
          restriction_type: r.restriction_type,
          metadata: r.metadata,
        },
      })),
    };

    const { filePath: snapshotPath, checksum } = await spatialSnapshotService.saveGeoJsonSnapshot(
      "protocol_roads",
      newVersionNum,
      featureCollection
    );

    const versionRecord = await datasetVersionRepository.createVersion({
      dataset_type: "PROTOCOL_ROADS",
      version: newVersionNum,
      status: "STAGING",
      source: "OpenStreetMap Overpass API",
      feature_count: validRoads.length,
      checksum,
      snapshot_path: snapshotPath,
      validation_summary: report,
    });

    if (validRoads.length > 0) {
      const values = validRoads.map((r) => [
        versionRecord.id,
        r.external_id,
        r.name,
        r.highway_type,
        r.restriction_type,
        JSON.stringify(r.geometry),
        JSON.stringify(r.metadata),
        "VALID",
      ]);

      const insertSql = format(
        `
        INSERT INTO protocol_roads_staging (
          version_id, external_id, name, highway_type, restriction_type, geom, metadata, validation_status
        )
        SELECT 
          v.version_id::uuid, v.external_id, v.name, v.highway_type, v.restriction_type,
          ST_SetSRID(ST_GeomFromGeoJSON(v.geojson), 4326),
          v.metadata::jsonb, v.validation_status
        FROM (VALUES %L) AS v(version_id, external_id, name, highway_type, restriction_type, geojson, metadata, validation_status);
      `,
        values
      );
      await pool.query(insertSql);
    }

    // Atomic Promotion
    await onProgress?.(90);
    await datasetSyncJobRepository.updateJob(jobId, { status: "PROMOTING", progress: 90 });

    if (lockLease) {
      const isStillOwner = await lockLease.verify();
      if (!isStillOwner || lockLease.isLost()) {
        console.error(`💥 [LOCK_LOST] Worker kehilangan kepemilikan lock sebelum promosi Jalan Protokol.`);
        const lockErr: any = new Error("DISTRIBUTED_LOCK_LOST: Worker telah kehilangan hak kepemilikan distributed lock.");
        lockErr.code = "LOCK_LOST";
        throw lockErr;
      }
    }

    // Step 10 & 11: ATOMIC PROMOTION & SAVE MANIFEST (True CAS)
    await datasetPromotionService.promoteVersion(
      versionRecord.id,
      expectedActiveVersionId
    );

    const manifestPath = await spatialSnapshotService.saveManifest("protocol_roads", newVersionNum, {
      dataset: "protocol_roads",
      version: newVersionNum,
      source: "OpenStreetMap Overpass API",
      fetched_at: new Date().toISOString(),
      feature_count: validRoads.length,
      checksum_sha256: checksum,
      validation_status: "VALIDATED",
      status: "ACTIVE",
    });

    await datasetVersionRepository.updateVersion(versionRecord.id, { manifest_path: manifestPath });

    const durationMs = Date.now() - startTime;
    await onProgress?.(100);
    await datasetSyncJobRepository.updateJob(jobId, {
      status: "COMPLETED",
      progress: 100,
      records_inserted: validRoads.length,
      target_version: newVersionNum,
      duration_ms: durationMs,
      completed_at: new Date(),
    });

    console.log(`🎉 [PIPELINE:PROTOCOL] Pipeline Jalan Protokol Berhasil! Versi ${newVersionNum} ACTIVE (${validRoads.length} segmen).`);
    return {
      success: true,
      dataset_type: "PROTOCOL_ROADS",
      version: newVersionNum,
      features_count: validRoads.length,
      duration_ms: durationMs,
    };
  }
}

export const spatialETLPipelineService = SpatialETLPipelineService.getInstance();
