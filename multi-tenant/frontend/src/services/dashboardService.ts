/*
 * dashboardService.ts
 * Dashboard REST Service for Svelte 5 Frontend
 */

import { axiosInstance } from "../lib/axios";

export interface DashboardSummary {
  date: string;
  role_scope: string;
  financials?: {
    total_revenue: number;
    total_transactions: number;
    total_units_sold: number;
    cash_revenue?: number;
    qris_revenue?: number;
    avg_order_value?: number;
    growth_percent?: number;
  };
  operations?: {
    registered_riders: number;
    waiting_riders?: number;
    plotted_riders?: number;
    assigned_riders: number;
    checked_in_riders: number;
    completed_riders?: number;
    total_active_zones: number;
    total_zone_capacity?: number;
  };
  fleet?: {
    total_units: number;
    available_units: number;
    reserved_units?: number;
    in_use_units: number;
    maintenance_units: number;
    utilization_rate_percentage: number;
  };
  top_dss_zone?: {
    zone_id: string;
    zone_name: string;
    preference_score: number;
    rank: number;
    time_slot: string;
    weight_source: string;
  } | null;
}

export interface SalesTrendItem {
  date: string;
  total_revenue: number;
  total_units_sold?: number;
  total_units?: number;
  total_transactions: number;
}

export interface ProductPerformanceItem {
  product_id: string;
  product_name: string;
  sku?: string;
  category?: string;
  image_url?: string;
  product_status: string;
  current_price: number;
  total_transactions: number;
  total_units_sold: number;
  total_revenue: number;
}

export interface ZonePerformanceItem {
  zone_id: string;
  zone_name: string;
  assigned_riders?: number;
  checked_in_riders?: number;
  max_capacity: number;
  total_revenue: number;
  total_units_sold: number;
  occupancy_rate_percentage?: number;
}

export interface AuditLogItem {
  id: string;
  user_id?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  status: string;
  details?: any;
  created_at: string;
}

export const dashboardService = {
  getSummary: async (date?: string): Promise<DashboardSummary> => {
    const params = date ? { date } : {};
    const res = await axiosInstance.get("/dashboard/summary", { params });
    return res.data?.data || res.data;
  },

  getSalesTrend: async (
    options?: string | { range?: string; startDate?: string; endDate?: string }
  ): Promise<SalesTrendItem[]> => {
    let range = "7d";
    let startDate: string | undefined;
    let endDate: string | undefined;

    if (typeof options === "string") {
      range = options;
    } else if (options && typeof options === "object") {
      range = options.range || "7d";
      startDate = options.startDate;
      endDate = options.endDate;
    }

    const res = await axiosInstance.get("/dashboard/sales-trend", {
      params: { range, start_date: startDate, end_date: endDate },
    });
    const trendData = res.data?.data?.data || res.data?.data || res.data || [];
    return Array.isArray(trendData) ? trendData : [];
  },

  getProductPerformance: async (
    options?: string | { range?: string; startDate?: string; endDate?: string }
  ): Promise<ProductPerformanceItem[]> => {
    let range = "7d";
    let startDate: string | undefined;
    let endDate: string | undefined;

    if (typeof options === "string") {
      range = options;
    } else if (options && typeof options === "object") {
      range = options.range || "7d";
      startDate = options.startDate;
      endDate = options.endDate;
    }

    const res = await axiosInstance.get("/dashboard/product-performance", {
      params: { range, start_date: startDate, end_date: endDate },
    });
    const list = res.data?.data?.products || res.data?.data || res.data || [];
    return Array.isArray(list) ? list : [];
  },

  getZonePerformance: async (date?: string): Promise<ZonePerformanceItem[]> => {
    const params = date ? { date } : {};
    const res = await axiosInstance.get("/dashboard/zone-performance", { params });
    const list = res.data?.data || res.data || [];
    return Array.isArray(list) ? list : [];
  },

  getAuditLogs: async (limit: number = 20): Promise<AuditLogItem[]> => {
    try {
      const res = await axiosInstance.get("/audit-logs", { params: { limit } });
      const logs = res.data?.logs || res.data?.data || res.data || [];
      return Array.isArray(logs) ? logs : [];
    } catch {
      return [];
    }
  },

  syncWeather: async (): Promise<{ msg: string; timestamp: string }> => {
    const res = await axiosInstance.post("/weathers/sync");
    return res.data;
  },
};
