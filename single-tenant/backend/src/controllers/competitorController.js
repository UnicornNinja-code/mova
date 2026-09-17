import {
  getZoneC6ScoreService,
  getCompetitorsByZoneService,
  createCompetitorService,
  deleteCompetitorService,
  getCompetitorsSummaryService,
} from "../services/poiService.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";

const handleControllerError = (res, error, defaultStatus = 500) => {
  const statusCode = error.statusCode || defaultStatus;
  return sendError(res, error.message || "Internal server error", statusCode);
};

export const getZoneC6Score = async (req, res) => {
  try {
    const { zone_id } = req.params;
    const result = await getZoneC6ScoreService(zone_id);
    return sendSuccess(res, result, "Skor kompetitor C6 berhasil dimuat.", 200, result);
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const getCompetitorsByZone = async (req, res) => {
  try {
    const { zone_id } = req.params;
    const competitors = await getCompetitorsByZoneService(zone_id);
    return sendSuccess(res, competitors, "Daftar kompetitor zona berhasil dimuat.", 200, {
      competitors,
      count: competitors.length,
    });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const createCompetitor = async (req, res) => {
  try {
    const data = req.body;
    const competitor = await createCompetitorService(data);
    return sendSuccess(res, competitor, "Data kompetitor berhasil ditambahkan", 201, { competitor });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const deleteCompetitor = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await deleteCompetitorService(id);
    return sendSuccess(res, result, "Data kompetitor berhasil dihapus", 200, result);
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const getCompetitorSummary = async (req, res) => {
  try {
    const summary = await getCompetitorsSummaryService();
    return sendSuccess(res, summary, "Ringkasan data kompetitor berhasil dimuat.", 200, {
      status: "success",
      data: summary,
    });
  } catch (error) {
    return handleControllerError(res, error);
  }
};
