/*
 * DashboardService.ts
 * Domain Service for Dashboard Analytics & Role-Based Scoping in TypeScript
 */

import { dashboardRepository, DashboardRepository } from "../../repositories/dashboardRepository.js";
import { topsisEngineService } from "../dss/TopsisEngineService.js";
import { TimeSlotEvaluator } from "../../utils/TimeSlotEvaluator.js";

export class DashboardService {
  private static instance: DashboardService | null = null;
  private repo: DashboardRepository;

  constructor(repo: DashboardRepository = dashboardRepository) {
    if (DashboardService.instance && repo === dashboardRepository) {
      return DashboardService.instance;
    }
    this.repo = repo;
    if (repo === dashboardRepository) {
      DashboardService.instance = this;
    }
  }

  public static getInstance(repo: DashboardRepository = dashboardRepository): DashboardService {
    if (!DashboardService.instance) {
      DashboardService.instance = new DashboardService(repo);
    }
    return DashboardService.instance;
  }

  /**
   * Helper: Convert date string (or now) to UTC boundaries representing full day in Asia/Jakarta (WIB UTC+7)
   */
  public getJakartaDateBoundaries(dateString: string | null = null): {
    targetDate: string;
    startTimestamp: string;
    endTimestamp: string;
  } {
    let targetDateStr = dateString;
    if (!targetDateStr) {
      const nowJakarta = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Jakarta",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
      targetDateStr = nowJakarta;
    }

    const startWib = new Date(`${targetDateStr}T00:00:00+07:00`);
    const nextDay = new Date(startWib.getTime() + 24 * 60 * 60 * 1000);

    return {
      targetDate: targetDateStr,
      startTimestamp: startWib.toISOString(),
      endTimestamp: nextDay.toISOString(),
    };
  }

  /**
   * Helper: Convert date range to UTC boundaries with maximum 31 days limit
   */
  public getJakartaRangeBoundaries(
    range: string = "7d",
    startDate: string | null = null,
    endDate: string | null = null
  ): {
    startDate: string;
    endDate: string;
    startTimestamp: string;
    endTimestamp: string;
  } {
    const todayJakarta = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    let finalStartStr = startDate;
    let finalEndStr = endDate || todayJakarta;

    // Enforce max 31-day boundary for custom ranges
    if (finalStartStr && finalEndStr) {
      let s = new Date(`${finalStartStr}T00:00:00+07:00`).getTime();
      let e = new Date(`${finalEndStr}T00:00:00+07:00`).getTime();
      if (s > e) {
        const temp = finalStartStr;
        finalStartStr = finalEndStr;
        finalEndStr = temp;
      }
      const diffDays = Math.ceil((new Date(`${finalEndStr}T00:00:00+07:00`).getTime() - new Date(`${finalStartStr}T00:00:00+07:00`).getTime()) / (24 * 60 * 60 * 1000)) + 1;
      if (diffDays > 31) {
        // Clamp to max 31 days from start
        const maxEnd = new Date(new Date(`${finalStartStr}T00:00:00+07:00`).getTime() + 30 * 24 * 60 * 60 * 1000);
        finalEndStr = maxEnd.toISOString().split("T")[0];
      }
    }

    if (!finalStartStr) {
      const endWib = new Date(`${finalEndStr}T00:00:00+07:00`);
      if (range === "today" || range === "1d" || range === "hari_ini") {
        finalStartStr = finalEndStr;
      } else if (range === "this_month" || range === "bulan_ini") {
        const [yearStr, monthStr] = finalEndStr.split("-");
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10) - 1;
        finalStartStr = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      } else if (range === "30d" || range === "month") {
        const startWib = new Date(endWib.getTime() - 29 * 24 * 60 * 60 * 1000);
        finalStartStr = startWib.toISOString().split("T")[0];
      } else {
        // Default 7 days (including today)
        const startWib = new Date(endWib.getTime() - 6 * 24 * 60 * 60 * 1000);
        finalStartStr = startWib.toISOString().split("T")[0];
      }
    }

    const startTimestamp = new Date(`${finalStartStr}T00:00:00+07:00`).toISOString();
    const endNextDay = new Date(new Date(`${finalEndStr}T00:00:00+07:00`).getTime() + 24 * 60 * 60 * 1000);
    const endTimestamp = endNextDay.toISOString();

