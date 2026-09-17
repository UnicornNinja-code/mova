/*
 * reportService.js
 * Frontend API Service for MOVA Reporting Suite & Multi-Format Exports (Single-Tenant)
 */

import { axiosInstance } from "../lib/axios.js";

export const reportService = {
  /**
   * Get High-Level Executive KPI Summary
   */
  getExecutiveSummary: async () => {
    const res = await axiosInstance.get("/reports/executive-summary");
    return res.data?.data || res.data;
  },

  /**
   * Get Rider Operational & Attendance Report
   */
  getRiderOperationalReport: async ({ startDate, endDate, riderId } = {}) => {
    const params = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    if (riderId && riderId !== "ALL") params.rider_id = riderId;

    const res = await axiosInstance.get("/reports/rider-operational", { params });
    return res.data?.data || res.data;
  },

  /**
   * Get Zone Effectiveness & Spatial Compliance Report
   */
  getZoneEffectivenessReport: async ({ startDate, endDate, zoneId } = {}) => {
    const params = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    if (zoneId && zoneId !== "ALL") params.zone_id = zoneId;

    const res = await axiosInstance.get("/reports/zone-effectiveness", { params });
    return res.data?.data || res.data;
  },

  /**
   * Get Fleet Health & Utilization Report
   */
  getFleetReport: async () => {
    const res = await axiosInstance.get("/reports/fleet");
    return res.data?.data || res.data;
  },

  /**
   * Get DSS Accuracy & Recommendation Effectiveness Report
   */
  getDssAccuracyReport: async ({ startDate, endDate } = {}) => {
    const params = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;

    const res = await axiosInstance.get("/reports/dss-accuracy", { params });
    return res.data?.data || res.data;
  },

  /**
   * Get System Security Audit Logs
   */
  getAuditLogsReport: async ({ limit = 50, offset = 0, action, entityType } = {}) => {
    const params = { limit, offset };
    if (action) params.action = action;
    if (entityType) params.entity_type = entityType;

    const res = await axiosInstance.get("/reports/audit-logs", { params });
    return res.data?.data || res.data;
  },

  /**
   * Download Formatted Report (CSV, XLSX, PDF/HTML)
   */
  downloadReportExport: async ({ type, format = "csv", startDate, endDate, zoneId, riderId }) => {
    const params = {
      type,
      format,
    };
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    if (zoneId && zoneId !== "ALL") params.zone_id = zoneId;
    if (riderId && riderId !== "ALL") params.rider_id = riderId;

    const res = await axiosInstance.get("/reports/export", {
      params,
      responseType: format === "html" || format === "pdf" ? "text" : "blob",
    });

    if (format === "html" || format === "pdf") {
      // Open in a new printable window
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(res.data);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 300);
      }
      return;
    }

    // Direct File Download for CSV/XLSX
    const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `mova_${type.toLowerCase()}_${new Date().toISOString().split("T")[0]}.${format === "xlsx" ? "csv" : "csv"}`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  /**
   * Export Report by Type Path Endpoint (/reports/export/:reportType)
   */
  exportReportByType: async (reportType, params = {}) => {
    const res = await axiosInstance.get(`/reports/export/${reportType}`, { params });
    return res.data;
  },
};
