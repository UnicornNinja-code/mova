import { reportService } from "../services/reportService.js";
import { ReportExportService } from "../services/reportExportService.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";

const handleControllerError = (res, error, defaultStatus = 500) => {
  const statusCode = error.statusCode || defaultStatus;
  return sendError(res, error.message || "Internal server error", statusCode);
};

export const getExecutiveSummary = async (_req, res) => {
  try {
    const data = await reportService.getExecutiveSummary();
    return sendSuccess(res, data, "Ringkasan eksekutif berhasil dimuat.", 200, { data });
  } catch (err) {
    return handleControllerError(res, err);
  }
};

export const getRiderOperationalReport = async (req, res) => {
  try {
    const { start_date, end_date, rider_id } = req.query;
    const data = await reportService.getRiderOperationalReport({
      startDate: start_date,
      endDate: end_date,
      riderId: rider_id,
    });
    return sendSuccess(res, data, "Laporan operasional rider berhasil dimuat.", 200, { data });
  } catch (err) {
    return handleControllerError(res, err);
  }
};

export const getZoneEffectivenessReport = async (req, res) => {
  try {
    const { start_date, end_date, zone_id } = req.query;
    const data = await reportService.getZoneEffectivenessReport({
      startDate: start_date,
      endDate: end_date,
      zoneId: zone_id,
    });
    return sendSuccess(res, data, "Laporan efektivitas zona berhasil dimuat.", 200, { data });
  } catch (err) {
    return handleControllerError(res, err);
  }
};

export const getFleetReport = async (_req, res) => {
  try {
    const data = await reportService.getFleetReport();
    return sendSuccess(res, data, "Laporan utilisasi armada berhasil dimuat.", 200, { data });
  } catch (err) {
    return handleControllerError(res, err);
  }
};

export const getDssAccuracyReport = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const data = await reportService.getDssAccuracyReport({
      startDate: start_date,
      endDate: end_date,
    });
    return sendSuccess(res, data, "Laporan akurasi DSS berhasil dimuat.", 200, { data });
  } catch (err) {
    return handleControllerError(res, err);
  }
};

export const getAuditLogsReport = async (req, res) => {
  try {
    const { limit = 50, offset = 0, action, entity_type } = req.query;
    const data = await reportService.getAuditLogsReport({
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      action,
      entityType: entity_type,
    });
    return sendSuccess(res, data, "Laporan riwayat audit berhasil dimuat.", 200, { data });
  } catch (err) {
    return handleControllerError(res, err);
  }
};

export const exportReport = async (req, res) => {
  try {
    const { type, format = "csv", start_date, end_date, zone_id, rider_id } = req.query;
    const reportType = (type || "EXECUTIVE_SUMMARY").toUpperCase();
    const exportFormat = (format || "csv").toLowerCase();
    const timestamp = new Date().toISOString().split("T")[0];

    let reportData;
    let title = "Laporan Operasional MOVA";

    switch (reportType) {
      case "RIDER_OPERATIONAL":
      case "RIDER_DUTY_REPORT":
        reportData = await reportService.getRiderOperationalReport({
          startDate: start_date,
          endDate: end_date,
          riderId: rider_id,
        });
        title = `Laporan Kinerja & Absensi Rider (${start_date || timestamp})`;
        break;

      case "ZONE_PERFORMANCE":
      case "ZONE_EFFECTIVENESS":
        reportData = await reportService.getZoneEffectivenessReport({
          startDate: start_date,
          endDate: end_date,
          zoneId: zone_id,
        });
        title = `Laporan Efektivitas & Kepatuhan Zona (${start_date || timestamp})`;
        break;

      case "FLEET_REPORT":
        reportData = await reportService.getFleetReport();
        title = `Laporan Utilisasi & Kondisi Armada (${timestamp})`;
        break;

      case "DSS_ACCURACY":
        reportData = await reportService.getDssAccuracyReport({
          startDate: start_date,
          endDate: end_date,
        });
        title = `Laporan Evaluasi & Akurasi Rekomendasi DSS (${start_date || timestamp})`;
        break;

      case "AUDIT_LOGS":
        reportData = await reportService.getAuditLogsReport({ limit: 500 });
        title = `Laporan Jejak Audit Sistem (${timestamp})`;
        break;

      case "EXECUTIVE_SUMMARY":
      default:
        reportData = await reportService.getExecutiveSummary();
        title = `Ringkasan Eksekutif & KPI Operasional (${timestamp})`;
        break;
    }

    if (exportFormat === "html" || exportFormat === "pdf") {
      const htmlContent = ReportExportService.generatePrintableHtml(reportType, reportData, title);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.status(200).send(htmlContent);
    }

    const csvContent = ReportExportService.generateCsv(reportType, reportData);
    const filename = `mova_${reportType.toLowerCase()}_${timestamp}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.status(200).send(csvContent);
  } catch (err) {
    return handleControllerError(res, err);
  }
};
