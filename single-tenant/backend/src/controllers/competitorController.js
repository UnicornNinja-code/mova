import {
  getZoneC6ScoreService,
  getCompetitorsByZoneService,
  createCompetitorService,
  bulkCreateCompetitorsService,
  deleteCompetitorService,
  getCompetitorsSummaryService,
  reconcileExplicitLinkService,
  detectCandidateMatchesService,
  unlinkReconciliationService,
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

export const bulkCreateCompetitors = async (req, res) => {
  try {
    const { competitors } = req.body;
    const items = Array.isArray(competitors) ? competitors : req.body;
    const result = await bulkCreateCompetitorsService(items);
    return sendSuccess(res, result, "Batch data kompetitor berhasil ditambahkan", 201, result);
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

export const reconcileCompetitor = async (req, res) => {
  try {
    const { competitor_id } = req.params;
    const { logical_poi_id, external_id, poi_id } = req.body;
    const result = await reconcileExplicitLinkService({
      competitorId: competitor_id,
      logicalPoiId: logical_poi_id,
      externalId: external_id,
      poiId: poi_id,
    });
    return sendSuccess(res, result, "Rekonsiliasi kompetitor berhasil diperbarui.", 200, {
      competitor: result,
    });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const detectCandidates = async (req, res) => {
  try {
    const { zone_id } = req.params;
    const candidates = await detectCandidateMatchesService(zone_id);
    return sendSuccess(res, candidates, "Deteksi kandidat rekonsiliasi berhasil dijalankan.", 200, {
      candidates,
      count: candidates.length,
    });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const unlinkCompetitor = async (req, res) => {
  try {
    const { competitor_id } = req.params;
    const result = await unlinkReconciliationService(competitor_id);
    return sendSuccess(res, result, "Tautan rekonsiliasi berhasil direset ke UNLINKED.", 200, {
      competitor: result,
    });
  } catch (error) {
    return handleControllerError(res, error);
  }
};
