/*
 * POIWeatherService.js
 * Singleton Service for Kriteria C4 (Kondisi Cuaca - Cost) & Weather Information.
 */

import { openMeteoApiClient } from "../../utils/OpenMeteoApiClient.js";
import { weatherRepository } from "../../repositories/WeatherRepository.js";
import { WeatherOperationalEvaluator } from "../../utils/WeatherOperationalEvaluator.js";
import { ZoneModel } from "../../models/zoneModel.js";
import { redisClient } from "../../config/redis.js";

const REDIS_WEATHER_TTL_SECONDS = 1800; // 30 mins
const MEMORY_CACHE_TTL_MS = 30 * 60 * 1000; // 30 mins
const DB_CACHE_FRESHNESS_MINUTES = 30;

export class POIWeatherService {
  static instance = null;

  constructor(
    apiClient = openMeteoApiClient,
    repo = weatherRepository,
    evaluator = WeatherOperationalEvaluator
  ) {
    if (POIWeatherService.instance) {
      return POIWeatherService.instance;
    }
    this.apiClient = apiClient;
    this.repo = repo;
    this.evaluator = evaluator;
    this.memoryCache = new Map(); // zoneId -> { hourly, fetchedAt }
    POIWeatherService.instance = this;
  }

  static getInstance() {
    if (!POIWeatherService.instance) {
      POIWeatherService.instance = new POIWeatherService();
    }
    return POIWeatherService.instance;
  }

  /**
   * Sync weather data for all active zones in ONE batch HTTP request to Open-Meteo
   */
  async syncAllZonesWeather(forceRefresh = false) {
    const centroids = await this.repo.getAllZoneCentroids();
    if (centroids.length === 0) {
      return [];
    }

    try {
      const batchData = await this.apiClient.fetchBatchWeather(centroids);
      const now = new Date();

      await Promise.all(
        batchData
          .filter((item) => item && item.zone_id)
          .map(async (item) => {
            // 1. Store in in-memory Map cache
            this.memoryCache.set(item.zone_id, {
              hourly: item.hourly,
              fetchedAt: now,
            });

            // 2. Store in Redis cache if available
            const cacheKey = `weather:zone:${item.zone_id}`;
            try {
              if (redisClient && (redisClient.isOpen || redisClient.isReady)) {
                await redisClient.set(cacheKey, JSON.stringify(item.hourly), {
                  EX: REDIS_WEATHER_TTL_SECONDS,
                });
              }
            } catch (redisErr) {
              // Redis error should not fail execution
            }

            // 3. Evaluate C4 score and save directly to PostgreSQL with 30-minute freshness
            const evaluated = this.evaluator.evaluateC4Score(item.hourly, now);
            evaluated.hourly = item.hourly;

            await this.repo.saveCachedWeather(item.zone_id, evaluated, DB_CACHE_FRESHNESS_MINUTES);
          })
      );

      console.log(`✅ Weather Batch Sync Berhasil: Data cuaca ${batchData.length} zona diperbarui di Redis & PostgreSQL via 1 Open-Meteo HTTP Request.`);
      return batchData;
    } catch (err) {
      console.warn("⚠️ Warning: Open-Meteo API Sync gagal, menggunakan data cache DB jika tersedia:", err.message);
      return [];
    }
  }


  /**
   * Fetch hourly weather forecast for a specific zone with multi-tier caching (Redis -> Memory -> DB)
   */
  async getHourlyForecastForZone(zoneId) {
    const cacheKey = `weather:zone:${zoneId}`;

    // 1. Check Redis Cache
    try {
      if (redisClient && (redisClient.isOpen || redisClient.isReady)) {
        const redisVal = await redisClient.get(cacheKey);
        if (redisVal) {
          return JSON.parse(redisVal);
        }
      }
    } catch (err) {
      // Ignore Redis error
    }

    // 2. Check In-Memory Map Cache (TTL: 30 minutes)
    const mem = this.memoryCache.get(zoneId);
    const ttlMs = 30 * 60 * 1000;
    if (mem && Date.now() - new Date(mem.fetchedAt).getTime() < ttlMs) {
      return mem.hourly;
    }

    // 3. Check PostgreSQL Database Cache (30-minute TTL)
    const dbCached = await this.repo.getCachedWeather(zoneId, 30);
    if (dbCached && dbCached.hourly_cache) {
      return dbCached.hourly_cache;
    }

    // 4. If expired or not present, fetch fresh batch weather data from Open-Meteo
    await this.syncAllZonesWeather(true);

    const updatedMem = this.memoryCache.get(zoneId);
    if (updatedMem) {
      return updatedMem.hourly;
    }

    const freshDb = await this.repo.getCachedWeather(zoneId, 30);
    if (freshDb && freshDb.hourly_cache) {
      return freshDb.hourly_cache;
    }

    return null;
  }

