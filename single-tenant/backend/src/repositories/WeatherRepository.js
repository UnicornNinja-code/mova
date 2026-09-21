/*
 * WeatherRepository.js
 * Data Access Layer for Weather Caching & PostGIS Zone Centroid Calculations.
 */

import { pool } from "../config/database.js";

export class WeatherRepository {
  static instance = null;

  constructor(dbPool = pool) {
    if (WeatherRepository.instance && dbPool === pool) {
      return WeatherRepository.instance;
    }
    this.pool = dbPool;
    if (dbPool === pool) {
      WeatherRepository.instance = this;
    }
  }

  static getInstance(dbPool = pool) {
    if (!WeatherRepository.instance) {
      WeatherRepository.instance = new WeatherRepository(dbPool);
    }
    return WeatherRepository.instance;
  }

  /**
   * Helper to format zone.polygon to GeoJSON string
   */
  formatPolygonToGeoJSON(polygon) {
    if (!polygon) return null;
    let parsed = polygon;
    if (typeof polygon === "string") {
      try {
        parsed = JSON.parse(polygon);
      } catch (e) {
        return null;
      }
    }
    if (parsed.type === "Polygon") return JSON.stringify(parsed);
    if (parsed.type === "Feature" && parsed.geometry) return JSON.stringify(parsed.geometry);
    if (Array.isArray(parsed) && parsed.length >= 3) {
      const coordinates = parsed.map((pt) => {
        if (Array.isArray(pt)) {
          const isLonFirst = Math.abs(pt[0]) > Math.abs(pt[1]);
          return [parseFloat(isLonFirst ? pt[0] : pt[1]), parseFloat(isLonFirst ? pt[1] : pt[0])];
        }
        return [parseFloat(pt.lon || pt.lng || 0), parseFloat(pt.lat || 0)];
      });
      const first = coordinates[0];
      const last = coordinates[coordinates.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        coordinates.push([first[0], first[1]]);
      }
      return JSON.stringify({ type: "Polygon", coordinates: [coordinates] });
    }
    return null;
  }

  /**
   * Fetch Centroid (latitude, longitude) of all active zones using PostGIS ST_Centroid
   * @returns {Promise<Array<{zone_id: string, name: string, latitude: number, longitude: number}>>}
   */
  async getAllZoneCentroids() {
    const query = `SELECT id, name, polygon FROM zones WHERE status = 'ACTIVE';`;
    const { rows } = await this.pool.query(query);

    const centroids = [];
    for (const z of rows) {
      const geoJsonStr = this.formatPolygonToGeoJSON(z.polygon);
      if (!geoJsonStr) continue;

      const centroidQuery = `
        SELECT 
          ST_Y(ST_Centroid(ST_GeomFromGeoJSON($1))) AS latitude,
          ST_X(ST_Centroid(ST_GeomFromGeoJSON($1))) AS longitude;
      `;
      const res = await this.pool.query(centroidQuery, [geoJsonStr]);
      if (res.rows[0]) {
        centroids.push({
          zone_id: z.id,
          name: z.name,
          latitude: parseFloat(res.rows[0].latitude),
          longitude: parseFloat(res.rows[0].longitude),
        });
      }
    }
    return centroids;
  }

  /**
   * Fetch Centroid of a single zone by ID
   */
  async getZoneCentroid(zoneId) {
    const query = `SELECT id, name, polygon FROM zones WHERE id = $1;`;
    const { rows } = await this.pool.query(query, [zoneId]);
    if (!rows[0]) return null;

    const geoJsonStr = this.formatPolygonToGeoJSON(rows[0].polygon);
    if (!geoJsonStr) return null;

    const centroidQuery = `
      SELECT 
        ST_Y(ST_Centroid(ST_GeomFromGeoJSON($1))) AS latitude,
        ST_X(ST_Centroid(ST_GeomFromGeoJSON($1))) AS longitude;
    `;
    const res = await this.pool.query(centroidQuery, [geoJsonStr]);
    if (!res.rows[0]) return null;

    return {
      zone_id: rows[0].id,
      name: rows[0].name,
      latitude: parseFloat(res.rows[0].latitude),
      longitude: parseFloat(res.rows[0].longitude),
    };
  }

  /**
   * Fetch cached weather for a zone if still fresh (expires_at > NOW())
   */
  async getCachedWeather(zoneId, ttlMinutes = 30) {
    const query = `
      SELECT * FROM weathers 
      WHERE zone_id = $1 
        AND (expires_at > NOW() OR updated_at >= NOW() - ($2 || ' minutes')::interval)
      ORDER BY updated_at DESC
      LIMIT 1;
    `;
    const { rows } = await this.pool.query(query, [zoneId, ttlMinutes]);
    return rows[0] || null;
  }

