import {
  getZoneC4ScoreService,
  getZoneWeatherTimelineService,
  getHubWeatherOverviewService,
  syncAllZonesWeatherService,
} from "../services/poiService.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";

const handleControllerError = (res, error, defaultStatus = 500) => {
  const statusCode = error.statusCode || defaultStatus;
  return sendError(res, error.message || "Internal server error", statusCode);
};

export const getZoneC4Score = async (req, res) => {
  try {
    const { zone_id } = req.params;
    const { time, date } = req.query;
    const result = await getZoneC4ScoreService(zone_id, time, date);
    return sendSuccess(res, result, "Skor cuaca C4 berhasil dimuat.", 200, result);
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const getZoneWeatherInfo = async (req, res) => {
  try {
    const { zone_id } = req.params;
    const { time, date } = req.query;
    const result = await getZoneC4ScoreService(zone_id, time, date);

    const payload = {
      zone_id: result.zone_id,
      zone_name: result.zone_name,
      weather_widget: {
        rain_mm: result.supporting_info?.rain ?? 0,
        weather_code: result.supporting_info?.weather_code ?? 0,
        wind_speed_kmh: result.supporting_info?.wind_speed ?? 0,
        humidity_percent: result.supporting_info?.humidity ?? 0,
        dew_point_c: result.supporting_info?.dew_point ?? 0,
        temperature_c: result.supporting_info?.temperature ?? 0,
        max_rain_probability_percent: result.max_precipitation_probability ?? 0,
      },
      time_slot: result.active_time_slot,
      operational_hours: result.operational_hours_window,
      slots: result.slots || [],
    };

    return sendSuccess(res, payload, "Informasi cuaca zona berhasil dimuat.", 200, payload);
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const getZoneWeatherTimeline = async (req, res) => {
  try {
    const { zone_id } = req.params;
    const { date, slot } = req.query;
    const result = await getZoneWeatherTimelineService({
      zoneId: zone_id,
      targetDate: date || "today",
      targetSlot: slot || "all",
    });
    return sendSuccess(res, result, "Timeline cuaca zona berhasil dimuat.", 200, result);
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const getHubWeatherInfo = async (req, res) => {
  try {
    const { city_name } = req.params;
    const { time, date, slot } = req.query;
    const cityName = city_name || req.query.city || "Sidoarjo";
    const result = await getHubWeatherOverviewService(cityName, time, date || "today", slot || "all");
    return sendSuccess(res, result, "Informasi cuaca kota hub berhasil dimuat.", 200, result);
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const syncWeather = async (req, res) => {
  try {
    const batch = await syncAllZonesWeatherService();
    return sendSuccess(
      res,
      batch,
      `Data cuaca untuk ${batch.length} zona berhasil diperbarui dari Open-Meteo API`,
      200,
      { count: batch.length }
    );
  } catch (error) {
    return handleControllerError(res, error);
  }
};
