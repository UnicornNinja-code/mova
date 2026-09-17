/*
 * reportService.ts
 * REST API client & Universal Export Generator for Reports & Audit Logs in TypeScript
 * Strictly aligned with swagger.ts contracts
 */

import { axiosInstance } from "../lib/axios";

export interface AuditLogItem {
  id: number | string;
  user_id?: number | string;
  user_name?: string;
  user_email?: string;
  user_role?: string;
  action: string;
  entity_type: string;
  entity_id?: string | number;
  details?: any;
  ip_address?: string;
  user_agent?: string;
  status?: "SUCCESS" | "FAILED" | string;
  created_at: string;
}

export interface AuditLogsResponse {
  logs: AuditLogItem[];
  count?: number;
  total?: number;
  page?: number;
  limit?: number;
}

export interface AuditFiltersResponse {
  success: boolean;
  data: {
    actions: string[];
    entity_types: string[];
  };
}

export interface RiderPerformanceReportItem {
  rider_id: string;
  rider_name: string;
  total_shifts: number;
  total_check_ins: number;
  avg_check_in_delay_minutes: number;
  total_sales_units: number;
  total_revenue: number;
  avg_shift_duration_hours?: number;
  favorite_zone_name?: string;
}

export interface RiderPerformanceReportResponse {
  success: boolean;
  data: RiderPerformanceReportItem[];
  summary_totals?: {
    total_shifts_all: number;
    total_revenue_all: number;
    avg_delay_minutes_overall: number;
  };
  pagination?: {
    page: number;
    limit: number;
    total_records: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

export interface ZoneEffectivenessReportItem {
  zone_id: string;
  zone_name: string;
  total_revenue: number;
  total_units_sold: number;
  avg_dss_rank?: number;
  occupancy_rate_percent?: number;
}

export interface FleetLifecycleReportResponse {
  success: boolean;
  data: {
    summary: {
      total_armadas: number;
      active: number;
      in_use: number;
      maintenance: number;
    };
    maintenance_stats: Array<{
      armada_code: string;
      total_issues_reported: number;
      total_downtime_days: number;
      current_status: string;
    }>;
  };
}

export interface DssAccuracyReportResponse {
  success: boolean;
  data: {
    total_recommendations: number;
    auto_accepted_count: number;
    manual_override_count: number;
    acceptance_rate_percent: number;
    override_rate_percent: number;
    top_override_reasons: Array<{
      reason: string;
      count: number;
    }>;
  };
}

export interface DssImpactAnalysisResponse {
  success: boolean;
  data: {
    evaluation_period: {
      start: string;
      end: string;
    };
    comparison: {
      accepted_recommendations: {
        assignments_count: number;
        total_revenue: number;
        avg_revenue_per_shift: number;
        avg_check_in_compliance_pct: number;
      };
      manual_overrides: {
        assignments_count: number;
        total_revenue: number;
        avg_revenue_per_shift: number;
        avg_check_in_compliance_pct: number;
      };
      impact_metrics: {
        revenue_lift_percent: number;
        compliance_lift_percent: number;
        p_value_significance?: number;
      };
    };
  };
}

export interface SyncHistoryReportItem {
  job_id: string;
  dataset_type: string;
  status: string;
  records_fetched?: number;
  records_deduplicated?: number;
  duration_seconds?: number;
  executed_at: string;
}

export interface ExecutiveSummaryReportResponse {
  success: boolean;
  data: {
    kpis: {
      total_revenue: number;
      active_riders: number;
      active_zones: number;
      fleet_utilization: number;
      dss_accuracy: number;
      dss_revenue_lift_pct?: number;
    };
  };
}

export interface SalesDailyItem {
  date: string;
  total_revenue: number;
  total_cup_count: number;
  active_riders_count?: number;
  qris_revenue?: number;
  cash_revenue?: number;
  status?: string;
}

export interface SalesOverviewResponse {
  total_revenue: number;
  total_volume_cup: number;
  average_daily_revenue: number;
  active_riders_count: number;
  top_zone?: { name: string; revenue: number };
  daily_sales: SalesDailyItem[];
}

export interface DssConfigItem {
  id: number | string;
  name: string;
  is_active: boolean;
  best_criteria_id: string | number;
  worst_criteria_id: string | number;
  best_to_others: Record<string, number>;
  worst_to_others: Record<string, number>;
  created_at: string;
  updated_at?: string;
}

export const reportService = {
  /**
   * Fetch Audit Logs with filters
   * GET /api/audit-logs
   */
  getAuditLogs: async (params: {
    user_id?: string;
    action?: string;
    entity_type?: string;
    status?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<AuditLogsResponse> => {
    const res = await axiosInstance.get("/audit-logs", { params });
    return res.data;
  },

  /**
   * Fetch available filter options for Audit Logs
   * GET /api/audit-logs/filters
   */
  getAuditLogFilters: async (): Promise<AuditFiltersResponse> => {
    const res = await axiosInstance.get("/audit-logs/filters");
    return res.data;
  },

  /**
   * Fetch Rider Performance Report (Pillar 1)
   * GET /api/reports/riders/performance
   */
  getRiderPerformance: async (params: {
    start_date?: string;
    end_date?: string;
    rider_id?: string;
    page?: number;
    limit?: number;
    export?: "csv";
  } = {}): Promise<RiderPerformanceReportResponse> => {
    const res = await axiosInstance.get("/reports/riders/performance", { params });
    return res.data;
  },

  /**
   * Fetch Zone Effectiveness Report (Pillar 2)
   * GET /api/reports/zones/effectiveness
   */
  getZoneEffectiveness: async (params: {
    start_date?: string;
    end_date?: string;
    zone_id?: string;
  } = {}): Promise<any> => {
    const res = await axiosInstance.get("/reports/zones/effectiveness", { params });
    return res.data;
  },

  /**
   * Fetch Fleet Lifecycle & Maintenance Downtime Report (Pillar 3)
   * GET /api/reports/fleet/lifecycle
   */
  getFleetLifecycle: async (params: {
    start_date?: string;
    end_date?: string;
  } = {}): Promise<FleetLifecycleReportResponse> => {
    const res = await axiosInstance.get("/reports/fleet/lifecycle", { params });
    return res.data;
  },

  /**
   * Fetch DSS Accuracy & Acceptance Rate Report (Pillar 4a)
   * GET /api/reports/dss/accuracy
   */
  getDssAccuracy: async (params: {
    start_date?: string;
    end_date?: string;
  } = {}): Promise<DssAccuracyReportResponse> => {
    const res = await axiosInstance.get("/reports/dss/accuracy", { params });
    return res.data;
  },

  /**
   * Fetch DSS Impact Analysis Report (Auto vs Manual Overrides Revenue) (Pillar 4b)
   * GET /api/reports/dss/impact-analysis
   */
  getDssImpactAnalysis: async (params: {
    start_date?: string;
    end_date?: string;
  } = {}): Promise<DssImpactAnalysisResponse> => {
    const res = await axiosInstance.get("/reports/dss/impact-analysis", { params });
    return res.data;
  },

  /**
   * Fetch Spatial & Weather External Sync History
   * GET /api/reports/system/sync-history
   */
  getSyncHistory: async (params: {
    dataset_type?: "poi" | "weather" | string;
  } = {}): Promise<{ success: boolean; data: SyncHistoryReportItem[] }> => {
    const res = await axiosInstance.get("/reports/system/sync-history", { params });
    return res.data;
  },

  /**
   * Fetch Overall Business Executive Summary
   * GET /api/reports/executive-summary
   */
  getExecutiveSummary: async (): Promise<ExecutiveSummaryReportResponse> => {
    const res = await axiosInstance.get("/reports/executive-summary");
    return res.data;
  },

  /**
   * Fetch Sales Analytics Overview
   * GET /api/sales/overview
   */
  getSalesOverview: async (params: {
    start_date?: string;
    end_date?: string;
    zone_id?: string;
    rider_id?: string;
  } = {}): Promise<SalesOverviewResponse> => {
    const res = await axiosInstance.get("/sales/overview", { params });
    return res.data?.data || res.data;
  },

  /**
   * Fetch all historical BWM configurations
   * GET /api/dss/bwm/configs
   */
  getDssConfigs: async (): Promise<DssConfigItem[]> => {
    const res = await axiosInstance.get("/dss/bwm/configs");
    return res.data?.configs || [];
  },

  /**
   * Export Data to CSV with UTF-8 BOM
   */
  exportToCsv: (filename: string, headers: string[], rows: (string | number | undefined | null)[][]) => {
    const headerRow = headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(",");
    const dataRows = rows.map((row) =>
      row.map((val) => `"${String(val ?? "").replace(/"/g, '""')}"`).join(",")
    );
    const csvContent = "\uFEFF" + [headerRow, ...dataRows].join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  /**
   * Print or Export to PDF via clean styled printable HTML document
   */
  printReportDoc: ({
    title,
    subtitle,
    dateRange,
    kpis = [],
    headers,
    rows,
  }: {
    title: string;
    subtitle?: string;
    dateRange?: string;
    kpis?: Array<{ label: string; value: string }>;
    headers: string[];
    rows: (string | number | undefined | null)[][];
  }) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const kpiHtml =
      kpis.length > 0
        ? `<div style="display: flex; gap: 16px; margin-bottom: 24px;">
            ${kpis
              .map(
                (k) => `
              <div style="flex: 1; padding: 12px; background: #f4f4f5; border: 1px solid #e4e4e7; border-radius: 8px;">
                <div style="font-size: 11px; text-transform: uppercase; color: #71717a; font-weight: 600;">${k.label}</div>
                <div style="font-size: 18px; font-weight: 700; color: #18181b; margin-top: 4px;">${k.value}</div>
              </div>
            `
              )
              .join("")}
          </div>`
        : "";

    const tableHeaderHtml = headers.map((h) => `<th style="padding: 10px 12px; text-align: left; background: #27272a; color: #fff; font-size: 11px; text-transform: uppercase;">${h}</th>`).join("");

    const tableRowsHtml = rows
      .map(
        (row, idx) => `
        <tr style="background: ${idx % 2 === 0 ? "#ffffff" : "#fafafa"}; border-bottom: 1px solid #e4e4e7;">
          ${row.map((cell) => `<td style="padding: 9px 12px; font-size: 12px; color: #27272a;">${cell}</td>`).join("")}
        </tr>
      `
      )
      .join("");

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title} - COZIS MantaKopi</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&display=swap');
            body { font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif; padding: 32px; color: #18181b; margin: 0; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #ea580c; padding-bottom: 16px; margin-bottom: 20px; }
            .logo { font-size: 20px; font-weight: 700; color: #ea580c; }
            .meta { font-size: 11px; color: #71717a; text-align: right; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            .footer { margin-top: 40px; display: flex; justify-content: space-between; font-size: 11px; color: #71717a; border-top: 1px solid #e4e4e7; padding-top: 12px; }
            .signature { margin-top: 48px; display: flex; justify-content: flex-end; }
            .sig-box { text-align: center; width: 200px; border-top: 1px solid #18181b; padding-top: 6px; font-size: 12px; font-weight: 600; }
            @media print {
              body { padding: 12mm; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="logo">COZIS DSS • MantaKopi Enterprise</div>
              <h2 style="margin: 4px 0 0 0; font-size: 18px; color: #09090b;">${title}</h2>
              <div style="font-size: 12px; color: #71717a; margin-top: 2px;">${subtitle || "Laporan Resmi Sistem Pendukung Keputusan & Operasional"}</div>
            </div>
            <div class="meta">
              <div><strong>Dicetak:</strong> ${new Date().toLocaleString("id-ID")}</div>
              ${dateRange ? `<div><strong>Periode:</strong> ${dateRange}</div>` : ""}
              <div><strong>Status:</strong> Dokumen Resmi Terverifikasi</div>
            </div>
          </div>

          ${kpiHtml}

          <table>
            <thead>
              <tr>${tableHeaderHtml}</tr>
            </thead>
            <tbody>
              ${tableRowsHtml}
            </tbody>
          </table>

          <div class="signature">
            <div>
              <div style="margin-bottom: 60px; font-size: 11px; text-align: center; color: #71717a;">Disahkan Oleh, Super Admin</div>
              <div class="sig-box">Management MantaKopi</div>
            </div>
          </div>

          <div class="footer">
            <span>COZIS DSS Platform • Hak Cipta Dilindungi Undang-Undang</span>
            <span>Dokumen digenerate secara otomatis</span>
          </div>

          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  },
};

export default reportService;
