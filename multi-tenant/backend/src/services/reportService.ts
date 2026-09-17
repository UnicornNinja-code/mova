/*
 * reportService.ts
 * Comprehensive Domain Service for Operational, DSS, Fleet, and Executive Reporting in MOVA
 */

import { pool } from "../config/database.js";
import type { Pool } from "pg";

export class ReportService {
  private static instance: ReportService | null = null;
  private pool: Pool;

  constructor(dbPool: Pool = pool) {
    this.pool = dbPool;
  }

  public static getInstance(dbPool: Pool = pool): ReportService {
    if (!ReportService.instance) {
      ReportService.instance = new ReportService(dbPool);
    }
    return ReportService.instance;
  }

  /**
   * 1. Rider Operational Report: Attendance, shifts, working hours, and revenue per rider
   */
  public async getRiderOperationalReport({
    startDate,
    endDate,
    riderId,
  }: {
    startDate?: string;
    endDate?: string;
    riderId?: string;
  } = {}): Promise<any> {
    const values: any[] = [];
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
        COUNT(DISTINCT CASE WHEN za.status IN ('CHECKED_IN', 'COMPLETED') THEN za.id END)::int AS total_check_ins,
        COUNT(DISTINCT CASE WHEN za.status = 'COMPLETED' THEN za.id END)::int AS total_check_outs,
        COALESCE(SUM(sl.total_price), 0)::numeric(14,2) AS total_revenue,
        COALESCE(SUM(sl.qty), 0)::int AS total_cups_sold,
        COUNT(DISTINCT sl.id)::int AS total_transactions,
        ROUND(AVG(
          CASE 
            WHEN za.check_in_time IS NOT NULL AND za.check_out_time IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (za.check_out_time - za.check_in_time)) / 3600.0
            ELSE NULL 
          END
        )::numeric, 2)::float AS avg_working_hours,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT z.name), NULL) AS assigned_zones
      FROM users u
      LEFT JOIN zone_assignments za ON za.rider_id = u.id ${dateFilter}
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
      riders: rows,
    };
  }

  /**
   * 2. Zone Effectiveness Report: Recommendation vs Selection vs Actual Revenue
   */
  public async getZoneEffectivenessReport({
    startDate,
    endDate,
    zoneId,
  }: {
    startDate?: string;
    endDate?: string;
    zoneId?: string;
  } = {}): Promise<any> {
    const values: any[] = [];
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
        COUNT(DISTINCT dri.id)::int AS dss_recommended_frequency
      FROM zones z
      LEFT JOIN zone_assignments za ON za.zone_id = z.id ${dateFilter}
      LEFT JOIN distribution_run_items dri ON dri.zone_id = z.id
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
      zones: rows,
    };
  }

  /**
   * 3. Fleet Report: Armada availability, condition, assignments, and reported issues
   */
  public async getFleetReport(): Promise<any> {
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
        COUNT(DISTINCT fa.id)::int AS historical_deployments_count,
        COUNT(DISTINCT fir.id)::int AS total_reported_issues,
        COUNT(DISTINCT CASE WHEN fir.status IN ('REPORTED', 'IN_REVIEW') THEN fir.id END)::int AS open_issues_count
      FROM armadas a
      LEFT JOIN users u ON u.id = a.current_rider_id
      LEFT JOIN fleet_assignments fa ON fa.armada_id = a.id
      LEFT JOIN fleet_issue_reports fir ON fir.armada_id = a.id
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
   * 4. DSS Accuracy Report: System Recommendation vs Supervisor Decision
   */
  public async getDssAccuracyReport({
    startDate,
    endDate,
  }: {
    startDate?: string;
    endDate?: string;
  } = {}): Promise<any> {
    const values: any[] = [];
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
        dr.id AS run_id,
        dr.run_number,
        dr.execution_type,
        dr.total_riders,
        dr.assigned_count,
        dr.unassigned_count,
        dr.executed_at,
        u.name AS executed_by_name
      FROM distribution_runs dr
      LEFT JOIN users u ON u.id = dr.executed_by
      ORDER BY dr.executed_at DESC
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
   * 5. Executive Summary: High-level KPI metrics for SuperAdmin and Management
   */
  public async getExecutiveSummary(): Promise<any> {
    const kpiQuery = `
      SELECT 
        (SELECT COUNT(*)::int FROM users WHERE role = 'RIDER' AND is_active = true) AS active_riders_count,
        (SELECT COUNT(*)::int FROM zones WHERE status = 'ACTIVE') AS active_zones_count,
        (SELECT COUNT(*)::int FROM armadas WHERE status = 'ACTIVE') AS active_fleet_count,
        (SELECT COUNT(*)::int FROM armadas WHERE current_rider_id IS NOT NULL) AS deployed_fleet_count,
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
        active_riders: kpi.active_riders_count,
        active_zones: kpi.active_zones_count,
        active_fleet: kpi.active_fleet_count,
        deployed_fleet: kpi.deployed_fleet_count,
        fleet_utilization_percent: fleetUtilization,
        revenue_today: kpi.revenue_today,
        revenue_this_month: kpi.revenue_this_month,
        cups_sold_today: kpi.cups_sold_today,
        active_sessions_today: kpi.active_sessions_today,
        check_in_compliance_percent: complianceRate,
        dss_runs_today: kpi.dss_runs_today,
      },
      generated_at: new Date().toISOString(),
    };
  }
}

export const reportService = ReportService.getInstance();
