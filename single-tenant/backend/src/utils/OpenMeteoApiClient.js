/*
 * OpenMeteoApiClient.js
 * Singleton Client for Open-Meteo Weather API with batch multi-coordinate query support & resilient backoff retries.
 */

const DEFAULT_BASE_URL = "https://api.open-meteo.com/v1/forecast";
const DEFAULT_FORECAST_DAYS = 3;
const DEFAULT_TIMEOUT_MS = 10000;
const MAX_RETRIES = 2;
const BASE_RETRY_DELAY_MS = 1000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class OpenMeteoApiClient {
  static instance = null;

  constructor(baseUrl = DEFAULT_BASE_URL) {
    if (OpenMeteoApiClient.instance) {
      return OpenMeteoApiClient.instance;
    }
    this.baseUrl = baseUrl;
    OpenMeteoApiClient.instance = this;
  }

  static getInstance() {
    if (!OpenMeteoApiClient.instance) {
      OpenMeteoApiClient.instance = new OpenMeteoApiClient();
    }
    return OpenMeteoApiClient.instance;
  }

  /**
   * Batch fetch hourly weather forecast for array of locations [{ zone_id, latitude, longitude }]
   * @param {Array<{zone_id: string, latitude: number, longitude: number}>} locations 
   * @param {number} forecastDays - Number of forecast days (default 3: today, tomorrow, day after)
   * @returns {Promise<Array<{zone_id: string, latitude: number, longitude: number, hourly: object}>>}
   */
  async fetchBatchWeather(locations, forecastDays = DEFAULT_FORECAST_DAYS) {
    if (!Array.isArray(locations) || locations.length === 0) {
      return [];
    }

    const validLocations = locations.filter(
      (l) => l && !isNaN(Number(l.latitude)) && !isNaN(Number(l.longitude))
    );

    if (validLocations.length === 0) {
      return [];
    }

    const lats = validLocations.map((l) => Number(l.latitude).toFixed(6)).join(",");
    const lons = validLocations.map((l) => Number(l.longitude).toFixed(6)).join(",");

    const hourlyParams = [
      "precipitation_probability",
      "precipitation",
      "rain",
      "weather_code",
      "wind_speed_10m",
      "relative_humidity_2m",
      "dew_point_2m",
      "apparent_temperature",
    ].join(",");

    const url = `${this.baseUrl}?latitude=${lats}&longitude=${lons}&hourly=${hourlyParams}&forecast_days=${forecastDays}&timezone=Asia%2FJakarta`;

    let lastError = null;

    for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS) });
        if (!response.ok) {
          throw new Error(`Open-Meteo API HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const rawResults = Array.isArray(data) ? data : [data];

        return validLocations.map((loc, idx) => {
          const raw = rawResults[idx] || rawResults[0] || {};
          return {
            zone_id: loc.zone_id,
            latitude: loc.latitude,
            longitude: loc.longitude,
            hourly: raw.hourly || {},
            fetched_at: new Date(),
          };
        });
      } catch (error) {
        lastError = error;
        if (attempt <= MAX_RETRIES) {
          const delayMs = attempt * BASE_RETRY_DELAY_MS;
          console.warn(`⚠️ [OpenMeteoApiClient] Percobaan ${attempt} gagal (${error.message}). Retry dalam ${delayMs}ms...`);
          await sleep(delayMs);
        }
      }
    }

    console.error("❌ Error fetching Open-Meteo batch weather after retries:", lastError?.message);
    throw lastError;
  }
}

export const openMeteoApiClient = OpenMeteoApiClient.getInstance();

