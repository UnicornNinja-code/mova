/*
 * reportService.js
 * Comprehensive Domain Service for Operational, DSS, Fleet, and Executive Reporting in Single-Tenant COZIS
 */

import { pool } from "../config/database.js";

export class ReportService {
  static instance = null;

  constructor(dbPool = pool) {
    if (ReportService.instance && dbPool === pool) {
      return ReportService.instance;
    }
    this.pool = dbPool;
    if (dbPool === pool) {
      ReportService.instance = this;
    }
  }

  static getInstance(dbPool = pool) {
    if (!ReportService.instance) {
      ReportService.instance = new ReportService(dbPool);
    }
    return ReportService.instance;
  }

  /**
   * 1. Executive Summary: High-level KPI metrics for SuperAdmin & Management
   */
  async getExecutiveSummary() {
    const kpiQuery = `
      SELECT 
        (SELECT COUNT(*)::int FROM users WHERE role = 'RIDER' AND is_active = true) AS active_riders_count,
        (SELECT COUNT(*)::int FROM zones WHERE status = 'ACTIVE') AS active_zones_count,
        (SELECT COUNT(*)::int FROM armadas WHERE status = 'ACTIVE') AS active_fleet_count,
        (SELECT COUNT(*)::int FROM armadas WHERE current_rider_id IS NOT NULL OR status = 'IN_USE') AS deployed_fleet_count,
        (SELECT COALESCE(SUM(total_price), 0)::numeric(14,2) FROM sales_logs WHERE created_at::date = CURRENT_DATE) AS revenue_today,
        (SELECT COALESCE(SUM(total_price), 0)::numeric(14,2) FROM sales_logs WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)) AS revenue_this_month,
        (SELECT COALESCE(SUM(qty), 0)::int FROM sales_logs WHERE created_at::date = CURRENT_DATE) AS cups_sold_today,
        (SELECT COUNT(*)::int FROM zone_assignments WHERE assignment_date = CURRENT_DATE AND status IN ('CHECKED_IN', 'COMPLETED')) AS active_sessions_today,
        (SELECT COUNT(*)::int FROM zone_assignments WHERE assignment_date = CURRENT_DATE) AS total_assigned_today,
        (SELECT COUNT(*)::int FROM dss_histories WHERE execution_date::date = CURRENT_DATE) AS dss_runs_today;
    `;

    const { rows } = await this.pool.query(kpiQuery);
    const kpi = rows[0] || {};

    const complianceRate =
      kpi.total_assigned_today > 0
        ? parseFloat(((kpi.active_sessions_today / kpi.total_assigned_today) * 100).toFixed(2))
        : 0;

    const fleetUtilization =
      kpi.active_fleet_count > 0
        ? parseFloat(((kpi.deployed_fleet_count / kpi.active_fleet_count) * 100).toFixed(2))
        : 0;

    return {
      kpis: {
        active_riders: kpi.active_riders_count || 0,
        active_zones: kpi.active_zones_count || 0,
        active_fleet: kpi.active_fleet_count || 0,
        deployed_fleet: kpi.deployed_fleet_count || 0,
        fleet_utilization_percent: fleetUtilization,
        revenue_today: parseFloat(kpi.revenue_today || 0),
        revenue_this_month: parseFloat(kpi.revenue_this_month || 0),
        cups_sold_today: kpi.cups_sold_today || 0,
        active_sessions_today: kpi.active_sessions_today || 0,
        total_assigned_today: kpi.total_assigned_today || 0,
        check_in_compliance_percent: complianceRate,
        dss_runs_today: kpi.dss_runs_today || 0,
      },
      generated_at: new Date().toISOString(),
    };
  }

