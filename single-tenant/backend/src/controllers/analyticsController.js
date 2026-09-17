import { reportingService } from "../services/analytics/ReportingService.js";
import { operationalAnalyticsService } from "../services/analytics/OperationalAnalyticsService.js";
import { complianceAnalyticsService } from "../services/analytics/ComplianceAnalyticsService.js";
import { salesAnalyticsService } from "../services/analytics/SalesAnalyticsService.js";
import { dssPerformanceService } from "../services/analytics/DSSPerformanceService.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";

const handleControllerError = (res, error, defaultStatus = 500) => {
  const statusCode = error.statusCode || defaultStatus;
  return sendError(res, error.message || "Internal server error", statusCode);
};

export const getDashboardOverview = async (req, res) => {
  try {
    const userRole = req.user?.role || "SUPERVISOR";
    const { date, start_date, end_date, zone_id, rider_id } = req.query;

    const result = await reportingService.getUnifiedDashboardOverview(userRole, {
      date,
      startDate: start_date,
      endDate: end_date,
      zoneId: zone_id,
      riderId: rider_id,
    });

    return sendSuccess(res, result, "Overview dashboard analitik berhasil dimuat.", 200, { data: result });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const getOperationalSummary = async (req, res) => {
  try {
    const { date, start_date, end_date, zone_id } = req.query;
    const result = await operationalAnalyticsService.getOperationalSummary({
      date,
      startDate: start_date,
      endDate: end_date,
      zoneId: zone_id,
    });

    return sendSuccess(res, result, "Ringkasan operasional berhasil dimuat.", 200, { data: result });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const getFleetUtilization = async (req, res) => {
  try {
    const result = await operationalAnalyticsService.getFleetUtilization();
    return sendSuccess(res, result, "Tingkat utilisasi armada berhasil dimuat.", 200, { data: result });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const getComplianceSummary = async (req, res) => {
  try {
    const { date, start_date, end_date, zone_id, rider_id } = req.query;
    const result = await complianceAnalyticsService.getComplianceSummary({
      date,
      startDate: start_date,
      endDate: end_date,
      zoneId: zone_id,
      riderId: rider_id,
    });

    return sendSuccess(res, result, "Ringkasan kepatuhan spasial berhasil dimuat.", 200, { data: result });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const getSalesPerformance = async (req, res) => {
  try {
    const { range, date, start_date, end_date, zone_id, rider_id } = req.query;
    const result = await salesAnalyticsService.getSalesPerformance({
      range,
      date,
      startDate: start_date,
      endDate: end_date,
      zoneId: zone_id,
      riderId: rider_id,
    });

    return sendSuccess(res, result, "Performa komersial penjualan berhasil dimuat.", 200, { data: result });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const getDSSPlanVsActual = async (req, res) => {
  try {
    const { date, start_date, end_date, distribution_run_id, dss_history_id } = req.query;
    const result = await dssPerformanceService.getPlanVsActualAnalysis({
      date,
      startDate: start_date,
      endDate: end_date,
      distributionRunId: distribution_run_id,
      dssHistoryId: dss_history_id,
    });

    return sendSuccess(res, result, "Analisis Plan-vs-Actual DSS berhasil dimuat.", 200, { data: result });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const getDailyReport = async (req, res) => {
  try {
    const { date, zone_id, format } = req.query;
    const targetDate = date || new Date().toISOString().split("T")[0];

    if (format === "csv") {
      const csvData = await reportingService.generateDailyReportCSV({
        targetDate,
        zoneId: zone_id,
      });

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="mova_daily_report_${targetDate}.csv"`);
      return res.status(200).send(csvData);
    }

    const report = await reportingService.getDailyOperationalReport({
      targetDate,
      zoneId: zone_id,
    });

    return sendSuccess(res, report, "Laporan harian operasional berhasil dimuat.", 200, { data: report });
  } catch (error) {
    return handleControllerError(res, error);
  }
};
