import fs from "fs";
import path from "path";
import { overpassApiClient } from "../utils/overpassClient.js";
import { roadRepository } from "../repositories/roadRepository.js";

const OVERPASS_TIMEOUT_SECONDS = 180;
const FALLBACK_TOLL_GEOJSON_PATH = "public/geojson/jalan_tol.geojson";
const FALLBACK_PROTOCOL_GEOJSON_PATH = "public/geojson/jalan_protokol.geojson";
const RESTRICTION_TYPE_TOLL = "PROHIBITED_TOLL_ROAD";
const RESTRICTION_TYPE_PROTOCOL = "PROHIBITED_ROAD";
const MIN_COORDINATES_COUNT = 2;

const PROTOCOL_HIGHWAY_TYPES = [
  "trunk",
  "trunk_link",
  "primary",
  "primary_link",
  "secondary",
  "secondary_link",
];

/**
 * Transform and classify raw OSM element applying ADR-PR-04A Restriction Classification Precedence
 */
export const transformOsmElementToRoad = (el) => {
  if (el.type !== "way" || !Array.isArray(el.geometry) || el.geometry.length < MIN_COORDINATES_COUNT) {
    return null;
  }

  const coords = el.geometry
    .filter((pt) => typeof pt.lat === "number" && typeof pt.lon === "number")
    .map((pt) => [pt.lon, pt.lat]);

  if (coords.length < MIN_COORDINATES_COUNT) {
    return null;
  }

  const osmId = el.id;
  const tags = el.tags || {};
  const roadName = tags.name || tags["name:id"] || tags.ref || `Way #${osmId}`;
  const highwayType = String(tags.highway || "").trim().toLowerCase();
  const isToll = tags.toll === "yes";

  // ADR-PR-04A: Restriction Classification Precedence Rule
  let restrictionType = null;
  if (isToll || highwayType === "motorway" || highwayType === "motorway_link") {
    restrictionType = RESTRICTION_TYPE_TOLL;
  } else if (PROTOCOL_HIGHWAY_TYPES.includes(highwayType)) {
    restrictionType = RESTRICTION_TYPE_PROTOCOL;
  } else {
    return null; // Excluded from MOVA restriction layers
  }

  return {
    external_id: `osm:way:${osmId}`,
    osm_type: "way",
    osm_id: osmId,
    name: roadName,
    highway_type: highwayType,
    restriction_type: restrictionType,
    metadata: {
      highway: tags.highway || null,
      ref: tags.ref || null,
      name: tags.name || null,
      toll: tags.toll || null,
      operator: tags.operator || null,
      surface: tags.surface || null,
      maxspeed: tags.maxspeed || null,
      tags,
    },
    geometry: {
      type: "LineString",
      coordinates: coords,
    },
  };
};

export class RoadOverpassSyncService {
  static instance = null;

  constructor(client = overpassApiClient, repo = roadRepository) {
    if (RoadOverpassSyncService.instance && client === overpassApiClient) {
      return RoadOverpassSyncService.instance;
    }
    this.overpassClient = client;
    this.roadRepo = repo;

    if (client === overpassApiClient) {
      RoadOverpassSyncService.instance = this;
    }
  }

  static getInstance() {
    if (!RoadOverpassSyncService.instance) {
      RoadOverpassSyncService.instance = new RoadOverpassSyncService();
    }
    return RoadOverpassSyncService.instance;
  }

