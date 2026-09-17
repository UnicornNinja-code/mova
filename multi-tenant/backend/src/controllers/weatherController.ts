/*
 * weatherController.ts
 * Controller for Weather Information & Criteria C4 DSS Evaluation in TypeScript
 */

import type { Request, Response } from "express";
import {
  getZoneC4ScoreService,
  getHubWeatherOverviewService,
  syncAllZonesWeatherService,
} from "../services/poiService.js";

export const getZoneC4Score = async (req: Request, res: Response): Promise<any> => {
  try {
    const zone_id = req.params.zone_id as string;
    const { time } = req.query as { time?: string };
    const result = await getZoneC4ScoreService(zone_id, time);
    return res.status(200).json(result);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const getZoneWeatherInfo = async (req: Request, res: Response): Promise<any> => {
  try {
    const zone_id = req.params.zone_id as string;
    const { time } = req.query as { time?: string };
    const result = await getZoneC4ScoreService(zone_id, time);
    return res.status(200).json({
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
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

import { operationalContextService } from "../services/spatial/OperationalContextService.js";

export const getHubWeatherInfo = async (req: Request, res: Response): Promise<any> => {
  try {
    let city_name = req.params.city_name as string;
    if (!city_name || city_name.toLowerCase() === "default" || city_name.toLowerCase() === "hub") {
      const opContext = await operationalContextService.getOperationalContext();
      city_name = opContext.hubCityName;
    }
    const { time } = req.query as { time?: string };
    const result = await getHubWeatherOverviewService(city_name, time);
    return res.status(200).json(result);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const syncWeather = async (req: Request, res: Response): Promise<any> => {
  try {
    const batch = await syncAllZonesWeatherService();
    return res.status(200).json({
      msg: `Data cuaca untuk ${batch.length} zona berhasil diperbarui dari Open-Meteo API`,
      count: batch.length,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};
