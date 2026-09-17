import { analyticsRepository } from "../../repositories/analyticsRepository.js";
import { DATA_STATUS } from "./AnalyticsContract.js";

export class DSSPerformanceService {
  static instance = null;

  constructor(repo = analyticsRepository) {
    if (DSSPerformanceService.instance && repo === analyticsRepository) {
      return DSSPerformanceService.instance;
    }
    this.repo = repo;
    if (repo === analyticsRepository) {
      DSSPerformanceService.instance = this;
    }
  }

  static getInstance(repo = analyticsRepository) {
    if (!DSSPerformanceService.instance) {
      DSSPerformanceService.instance = new DSSPerformanceService(repo);
    }
    return DSSPerformanceService.instance;
  }

  async getPlanVsActualAnalysis({ startDate, endDate, date, distributionRunId = null, dssHistoryId = null } = {}) {
    const targetStartDate = startDate || date || new Date().toISOString().split("T")[0];
    const targetEndDate = endDate || date || targetStartDate;

    const rankRows = await this.repo.getDSSPlanVsActualMetrics({
      startDate: targetStartDate,
      endDate: targetEndDate,
      distributionRunId,
      dssHistoryId,
    });

    if (rankRows.length === 0) {
      return {
        time_window: {
          start_date: targetStartDate,
          end_date: targetEndDate,
        },
        data_status: DATA_STATUS.NO_DATA,
        message: "Tidak ada data penugasan atau eksekusi operasional yang terhubung dengan TOPSIS pada rentang waktu ini.",
        ranks_breakdown: [],
        insights: {
          rank_order_alignment: "INSUFFICIENT_DATA",
          summary: "Belum ada data penugasan untuk evaluasi Plan-vs-Actual.",
        },
      };
    }

    const sortedByRevenue = [...rankRows].sort((a, b) => parseFloat(b.actual_revenue) - parseFloat(a.actual_revenue));

    const ranksBreakdown = rankRows.map((r, idx) => {
      const revenue = parseFloat(r.actual_revenue) || 0;
      const assignedRiders = r.total_assigned_riders || 0;
      const revPerRider = parseFloat(r.revenue_per_assigned_rider) || 0;
      const compliance = r.actual_compliance_rate_pct !== null ? parseFloat(r.actual_compliance_rate_pct) : null;
      const duration = parseFloat(r.avg_operating_duration_minutes) || 0;
      const prefScore = parseFloat(r.predicted_preference_score) || 0;
      const realizedRevenueRank = sortedByRevenue.findIndex((item) => item.zone_id === r.zone_id) + 1;

      return {
        topsis_rank: r.topsis_rank || idx + 1,
        zone_id: r.zone_id,
        zone_name: r.zone_name,
        dss_prediction: {
          preference_score: prefScore,
          preference_score_formatted: `${(prefScore * 100).toFixed(2)}%`,
        },
        actual_execution: {
          total_assigned_riders: assignedRiders,
          total_checked_in_riders: r.total_checked_in_riders || 0,
          actual_revenue: revenue,
          formatted_revenue: `Rp ${Math.round(revenue).toLocaleString("id-ID")}`,
          revenue_per_assigned_rider: revPerRider,
          formatted_revenue_per_rider: `Rp ${Math.round(revPerRider).toLocaleString("id-ID")}`,
          avg_operating_duration_minutes: duration,
          actual_compliance_rate_pct: compliance !== null ? `${compliance.toFixed(2)}%` : "N/A",
          realized_revenue_rank: realizedRevenueRank,
        },
        data_status: r.data_status || DATA_STATUS.COMPLETE,
      };
    });

    const topRankAchievedMaxRev =
      ranksBreakdown.length > 0 && sortedByRevenue.length > 0
        ? ranksBreakdown[0].zone_id === sortedByRevenue[0].zone_id
        : false;

    const alignmentStatus = topRankAchievedMaxRev ? "STRONG_ALIGNMENT" : "MODERATE_OR_MIXED_ALIGNMENT";
    const topZone = ranksBreakdown[0];

    return {
      time_window: {
        start_date: targetStartDate,
        end_date: targetEndDate,
      },
      data_status: DATA_STATUS.COMPLETE,
      total_evaluated_ranks: ranksBreakdown.length,
      ranks_breakdown: ranksBreakdown,
      insights: {
        rank_order_alignment: alignmentStatus,
        top_rank_zone_name: topZone?.zone_name || "-",
        top_rank_actual_revenue: topZone
          ? `Rp ${Math.round(topZone.actual_execution.actual_revenue).toLocaleString("id-ID")}`
          : "Rp 0",
        summary: topRankAchievedMaxRev
          ? `Zona Peringkat #1 TOPSIS ('${topZone.zone_name}') berhasil membukukan omzet tertinggi (${topZone.actual_execution.formatted_revenue}), mengonfirmasi efektivitas model rekomendasi preskriptif.`
          : "Distribusi omzet aktual lapangan terdistribusi dinamis antar zona tugas.",
      },
    };
  }
}

export const dssPerformanceService = DSSPerformanceService.getInstance();
