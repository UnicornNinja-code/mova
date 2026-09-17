/*
 *   Copyright (c) 2026 
 *   All rights reserved.
 *   dashboardRepository.js (High-Performance Read-Model Aggregation Layer)
 *   Consolidates Canonical Sources: users, zones, zone_assignments, rider_duty_queues, armadas, products, sales_logs.
 */

import { pool } from "../config/database.js";

export class DashboardRepository {
  static instance = null;

  constructor(dbPool = pool) {
    if (DashboardRepository.instance && dbPool === pool) {
      return DashboardRepository.instance;
    }
    this.pool = dbPool;
    if (dbPool === pool) {
      DashboardRepository.instance = this;
    }
  }

  static getInstance(dbPool = pool) {
    if (!DashboardRepository.instance) {
      DashboardRepository.instance = new DashboardRepository(dbPool);
    }
    return DashboardRepository.instance;
  }

  /**
   * Fetch Consolidated Executive & Operational KPIs
   */
  async getExecutiveKpis({ startTimestamp, endTimestamp, targetDate }) {
    // 1. Financial Metrics Query (Index-friendly date range on created_at)
    const financialQuery = `
      SELECT 
        COUNT(id)::int AS total_transactions,
        COALESCE(SUM(qty), 0)::int AS total_units_sold,
        COALESCE(SUM(total_price), 0)::numeric(14,2) AS total_revenue,
        COALESCE(AVG(total_price), 0)::numeric(14,2) AS avg_order_value
      FROM sales_logs
      WHERE created_at >= $1::timestamp AND created_at < $2::timestamp;
    `;

    // 2. Rider Operational State Metrics Query
    const riderOpsQuery = `
      SELECT
        (SELECT COUNT(*)::int FROM users WHERE role = 'RIDER' AND is_active = true) AS registered_riders,
        (SELECT COUNT(*)::int FROM rider_duty_queues WHERE duty_date = $1::date AND status = 'WAITING') AS waiting_riders,
        (SELECT COUNT(*)::int FROM rider_duty_queues WHERE duty_date = $1::date AND status = 'PLOTTED') AS plotted_riders,
        (SELECT COUNT(*)::int FROM zone_assignments WHERE assignment_date = $1::date AND status IN ('ASSIGNED', 'CHECKED_IN')) AS assigned_riders,
        (SELECT COUNT(*)::int FROM zone_assignments WHERE assignment_date = $1::date AND status = 'CHECKED_IN') AS checked_in_riders,
        (SELECT COUNT(*)::int FROM zone_assignments WHERE assignment_date = $1::date AND status = 'COMPLETED') AS completed_riders;
    `;

    // 3. Zone Master & Capacity Overview Query
    const zoneOverviewQuery = `
      SELECT
        COUNT(*)::int AS total_zones,
        COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END)::int AS active_zones,
        COALESCE(SUM(CASE WHEN status = 'ACTIVE' THEN max_capacity ELSE 0 END), 0)::int AS total_capacity
      FROM zones;
    `;

    // 4. Fleet / Armada Distribution Query
    const fleetQuery = `
      SELECT 
        status, 
        COUNT(*)::int AS count 
      FROM armadas 
      GROUP BY status;
    `;

    const [
      { rows: financialRows },
      { rows: riderOpsRows },
      { rows: zoneOverviewRows },
      { rows: fleetRows },
    ] = await Promise.all([
      this.pool.query(financialQuery, [startTimestamp, endTimestamp]),
      this.pool.query(riderOpsQuery, [targetDate]),
      this.pool.query(zoneOverviewQuery),
      this.pool.query(fleetQuery),
    ]);

    const fin = financialRows[0] || {
      total_transactions: 0,
      total_units_sold: 0,
      total_revenue: "0.00",
      avg_order_value: "0.00",
    };

    const ops = riderOpsRows[0] || {
      registered_riders: 0,
      waiting_riders: 0,
      plotted_riders: 0,
      assigned_riders: 0,
      checked_in_riders: 0,
      completed_riders: 0,
    };

    const zones = zoneOverviewRows[0] || {
      total_zones: 0,
      active_zones: 0,
      total_capacity: 0,
    };

    const fleetMap = { ACTIVE: 0, RESERVED: 0, IN_USE: 0, MAINTENANCE: 0 };
    let totalArmadas = 0;
    fleetRows.forEach((r) => {
      fleetMap[r.status] = parseInt(r.count, 10);
      totalArmadas += parseInt(r.count, 10);
    });

    const activeFleet = fleetMap.ACTIVE + fleetMap.RESERVED + fleetMap.IN_USE;
    const occupiedFleet = fleetMap.RESERVED + fleetMap.IN_USE;
    const utilizationRate = activeFleet > 0
      ? parseFloat(((occupiedFleet / activeFleet) * 100).toFixed(1))
      : 0.0;

    return {
      financials: {
        total_revenue: parseFloat(fin.total_revenue || 0),
        total_transactions: parseInt(fin.total_transactions, 10) || 0,
        total_units_sold: parseInt(fin.total_units_sold, 10) || 0,
        avg_order_value: parseFloat(fin.avg_order_value || 0),
      },
      operations: {
        registered_riders: ops.registered_riders,
        waiting_riders: ops.waiting_riders,
        plotted_riders: ops.plotted_riders,
        assigned_riders: ops.assigned_riders,
        checked_in_riders: ops.checked_in_riders,
        completed_riders: ops.completed_riders,
        total_active_zones: zones.active_zones,
        total_zone_capacity: zones.total_capacity,
      },
      fleet: {
        total_units: totalArmadas,
        available_units: fleetMap.ACTIVE,
        reserved_units: fleetMap.RESERVED,
        in_use_units: fleetMap.IN_USE,
        maintenance_units: fleetMap.MAINTENANCE,
        utilization_rate_percentage: utilizationRate,
      },
    };
  }

