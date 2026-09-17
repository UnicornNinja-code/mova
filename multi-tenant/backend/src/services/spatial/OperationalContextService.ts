/*
 * OperationalContextService.ts
 *
 * Authoritative Single Source of Truth for MOVA Operational Geographic Scope.
 * Resolves hub city name, central hub coordinates, radius, and operational bounding box
 * from system_settings.
 *
 * Enforces strict fail-safe behavior:
 * If configuration is missing, throws OperationalConfigurationError rather than silently defaulting to any city.
 */

import { pool } from "../../config/database.js";
import {
  BoundingBox,
  CITY_BBOX_PRESETS,
  OPERATIONAL_BBOX,
} from "./SpatialValidationService.js";

export class OperationalConfigurationError extends Error {
  public statusCode: number = 422;
  public code: string = "OPERATIONAL_SCOPE_NOT_CONFIGURED";

  constructor(message: string) {
    super(message);
    this.name = "OperationalConfigurationError";
  }
}

export interface OperationalContext {
  hubCityName: string;
  centralHubName: string;
  centralHubAddress: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
  bbox: BoundingBox;
}

export class OperationalContextService {
  private static instance: OperationalContextService | null = null;
  private cachedContext: OperationalContext | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL_MS = 60 * 1000; // 1 minute in-memory cache
  private dbPool = pool;

  public static getInstance(): OperationalContextService {
    if (!OperationalContextService.instance) {
      OperationalContextService.instance = new OperationalContextService();
    }
    return OperationalContextService.instance;
  }

  /**
   * Inject alternative database pool (used for unit testing)
   */
  public setDbPool(customPool: any): void {
    this.dbPool = customPool;
    this.invalidateCache();
  }

  /**
   * Invalidate cached operational context (called on system setting updates)
   */
  public invalidateCache(): void {
    this.cachedContext = null;
    this.cacheTimestamp = 0;
  }

  /**
   * Compute dynamic BoundingBox from center coordinate (lat, lon) and radius in KM
   */
  public computeBoundingBox(lat: number, lon: number, radiusKm: number): BoundingBox {
    // 1 deg latitude ~ 111.32 km
    const marginMultiplier = 1.15; // 15% safety operational margin
    const effectiveRadius = Math.max(1, radiusKm) * marginMultiplier;

    const deltaLat = effectiveRadius / 111.32;
    const cosLat = Math.cos((lat * Math.PI) / 180);
    // Protect against polar division by near-zero
    const deltaLon = effectiveRadius / (111.32 * Math.max(0.1, Math.abs(cosLat)));

    return {
      minLat: parseFloat((lat - deltaLat).toFixed(4)),
      maxLat: parseFloat((lat + deltaLat).toFixed(4)),
      minLon: parseFloat((lon - deltaLon).toFixed(4)),
      maxLon: parseFloat((lon + deltaLon).toFixed(4)),
    };
  }

  /**
   * Retrieve authoritative operational context from PostgreSQL system_settings.
   * Throws OperationalConfigurationError if operational scope is missing or unconfigured.
   */
  public async getOperationalContext(forceRefresh: boolean = false): Promise<OperationalContext> {
    const now = Date.now();
    if (!forceRefresh && this.cachedContext && now - this.cacheTimestamp < this.CACHE_TTL_MS) {
      return this.cachedContext;
    }

    const query = `
      SELECT key, value FROM system_settings 
      WHERE key IN (
        'HUB_CITY_NAME',
        'CENTRAL_HUB_NAME',
        'CENTRAL_HUB_ADDRESS',
        'CENTRAL_HUB_LAT',
        'CENTRAL_HUB_LNG',
        'HUB_LATITUDE',
        'HUB_LONGITUDE',
        'OPERATIONAL_RADIUS_KM'
      );
    `;

    const { rows } = await this.dbPool.query(query);
    const settingMap: Record<string, string> = {};
    for (const r of rows) {
      settingMap[r.key] = r.value;
    }

    let hubCityName = (settingMap["HUB_CITY_NAME"] || "").trim();
    const centralHubName = (settingMap["CENTRAL_HUB_NAME"] || "Central Hub").trim();
    const centralHubAddress = (settingMap["CENTRAL_HUB_ADDRESS"] || "").trim();

    // Coordinate resolution: primary CENTRAL_HUB_LAT/LNG, secondary HUB_LATITUDE/LONGITUDE
    const rawLat = settingMap["CENTRAL_HUB_LAT"] || settingMap["HUB_LATITUDE"];
    const rawLon = settingMap["CENTRAL_HUB_LNG"] || settingMap["HUB_LONGITUDE"];

    const latitude = rawLat !== undefined && rawLat !== "" ? parseFloat(rawLat) : NaN;
    const longitude = rawLon !== undefined && rawLon !== "" ? parseFloat(rawLon) : NaN;

    const rawRadius = settingMap["OPERATIONAL_RADIUS_KM"];
    const radiusKm = rawRadius !== undefined && rawRadius !== "" ? parseFloat(rawRadius) : 12;

    // Fail-safe check: HUB_CITY_NAME must be specified
    if (!hubCityName) {
      // Check if address explicitly contains a known city name as fallback extraction
      if (centralHubAddress) {
        const knownCities = Object.keys(CITY_BBOX_PRESETS);
        for (const city of knownCities) {
          const regex = new RegExp(`\\b${city}\\b`, "i");
          if (regex.test(centralHubAddress)) {
            hubCityName = city;
            break;
          }
        }
      }

      if (!hubCityName) {
        throw new OperationalConfigurationError(
          "Cakupan wilayah operasional (HUB_CITY_NAME) belum dikonfigurasi. " +
          "Silakan selesaikan Setup Wizard atau tentukan kota hub pada Pengaturan Sistem."
        );
      }
    }

    // Fail-safe check: Coordinates must be valid
    if (isNaN(latitude) || isNaN(longitude)) {
      throw new OperationalConfigurationError(
        `Koordinat Central Hub untuk wilayah '${hubCityName}' belum ditentukan secara valid di sistem.`
      );
    }

    // Resolve Bounding Box: Check presets first, or compute dynamically from lat/lon + radius
    let bbox: BoundingBox;
    const matchedPreset = Object.keys(CITY_BBOX_PRESETS).find(
      (c) => c.toLowerCase() === hubCityName.toLowerCase()
    );

    if (matchedPreset) {
      bbox = CITY_BBOX_PRESETS[matchedPreset];
    } else {
      bbox = this.computeBoundingBox(latitude, longitude, radiusKm);
    }

    this.cachedContext = {
      hubCityName,
      centralHubName,
      centralHubAddress,
      latitude,
      longitude,
      radiusKm,
      bbox,
    };
    this.cacheTimestamp = now;

    return this.cachedContext;
  }
}

export const operationalContextService = OperationalContextService.getInstance();