  /**
   * 2. Rider Operational Report: Attendance, shifts, working hours, and revenue per rider
   */
  async getRiderOperationalReport({ startDate, endDate, riderId } = {}) {
    const values = [];
    let whereClause = "WHERE u.role = 'RIDER'";

    if (riderId) {
      values.push(riderId);
      whereClause += ` AND u.id = $${values.length}`;
    }

    let dateFilter = "";
    if (startDate) {
      values.push(startDate);
      dateFilter += ` AND za.assignment_date >= $${values.length}::date`;
    }
    if (endDate) {
      values.push(endDate);
      dateFilter += ` AND za.assignment_date <= $${values.length}::date`;
    }

    const query = `
      SELECT 
        u.id AS rider_id,
        u.name AS rider_name,
        u.username AS rider_username,
        u.email AS rider_email,
        u.is_active,
        COUNT(DISTINCT za.assignment_date)::int AS total_days_active,
        COUNT(DISTINCT za.id)::int AS total_assignments,
        COUNT(DISTINCT CASE WHEN za.status IN ('CHECKED_IN', 'COMPLETED') OR os.status IN ('CHECKED_IN', 'OPERATING', 'COMPLETED') THEN za.id END)::int AS total_check_ins,
        COUNT(DISTINCT CASE WHEN za.status = 'COMPLETED' OR os.status = 'COMPLETED' THEN za.id END)::int AS total_check_outs,
        COALESCE(SUM(sl.total_price), 0)::numeric(14,2) AS total_revenue,
        COALESCE(SUM(sl.qty), 0)::int AS total_cups_sold,
        COUNT(DISTINCT sl.id)::int AS total_transactions,
        ROUND(AVG(
          CASE 
            WHEN os.checked_in_at IS NOT NULL AND os.checked_out_at IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (os.checked_out_at - os.checked_in_at)) / 3600.0
            WHEN za.check_in_time IS NOT NULL AND za.check_out_time IS NOT NULL
            THEN EXTRACT(EPOCH FROM (za.check_out_time - za.check_in_time)) / 3600.0
            ELSE NULL 
          END
        )::numeric, 2)::float AS avg_working_hours,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT z.name), NULL) AS assigned_zones
      FROM users u
      LEFT JOIN zone_assignments za ON za.rider_id = u.id ${dateFilter}
      LEFT JOIN operational_sessions os ON os.assignment_id = za.id
      LEFT JOIN zones z ON z.id = za.zone_id
      LEFT JOIN sales_logs sl ON sl.rider_id = u.id 
        ${startDate ? `AND sl.created_at::date >= '${startDate}'::date` : ""}
        ${endDate ? `AND sl.created_at::date <= '${endDate}'::date` : ""}
      ${whereClause}
      GROUP BY u.id, u.name, u.username, u.email, u.is_active
      ORDER BY total_revenue DESC, total_check_ins DESC;
    `;

    const { rows } = await this.pool.query(query, values);
    return {
      period: { start_date: startDate || null, end_date: endDate || null },
      total_riders_analyzed: rows.length,
      riders: rows.map(r => ({
        ...r,
        total_revenue: parseFloat(r.total_revenue || 0),
        avg_working_hours: r.avg_working_hours || 0,
      })),
    };
  }

