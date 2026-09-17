/*
 * analyticsRepository.js
 * Data Access Layer for Milestone B-12: Reporting, Supervisor KPI & Plan-vs-Actual Analytics Layer
 * Pure Read-Model CTE Aggregations against PostgreSQL/PostGIS SSOT tables (B-08..B-11).
 */

import { pool } from "../config/database.js";

export class AnalyticsRepository {
  static instance = null;

  constructor(dbPool = pool) {
    if (AnalyticsRepository.instance && dbPool === pool) {
      return AnalyticsRepository.instance;
    }
    this.pool = dbPool;
    if (dbPool === pool) {
      AnalyticsRepository.instance = this;
    }
  }

  static getInstance(dbPool = pool) {
    if (!AnalyticsRepository.instance) {
      AnalyticsRepository.instance = new AnalyticsRepository(dbPool);
    }
    return AnalyticsRepository.instance;
  }

  /**
   * 1. Operational Lifecycle & Shift Duration Metrics
   */
  async getOperationalLifecycleMetrics({ startDate, endDate, zoneId = null } = {}) {
    let whereClauses = [];
    let values = [];
    let paramIdx = 1;

    if (startDate) {
      whereClauses.push(`za.assignment_date >= $${paramIdx}::date`);
      values.push(startDate);
      paramIdx++;
    }
    if (endDate) {
      whereClauses.push(`za.assignment_date <= $${paramIdx}::date`);
      values.push(endDate);
      paramIdx++;
    }
    if (zoneId) {
      whereClauses.push(`za.zone_id = $${paramIdx}`);
      values.push(zoneId);
      paramIdx++;
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const query = `
      WITH assignment_stats AS (
        SELECT 
          za.id AS assignment_id,
          za.rider_id,
          za.zone_id,
          za.status AS assignment_status,
          os.id AS session_id,
          os.status AS session_status,
          os.started_at,
          os.checked_in_at,
          os.checked_out_at,
          os.completed_at,
          CASE 
            WHEN os.checked_in_at IS NOT NULL THEN
              ROUND(EXTRACT(EPOCH FROM (COALESCE(os.completed_at, os.checked_out_at, NOW()) - os.checked_in_at)) / 60.0, 2)
            ELSE NULL 
          END AS operating_duration_minutes
        FROM zone_assignments za
        LEFT JOIN operational_sessions os ON za.id = os.assignment_id
        ${whereSql}
      )
      SELECT 
        COUNT(*)::int AS total_assigned_sessions,
        COUNT(DISTINCT rider_id)::int AS total_assigned_riders,
        COUNT(CASE WHEN assignment_status = 'CHECKED_IN' OR session_status IN ('CHECKED_IN', 'OPERATING', 'COMPLETED') THEN 1 END)::int AS total_checked_in_sessions,
        COUNT(CASE WHEN session_status = 'OPERATING' THEN 1 END)::int AS currently_operating_sessions,
        COUNT(CASE WHEN assignment_status = 'COMPLETED' OR session_status = 'COMPLETED' THEN 1 END)::int AS total_completed_sessions,
        COALESCE(AVG(operating_duration_minutes), 0)::numeric(10,2) AS avg_operating_duration_minutes,
        COALESCE(MIN(operating_duration_minutes), 0)::numeric(10,2) AS min_operating_duration_minutes,
        COALESCE(MAX(operating_duration_minutes), 0)::numeric(10,2) AS max_operating_duration_minutes
      FROM assignment_stats;
    `;

    const { rows } = await this.pool.query(query, values);
    return rows[0] || {
      total_assigned_sessions: 0,
      total_assigned_riders: 0,
      total_checked_in_sessions: 0,
      currently_operating_sessions: 0,
      total_completed_sessions: 0,
      avg_operating_duration_minutes: "0.00",
      min_operating_duration_minutes: "0.00",
      max_operating_duration_minutes: "0.00",
    };
  }

  /**
   * 2. Fleet / Armada Utilization Breakdown
   */
  async getFleetUtilizationMetrics() {
    const query = `
      SELECT 
        COUNT(*)::int AS total_fleet_units,
        COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END)::int AS active_available_units,
        COUNT(CASE WHEN status = 'RESERVED' THEN 1 END)::int AS currently_held_units,
        COUNT(CASE WHEN status = 'IN_USE' THEN 1 END)::int AS currently_deployed_units,
        COUNT(CASE WHEN status = 'MAINTENANCE' THEN 1 END)::int AS maintenance_units,
        ROUND((COUNT(CASE WHEN status IN ('IN_USE', 'RESERVED') THEN 1 END)::numeric / NULLIF(COUNT(*), 0) * 100), 2) AS fleet_utilization_rate_pct
      FROM armadas;
    `;
    const { rows } = await this.pool.query(query);
    return rows[0] || {
      total_fleet_units: 0,
      active_available_units: 0,
      currently_held_units: 0,
      currently_deployed_units: 0,
      maintenance_units: 0,
      fleet_utilization_rate_pct: 0,
    };
  }

  /**
   * 3. Spatial Compliance, Telemetry & Road Alert Metrics
   */
  async getComplianceMetrics({ startDate, endDate, zoneId = null, riderId = null } = {}) {
    let whereClauses = [];
    let values = [];
    let paramIdx = 1;

    if (startDate) {
      whereClauses.push(`rtl.recorded_at >= $${paramIdx}::timestamp`);
      values.push(`${startDate} 00:00:00`);
      paramIdx++;
    }
    if (endDate) {
      whereClauses.push(`rtl.recorded_at <= $${paramIdx}::timestamp`);
      values.push(`${endDate} 23:59:59`);
      paramIdx++;
    }
    if (zoneId) {
      whereClauses.push(`rtl.actual_zone_id = $${paramIdx}`);
      values.push(zoneId);
      paramIdx++;
    }
    if (riderId) {
      whereClauses.push(`rtl.rider_id = $${paramIdx}`);
      values.push(riderId);
      paramIdx++;
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const telemetryQuery = `
      SELECT 
        COUNT(*)::int AS total_telemetry_samples,
        COUNT(CASE WHEN zone_compliance = 'COMPLIANT' THEN 1 END)::int AS compliant_samples,
        COUNT(CASE WHEN zone_compliance = 'DEVIATED' THEN 1 END)::int AS deviated_samples,
        COUNT(CASE WHEN zone_compliance = 'OUTSIDE_ZONE' THEN 1 END)::int AS outside_zone_samples,
        COUNT(CASE WHEN road_compliance = 'PROHIBITED_ROAD_ALERT' THEN 1 END)::int AS prohibited_road_alerts_count,
        ROUND((COUNT(CASE WHEN zone_compliance = 'COMPLIANT' THEN 1 END)::numeric / NULLIF(COUNT(*), 0) * 100), 2) AS zone_compliance_rate_pct,
        ROUND((COUNT(CASE WHEN zone_compliance = 'DEVIATED' THEN 1 END)::numeric / NULLIF(COUNT(*), 0) * 100), 2) AS deviation_rate_pct,
        ROUND((COUNT(CASE WHEN zone_compliance = 'OUTSIDE_ZONE' THEN 1 END)::numeric / NULLIF(COUNT(*), 0) * 100), 2) AS outside_zone_rate_pct
      FROM rider_telemetry_logs rtl
      ${whereSql};
    `;

    // Discrete Geofence Transition Events
    let zWhereClauses = [];
    let zValues = [];
    let zParamIdx = 1;
    if (startDate) {
      zWhereClauses.push(`rzl.created_at >= $${zParamIdx}::timestamp`);
      zValues.push(`${startDate} 00:00:00`);
      zParamIdx++;
    }
    if (endDate) {
      zWhereClauses.push(`rzl.created_at <= $${zParamIdx}::timestamp`);
      zValues.push(`${endDate} 23:59:59`);
      zParamIdx++;
    }
    if (zoneId) {
      zWhereClauses.push(`rzl.zone_id = $${zParamIdx}`);
      zValues.push(zoneId);
      zParamIdx++;
    }
    if (riderId) {
      zWhereClauses.push(`rzl.rider_id = $${zParamIdx}`);
      zValues.push(riderId);
      zParamIdx++;
    }
    const zWhereSql = zWhereClauses.length > 0 ? `WHERE ${zWhereClauses.join(" AND ")}` : "";

    const zoneEventsQuery = `
      SELECT 
        COUNT(*)::int AS total_discrete_events,
        COUNT(CASE WHEN event_type = 'ENTER' THEN 1 END)::int AS enter_events_count,
        COUNT(CASE WHEN event_type = 'DEVIATED_ENTER' THEN 1 END)::int AS deviation_events_count,
        COUNT(CASE WHEN event_type = 'EXIT' THEN 1 END)::int AS exit_events_count
      FROM rider_zone_logs rzl
      ${zWhereSql};
    `;

    const [{ rows: telRows }, { rows: eventRows }] = await Promise.all([
      this.pool.query(telemetryQuery, values),
      this.pool.query(zoneEventsQuery, zValues),
    ]);

    return {
      telemetry: telRows[0] || {
        total_telemetry_samples: 0,
        compliant_samples: 0,
        deviated_samples: 0,
        outside_zone_samples: 0,
        prohibited_road_alerts_count: 0,
        zone_compliance_rate_pct: null,
        deviation_rate_pct: null,
        outside_zone_rate_pct: null,
      },
      discrete_events: eventRows[0] || {
        total_discrete_events: 0,
        enter_events_count: 0,
        deviation_events_count: 0,
        exit_events_count: 0,
      },
    };
  }

  /**
   * 4. Sales & Revenue Aggregates with Spatial Compliance Provenance
   */
  async getSalesMetrics({ startDate, endDate, zoneId = null, riderId = null } = {}) {
    let whereClauses = [];
    let values = [];
    let paramIdx = 1;

    if (startDate) {
      whereClauses.push(`sl.created_at >= $${paramIdx}::timestamp`);
      values.push(`${startDate} 00:00:00`);
      paramIdx++;
    }
    if (endDate) {
      whereClauses.push(`sl.created_at <= $${paramIdx}::timestamp`);
      values.push(`${endDate} 23:59:59`);
      paramIdx++;
    }
    if (zoneId) {
      whereClauses.push(`sl.zone_id = $${paramIdx}`);
      values.push(zoneId);
      paramIdx++;
    }
    if (riderId) {
      whereClauses.push(`sl.rider_id = $${paramIdx}`);
      values.push(riderId);
      paramIdx++;
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const summaryQuery = `
      SELECT 
        COUNT(sl.id)::int AS total_transactions,
        COALESCE(SUM(sl.qty), 0)::int AS total_units_sold,
        COALESCE(SUM(sl.total_price), 0)::numeric(14,2) AS total_revenue,
        COALESCE(AVG(sl.total_price), 0)::numeric(14,2) AS average_order_value,
        COUNT(DISTINCT sl.rider_id)::int AS total_transacting_riders,
        COUNT(DISTINCT sl.zone_id)::int AS total_transacting_zones,
        COALESCE(SUM(CASE WHEN sl.compliance_at_sale = 'COMPLIANT' THEN sl.total_price ELSE 0 END), 0)::numeric(14,2) AS in_zone_compliant_revenue,
        COALESCE(SUM(CASE WHEN sl.compliance_at_sale != 'COMPLIANT' THEN sl.total_price ELSE 0 END), 0)::numeric(14,2) AS out_of_zone_deviated_revenue,
        ROUND((COALESCE(SUM(CASE WHEN sl.compliance_at_sale = 'COMPLIANT' THEN sl.total_price ELSE 0 END), 0)::numeric / NULLIF(SUM(sl.total_price), 0) * 100), 2) AS compliant_revenue_share_pct
      FROM sales_logs sl
      ${whereSql};
    `;

    // Hourly Distribution Query (06:00 - 22:00)
    const hourlyQuery = `
      SELECT 
        EXTRACT(HOUR FROM sl.created_at)::int AS hour_of_day,
        COUNT(sl.id)::int AS transaction_count,
        COALESCE(SUM(sl.qty), 0)::int AS units_sold,
        COALESCE(SUM(sl.total_price), 0)::numeric(14,2) AS hourly_revenue
      FROM sales_logs sl
      ${whereSql}
      GROUP BY EXTRACT(HOUR FROM sl.created_at)
      ORDER BY hour_of_day ASC;
    `;

    // Product Mix Performance Query
    const productQuery = `
      SELECT 
        p.id AS product_id,
        p.name AS product_name,
        p.price AS current_price,
        COUNT(sl.id)::int AS total_orders,
        COALESCE(SUM(sl.qty), 0)::int AS units_sold,
        COALESCE(SUM(sl.total_price), 0)::numeric(14,2) AS product_revenue,
        ROUND((COALESCE(SUM(sl.total_price), 0)::numeric / NULLIF((SELECT SUM(total_price) FROM sales_logs sl_sub ${whereSql.replace(/sl\./g, 'sl_sub.')}), 0) * 100), 2) AS revenue_share_pct
      FROM sales_logs sl
      JOIN products p ON sl.product_id = p.id
      ${whereSql}
      GROUP BY p.id, p.name, p.price
      ORDER BY product_revenue DESC;
    `;

    const [
      { rows: summaryRows },
      { rows: hourlyRows },
      { rows: productRows },
    ] = await Promise.all([
      this.pool.query(summaryQuery, values),
      this.pool.query(hourlyQuery, values),
      this.pool.query(productQuery, values),
    ]);

    return {
      summary: summaryRows[0] || {
        total_transactions: 0,
        total_units_sold: 0,
        total_revenue: "0.00",
        average_order_value: "0.00",
        total_transacting_riders: 0,
        total_transacting_zones: 0,
        in_zone_compliant_revenue: "0.00",
        out_of_zone_deviated_revenue: "0.00",
        compliant_revenue_share_pct: null,
      },
      hourly_trend: hourlyRows,
      product_mix: productRows,
    };
  }

  /**
   * 5. DSS Plan-vs-Actual Effectiveness Correlation (TOPSIS Rank Correlation)
   */
  async getDSSPlanVsActualMetrics({ startDate, endDate, distributionRunId = null, dssHistoryId = null } = {}) {
    let whereClauses = [];
    let values = [];
    let paramIdx = 1;

    if (startDate) {
      whereClauses.push(`za.assignment_date >= $${paramIdx}::date`);
      values.push(startDate);
      paramIdx++;
    }
    if (endDate) {
      whereClauses.push(`za.assignment_date <= $${paramIdx}::date`);
      values.push(endDate);
      paramIdx++;
    }
    if (distributionRunId) {
      whereClauses.push(`za.distribution_run_id = $${paramIdx}`);
      values.push(distributionRunId);
      paramIdx++;
    }
    if (dssHistoryId) {
      whereClauses.push(`za.dss_history_id = $${paramIdx}`);
      values.push(dssHistoryId);
      paramIdx++;
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const query = `
      WITH rank_assignments AS (
        SELECT 
          za.topsis_rank,
          za.preference_score,
          za.zone_id,
          z.name AS zone_name,
          za.rider_id,
          za.id AS assignment_id,
          os.id AS session_id,
          os.checked_in_at,
          os.completed_at,
          os.checked_out_at,
          CASE 
            WHEN os.checked_in_at IS NOT NULL THEN
              ROUND(EXTRACT(EPOCH FROM (COALESCE(os.completed_at, os.checked_out_at, NOW()) - os.checked_in_at)) / 60.0, 2)
            ELSE NULL 
          END AS operating_duration_minutes
        FROM zone_assignments za
        JOIN zones z ON za.zone_id = z.id
        LEFT JOIN operational_sessions os ON za.id = os.assignment_id
        ${whereSql}
      ),
      rank_sales AS (
        SELECT 
          ra.topsis_rank,
          ra.zone_id,
          ra.rider_id,
          COALESCE(SUM(sl.total_price), 0)::numeric(14,2) AS zone_revenue,
          COUNT(sl.id)::int AS transaction_count,
          COALESCE(SUM(sl.qty), 0)::int AS units_sold
        FROM rank_assignments ra
        LEFT JOIN sales_logs sl ON ra.session_id = sl.session_id
        GROUP BY ra.topsis_rank, ra.zone_id, ra.rider_id
      ),
      rank_telemetry AS (
        SELECT 
          ra.topsis_rank,
          ra.zone_id,
          COUNT(rtl.id)::int AS total_samples,
          COUNT(CASE WHEN rtl.zone_compliance = 'COMPLIANT' THEN 1 END)::int AS compliant_samples
        FROM rank_assignments ra
        LEFT JOIN rider_telemetry_logs rtl ON ra.session_id = rtl.session_id
        GROUP BY ra.topsis_rank, ra.zone_id
      )
      SELECT 
        ra.topsis_rank,
        ra.zone_id,
        ra.zone_name,
        COALESCE(AVG(ra.preference_score), 0)::numeric(6,4) AS predicted_preference_score,
        COUNT(DISTINCT ra.assignment_id)::int AS total_assigned_sessions,
        COUNT(DISTINCT ra.rider_id)::int AS total_assigned_riders,
        COUNT(CASE WHEN ra.checked_in_at IS NOT NULL THEN 1 END)::int AS total_checked_in_riders,
        COALESCE(SUM(rs.zone_revenue), 0)::numeric(14,2) AS actual_revenue,
        ROUND((COALESCE(SUM(rs.zone_revenue), 0)::numeric / NULLIF(COUNT(DISTINCT ra.rider_id), 0)), 2) AS revenue_per_assigned_rider,
        COALESCE(AVG(ra.operating_duration_minutes), 0)::numeric(10,2) AS avg_operating_duration_minutes,
        ROUND((COALESCE(SUM(rt.compliant_samples), 0)::numeric / NULLIF(SUM(rt.total_samples), 0) * 100), 2) AS actual_compliance_rate_pct,
        CASE 
          WHEN COUNT(DISTINCT ra.rider_id) = 0 THEN 'NO_DATA'
          WHEN SUM(rt.total_samples) IS NULL OR SUM(rt.total_samples) = 0 THEN 'PARTIAL'
          ELSE 'COMPLETE'
        END AS data_status
      FROM rank_assignments ra
      LEFT JOIN rank_sales rs ON ra.topsis_rank = rs.topsis_rank AND ra.zone_id = rs.zone_id AND ra.rider_id = rs.rider_id
      LEFT JOIN rank_telemetry rt ON ra.topsis_rank = rt.topsis_rank AND ra.zone_id = rt.zone_id
      GROUP BY ra.topsis_rank, ra.zone_id, ra.zone_name
      ORDER BY ra.topsis_rank ASC NULLS LAST;
    `;

    const { rows } = await this.pool.query(query, values);
    return rows;
  }

  /**
   * 6. Detailed Session-by-Session Tabular Dataset for Formal Reporting & Export
   */
  async getDetailedDailyOperationalReport({ targetDate, zoneId = null } = {}) {
    let whereClauses = [`za.assignment_date = $1::date`];
    let values = [targetDate];
    let paramIdx = 2;

    if (zoneId) {
      whereClauses.push(`za.zone_id = $${paramIdx}`);
      values.push(zoneId);
      paramIdx++;
    }

    const whereSql = `WHERE ${whereClauses.join(" AND ")}`;

    const query = `
      SELECT 
        za.id AS assignment_id,
        za.assignment_date,
        za.topsis_rank,
        za.preference_score,
        u.id AS rider_id,
        u.name AS rider_name,
        u.email AS rider_email,
        z.id AS zone_id,
        z.name AS zone_name,
        a.code AS armada_code,
        a.type AS armada_type,
        os.id AS session_id,
        os.status AS session_status,
        os.started_at,
        os.checked_in_at,
        os.checked_out_at,
        os.completed_at,
        CASE 
          WHEN os.checked_in_at IS NOT NULL THEN
            ROUND(EXTRACT(EPOCH FROM (COALESCE(os.completed_at, os.checked_out_at, NOW()) - os.checked_in_at)) / 60.0, 2)
          ELSE 0 
        END AS operating_duration_minutes,
        COALESCE(sales_summary.total_revenue, 0)::numeric(14,2) AS total_sales_revenue,
        COALESCE(sales_summary.total_qty, 0)::int AS total_units_sold,
        COALESCE(sales_summary.transaction_count, 0)::int AS transaction_count,
        COALESCE(tel_summary.compliance_rate_pct, 0)::numeric(6,2) AS compliance_rate_pct,
        COALESCE(tel_summary.road_alert_count, 0)::int AS road_alert_count
      FROM zone_assignments za
      JOIN users u ON za.rider_id = u.id
      JOIN zones z ON za.zone_id = z.id
      LEFT JOIN armadas a ON za.armada_id = a.id
      LEFT JOIN operational_sessions os ON za.id = os.assignment_id
      LEFT JOIN (
        SELECT 
          session_id, 
          COUNT(id)::int AS transaction_count,
          SUM(qty)::int AS total_qty,
          SUM(total_price)::numeric(14,2) AS total_revenue
        FROM sales_logs
        GROUP BY session_id
      ) sales_summary ON os.id = sales_summary.session_id
      LEFT JOIN (
        SELECT 
          session_id,
          COUNT(CASE WHEN road_compliance = 'PROHIBITED_ROAD_ALERT' THEN 1 END)::int AS road_alert_count,
          ROUND((COUNT(CASE WHEN zone_compliance = 'COMPLIANT' THEN 1 END)::numeric / NULLIF(COUNT(*), 0) * 100), 2) AS compliance_rate_pct
        FROM rider_telemetry_logs
        GROUP BY session_id
      ) tel_summary ON os.id = tel_summary.session_id
      ${whereSql}
      ORDER BY za.topsis_rank ASC NULLS LAST, za.created_at ASC;
    `;

    const { rows } = await this.pool.query(query, values);
    return rows;
  }
}

export const analyticsRepository = AnalyticsRepository.getInstance();
