import { cronManagerService } from "../services/cron/CronManagerService.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";

const DEFAULT_LOGS_LIMIT = 50;

const handleControllerError = (res, error, defaultStatus = 500) => {
  const statusCode = error.statusCode || defaultStatus;
  return sendError(res, error.message || "Internal server error", statusCode, error.details || null);
};

export const getCronConfigs = async (req, res) => {
  try {
    const result = await cronManagerService.getCronConfigs();
    return sendSuccess(res, result.configs || result, "Cron configs retrieved successfully", 200, {
      configs: result.configs || result,
    });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const getCronLogs = async (req, res) => {
  try {
    const { cron_key, limit } = req.query;
    const result = await cronManagerService.getCronLogs({
      cronKey: cron_key,
      limit: limit ? parseInt(limit, 10) : DEFAULT_LOGS_LIMIT,
    });
    return sendSuccess(res, result.logs || result, "Cron logs retrieved successfully", 200, {
      logs: result.logs || result,
    });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const toggleCronActive = async (req, res) => {
  try {
    const { cronKey } = req.params;
    const { is_active } = req.body;

    const updated = await cronManagerService.toggleCronActive(cronKey, is_active);
    return sendSuccess(
      res,
      updated,
      `Status cron job '${cronKey}' berhasil diubah`,
      200,
      { config: updated }
    );
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const triggerCronManually = async (req, res) => {
  try {
    const { cronKey } = req.params;
    const result = await cronManagerService.triggerCronManually(cronKey);
    return sendSuccess(
      res,
      result,
      `Pemicu eksekusi manual cron job '${cronKey}' berhasil dijalankan`,
      200,
      { result }
    );
  } catch (error) {
    return handleControllerError(res, error);
  }
};