  /**
   * Fetch Time-Series Sales Trend (Daily Aggregation in Asia/Jakarta Timezone)
   */
  async getSalesTrend({ startTimestamp, endTimestamp }) {
    const query = `
      SELECT 
        (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date AS date,
        COUNT(id)::int AS total_transactions,
        COALESCE(SUM(qty), 0)::int AS total_units_sold,
        COALESCE(SUM(total_price), 0)::numeric(14,2) AS total_revenue
      FROM sales_logs
      WHERE created_at >= $1::timestamp AND created_at < $2::timestamp
      GROUP BY date
      ORDER BY date ASC;
    `;

    const { rows } = await this.pool.query(query, [startTimestamp, endTimestamp]);
    return rows.map((r) => ({
      date: r.date.toISOString ? r.date.toISOString().split("T")[0] : String(r.date),
      total_transactions: parseInt(r.total_transactions, 10),
      total_units_sold: parseInt(r.total_units_sold, 10),
      total_revenue: parseFloat(r.total_revenue || 0),
    }));
  }

  /**
   * Fetch Zone Performance & Occupancy Breakdown
   */
  async getZonePerformanceMetrics({ startTimestamp, endTimestamp, targetDate }) {
    const query = `
      SELECT 
        z.id AS zone_id,
        z.name AS zone_name,
        z.status AS zone_status,
        z.max_capacity,
        COALESCE(za.assigned_riders, 0)::int AS assigned_riders,
        COALESCE(za.checked_in_riders, 0)::int AS checked_in_riders,
        GREATEST(0, z.max_capacity - COALESCE(za.assigned_riders, 0))::int AS remaining_capacity,
        CASE 
          WHEN z.max_capacity > 0 THEN ROUND((COALESCE(za.assigned_riders, 0)::numeric / z.max_capacity::numeric) * 100, 1)
          ELSE 0.0
        END AS occupancy_rate_percentage,
        COALESCE(sl.total_transactions, 0)::int AS total_transactions,
        COALESCE(sl.total_units_sold, 0)::int AS total_units_sold,
        COALESCE(sl.total_revenue, 0)::numeric(14,2) AS total_revenue
      FROM zones z
      LEFT JOIN (
        SELECT 
          zone_id,
          COUNT(*)::int AS assigned_riders,
          COUNT(CASE WHEN status = 'CHECKED_IN' THEN 1 END)::int AS checked_in_riders
        FROM zone_assignments
        WHERE assignment_date = $3::date AND status IN ('ASSIGNED', 'CHECKED_IN', 'COMPLETED')
        GROUP BY zone_id
      ) za ON za.zone_id = z.id
      LEFT JOIN (
        SELECT 
          zone_id,
          COUNT(id)::int AS total_transactions,
          SUM(qty)::int AS total_units_sold,
          SUM(total_price)::numeric(14,2) AS total_revenue
        FROM sales_logs
        WHERE created_at >= $1::timestamp AND created_at < $2::timestamp
        GROUP BY zone_id
      ) sl ON sl.zone_id = z.id
      WHERE z.status = 'ACTIVE'
      ORDER BY total_revenue DESC, z.name ASC;
    `;

    const { rows } = await this.pool.query(query, [startTimestamp, endTimestamp, targetDate]);
    return rows.map((r) => ({
      zone_id: r.zone_id,
      zone_name: r.zone_name,
      zone_status: r.zone_status,
      max_capacity: r.max_capacity,
      assigned_riders: r.assigned_riders,
      checked_in_riders: r.checked_in_riders,
      remaining_capacity: r.remaining_capacity,
      occupancy_rate_percentage: parseFloat(r.occupancy_rate_percentage || 0),
      total_transactions: r.total_transactions,
      total_units_sold: r.total_units_sold,
      total_revenue: parseFloat(r.total_revenue || 0),
    }));
  }

  /**
   * Fetch Product Performance & Contribution Breakdown
   */
  async getProductPerformanceMetrics({ startTimestamp, endTimestamp }) {
    const query = `
      SELECT 
        p.id AS product_id,
        p.name AS product_name,
        p.status AS product_status,
        p.price AS current_price,
        COALESCE(sl.transaction_count, 0)::int AS total_transactions,
        COALESCE(sl.units_sold, 0)::int AS total_units_sold,
        COALESCE(sl.revenue, 0)::numeric(14,2) AS total_revenue
      FROM products p
      LEFT JOIN (
        SELECT 
          product_id,
          COUNT(id)::int AS transaction_count,
          SUM(qty)::int AS units_sold,
          SUM(total_price)::numeric(14,2) AS revenue
        FROM sales_logs
        WHERE created_at >= $1::timestamp AND created_at < $2::timestamp
        GROUP BY product_id
      ) sl ON sl.product_id = p.id
      ORDER BY total_revenue DESC, total_units_sold DESC, p.name ASC;
    `;

    const { rows } = await this.pool.query(query, [startTimestamp, endTimestamp]);
    return rows.map((r) => ({
      product_id: r.product_id,
      product_name: r.product_name,
      product_status: r.product_status,
      current_price: parseFloat(r.current_price || 0),
      total_transactions: r.total_transactions,
      total_units_sold: r.total_units_sold,
      total_revenue: parseFloat(r.total_revenue || 0),
    }));
  }
}

export const dashboardRepository = DashboardRepository.getInstance();
