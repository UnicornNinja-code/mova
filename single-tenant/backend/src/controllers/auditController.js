import { auditService } from "../services/auditService.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";

const handleControllerError = (res, error, defaultStatus = 500) => {
  const statusCode = error.statusCode || defaultStatus;
  return sendError(res, error.message || "Internal server error", statusCode);
};

export const getAuditLogs = async (req, res) => {
  try {
    const { user_id, action, entity_type, status, page = 1, limit = 50 } = req.query;
    const result = await auditService.getAuditLogs({
      userId: user_id,
      action,
      entityType: entity_type,
      status,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
    return sendSuccess(res, result.logs || result, "Log audit sistem berhasil dimuat.", 200, result);
  } catch (error) {
    return handleControllerError(res, error);
  }
};
