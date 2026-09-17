import { analyticsRepository } from "../../repositories/analyticsRepository.js";
import { formatMetric, DATA_STATUS } from "./AnalyticsContract.js";

const SEVEN_DAYS = 7;
const THIRTY_DAYS = 30;

const resolveDateRange = ({ range = "today", startDate, endDate, date }) => {
  if (startDate && endDate) {
    return { targetStartDate: startDate, targetEndDate: endDate };
  }

  const now = new Date();
  if (range === "7d") {
    const d = new Date(now);
    d.setDate(d.getDate() - SEVEN_DAYS);
    return {
      targetStartDate: d.toISOString().split("T")[0],
      targetEndDate: now.toISOString().split("T")[0],
    };
  }

  if (range === "30d") {
    const d = new Date(now);
    d.setDate(d.getDate() - THIRTY_DAYS);
    return {
      targetStartDate: d.toISOString().split("T")[0],
      targetEndDate: now.toISOString().split("T")[0],
    };
  }

  const defaultDate = date || now.toISOString().split("T")[0];
  return { targetStartDate: defaultDate, targetEndDate: defaultDate };
};

export class SalesAnalyticsService {
  static instance = null;

  constructor(repo = analyticsRepository) {
    if (SalesAnalyticsService.instance && repo === analyticsRepository) {
      return SalesAnalyticsService.instance;
    }
    this.repo = repo;
    if (repo === analyticsRepository) {
      SalesAnalyticsService.instance = this;
    }
  }

  static getInstance(repo = analyticsRepository) {
    if (!SalesAnalyticsService.instance) {
      SalesAnalyticsService.instance = new SalesAnalyticsService(repo);
    }
    return SalesAnalyticsService.instance;
  }

  async getSalesPerformance({ range = "today", startDate, endDate, date, zoneId = null, riderId = null } = {}) {
    const { targetStartDate, targetEndDate } = resolveDateRange({ range, startDate, endDate, date });

    const data = await this.repo.getSalesMetrics({
      startDate: targetStartDate,
      endDate: targetEndDate,
      zoneId,
      riderId,
    });

    const sum = data.summary;
    const totalTransactions = sum.total_transactions || 0;
    const totalRevenue = parseFloat(sum.total_revenue) || 0;
    const inZoneRevenue = parseFloat(sum.in_zone_compliant_revenue) || 0;
    const outOfZoneRevenue = parseFloat(sum.out_of_zone_deviated_revenue) || 0;
    const aov = parseFloat(sum.average_order_value) || 0;

    const hasTransactions = totalTransactions > 0;

    return {
      time_window: {
        range,
        start_date: targetStartDate,
        end_date: targetEndDate,
      },
      data_status: hasTransactions ? DATA_STATUS.COMPLETE : DATA_STATUS.NO_DATA,
      summary: {
        total_revenue: formatMetric(totalRevenue, totalTransactions, "Rp"),
        total_transactions: totalTransactions,
        total_units_sold: sum.total_units_sold || 0,
        average_order_value: formatMetric(aov, totalTransactions, "Rp"),
        total_transacting_riders: sum.total_transacting_riders || 0,
        total_transacting_zones: sum.total_transacting_zones || 0,
      },
      spatial_revenue_breakdown: {
        in_zone_compliant_revenue: formatMetric(inZoneRevenue, totalTransactions, "Rp"),
        out_of_zone_deviated_revenue: formatMetric(outOfZoneRevenue, totalTransactions, "Rp"),
        compliant_revenue_share_pct: hasTransactions
          ? formatMetric((inZoneRevenue / totalRevenue) * 100, totalTransactions, "%")
          : { value: null, formatted: "N/A", data_status: DATA_STATUS.NO_DATA, unit: "%" },
      },
      hourly_trend: data.hourly_trend.map((h) => {
        const hourlyRevenue = parseFloat(h.hourly_revenue) || 0;
        return {
          hour: h.hour_of_day,
          hour_label: `${String(h.hour_of_day).padStart(2, "0")}:00`,
          transactions: h.transaction_count,
          units_sold: h.units_sold,
          revenue: hourlyRevenue,
          formatted_revenue: `Rp ${Math.round(hourlyRevenue).toLocaleString("id-ID")}`,
        };
      }),
      product_mix: data.product_mix.map((p) => {
        const prodRevenue = parseFloat(p.product_revenue) || 0;
        return {
          product_id: p.product_id,
          product_name: p.product_name,
          current_price: parseFloat(p.current_price) || 0,
          total_orders: p.total_orders,
          units_sold: p.units_sold,
          product_revenue: prodRevenue,
          formatted_revenue: `Rp ${Math.round(prodRevenue).toLocaleString("id-ID")}`,
          revenue_share_pct: `${parseFloat(p.revenue_share_pct || 0).toFixed(2)}%`,
        };
      }),
    };
  }
}

export const salesAnalyticsService = SalesAnalyticsService.getInstance();