  /**
   * 3. Zone Effectiveness Report: Revenue, capacity utilization, and compliance
   */
  async getZoneEffectivenessReport({ startDate, endDate, zoneId } = {}) {
    const values = [];
    let whereClause = "WHERE 1=1";

    if (zoneId) {
      values.push(zoneId);
      whereClause += ` AND z.id = $${values.length}`;
    }

    let dateFilter = "";
    if (startDate) {
      values.push(startDate);
      dateFilter += ` AND za.assignment_date >= $${values.length}::date`;
    }
    if (endDate) {
      values.push(endDate);
      dateFilter += ` AND za.assignment_date <= $${values.length}::date`;
    }

    const query = `
      SELECT 
        z.id AS zone_id,
        z.name AS zone_name,
        z.status AS zone_status,
        z.max_capacity,
        COUNT(DISTINCT za.id)::int AS total_assigned_riders,
        COUNT(DISTINCT CASE WHEN za.status IN ('CHECKED_IN', 'COMPLETED') THEN za.id END)::int AS total_check_ins,
        ROUND(
          CASE 
            WHEN COUNT(DISTINCT za.id) > 0 
            THEN (COUNT(DISTINCT CASE WHEN za.status IN ('CHECKED_IN', 'COMPLETED') THEN za.id END)::numeric / COUNT(DISTINCT za.id)::numeric) * 100 
            ELSE 0 
          END, 2
        )::float AS execution_compliance_rate,
        COALESCE(SUM(sl.total_price), 0)::numeric(14,2) AS total_revenue,
        COALESCE(SUM(sl.qty), 0)::int AS total_cups_sold,
        COUNT(DISTINCT sl.id)::int AS total_sales_transactions,
        (SELECT COUNT(*)::int FROM recommendations r WHERE r.zone_id = z.id) AS dss_recommended_frequency
      FROM zones z
      LEFT JOIN zone_assignments za ON za.zone_id = z.id ${dateFilter}
      LEFT JOIN sales_logs sl ON sl.zone_id = z.id
        ${startDate ? `AND sl.created_at::date >= '${startDate}'::date` : ""}
        ${endDate ? `AND sl.created_at::date <= '${endDate}'::date` : ""}
      ${whereClause}
      GROUP BY z.id, z.name, z.status, z.max_capacity
      ORDER BY total_revenue DESC, total_check_ins DESC;
    `;

    const { rows } = await this.pool.query(query, values);
    return {
      period: { start_date: startDate || null, end_date: endDate || null },
      total_zones_analyzed: rows.length,
      zones: rows.map(z => ({
        ...z,
        total_revenue: parseFloat(z.total_revenue || 0),
        execution_compliance_rate: z.execution_compliance_rate || 0,
      })),
    };
  }

  /**
   * 4. Fleet Report: Armada availability, condition, and deployed riders
   */
  async getFleetReport() {
    const summaryQuery = `
      SELECT 
        COUNT(*)::int AS total_fleet,
        COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END)::int AS active_count,
        COUNT(CASE WHEN status = 'MAINTENANCE' THEN 1 END)::int AS maintenance_count,
        COUNT(CASE WHEN status = 'ACTIVE' AND current_rider_id IS NULL THEN 1 END)::int AS standby_count,
        COUNT(CASE WHEN status = 'IN_USE' OR current_rider_id IS NOT NULL THEN 1 END)::int AS currently_deployed_count,
        COUNT(CASE WHEN status = 'RESERVED' THEN 1 END)::int AS reserved_count
      FROM armadas;
    `;

    const detailQuery = `
      SELECT 
        a.id AS armada_id,
        a.code,
        a.type,
        a.status,
        a.current_rider_id,
        u.name AS current_rider_name,
        COUNT(DISTINCT za.id)::int AS historical_deployments_count
      FROM armadas a
      LEFT JOIN users u ON u.id = a.current_rider_id
      LEFT JOIN zone_assignments za ON za.armada_id = a.id
      GROUP BY a.id, a.code, a.type, a.status, a.current_rider_id, u.name
      ORDER BY a.code ASC;
    `;

    const [{ rows: summaryRows }, { rows: detailRows }] = await Promise.all([
      this.pool.query(summaryQuery),
      this.pool.query(detailQuery),
    ]);

    const summary = summaryRows[0] || {
      total_fleet: 0,
      active_count: 0,
      maintenance_count: 0,
      standby_count: 0,
      currently_deployed_count: 0,
      reserved_count: 0,
    };

    const utilizationRate =
      summary.total_fleet > 0
        ? parseFloat(((summary.currently_deployed_count / summary.total_fleet) * 100).toFixed(2))
        : 0;

    return {
      summary: {
        ...summary,
        utilization_rate: utilizationRate,
      },
      armadas: detailRows,
    };
  }

