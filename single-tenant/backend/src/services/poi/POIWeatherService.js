/*
 * POIWeatherService.js
 * Singleton Service for Kriteria C4 (Kondisi Cuaca - Cost) & Weather Information.
 * Implements Multi-tier Caching (Redis -> In-Memory -> PostgreSQL), Macro Hub Aggregation,
 * and H+1 Predictive Forecast Pipeline.
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
          .filter((item) => item && item.zone_id && item.hourly)
          .map(async (item) => {
            // 1. Build structured hourly rows for zone_hourly_weathers relational table
            const times = item.hourly.time || [];
            const hourlyRows = [];

            for (let i = 0; i < times.length; i++) {
              const rawTime = times[i];
              const forecastTime = new Date(rawTime.endsWith("Z") ? rawTime : `${rawTime}:00Z`);
              const rainProb = Number(item.hourly.precipitation_probability?.[i] ?? 0);
              const wCode = Number(item.hourly.weather_code?.[i] ?? 0);
              const wmoMeta = this.evaluator.getWmoMeta ? this.evaluator.getWmoMeta(wCode) : { label: "Cerah" };
              const c4Risk = Math.min(1.0, Math.max(0.0, rainProb / 100));

              hourlyRows.push({
                forecast_time: forecastTime,
                temperature_2m: item.hourly.temperature_2m?.[i] ?? 28.0,
                apparent_temperature: item.hourly.apparent_temperature?.[i] ?? item.hourly.temperature_2m?.[i] ?? 29.0,
                relative_humidity_2m: item.hourly.relative_humidity_2m?.[i] ?? 70.0,
                dew_point_2m: item.hourly.dew_point_2m?.[i] ?? 23.0,
                precipitation_probability: rainProb,
                precipitation: item.hourly.precipitation?.[i] ?? 0.0,
                rain: item.hourly.rain?.[i] ?? 0.0,
                weather_code: wCode,
                wind_speed_10m: item.hourly.wind_speed_10m?.[i] ?? 10.0,
                weather_risk_score: c4Risk,
                condition_label: wmoMeta.label || "Cerah",
                data_quality: "VALID",
                source: "OPEN_METEO",
              });
            }

            // 2. Persist granular hourly rows via atomic UPSERT in PostgreSQL
            if (hourlyRows.length > 0) {
              await this.repo.saveBatchHourlyWeather(item.zone_id, hourlyRows, now);
            }

            // 3. Store in in-memory Map cache
            this.memoryCache.set(item.zone_id, {
              hourly: item.hourly,
              fetchedAt: now,
            });

            // 4. Store in Redis cache if available
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

            // 5. Evaluate C4 score and save snapshot in weathers table for backwards compatibility
            const evaluated = this.evaluator.evaluateC4Score(item.hourly, now);
            evaluated.hourly = item.hourly;

            await this.repo.saveCachedWeather(item.zone_id, evaluated, DB_CACHE_FRESHNESS_MINUTES);
          })
      );

      console.log(`✅ Weather Batch Sync Berhasil: Data cuaca ${batchData.length} zona diperbarui di zone_hourly_weathers, Redis & memory via 1 Open-Meteo HTTP Request.`);
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

    // 3. Check PostgreSQL zone_hourly_weathers Table for Fresh Data
    const freshness = await this.repo.checkZoneWeatherFreshness(zoneId, 30);
    if (freshness.isFresh) {
      const { hourly } = await this.repo.getZoneHourlyForecast(zoneId);
      if (hourly && hourly.time && hourly.time.length > 0) {
        this.memoryCache.set(zoneId, { hourly, fetchedAt: freshness.lastSynced });
        return hourly;
      }
    }

    // 4. If expired or not present, fetch fresh batch weather data from Open-Meteo
    await this.syncAllZonesWeather(true);

    const updatedMem = this.memoryCache.get(zoneId);
    if (updatedMem) {
      return updatedMem.hourly;
    }

    // 5. Fallback: Query zone_hourly_weathers even if older, or legacy weathers table
    const { hourly: dbHourly } = await this.repo.getZoneHourlyForecast(zoneId);
    if (dbHourly && dbHourly.time && dbHourly.time.length > 0) {
      return dbHourly;
    }

    const dbCached = await this.repo.getCachedWeather(zoneId, 1440); // 24 hours fallback
    if (dbCached && dbCached.hourly_cache) {
      return dbCached.hourly_cache;
    }

    return null;
  }

  /**
   * Calculate C4 Score & UI Supporting Weather Info for a Zone (Supports 'all' and H+1)
   */
  async calculateZoneC4Score(zoneId, timeInput = new Date(), targetDate = "today") {
    // Handle aggregate/all requests gracefully without 404
    if (!zoneId || zoneId === "all" || zoneId === "zone-all" || zoneId === "zone-default" || zoneId === "hub") {
      const hub = await this.getHubWeatherOverview({ cityName: "Sidoarjo", timeInput, targetDate });
      return {
        zone_id: "all",
        zone_name: "Central Hub (Sidoarjo Area)",
        skor_c4: Number((hub.hub_overview.max_rain_probability_percent / 100).toFixed(2)),
        max_precipitation_probability: hub.hub_overview.max_rain_probability_percent,
        avg_precipitation_probability: hub.hub_overview.max_rain_probability_percent,
        data_quality: "VALID",
        source: "OPEN_METEO_HUB_AGGREGATE",
        warning: null,
        supporting_info: {
          rain: hub.hub_overview.rain_volume_mm ?? 0,
          weather_code: hub.hub_overview.weather_code ?? 0,
          wind_speed: hub.hub_overview.wind_speed_kmh ?? 0,
          humidity: hub.hub_overview.humidity_percent ?? 0,
          dew_point: hub.hub_overview.dew_point_c ?? 0,
          temperature: hub.hub_overview.avg_temperature_c ?? 0,
        },
        active_time_slot: hub.hub_overview.active_time_slot,
        is_off_hours: hub.hub_overview.active_time_slot === "off_hours",
        operational_hours_window: "06:00 - 21:00",
        slots: hub.hub_c4_slots,
      };
    }

    const zone = await ZoneModel.findById(zoneId);
    if (!zone) {
      const error = new Error(`Zona dengan ID '${zoneId}' tidak ditemukan.`);
      error.statusCode = 404;
      throw error;
    }

    const hourlyData = await this.getHourlyForecastForZone(zoneId);
    const evaluation = this.evaluator.evaluateC4Score(hourlyData, timeInput);
    const timeline = this.evaluator.extractHourlyTimeline({ hourlyData, targetDate, targetSlot: "all" });

    // Build 4 shift slots advisory for this specific zone
    const slots = (timeline.available_slots && Object.keys(timeline.available_slots).length > 0)
      ? [
          {
            slot: "MORNING",
            time_range: "06:00 - 10:00 WIB",
            c4_score: Number(((timeline.available_slots.pagi?.max_rain_probability || 0) / 100).toFixed(2)),
            status: (timeline.available_slots.pagi?.max_rain_probability || 0) > 60 ? "BAHAYA HUJAN" : (timeline.available_slots.pagi?.max_rain_probability || 0) > 30 ? "WASPADA" : "AMAN",
            advisory: (timeline.available_slots.pagi?.max_rain_probability || 0) > 60
              ? "Peluang hujan tinggi: prioritaskan shelter POI beratap dan siapkan jas hujan rider."
              : "Sangat baik untuk plotting seluruh gerobak di titik terbuka.",
          },
          {
            slot: "AFTERNOON",
            time_range: "11:00 - 14:00 WIB",
            c4_score: Number(((timeline.available_slots.siang?.max_rain_probability || 0) / 100).toFixed(2)),
            status: (timeline.available_slots.siang?.max_rain_probability || 0) > 60 ? "BAHAYA HUJAN" : (timeline.available_slots.siang?.max_rain_probability || 0) > 30 ? "WASPADA" : "AMAN",
            advisory: (timeline.available_slots.siang?.max_rain_probability || 0) > 60
              ? "Waspada hujan petir siang hari, koordinasikan shelter alternatif."
              : "Panas terik dan potensi mendung lokal. Pastikan payung gerobak terpasang kuat.",
          },
          {
            slot: "EVENING",
            time_range: "15:00 - 17:00 WIB",
            c4_score: Number(((timeline.available_slots.sore?.max_rain_probability || 0) / 100).toFixed(2)),
            status: (timeline.available_slots.sore?.max_rain_probability || 0) > 60 ? "BAHAYA HUJAN" : (timeline.available_slots.sore?.max_rain_probability || 0) > 30 ? "WASPADA" : "AMAN",
            advisory: (timeline.available_slots.sore?.max_rain_probability || 0) > 60
              ? "Peluang hujan lebat sore hari: prioritaskan titik teduh."
              : "Kondisi kondusif untuk jam pulang kantor / sore santai.",
          },
          {
            slot: "NIGHT",
            time_range: "18:00 - 21:00 WIB",
            c4_score: Number(((timeline.available_slots.malam?.max_rain_probability || 0) / 100).toFixed(2)),
            status: (timeline.available_slots.malam?.max_rain_probability || 0) > 60 ? "BAHAYA HUJAN" : (timeline.available_slots.malam?.max_rain_probability || 0) > 30 ? "WASPADA" : "AMAN",
            advisory: (timeline.available_slots.malam?.max_rain_probability || 0) > 60
              ? "Hujan malam: siapkan penutup armada dan titik kumpul aman."
              : "Kondisi cuaca berangsur kondusif untuk shift santai malam.",
          },
        ]
      : [];

    return {
      zone_id: zone.id,
      zone_name: zone.name,
      skor_c4: evaluation.skor_c4,
      max_precipitation_probability: evaluation.max_precipitation_probability,
      avg_precipitation_probability: evaluation.avg_precipitation_probability,
      data_quality: evaluation.data_quality || (hourlyData ? "FRESH" : "DEGRADED"),
      source: evaluation.source || (hourlyData ? "OPEN_METEO" : "CONSERVATIVE_BASELINE"),
      warning: evaluation.warning || null,
      supporting_info: evaluation.supporting_info,
      active_time_slot: evaluation.active_slot,
      is_off_hours: evaluation.is_off_hours,
      operational_hours_window: "06:00 - 21:00",
      slots,
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
   * Calculate HUB Level & Zone-List Weather Overview with Macro Aggregation (Today or Tomorrow H+1)
   */
  async getHubWeatherOverview(arg1 = "ALL", arg2 = new Date(), arg3 = "today", arg4 = "all") {
    // Support both single options object and positional arguments
    let cityName = "ALL";
    let timeInput = new Date();
    let targetDate = "today";
    let targetSlot = "all";

    if (typeof arg1 === "object" && arg1 !== null && !(arg1 instanceof Date)) {
      cityName = arg1.cityName || "ALL";
      timeInput = arg1.timeInput || new Date();
      targetDate = arg1.targetDate || "today";
      targetSlot = arg1.targetSlot || "all";
    } else {
      cityName = arg1 || "ALL";
      timeInput = arg2 || new Date();
      targetDate = arg3 || "today";
      targetSlot = arg4 || "all";
    }

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
        target_date: targetDate,
        is_tomorrow: targetDate === "tomorrow",
        total_zones: 0,
        hub_overview: {
          avg_temperature_c: 0,
          feels_like_c: 0,
          max_rain_probability_percent: 0,
          rain_volume_mm: 0,
          humidity_percent: 0,
          wind_speed_kmh: 0,
          dew_point_c: 0,
          weather_condition: "Unknown",
          weather_code: 0,
          active_time_slot: "off_hours",
          operational_hours: "06:00 - 21:00",
          c4_score: 0.5,
        },
        hub_timeline: [],
        hub_c4_slots: [],
        zones_weather_list: [],
      };
    }

    const zonesWeatherList = [];
    const zoneTimelines = [];
    let resolvedDateStr = "";

    // Fetch and evaluate timeline for each zone
    for (const loc of filteredCentroids) {
      const hourlyData = await this.getHourlyForecastForZone(loc.zone_id);
      const timelineResult = this.evaluator.extractHourlyTimeline({
        hourlyData,
        targetDate,
        targetSlot,
      });

      resolvedDateStr = timelineResult.target_date || resolvedDateStr;
      zoneTimelines.push({
        zone_id: loc.zone_id,
        zone_name: loc.name,
        timeline: timelineResult.hourly_timeline || [],
        available_slots: timelineResult.available_slots || {},
      });

      const summary = timelineResult.slot_summary || {};
      const firstHour = timelineResult.hourly_timeline?.[0] || {};
      const maxRain = summary.max_rain_probability ?? firstHour.rain_probability_percent ?? 0;
      const temp = summary.avg_temperature_c ?? firstHour.temperature_c ?? 28.5;
      const weatherCode = firstHour.weather_code ?? 1;

      zonesWeatherList.push({
        zone_id: loc.zone_id,
        zone_name: loc.name,
        latitude: loc.latitude,
        longitude: loc.longitude,
        skor_c4_cost: Number(((maxRain / 100)).toFixed(2)),
        rain_probability_percent: maxRain,
        rain_volume_mm: firstHour.rain_volume_mm ?? 0,
        temperature_c: temp,
        weather_code: weatherCode,
        weather_condition: this.getWmoWeatherLabel(weatherCode),
        risk_level: maxRain > 60 ? "HIGH" : maxRain > 30 ? "MEDIUM" : "LOW",
      });
    }

    // ─────────────────────────────────────────────────────────────
    // MACRO HUB TIMELINE AGGREGATION (06:00 - 21:00 WIB)
    // ─────────────────────────────────────────────────────────────
    const operationalHours = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
    const hubTimeline = operationalHours.map((hour) => {
      const hourStr = `${String(hour).padStart(2, "0")}:00`;
      const hourSamples = [];

      for (const zt of zoneTimelines) {
        const found = zt.timeline.find((item) => item.hour === hour);
        if (found) {
          hourSamples.push(found);
        }
      }

      if (hourSamples.length === 0) {
        return {
          time: hourStr,
          hour,
          temperature_c: 29.0,
          apparent_temperature: 31.0,
          rain_probability_percent: 15,
          rain_volume_mm: 0,
          weather_code: 1,
          weather_label: "Cerah Berawan",
          icon: "partly-cloudy-day",
          severity: "LOW",
          wind_speed_kmh: 12.0,
          humidity_percent: 70,
          dew_point_c: 23.0,
        };
      }

      const count = hourSamples.length;
      const avgTemp = Math.round((hourSamples.reduce((sum, s) => sum + s.temperature_c, 0) / count) * 10) / 10;
      const avgFeels = Math.round((hourSamples.reduce((sum, s) => sum + (s.apparent_temperature || s.temperature_c), 0) / count) * 10) / 10;
      const maxRainProb = Math.max(...hourSamples.map((s) => s.rain_probability_percent || 0));
      const maxRainMm = Math.max(...hourSamples.map((s) => s.rain_volume_mm || 0));
      const avgWind = Math.round((hourSamples.reduce((sum, s) => sum + s.wind_speed_kmh, 0) / count) * 10) / 10;
      const avgHum = Math.round(hourSamples.reduce((sum, s) => sum + s.humidity_percent, 0) / count);
      const avgDew = Math.round((hourSamples.reduce((sum, s) => sum + s.dew_point_c, 0) / count) * 10) / 10;

      // Select most severe or dominant weather code
      const rainHeavySample = hourSamples.find((s) => s.weather_code >= 61);
      const dominantSample = rainHeavySample || hourSamples[0];

      return {
        time: hourStr,
        hour,
        temperature_c: avgTemp,
        apparent_temperature: avgFeels,
        rain_probability_percent: maxRainProb,
        rain_volume_mm: maxRainMm,
        weather_code: dominantSample.weather_code,
        weather_label: dominantSample.weather_label,
        icon: dominantSample.icon,
        severity: maxRainProb > 60 ? "HIGH" : maxRainProb > 30 ? "MEDIUM" : "LOW",
        wind_speed_kmh: avgWind,
        humidity_percent: avgHum,
        dew_point_c: avgDew,
      };
    });

    // ─────────────────────────────────────────────────────────────
    // 4-SLOT C4 WEATHER RISK EVALUATION ACROSS HUB
    // ─────────────────────────────────────────────────────────────
    const getSlotTimeline = (startH, endH) => hubTimeline.filter((h) => h.hour >= startH && h.hour <= endH);
    
    const morningList = getSlotTimeline(6, 10);
    const afternoonList = getSlotTimeline(11, 14);
    const eveningList = getSlotTimeline(15, 17);
    const nightList = getSlotTimeline(18, 21);

    const calcSlotSummary = (list, slotName, timeRange, advisoryTextHigh, advisoryTextNormal) => {
      const maxRain = list.length > 0 ? Math.max(...list.map((h) => h.rain_probability_percent)) : 10;
      const c4Score = Number(((maxRain / 100)).toFixed(2));
      const status = maxRain > 60 ? "BAHAYA HUJAN" : maxRain > 30 ? "WASPADA" : "AMAN";
      return {
        slot: slotName,
        time_range: timeRange,
        c4_score: c4Score,
        max_rain_probability: maxRain,
        status,
        advisory: maxRain > 60 ? advisoryTextHigh : advisoryTextNormal,
      };
    };

    const hubC4Slots = [
      calcSlotSummary(
        morningList,
        "MORNING",
        "06:00 - 10:00 WIB",
        "Peluang hujan tinggi: prioritaskan shelter POI beratap dan siapkan jas hujan rider.",
        "Sangat baik untuk plotting seluruh gerobak di titik terbuka."
      ),
      calcSlotSummary(
        afternoonList,
        "AFTERNOON",
        "11:00 - 14:00 WIB",
        "Waspada potensi hujan deras siang hari, pantau shelter terdekat.",
        "Panas terik dan potensi mendung lokal. Pastikan payung gerobak terpasang kuat."
      ),
      calcSlotSummary(
        eveningList,
        "EVENING",
        "15:00 - 17:00 WIB",
        "Peluang hujan lebat tinggi: prioritaskan shelter POI beratap dan siapkan jas hujan rider.",
        "Kondisi cuaca berangsur kondusif untuk jam pulang kantor / sore santai."
      ),
      calcSlotSummary(
        nightList,
        "NIGHT",
        "18:00 - 21:00 WIB",
        "Hujan malam: siapkan penutup armada dan prioritaskan rute dekat shelter.",
        "Kondisi cuaca berangsur kondusif untuk shift santai malam."
      ),
    ];

    // ─────────────────────────────────────────────────────────────
    // GLOBAL HUB OVERVIEW MACRO SUMMARY
    // ─────────────────────────────────────────────────────────────
    const allHubTemps = hubTimeline.map((h) => h.temperature_c);
    const avgHubTemp = allHubTemps.length > 0 ? Math.round((allHubTemps.reduce((a, b) => a + b, 0) / allHubTemps.length) * 10) / 10 : 29.0;
    const maxHubRain = Math.max(...hubTimeline.map((h) => h.rain_probability_percent), 0);
    const maxHubRainMm = Math.max(...hubTimeline.map((h) => h.rain_volume_mm), 0);
    const avgHubHumidity = Math.round(hubTimeline.reduce((a, b) => a + b.humidity_percent, 0) / (hubTimeline.length || 1));
    const avgHubWind = Math.round((hubTimeline.reduce((a, b) => a + b.wind_speed_kmh, 0) / (hubTimeline.length || 1)) * 10) / 10;
    const avgHubDew = Math.round((hubTimeline.reduce((a, b) => a + b.dew_point_c, 0) / (hubTimeline.length || 1)) * 10) / 10;
    const avgHubFeels = Math.round((hubTimeline.reduce((a, b) => a + b.apparent_temperature, 0) / (hubTimeline.length || 1)) * 10) / 10;

    // Dominant weather code in timeline
    const worstTimelineItem = hubTimeline.find((h) => h.rain_probability_percent === maxHubRain) || hubTimeline[0] || {};
    const mainWeatherCode = worstTimelineItem.weather_code || 1;
    const mainWeatherCondition = worstTimelineItem.weather_label || this.getWmoWeatherLabel(mainWeatherCode);

    return {
      status: "success",
      hub_city_name: cityName.toUpperCase(),
      target_date: resolvedDateStr,
      is_tomorrow: targetDate === "tomorrow",
      total_zones: filteredCentroids.length,
      hub_overview: {
        avg_temperature_c: avgHubTemp,
        feels_like_c: avgHubFeels,
        max_rain_probability_percent: maxHubRain,
        rain_volume_mm: maxHubRainMm,
        humidity_percent: avgHubHumidity,
        wind_speed_kmh: avgHubWind,
        dew_point_c: avgHubDew,
        weather_condition: mainWeatherCondition,
        weather_code: mainWeatherCode,
        active_time_slot: targetSlot === "all" ? "Seluruh Jam Operasional" : targetSlot,
        operational_hours: "06:00 - 21:00",
        c4_score: Number(((maxHubRain / 100)).toFixed(2)),
      },
      hub_timeline: hubTimeline,
      hub_c4_slots: hubC4Slots,
      zones_weather_list: zonesWeatherList,
    };
  }

  /**
   * Fetch Hourly Weather Timeline for a Zone (paired with time slots for Today / Tomorrow)
   */
  async getZoneWeatherTimeline({ zoneId, targetDate = "today", targetSlot = "all" }) {
    // Handle aggregate/all requests gracefully without 404
    if (!zoneId || zoneId === "all" || zoneId === "zone-all" || zoneId === "hub") {
      const hub = await this.getHubWeatherOverview({ cityName: "Sidoarjo", targetDate, targetSlot });
      return {
        status: "success",
        zone_id: "all",
        zone_name: "Central Hub (Sidoarjo Area)",
        target_date: hub.target_date,
        selected_slot: targetSlot,
        slot_summary: {
          label: targetSlot === "all" ? "Seluruh Jam Operasional (06:00 - 21:00)" : targetSlot,
          avg_temperature_c: hub.hub_overview.avg_temperature_c,
          max_rain_probability: hub.hub_overview.max_rain_probability_percent,
          dominant_condition: hub.hub_overview.weather_condition,
          skor_c4_dss: hub.hub_overview.max_rain_probability_percent,
          risk_level: hub.hub_overview.max_rain_probability_percent > 60 ? "HIGH" : hub.hub_overview.max_rain_probability_percent > 30 ? "MEDIUM" : "LOW",
        },
        hourly_timeline: hub.hub_timeline,
        available_slots: hub.hub_c4_slots.reduce((acc, slotItem) => {
          const key = slotItem.slot.toLowerCase() === "morning" ? "pagi" : slotItem.slot.toLowerCase() === "afternoon" ? "siang" : slotItem.slot.toLowerCase() === "evening" ? "sore" : "malam";
          acc[key] = {
            slot_key: key,
            label: `${slotItem.slot} (${slotItem.time_range})`,
            max_rain_probability: slotItem.max_rain_probability,
            c4_score: slotItem.c4_score,
            status: slotItem.status,
            advisory: slotItem.advisory,
          };
          return acc;
        }, {}),
      };
    }

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