  /**
   * Sync Protocol Roads (Pilar 2) from live Overpass API or fallback snapshot
   */
  async syncProtocolRoadsFromOverpass(options = {}) {
    const hubCity = options.hubCity || "Sidoarjo";
    const customBbox = options.customBbox || null;

    let query = "";
    let queryScope = "";

    if (customBbox) {
      const { minLat, minLon, maxLat, maxLon } = customBbox;
      queryScope = `BBOX: (${minLat},${minLon},${maxLat},${maxLon})`;
      query = `
        [out:json][timeout:${OVERPASS_TIMEOUT_SECONDS}];
        (
          way["highway"~"^(trunk|trunk_link|primary|primary_link|secondary|secondary_link)$"](${minLat},${minLon},${maxLat},${maxLon});
        );
        out geom;
      `;
    } else {
      queryScope = `City Area: ${hubCity} (admin_level=5)`;
      query = `
        [out:json][timeout:${OVERPASS_TIMEOUT_SECONDS}];
        (
          area["name"="Kabupaten ${hubCity}"]["admin_level"="5"];
          area["name"="${hubCity}"]["admin_level"="5"];
        )->.searchArea;
        (
          way["highway"~"^(trunk|trunk_link|primary|primary_link|secondary|secondary_link)$"](area.searchArea);
        );
        out geom;
      `;
    }

    let elements = [];
    let source = "OVERPASS_API";

    try {
      elements = await this.overpassClient.fetchOverpassData(query);
    } catch (err) {
      console.warn("⚠️ Error Overpass API admin_level=5 protocol roads:", err.message);
      if (!customBbox) {
        console.warn("⚠️ Mencoba query geografis BBox Sidoarjo sebagai fallback live Overpass...");
        const bboxFallbackQuery = `
          [out:json][timeout:${OVERPASS_TIMEOUT_SECONDS}];
          (
            way["highway"~"^(trunk|trunk_link|primary|primary_link|secondary|secondary_link)$"](-7.65,112.45,-7.25,112.95);
          );
          out geom;
        `;
        try {
          elements = await this.overpassClient.fetchOverpassData(bboxFallbackQuery);
        } catch (err2) {
          console.warn("⚠️ Overpass API BBox query gagal, mencoba fallback snapshot lokal...");
          const localPath = path.resolve(process.cwd(), FALLBACK_PROTOCOL_GEOJSON_PATH);
          if (fs.existsSync(localPath)) {
            source = "SNAPSHOT_FALLBACK";
            const raw = fs.readFileSync(localPath, "utf8");
            const parsed = JSON.parse(raw);
            const feats = parsed.features || [];
            elements = feats.map((f, idx) => ({
              type: "way",
              id: f.properties?.osm_id || f.properties?.id || idx + 100000,
              tags: {
                name: f.properties?.name || "Jalan Protokol",
                highway: f.properties?.highway || "secondary",
                toll: f.properties?.toll || "no",
                ...f.properties,
              },
              geometry: (f.geometry?.coordinates || []).map((coord) => ({
                lon: coord[0],
                lat: coord[1],
              })),
            }));
          } else {
            throw err2;
          }
        }
      } else {
        throw err;
      }
    }

    const rawAcquired = Array.isArray(elements) ? elements.length : 0;

    // Apply Transformation + ADR-PR-04A Precedence Rule (Strictly PROHIBITED_ROAD for Pilar 2)
    const validRoads = (elements || [])
      .map(transformOsmElementToRoad)
      .filter((r) => r !== null && r.restriction_type === RESTRICTION_TYPE_PROTOCOL);

    let dbResults = [];
    if (validRoads.length > 0) {
      dbResults = await this.roadRepo.bulkCreate(validRoads);
    }

    const result = {
      success: true,
      runId: options.runId || `PR-SYNC-${Date.now()}`,
      source,
      endpoint: "https://overpass-api.de/api/interpreter",
      queryScope,
      acquiredAt: new Date().toISOString(),
      rawAcquired,
      rawPersisted: validRoads.length,
      protocolRoadsCount: dbResults.length,
      message: `Berhasil menyinkronkan ${dbResults.length} segmen Jalan Protokol (PROHIBITED_ROAD) dari ${source} ke PostGIS.`,
    };

    console.log(`✅ [RoadOverpassSyncService] ${result.message}`);
    return result;
  }

