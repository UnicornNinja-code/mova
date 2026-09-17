import { axiosInstance } from "../lib/axios.js";

/**
 * Analytics Domain Service for Milestone B-12 / Phase F-01
 * Pure consumer adapter for Backend SSOT Read-Model Analytics & Reporting Endpoints.
 */
export const analyticsService = {
  /**
   * 1. Multi-Domain Executive / Supervisor Analytics Overview
   * @param {Object} params { startDate, endDate, date, zoneId }
   */
  getOverview: async (params = {}) => {
    const res = await axiosInstance.get("/analytics/overview", { params });
    return res.data;
  },

  /**
   * 2. Operational Lifecycle & Shift Durations Summary
   * @param {Object} params { startDate, endDate, date, zoneId }
   */
  getOperational: async (params = {}) => {
    const res = await axiosInstance.get("/analytics/operational/summary", { params });
    return res.data;
  },

  /**
   * 2b. Fleet Utilization Breakdown
   */
  getFleetUtilization: async () => {
    const res = await axiosInstance.get("/analytics/operational/fleet-utilization");
    return res.data;
  },

  /**
   * 3. Spatial Geofence Compliance, Telemetry & Road Restrictions
   * @param {Object} params { startDate, endDate, date, zoneId, riderId }
   */
  getCompliance: async (params = {}) => {
    const res = await axiosInstance.get("/analytics/compliance/summary", { params });
    return res.data;
  },

  /**
   * 4. Commercial Sales Performance & In-Zone vs Deviated Revenue Breakdown
   * @param {Object} params { startDate, endDate, date, zoneId, riderId }
   */
  getSales: async (params = {}) => {
    const res = await axiosInstance.get("/analytics/sales/performance", { params });
    return res.data;
  },

  /**
   * 5. DSS Plan-vs-Actual Effectiveness Analysis
   * @param {Object} params { startDate, endDate, date, distributionRunId, dssHistoryId }
   */
  getDssPerformance: async (params = {}) => {
    const res = await axiosInstance.get("/analytics/dss/plan-vs-actual", { params });
    return res.data;
  },

  getDssPlanVsActual: async (params = {}) => {
    const res = await axiosInstance.get("/analytics/dss/plan-vs-actual", { params });
    return res.data;
  },

  getHourlySalesCurves: async (params = {}) => {
    const res = await axiosInstance.get("/analytics/hourly-sales-curves", { params });
    return res.data;
  },

  getInZoneVsOutZone: async (params = {}) => {
    const res = await axiosInstance.get("/analytics/in-zone-vs-out-of-zone", { params });
    return res.data;
  },

  /**
   * 6. Tabular Detailed Daily Operational Report
   * @param {Object} params { date, zoneId, riderId }
   */
  getDailyReport: async (params = {}) => {
    const res = await axiosInstance.get("/analytics/reports/daily-summary", { params });
    return res.data;
  },

  /**
   * 7. Stream & Trigger CSV File Download for Daily Report
   * @param {Object} params { date, zoneId }
   */
  exportDailyReport: async (params = {}) => {
    const res = await axiosInstance.get("/analytics/reports/daily-summary", {
      params: { ...params, format: "csv" },
      responseType: "blob",
    });

    // In browser environment, trigger automatic file download
    if (typeof window !== "undefined" && typeof document !== "undefined") {
      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;

      // Extract filename from Content-Disposition header if available
      let filename = `mova_daily_report_${params.date || new Date().toISOString().split("T")[0]}.csv`;
      const disposition = res.headers?.["content-disposition"];
      if (disposition && disposition.includes("filename=")) {
        const matches = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (matches != null && matches[1]) {
          filename = matches[1].replace(/['"]/g, "");
        }
      }

      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    }

    return res.data;
  },
};

/**
 * Semantic metadata safe extraction helpers
 * Ensures NO_DATA / null values are not silently converted into fake zeros.
 */
export function getAnalyticsValue(metric) {
  return metric?.value ?? null;
}

export function getAnalyticsFormatted(metric) {
  return metric?.formatted ?? "N/A";
}

export function isNoData(metric) {
  return (
    metric?.data_status === "NO_DATA" ||
    metric?.value === null ||
    metric?.value === undefined
  );
}