  /**
   * Upsert cached weather payload into weathers table with DB-level freshness
   */
  async saveCachedWeather(zoneId, weatherPayload, ttlMinutes = 30) {
    const supporting = weatherPayload.supporting_info || {};
    const riskScore = weatherPayload.skor_c4 !== undefined ? weatherPayload.skor_c4 : (weatherPayload.weather_risk_score || 0);
    const conditionLabel = weatherPayload.condition_label || supporting.condition_label || "Normal";

    // Delete previous cached entry for this zone to keep table clean
    await this.pool.query(`DELETE FROM weathers WHERE zone_id = $1;`, [zoneId]);

    const query = `
      INSERT INTO weathers (
        zone_id, timestamp, temperature_2m, relative_humidity_2m, 
        dew_point_2m, apparent_temperature, precipitation_probability, 
        precipitation, rain, weather_code, showers, visibility,
        weather_risk_score, condition_label, expires_at, updated_at
      ) VALUES (
        $1, CURRENT_TIMESTAMP, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
        $12, $13, CURRENT_TIMESTAMP + ($14 || ' minutes')::interval, CURRENT_TIMESTAMP
      ) RETURNING *;
    `;

    const values = [
      zoneId,
      supporting.temperature || 0,
      supporting.humidity || 0,
      supporting.dew_point || 0,
      supporting.temperature || 0,
      weatherPayload.max_precipitation_probability || 0,
      weatherPayload.precipitation || 0,
      supporting.rain || 0,
      supporting.weather_code || 0,
      0,
      10000,
      riskScore,
      conditionLabel,
      ttlMinutes,
    ];

    const { rows } = await this.pool.query(query, values);
    
    if (rows[0]) {
      rows[0].hourly_cache = weatherPayload.hourly;
    }
    return rows[0];
  }

  /**
   * Bulk UPSERT hourly weather records into zone_hourly_weathers table
   * @param {string} zoneId
   * @param {Array<object>} hourlyList Array of hourly weather point records
   * @param {Date} [syncedAt]
   */
  async saveBatchHourlyWeather(zoneId, hourlyList, syncedAt = new Date()) {
    if (!zoneId || !Array.isArray(hourlyList) || hourlyList.length === 0) {
      return [];
    }

    const valueRows = [];
    const values = [];
    let paramIndex = 1;

    for (const item of hourlyList) {
      valueRows.push(`(
        $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++},
        $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++},
        $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++},
        $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}
      )`);

      values.push(
        zoneId,
        item.forecast_time instanceof Date ? item.forecast_time.toISOString() : item.forecast_time,
        Number(item.temperature_2m ?? item.temp ?? 0),
        Number(item.apparent_temperature ?? item.feels_like ?? item.temperature_2m ?? 0),
        Number(item.relative_humidity_2m ?? item.humidity ?? 0),
        Number(item.dew_point_2m ?? item.dew_point ?? 0),
        Number(item.precipitation_probability ?? item.rain_prob ?? 0),
        Number(item.precipitation ?? item.rain_mm ?? 0),
        Number(item.rain ?? item.rain_mm ?? 0),
        Number(item.weather_code ?? 0),
        Number(item.wind_speed_10m ?? item.wind_speed ?? 0),
        Number(item.weather_risk_score ?? item.c4_score ?? 0),
        item.condition_label || item.weather_label || "Cerah",
        item.data_quality || "VALID",
        item.source || "OPEN_METEO",
        syncedAt
      );
    }

    const query = `
      INSERT INTO "zone_hourly_weathers" (
        "zone_id", "forecast_time", "temperature_2m", "apparent_temperature",
        "relative_humidity_2m", "dew_point_2m", "precipitation_probability",
        "precipitation", "rain", "weather_code", "wind_speed_10m",
        "weather_risk_score", "condition_label", "data_quality", "source", "synced_at"
      ) VALUES ${valueRows.join(", ")}
      ON CONFLICT ("zone_id", "forecast_time") DO UPDATE SET
        "temperature_2m" = EXCLUDED."temperature_2m",
        "apparent_temperature" = EXCLUDED."apparent_temperature",
        "relative_humidity_2m" = EXCLUDED."relative_humidity_2m",
        "dew_point_2m" = EXCLUDED."dew_point_2m",
        "precipitation_probability" = EXCLUDED."precipitation_probability",
        "precipitation" = EXCLUDED."precipitation",
        "rain" = EXCLUDED."rain",
        "weather_code" = EXCLUDED."weather_code",
        "wind_speed_10m" = EXCLUDED."wind_speed_10m",
        "weather_risk_score" = EXCLUDED."weather_risk_score",
        "condition_label" = EXCLUDED."condition_label",
        "data_quality" = EXCLUDED."data_quality",
        "source" = EXCLUDED."source",
        "synced_at" = EXCLUDED."synced_at",
        "updated_at" = CURRENT_TIMESTAMP
      RETURNING id, forecast_time;
    `;

    const { rows } = await this.pool.query(query, values);
    return rows;
  }