  /**
   * 5. DSS Accuracy Report: System Recommendation vs Supervisor Decision
   */
  async getDssAccuracyReport({ startDate, endDate } = {}) {
    const values = [];
    let dateFilter = "WHERE 1=1";

    if (startDate) {
      values.push(startDate);
      dateFilter += ` AND za.assignment_date >= $${values.length}::date`;
    }
    if (endDate) {
      values.push(endDate);
      dateFilter += ` AND za.assignment_date <= $${values.length}::date`;
    }

    const query = `
      SELECT 
        COUNT(*)::int AS total_assignments,
        COUNT(CASE WHEN za.assignment_type = 'AUTO' THEN 1 END)::int AS accepted_recommendations,
        COUNT(CASE WHEN za.assignment_type = 'MANUAL' THEN 1 END)::int AS supervisor_overrides,
        ROUND(
          CASE 
            WHEN COUNT(*) > 0 
            THEN (COUNT(CASE WHEN za.assignment_type = 'AUTO' THEN 1 END)::numeric / COUNT(*)::numeric) * 100 
            ELSE 0 
          END, 2
        )::float AS acceptance_rate,
        ROUND(
          CASE 
            WHEN COUNT(*) > 0 
            THEN (COUNT(CASE WHEN za.assignment_type = 'MANUAL' THEN 1 END)::numeric / COUNT(*)::numeric) * 100 
            ELSE 0 
          END, 2
        )::float AS override_rate
      FROM zone_assignments za
      ${dateFilter};
    `;

    const recentRunsQuery = `
      SELECT 
        dh.id AS dss_history_id,
        dh.execution_date,
        dh.consistency_ratio,
        dh.status,
        u.name AS executed_by_name,
        (SELECT COUNT(*)::int FROM recommendations r WHERE r.dss_history_id = dh.id) AS recommended_zones_count
      FROM dss_histories dh
      LEFT JOIN users u ON u.id = dh.executed_by
      ORDER BY dh.execution_date DESC
      LIMIT 10;
    `;

    const [{ rows: statsRows }, { rows: recentRuns }] = await Promise.all([
      this.pool.query(query, values),
      this.pool.query(recentRunsQuery),
    ]);

    return {
      period: { start_date: startDate || null, end_date: endDate || null },
      metrics: statsRows[0] || {
        total_assignments: 0,
        accepted_recommendations: 0,
        supervisor_overrides: 0,
        acceptance_rate: 0,
        override_rate: 0,
      },
      recent_runs: recentRuns,
    };
  }

  /**
   * 6. Audit Logs Report: Security & Change History
   */
  async getAuditLogsReport({ limit = 50, offset = 0, action = null, entityType = null } = {}) {
    const values = [limit, offset];
    let whereConditions = [];

    if (action) {
      values.push(action);
      whereConditions.push(`al.action = $${values.length}`);
    }

    if (entityType) {
      values.push(entityType);
      whereConditions.push(`al.entity_type = $${values.length}`);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";

    const query = `
      SELECT 
        al.id,
        al.action,
        al.entity_type,
        al.entity_id,
        al.details,
        al.old_values,
        al.new_values,
        al.ip_address,
        al.status,
        al.created_at,
        u.name AS user_name,
        u.email AS user_email,
        u.role AS user_role
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT $1 OFFSET $2;
    `;

    const countQuery = `SELECT COUNT(*)::int AS total FROM audit_logs al ${whereClause};`;
    const countValues = values.slice(2);

    const [{ rows }, { rows: countRows }] = await Promise.all([
      this.pool.query(query, values),
      this.pool.query(countQuery, countValues),
    ]);

    return {
      logs: rows,
      total: countRows[0]?.total || 0,
      limit,
      offset,
    };
  }
}

export const reportService = ReportService.getInstance();