    return {
      startDate: finalStartStr,
      endDate: finalEndStr,
      startTimestamp,
      endTimestamp,
    };
  }

  /**
   * Fetch Deterministic Top 1 DSS Zone
   */
  public async getTopDssZone(): Promise<any | null> {
    try {
      const currentSlot = TimeSlotEvaluator.getSlot(new Date());
      const topsisResult = await topsisEngineService.calculateTopsisRecommendations({
        timeSlot: currentSlot,
      });

      if (topsisResult && topsisResult.rankings && topsisResult.rankings.length > 0) {
        const top = topsisResult.rankings[0];
        return {
          zone_id: top.zone_id,
          zone_name: top.zone_name,
          preference_score: top.preference_score,
          rank: 1,
          time_slot: currentSlot,
          weight_source: topsisResult.weight_source,
        };
      }
    } catch (err: any) {
      console.warn("⚠️ Top DSS recommendation fallback:", err.message);
    }
    return null;
  }

  /**
   * Get Unified Executive / Operational Dashboard Summary
   */
  public async getDashboardSummary(userRole: string, { date }: { date?: string } = {}): Promise<any> {
    if (userRole === "RIDER") {
      const error: any = new Error("Rider tidak memiliki otorisasi untuk mengakses Dashboard.");
      error.statusCode = 403;
      throw error;
    }

    const { targetDate, startTimestamp, endTimestamp } = this.getJakartaDateBoundaries(date || null);

    const [kpis, topDssZone] = await Promise.all([
      this.repo.getExecutiveKpis({ startTimestamp, endTimestamp, targetDate }),
      this.getTopDssZone(),
    ]);

    if (userRole === "SUPERVISOR") {
      return {
        date: targetDate,
        role_scope: "SUPERVISOR",
        operations: kpis.operations,
        fleet: kpis.fleet,
        top_dss_zone: topDssZone,
      };
    }

    return {
      date: targetDate,
      role_scope: "SUPERADMIN",
      financials: kpis.financials,
      operations: kpis.operations,
      fleet: kpis.fleet,
      top_dss_zone: topDssZone,
    };
  }

  /**
   * Get Sales Trend Time-Series Data
   */
  public async getSalesTrend(
    userRole: string,
    { range = "7d", startDate, endDate }: { range?: string; startDate?: string | null; endDate?: string | null } = {}
  ): Promise<any> {
    if (userRole === "RIDER") {
      const error: any = new Error("Rider tidak memiliki otorisasi untuk mengakses Sales Trend.");
      error.statusCode = 403;
      throw error;
    }

    const { startDate: sDate, endDate: eDate, startTimestamp, endTimestamp } = this.getJakartaRangeBoundaries(
      range,
      startDate || null,
      endDate || null
    );

    const trend = await this.repo.getSalesTrend({ startTimestamp, endTimestamp });

    if (userRole === "SUPERVISOR") {
      return {
        range,
        start_date: sDate,
        end_date: eDate,
        data: trend.map((t: any) => ({
          date: t.date,
          total_transactions: t.total_transactions,
          total_units_sold: t.total_units_sold,
        })),
      };
    }

    return {
      range,
      start_date: sDate,
      end_date: eDate,
      data: trend,
    };
  }

  /**
   * Get Zone Performance Breakdown
   */
  public async getZonePerformance(userRole: string, { date }: { date?: string } = {}): Promise<any> {
    if (userRole === "RIDER") {
      const error: any = new Error("Rider tidak memiliki otorisasi untuk mengakses Zone Performance.");
      error.statusCode = 403;
      throw error;
    }

    const { targetDate, startTimestamp, endTimestamp } = this.getJakartaDateBoundaries(date || null);

    const zones = await this.repo.getZonePerformanceMetrics({
      startTimestamp,
      endTimestamp,
      targetDate,
    });

    return zones;
  }

  /**
   * Get Product Contribution & Sales Breakdown
   */
  public async getProductPerformance(
    userRole: string,
    { range = "7d", startDate, endDate }: { range?: string; startDate?: string | null; endDate?: string | null } = {}
  ): Promise<any> {
    if (userRole === "RIDER") {
      const error: any = new Error("Rider tidak memiliki otorisasi untuk mengakses Product Performance.");
      error.statusCode = 403;
      throw error;
    }

    const { startDate: sDate, endDate: eDate, startTimestamp, endTimestamp } = this.getJakartaRangeBoundaries(
      range,
      startDate || null,
      endDate || null
    );

    const products = await this.repo.getProductPerformanceMetrics({
      startTimestamp,
      endTimestamp,
    });

    return {
      range,
      start_date: sDate,
      end_date: eDate,
      products,
    };
  }
}

export const dashboardService = DashboardService.getInstance();