  /**
   * Fetch hourly weather forecast for a zone from zone_hourly_weathers
   * @param {string} zoneId
   * @param {Date|string} [startDate]
   * @param {Date|string} [endDate]
   * @returns {Promise<{ rows: Array<object>, hourly: object }>}
   */
  async getZoneHourlyForecast(zoneId, startDate = null, endDate = null) {
    let query = `
      SELECT 
        id, zone_id, forecast_time, temperature_2m, apparent_temperature,
        relative_humidity_2m, dew_point_2m, precipitation_probability,
        precipitation, rain, weather_code, wind_speed_10m,
        weather_risk_score, condition_label, data_quality, source, synced_at
      FROM "zone_hourly_weathers"
      WHERE zone_id = $1
    `;
    const params = [zoneId];

    if (startDate && endDate) {
      params.push(startDate, endDate);
      query += ` AND forecast_time >= $2 AND forecast_time <= $3`;
    } else if (startDate) {
      params.push(startDate);
      query += ` AND forecast_time >= $2`;
    }

    query += ` ORDER BY forecast_time ASC;`;

    const { rows } = await this.pool.query(query, params);

    // Format into Open-Meteo compatible hourly object
    const hourly = {
      time: [],
      temperature_2m: [],
      apparent_temperature: [],
      relative_humidity_2m: [],
      dew_point_2m: [],
      precipitation_probability: [],
      precipitation: [],
      rain: [],
      weather_code: [],
      wind_speed_10m: [],
    };

    for (const r of rows) {
      const isoStr = r.forecast_time instanceof Date ? r.forecast_time.toISOString() : String(r.forecast_time);
      // Format as YYYY-MM-DDTHH:00
      const formattedTime = isoStr.replace(/\.\d+Z$/, "").slice(0, 16);
      hourly.time.push(formattedTime);
      hourly.temperature_2m.push(parseFloat(r.temperature_2m));
      hourly.apparent_temperature.push(parseFloat(r.apparent_temperature ?? r.temperature_2m));
      hourly.relative_humidity_2m.push(parseFloat(r.relative_humidity_2m));
      hourly.dew_point_2m.push(parseFloat(r.dew_point_2m));
      hourly.precipitation_probability.push(parseFloat(r.precipitation_probability));
      hourly.precipitation.push(parseFloat(r.precipitation));
      hourly.rain.push(parseFloat(r.rain));
      hourly.weather_code.push(parseInt(r.weather_code, 10));
      hourly.wind_speed_10m.push(parseFloat(r.wind_speed_10m));
    }

    return { rows, hourly: rows.length > 0 ? hourly : null };
  }

  /**
   * Check if weather data in database for a zone is fresh
   * @param {string} zoneId
   * @param {number} maxAgeMinutes (default 30 mins)
   */
  async checkZoneWeatherFreshness(zoneId, maxAgeMinutes = 30) {
    const query = `
      SELECT 
        MAX(synced_at) AS last_synced,
        COUNT(*) AS total_records,
        COUNT(*) FILTER (WHERE forecast_time >= CURRENT_DATE) AS future_records
      FROM "zone_hourly_weathers"
      WHERE zone_id = $1;
    `;
    const { rows } = await this.pool.query(query, [zoneId]);
    const lastSynced = rows[0]?.last_synced;
    const futureCount = parseInt(rows[0]?.future_records || "0", 10);

    if (!lastSynced || futureCount === 0) {
      return { isFresh: false, lastSynced: null, totalRecords: 0 };
    }

    const ageMs = Date.now() - new Date(lastSynced).getTime();
    const isFresh = ageMs < maxAgeMinutes * 60 * 1000;

    return {
      isFresh,
      lastSynced: new Date(lastSynced),
      totalRecords: parseInt(rows[0]?.total_records || "0", 10),
    };
  }
}

export const weatherRepository = WeatherRepository.getInstance();