  /**
   * Calculate C4 Score & UI Supporting Weather Info for a Zone
   */
  async calculateZoneC4Score(zoneId, timeInput = new Date()) {
    const zone = await ZoneModel.findById(zoneId);
    if (!zone) {
      const error = new Error(`Zona dengan ID '${zoneId}' tidak ditemukan.`);
      error.statusCode = 404;
      throw error;
    }

    const hourlyData = await this.getHourlyForecastForZone(zoneId);
    const evaluation = this.evaluator.evaluateC4Score(hourlyData, timeInput);

    return {
      zone_id: zone.id,
      zone_name: zone.name,
      skor_c4: evaluation.skor_c4, // Max precipitation probability % during operational hours (Cost criteria)
      max_precipitation_probability: evaluation.max_precipitation_probability,
      avg_precipitation_probability: evaluation.avg_precipitation_probability,
      data_quality: evaluation.data_quality || (hourlyData ? "FRESH" : "DEGRADED"),
      source: evaluation.source || (hourlyData ? "OPEN_METEO" : "CONSERVATIVE_BASELINE"),
      warning: evaluation.warning || null,
      supporting_info: evaluation.supporting_info,
      active_time_slot: evaluation.active_slot,
      is_off_hours: evaluation.is_off_hours,
      operational_hours_window: "06:00 - 21:00",
    };
  }

  /**
   * Helper to map WMO weather codes to human readable Indonesian labels
   */
  getWmoWeatherLabel(code = 0) {
    if (code === 0) return "Cerah";
    if ([1, 2, 3].includes(code)) return "Cerah Berawan";
    if ([45, 48].includes(code)) return "Berkabut";
    if ([51, 53, 55, 56, 57].includes(code)) return "Gerimis";
    if ([61, 63, 65, 66, 67].includes(code)) return "Hujan Ringan";
    if ([80, 81, 82].includes(code)) return "Hujan Deras";
    if ([95, 96, 99].includes(code)) return "Badai Petir";
    return "Berawan";
  }

  /**
   * Calculate HUB Level & Zone-List Weather Overview for a City (e.g. SIDOARJO)
   */
  async getHubWeatherOverview(cityName = "ALL", timeInput = new Date()) {
    const centroids = await this.repo.getAllZoneCentroids();
    let filteredCentroids = centroids;

    if (cityName && cityName.toUpperCase() !== "ALL") {
      const matched = centroids.filter((c) =>
        c.name.toLowerCase().includes(cityName.toLowerCase())
      );
      if (matched.length > 0) {
        filteredCentroids = matched;
      }
    }

    if (filteredCentroids.length === 0) {
      return {
        status: "success",
        hub_city_name: cityName.toUpperCase(),
        total_zones: 0,
        hub_overview: {
          avg_temperature_c: 0,
          max_rain_probability_percent: 0,
          weather_condition: "Unknown",
          weather_code: 0,
          active_time_slot: "off_hours",
          operational_hours: "06:00 - 21:00",
        },
        zones_weather_list: [],
      };
    }

    const zonesWeatherList = [];
    let sumTemp = 0;
    let maxRainProb = 0;
    let mainWeatherCode = 0;
    let activeSlot = "off_hours";

    for (const loc of filteredCentroids) {
      const hourlyData = await this.getHourlyForecastForZone(loc.zone_id);
      const evaluation = this.evaluator.evaluateC4Score(hourlyData, timeInput);
      const supporting = evaluation.supporting_info || {};

      activeSlot = evaluation.active_slot || "off_hours";
      const rainProb = evaluation.max_precipitation_probability || 0;
      if (rainProb >= maxRainProb) {
        maxRainProb = rainProb;
        mainWeatherCode = supporting.weather_code || 0;
      }

      const temp = supporting.temperature || 0;
      sumTemp += temp;

      zonesWeatherList.push({
        zone_id: loc.zone_id,
        zone_name: loc.name,
        latitude: loc.latitude,
        longitude: loc.longitude,
        skor_c4_cost: evaluation.skor_c4,
        rain_probability_percent: rainProb,
        temperature_c: temp,
        weather_code: supporting.weather_code || 0,
        weather_condition: this.getWmoWeatherLabel(supporting.weather_code),
        risk_level: rainProb > 60 ? "HIGH" : rainProb > 30 ? "MEDIUM" : "LOW",
      });
    }

    const avgTemp = Math.round((sumTemp / filteredCentroids.length) * 10) / 10;

    return {
      status: "success",
      hub_city_name: cityName.toUpperCase(),
      total_zones: filteredCentroids.length,
      hub_overview: {
        avg_temperature_c: avgTemp,
        max_rain_probability_percent: maxRainProb,
        weather_condition: this.getWmoWeatherLabel(mainWeatherCode),
        weather_code: mainWeatherCode,
        active_time_slot: activeSlot,
        operational_hours: "06:00 - 21:00",
      },
      zones_weather_list: zonesWeatherList,
    };
  }

  /**
   * Fetch Hourly Weather Timeline for a Zone (paired with time slots for Today / Tomorrow)
   */
  async getZoneWeatherTimeline({ zoneId, targetDate = "today", targetSlot = "all" }) {
    const zone = await ZoneModel.findById(zoneId);
    if (!zone) {
      const error = new Error(`Zona dengan ID '${zoneId}' tidak ditemukan.`);
      error.statusCode = 404;
      throw error;
    }

    const hourlyData = await this.getHourlyForecastForZone(zoneId);
    const timeline = this.evaluator.extractHourlyTimeline({
      hourlyData,
      targetDate,
      targetSlot,
    });

    return {
      status: "success",
      zone_id: zone.id,
      zone_name: zone.name,
      ...timeline,
    };
  }
}

export const poiWeatherService = POIWeatherService.getInstance();

