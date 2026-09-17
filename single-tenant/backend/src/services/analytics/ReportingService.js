import { operationalAnalyticsService } from "./OperationalAnalyticsService.js";
import { complianceAnalyticsService } from "./ComplianceAnalyticsService.js";
import { salesAnalyticsService } from "./SalesAnalyticsService.js";
import { dssPerformanceService } from "./DSSPerformanceService.js";
import { analyticsRepository } from "../../repositories/analyticsRepository.js";

const MANAGEMENT_ROLES = Object.freeze(["SUPERADMIN", "MANAGEMENT"]);

const CSV_HEADERS = Object.freeze([
  "Assignment ID",
  "Tanggal",
  "TOPSIS Rank",
  "Preferensi TOPSIS",
  "Nama Rider",
  "Email Rider",
  "Zona Tugas",
  "Kode Armada",
  "Status Sesi",
  "Check-In Waktu",
  "Durasi Operasi (Menit)",
  "Total Penjualan (Rp)",
  "Unit Terjual",
  "Jumlah Transaksi",
  "Tingkat Kepatuhan Zona (%)",
  "Peringatan Jalan Protokol",
]);

export class ReportingService {
  static instance = null;

  constructor(
    opsService = operationalAnalyticsService,
    compService = complianceAnalyticsService,
    salesService = salesAnalyticsService,
    dssService = dssPerformanceService,
    repo = analyticsRepository
  ) {
    if (ReportingService.instance && opsService === operationalAnalyticsService) {
      return ReportingService.instance;
    }
    this.opsService = opsService;
    this.compService = compService;
    this.salesService = salesService;
    this.dssService = dssService;
    this.repo = repo;
    if (opsService === operationalAnalyticsService) {
      ReportingService.instance = this;
    }
  }

  static getInstance() {
    if (!ReportingService.instance) {
      ReportingService.instance = new ReportingService();
    }
    return ReportingService.instance;
  }

  async getUnifiedDashboardOverview(
    userRole = "SUPERVISOR",
    { date, startDate, endDate, zoneId = null, riderId = null } = {}
  ) {
    const targetDate = date || new Date().toISOString().split("T")[0];
    const targetStartDate = startDate || targetDate;
    const targetEndDate = endDate || targetDate;

    const [operational, compliance, sales, dss] = await Promise.all([
      this.opsService.getOperationalSummary({ startDate: targetStartDate, endDate: targetEndDate, zoneId }),
      this.compService.getComplianceSummary({ startDate: targetStartDate, endDate: targetEndDate, zoneId, riderId }),
      this.salesService.getSalesPerformance({ startDate: targetStartDate, endDate: targetEndDate, zoneId, riderId }),
      this.dssService.getPlanVsActualAnalysis({ startDate: targetStartDate, endDate: targetEndDate }),
    ]);

    const isManagementOrSuperadmin = MANAGEMENT_ROLES.includes(userRole);

    return {
      role_projection: userRole,
      time_window: {
        date: targetDate,
        start_date: targetStartDate,
        end_date: targetEndDate,
      },
      operational,
      compliance,
      sales: isManagementOrSuperadmin
        ? sales
        : {
            ...sales,
            summary: {
              ...sales.summary,
              total_revenue: { formatted: "PROTECTED_ROLE", value: 0 },
              average_order_value: { formatted: "PROTECTED_ROLE", value: 0 },
            },
            spatial_revenue_breakdown: {
              ...sales.spatial_revenue_breakdown,
              in_zone_compliant_revenue: { formatted: "PROTECTED_ROLE", value: 0 },
              out_of_zone_deviated_revenue: { formatted: "PROTECTED_ROLE", value: 0 },
            },
          },
      dss_effectiveness: dss,
    };
  }

  async getDailyOperationalReport({ targetDate, zoneId = null }) {
    const date = targetDate || new Date().toISOString().split("T")[0];
    const rows = await this.repo.getDetailedDailyOperationalReport({ targetDate: date, zoneId });
    return {
      target_date: date,
      total_records: rows.length,
      records: rows,
    };
  }

  async generateDailyReportCSV({ targetDate, zoneId = null }) {
    const date = targetDate || new Date().toISOString().split("T")[0];
    const rows = await this.repo.getDetailedDailyOperationalReport({ targetDate: date, zoneId });

    const csvRows = [CSV_HEADERS.join(",")];

    for (const r of rows) {
      const row = [
        `"${r.assignment_id || ""}"`,
        `"${r.assignment_date ? new Date(r.assignment_date).toISOString().split("T")[0] : ""}"`,
        r.topsis_rank || "",
        r.preference_score || "",
        `"${(r.rider_name || "").replace(/"/g, '""')}"`,
        `"${r.rider_email || ""}"`,
        `"${(r.zone_name || "").replace(/"/g, '""')}"`,
        `"${r.armada_code || ""}"`,
        `"${r.session_status || ""}"`,
        `"${r.checked_in_at ? new Date(r.checked_in_at).toISOString() : ""}"`,
        r.operating_duration_minutes || 0,
        r.total_sales_revenue || 0,
        r.total_units_sold || 0,
        r.transaction_count || 0,
        r.compliance_rate_pct || 0,
        r.road_alert_count || 0,
      ];
      csvRows.push(row.join(","));
    }

    return csvRows.join("\n");
  }
}

export const reportingService = ReportingService.getInstance();
