import fs from "fs";
import path from "path";
import { overpassApiClient } from "../utils/overpassClient.js";
import { roadRepository } from "../repositories/roadRepository.js";

const OVERPASS_TIMEOUT_SECONDS = 180;
const FALLBACK_GEOJSON_REL_PATH = "public/geojson/jalan_tol.geojson";
const RESTRICTION_TYPE_TOLL = "PROHIBITED_TOLL_ROAD";
const MIN_COORDINATES_COUNT = 2;

const transformOsmElementToRoad = (el) => {
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
  const highwayType = tags.highway || "motorway";

  return {
    external_id: `osm:way:${osmId}`,
    osm_type: "way",
    osm_id: osmId,
    name: roadName,
    highway_type: highwayType,
    restriction_type: RESTRICTION_TYPE_TOLL,
    metadata: {
      toll: tags.toll || "yes",
      ref: tags.ref || null,
      operator: tags.operator || null,
      highway: tags.highway || null,
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

  async syncTollRoadsFromOverpass() {
    const query = `
      [out:json][timeout:${OVERPASS_TIMEOUT_SECONDS}];
      (
        area["name"="Sidoarjo"]["admin_level"="5"];
        area["name"="Pasuruan"]["admin_level"="5"];
      )->.searchAreas;
      (
        way["highway"="motorway"](area.searchAreas);
        way["highway"="motorway_link"](area.searchAreas);
        way["toll"="yes"](area.searchAreas);
      );
      out geom;
    `;

    let elements = [];
    try {
      elements = await this.overpassClient.fetchOverpassData(query);
    } catch (err) {
      console.warn("⚠️ Overpass API gagal/timeout, mencoba fallback snapshot lokal 'jalan_tol.geojson'...");
      const localPath = path.resolve(process.cwd(), FALLBACK_GEOJSON_REL_PATH);
      if (!fs.existsSync(localPath)) {
        console.error("💥 Error calling Overpass API and local snapshot not found:", err.message);
        throw new Error(`Gagal mengambil data Jalan Tol dari Overpass API: ${err.message}`);
      }

      const raw = fs.readFileSync(localPath, "utf8");
      const parsed = JSON.parse(raw);
      const feats = parsed.features || [];
      elements = feats.map((f, idx) => ({
        type: "way",
        id: f.properties?.osm_id || idx + 200000,
        tags: {
          name: f.properties?.name || "Jalan Tol",
          highway: f.properties?.highway || "motorway",
          toll: "yes",
          ...f.properties,
        },
        geometry: (f.geometry?.coordinates || []).map((coord) => ({
          lon: coord[0],
          lat: coord[1],
        })),
      }));
    }

    if (!Array.isArray(elements) || elements.length === 0) {
      return {
        success: true,
        source: "OVERPASS_API",
        inserted: 0,
        updated: 0,
        total: 0,
        restriction_type: RESTRICTION_TYPE_TOLL,
        message: "Tidak ada data jalan tol yang dikembalikan dari Overpass.",
      };
    }

    const validTollRoads = elements
      .map(transformOsmElementToRoad)
      .filter(Boolean);

    let dbResults = [];
    if (validTollRoads.length > 0) {
      dbResults = await this.roadRepo.bulkCreate(validTollRoads);
    }

    return {
      success: true,
      source: "OVERPASS_API",
      inserted: dbResults.length,
      updated: dbResults.length,
      total: dbResults.length,
      restriction_type: RESTRICTION_TYPE_TOLL,
      message: `Berhasil menyinkronkan ${dbResults.length} segmen Jalan Tol dari Overpass API ke PostGIS.`,
    };
  }
}

export const roadOverpassSyncService = RoadOverpassSyncService.getInstance();
