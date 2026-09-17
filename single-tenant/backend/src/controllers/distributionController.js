import { distributionService } from "../services/distribution/DistributionService.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";

const handleControllerError = (res, error, defaultStatus = 500) => {
  const statusCode = error.statusCode || defaultStatus;
  return sendError(res, error.message || "Internal server error", statusCode);
};

export const confirmDuty = async (req, res) => {
  try {
    const riderId = req.user?.id || req.body?.rider_id;
    if (!riderId) {
      return sendError(res, "Rider ID harus disertakan.", 400);
    }

    const queueEntry = await distributionService.confirmRiderDuty(riderId);
    return sendSuccess(
      res,
      queueEntry,
      "Konfirmasi kesediaan bertugas berhasil. Rider telah masuk ke Antrean FIFO.",
      200,
      { queue: queueEntry }
    );
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const getRiderDutyStatus = async (req, res) => {
  try {
    const riderId = req.user?.id || req.query?.rider_id;
    if (!riderId) {
      return sendError(res, "Rider ID harus disertakan.", 400);
    }

    const status = await distributionService.getRiderOperationalStatus(riderId);
    return sendSuccess(res, status, "Status operasional rider berhasil dimuat.", 200, { data: status });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const getDistributionOverview = async (req, res) => {
  try {
    const { time } = req.query;
    const overview = await distributionService.getDistributionOverview(time);
    return sendSuccess(res, overview, "Ringkasan distribusi berhasil dimuat.", 200, { data: overview });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const autoDistribute = async (req, res) => {
  try {
    const executedBy = req.user?.id || null;
    const { time } = req.body || {};
    const result = await distributionService.autoDistributeRiders(executedBy, time);
    return sendSuccess(res, result, "Distribusi otomatis rider berhasil dijalankan.", 200, result);
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const manualDistribute = async (req, res) => {
  try {
    const { rider_id, zone_id, time } = req.body;
    const assignedBy = req.user?.id || null;

    const result = await distributionService.manualDistributeRider({
      riderId: rider_id,
      zoneId: zone_id,
      assignedBy,
      timeInput: time,
    });

    return sendSuccess(res, result, "Distribusi manual rider berhasil ditetapkan.", 200, result);
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const getDistributionRuns = async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 20;
    const runs = await distributionService.getDistributionRuns(limit);
    return sendSuccess(res, runs, "Riwayat proses distribusi berhasil dimuat.", 200, { data: runs });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const getDistributionRunById = async (req, res) => {
  try {
    const { id } = req.params;
    const run = await distributionService.getDistributionRunById(id);
    return sendSuccess(res, run, "Detail sesi distribusi berhasil dimuat.", 200, { data: run });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const getMyDutyHistory = async (req, res) => {
  try {
    const riderId = req.user.id;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 30;

    const result = await distributionService.getMyDutyHistory(riderId, limit);
    return sendSuccess(res, result, "Riwayat penugasan tugas berhasil dimuat.", 200, result);
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const getRidersSummary = async (req, res) => {
  try {
    const summary = await distributionService.getRidersSummary();
    return sendSuccess(res, summary, "Ringkasan status seluruh rider berhasil dimuat.", 200, { data: summary });
  } catch (error) {
    return handleControllerError(res, error);
  }
};
