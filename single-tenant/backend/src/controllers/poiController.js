import {
  syncCityPoisService,
  reprocessLocalPoisService,
  getPoisByZoneService,
  getAllOperationalPoisService,
  getDensitasDanDiversitasC1C2Service,
  reclusterExistingPoisService,
  getLeakageReportService,
  getPendingPoisService,
  approveOrRejectPoiService,
  getApprovalLogsService,
  triggerCronDetectionService,
  getZoneC3ScoreService,
  getZoneC4ScoreService,
  getZoneC5ScoreService,
  getQualitySummaryService,
  resolveAnomalyService,
  getPoiStatsService,
  getPoiByIdService,
  createManualPoiService,
  updateManualPoiService,
  deleteManualPoiService,
  bulkCreateManualPoisService,
} from "../services/poiService.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";

const handleControllerError = (res, error, defaultStatus = 500) => {
  const statusCode = error.statusCode || defaultStatus;
  return sendError(res, error.message || "Internal server error", statusCode, error.details || null);
};

export const getPoiById = async (req, res) => {
  try {
    const { id } = req.params;
    const poi = await getPoiByIdService(id);
    return sendSuccess(res, poi, "Data POI berhasil dimuat.", 200, { poi });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const createPoi = async (req, res) => {
  try {
    const user = req.user || {};
    const created = await createManualPoiService(req.body, user);
    return sendSuccess(res, created, "POI berhasil didaftarkan.", 201, { poi: created });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const updatePoi = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user || {};
    const updated = await updateManualPoiService(id, req.body, user);
    return sendSuccess(res, updated, "Data POI berhasil diperbarui.", 200, { poi: updated });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const deletePoi = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user || {};
    const deleted = await deleteManualPoiService(id, user);
    return sendSuccess(res, deleted, "Data POI berhasil dihapus.", 200, { poi: deleted });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const bulkCreatePois = async (req, res) => {
  try {
    const user = req.user || {};
    const items = Array.isArray(req.body.pois) ? req.body.pois : req.body;
    const result = await bulkCreateManualPoisService(items, user);
    return sendSuccess(res, result, "Bulk POI berhasil disinkronkan.", 201, result);
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const syncCityPois = async (req, res) => {
  try {
    const result = await syncCityPoisService();
    return sendSuccess(res, result, "Sinkronisasi POI kota berhasil.", 200, result);
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const reprocessLocalPois = async (req, res) => {
  try {
    const result = await reprocessLocalPoisService();
    return sendSuccess(res, result, "Reproses POI lokal berhasil.", 200, result);
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const getPoisByZone = async (req, res) => {
  try {
    const { zone_id } = req.params;
    const pois = await getPoisByZoneService(zone_id);
    return sendSuccess(res, pois, "Daftar POI per zona berhasil dimuat.", 200, { pois, count: pois.length });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const getOperationalAreaPois = async (req, res) => {
  try {
    const pois = await getAllOperationalPoisService();
    return sendSuccess(res, pois, "Seluruh POI area operasional berhasil dimuat.", 200, { pois, count: pois.length });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const getDensitasDanDiversitasC1C2 = async (req, res) => {
  try {
    const { zone_id } = req.params;
    const result = await getDensitasDanDiversitasC1C2Service(zone_id);
    return sendSuccess(res, result, "Metrik densitas dan diversitas POI berhasil dimuat.", 200, result);
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const getZoneC3Score = async (req, res) => {
  try {
    const { zone_id } = req.params;
    const { time } = req.query;
    const result = await getZoneC3ScoreService(zone_id, time);
    return sendSuccess(res, result, "Skor waktu operasional C3 berhasil dimuat.", 200, result);
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const getZoneC4Score = async (req, res) => {
  try {
    const { zone_id } = req.params;
    const { time } = req.query;
    const result = await getZoneC4ScoreService(zone_id, time);
    return sendSuccess(res, result, "Skor kesesuaian cuaca C4 berhasil dimuat.", 200, result);
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const getZoneC5Score = async (req, res) => {
  try {
    const { zone_id } = req.params;
    const { lat, lon } = req.query;
    const result = await getZoneC5ScoreService(zone_id, lat, lon);
    return sendSuccess(res, result, "Skor jarak rider C5 berhasil dimuat.", 200, result);
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const reclusterPois = async (req, res) => {
  try {
    const result = await reclusterExistingPoisService();
    return sendSuccess(res, result, "Pengelompokan ulang POI berhasil dijalankan.", 200, result);
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const getLeakageReport = async (req, res) => {
  try {
    const report = await getLeakageReportService();
    return sendSuccess(res, report, "Laporan kebocoran POI berhasil dimuat.", 200, { report, count: report.length });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const getPendingPois = async (req, res) => {
  try {
    const pendingPois = await getPendingPoisService();
    return sendSuccess(res, pendingPois, "Daftar POI tertunda berhasil dimuat.", 200, { pois: pendingPois, count: pendingPois.length });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const approveOrRejectPoi = async (req, res) => {
  try {
    const { poi_id, status, notes } = req.body;
    const userId = req.user?.id || req.user?.userId;
    const result = await approveOrRejectPoiService(poi_id, status, userId, notes);
    return sendSuccess(res, result, "Status persetujuan POI berhasil diperbarui.", 200, result);
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const getApprovalLogs = async (req, res) => {
  try {
    const logs = await getApprovalLogsService();
    return sendSuccess(res, logs, "Log riwayat persetujuan POI berhasil dimuat.", 200, { logs, count: logs.length });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const triggerCronDetection = async (req, res) => {
  try {
    const { hub_city } = req.body || {};
    const result = await triggerCronDetectionService(hub_city);
    return sendSuccess(res, result, "Deteksi POI otomatis berhasil dipicu.", 200, result);
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const getQualitySummary = async (req, res) => {
  try {
    const summary = await getQualitySummaryService();
    return sendSuccess(res, summary, "Ringkasan kualitas data POI berhasil dimuat.", 200, summary);
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const resolveAnomaly = async (req, res) => {
  try {
    const { poi_id, resolved_category, category, action } = req.body;
    const userId = req.user?.id || req.user?.userId;
    const result = await resolveAnomalyService(poi_id, resolved_category || category, action || "APPROVE", userId);
    return sendSuccess(res, result, "Anomali data POI berhasil diselesaikan.", 200, result);
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const getPoiStats = async (req, res) => {
  try {
    const stats = await getPoiStatsService();
    return sendSuccess(res, stats, "Statistik POI berhasil dimuat.", 200, { status: "success", data: stats });
  } catch (error) {
    return handleControllerError(res, error);
  }
};
