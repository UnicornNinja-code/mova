import { syncRunRepository } from "../repositories/syncRunRepository.js";
import { POIEltPipelineService } from "../services/poiService.js";
import { POIWeatherService } from "../services/poi/POIWeatherService.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";

const DEFAULT_SYNC_RUNS_LIMIT = 20;

const poiPipelineService = new POIEltPipelineService();
const weatherService = POIWeatherService.getInstance();

const handleControllerError = (res, error, defaultStatus = 500) => {
  const statusCode = error.statusCode || defaultStatus;
  return sendError(res, error.message || "Internal server error", statusCode, error.details || null);
};

export const getSyncStatus = async (req, res) => {
  try {
    const summary = await syncRunRepository.getLatestStatusSummary();
    return sendSuccess(res, summary, "Sync status retrieved successfully", 200, {
      freshness_summary: summary,
    });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const getSyncRuns = async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : DEFAULT_SYNC_RUNS_LIMIT;
    const runs = await syncRunRepository.getRecentRuns(limit);
    return sendSuccess(res, runs, "Sync runs retrieved successfully", 200, {
      total: runs.length,
      runs,
    });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const triggerPoiSync = async (req, res) => {
  try {
    const { city } = req.body || {};
    const result = await poiPipelineService.syncCityPois(city || null);
    return sendSuccess(
      res,
      result,
      "Sinkronisasi POI Overpass API berhasil diproses dan dicatat ke data_sync_runs.",
      200,
      { result }
    );
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const triggerWeatherSync = async (req, res) => {
  try {
    const run = await syncRunRepository.startRun({
      data_type: "WEATHER",
      source: "OPEN_METEO",
      metadata: { trigger: "MANUAL" },
    });

    try {
      const result = await weatherService.syncAllZonesWeather(true);
      await syncRunRepository.completeRun(run.id, {
        records_fetched: result.length,
        records_processed: result.length,
        records_rejected: 0,
        metadata: { zones_count: result.length },
      });

      return sendSuccess(
        res,
        result,
        `Sinkronisasi cuaca Open-Meteo berhasil diproses (${result.length} zona).`,
        200,
        { zones_updated: result.length }
      );
    } catch (err) {
      await syncRunRepository.failRun(run.id, err.message, { trigger: "MANUAL" });
      throw err;
    }
  } catch (error) {
    return handleControllerError(res, error);
  }
};