  /**
   * Sync Toll Roads (Pilar 3) from live Overpass API or fallback snapshot
   */
  async syncTollRoadsFromOverpass(options = {}) {
    const hubCity = options.hubCity || "Sidoarjo";
    const customBbox = options.customBbox || null;

    let query = "";
    let queryScope = "";

    if (customBbox) {
      const minLat = customBbox.minLat ?? customBbox[0];
      const minLon = customBbox.minLon ?? customBbox[1];
      const maxLat = customBbox.maxLat ?? customBbox[2];
      const maxLon = customBbox.maxLon ?? customBbox[3];
      queryScope = `BBOX: (${minLat},${minLon},${maxLat},${maxLon})`;
      query = `
        [out:json][timeout:${OVERPASS_TIMEOUT_SECONDS}];
        (
          way["highway"="motorway"](${minLat},${minLon},${maxLat},${maxLon});
          way["highway"="motorway_link"](${minLat},${minLon},${maxLat},${maxLon});
          way["toll"="yes"](${minLat},${minLon},${maxLat},${maxLon});
        );
        out geom;
      `;
    } else {
      queryScope = `City Area: ${hubCity} (admin_level=5)`;
      query = `
        [out:json][timeout:${OVERPASS_TIMEOUT_SECONDS}];
        (
          area["name"="Kabupaten ${hubCity}"]["admin_level"="5"];
          area["name"="${hubCity}"]["admin_level"="5"];
        )->.searchAreas;
        (
          way["highway"="motorway"](area.searchAreas);
          way["highway"="motorway_link"](area.searchAreas);
          way["toll"="yes"](area.searchAreas);
        );
        out geom;
      `;
    }

    let elements = [];
    let source = "OVERPASS_API";

    try {
      elements = await this.overpassClient.fetchOverpassData(query);
    } catch (err) {
      console.warn("⚠️ Error Overpass API admin_level=5 toll roads:", err.message);
      if (!customBbox) {
        console.warn("⚠️ Mencoba query geografis BBox Sidoarjo sebagai fallback live Overpass...");
        const bboxFallbackQuery = `
          [out:json][timeout:${OVERPASS_TIMEOUT_SECONDS}];
          (
            way["highway"="motorway"](-7.65,112.45,-7.25,112.95);
            way["highway"="motorway_link"](-7.65,112.45,-7.25,112.95);
            way["toll"="yes"](-7.65,112.45,-7.25,112.95);
          );
          out geom;
        `;
        try {
          elements = await this.overpassClient.fetchOverpassData(bboxFallbackQuery);
        } catch (err2) {
          console.warn("⚠️ Overpass API BBox query gagal, mencoba fallback snapshot lokal...");
          const localPath = path.resolve(process.cwd(), FALLBACK_TOLL_GEOJSON_PATH);
          if (fs.existsSync(localPath)) {
            source = "SNAPSHOT_FALLBACK";
            const raw = fs.readFileSync(localPath, "utf8");
            const parsed = JSON.parse(raw);
            const feats = parsed.features || [];
            elements = feats.map((f, idx) => ({
              type: "way",
              id: f.properties?.osm_id || f.properties?.id || idx + 200000,
              tags: {
                name: f.properties?.name || "Jalan Tol",
                highway: f.properties?.highway || "motorway",
                toll: f.properties?.toll || "yes",
                ...f.properties,
              },
              geometry: (f.geometry?.coordinates || []).map((coord) => ({
                lon: coord[0],
                lat: coord[1],
              })),
            }));
          } else {
            throw err2;
          }
        }
      } else {
        throw err;
      }
    }

    const rawAcquired = Array.isArray(elements) ? elements.length : 0;

    const validTollRoads = (elements || [])
      .map(transformOsmElementToRoad)
      .filter((r) => r !== null && r.restriction_type === RESTRICTION_TYPE_TOLL);

    let dbResults = [];
    if (validTollRoads.length > 0) {
      dbResults = await this.roadRepo.bulkCreate(validTollRoads);
    }

    const result = {
      success: true,
      runId: options.runId || `TR-SYNC-${Date.now()}`,
      source,
      endpoint: "https://overpass-api.de/api/interpreter",
      queryScope,
      acquiredAt: new Date().toISOString(),
      rawAcquired,
      rawPersisted: validTollRoads.length,
      tollRoadsCount: dbResults.length,
      inserted: dbResults.length,
      updated: dbResults.length,
      total: dbResults.length,
      restriction_type: RESTRICTION_TYPE_TOLL,
      message: `Berhasil menyinkronkan ${dbResults.length} segmen Jalan Tol (PROHIBITED_TOLL_ROAD) dari ${source} ke PostGIS.`,
    };

    console.log(`✅ [RoadOverpassSyncService] ${result.message}`);
    return result;
  }
}

export const roadOverpassSyncService = RoadOverpassSyncService.getInstance();

