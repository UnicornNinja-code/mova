/*
 * SalesService.ts
 * Domain Service for Sales Transactions & Aggregated Analytics in TypeScript
 */

import { pool } from "../../config/database.js";
import type { Pool } from "pg";

export class SalesService {
  private static instance: SalesService | null = null;
  private pool: Pool;

  constructor(dbPool: Pool = pool) {
    if (SalesService.instance && dbPool === pool) {
      return SalesService.instance;
    }
    this.pool = dbPool;
    if (dbPool === pool) {
      SalesService.instance = this;
    }
  }

  public static getInstance(dbPool: Pool = pool): SalesService {
    if (!SalesService.instance) {
      SalesService.instance = new SalesService(dbPool);
    }
    return SalesService.instance;
  }

  /**
   * Fetch aggregated sales analytics for Management, Supervisor, and Superadmin
   */
  public async getSalesOverview({
    startDate,
    endDate,
    zoneId,
    riderId,
    productId,
  }: {
    startDate?: string | null;
    endDate?: string | null;
    zoneId?: string | null;
    riderId?: string | null;
    productId?: string | null;
  } = {}): Promise<any> {
    const whereClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (startDate) {
      whereClauses.push(`sl.created_at::date >= $${paramIndex}::date`);
      values.push(startDate);
      paramIndex++;
    }
    if (endDate) {
      whereClauses.push(`sl.created_at::date <= $${paramIndex}::date`);
      values.push(endDate);
      paramIndex++;
    }
    if (zoneId) {
      whereClauses.push(`sl.zone_id = $${paramIndex}::uuid`);
      values.push(zoneId);
      paramIndex++;
    }
    if (riderId) {
      whereClauses.push(`sl.rider_id = $${paramIndex}::uuid`);
      values.push(riderId);
      paramIndex++;
    }
    if (productId) {
      whereClauses.push(`sl.product_id = $${paramIndex}::uuid`);
      values.push(productId);
      paramIndex++;
    }

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    // 1. Overall Summary
    const summaryQuery = `
      SELECT 
        COUNT(*)::int AS total_transactions,
        COALESCE(SUM(sl.qty), 0)::int AS total_units_sold,
        COALESCE(SUM(sl.total_price), 0)::numeric(14,2) AS total_revenue,
        COALESCE(AVG(sl.total_price), 0)::numeric(14,2) AS avg_transaction_value
      FROM sales_logs sl
      ${whereStr};
    `;

    // 2. Breakdown By Product
    const productQuery = `
      SELECT 
        p.id AS product_id,
        p.name AS product_name,
        COALESCE(SUM(sl.qty), 0)::int AS units_sold,
        COALESCE(SUM(sl.total_price), 0)::numeric(14,2) AS revenue
      FROM products p
      LEFT JOIN sales_logs sl ON sl.product_id = p.id ${whereClauses.length > 0 ? `AND ${whereClauses.join(" AND ")}` : ""}
      GROUP BY p.id, p.name
      ORDER BY revenue DESC;
    `;

    // 3. Breakdown By Zone
    const zoneQuery = `
      SELECT 
        z.id AS zone_id,
        z.name AS zone_name,
        COUNT(sl.id)::int AS transactions_count,
        COALESCE(SUM(sl.qty), 0)::int AS units_sold,
        COALESCE(SUM(sl.total_price), 0)::numeric(14,2) AS revenue
      FROM zones z
      LEFT JOIN sales_logs sl ON sl.zone_id = z.id ${whereClauses.length > 0 ? `AND ${whereClauses.join(" AND ")}` : ""}
      GROUP BY z.id, z.name
      ORDER BY revenue DESC;
    `;

    // 4. Breakdown By Rider
    const riderQuery = `
      SELECT 
        u.id AS rider_id,
        u.name AS rider_name,
        u.username AS rider_username,
        COUNT(sl.id)::int AS transactions_count,
        COALESCE(SUM(sl.qty), 0)::int AS units_sold,
        COALESCE(SUM(sl.total_price), 0)::numeric(14,2) AS revenue
      FROM users u
      JOIN sales_logs sl ON sl.rider_id = u.id ${whereClauses.length > 0 ? `AND ${whereClauses.join(" AND ")}` : ""}
      WHERE u.role = 'RIDER'
      GROUP BY u.id, u.name, u.username
      ORDER BY revenue DESC;
    `;

    // 5. Recent 10 Transactions
    const recentQuery = `
      SELECT 
        sl.id AS sale_id,
        sl.rider_id,
        u.name AS rider_name,
        sl.zone_id,
        z.name AS zone_name,
        sl.product_id,
        p.name AS product_name,
        sl.qty,
        sl.unit_price,
        sl.total_price,
        sl.created_at
      FROM sales_logs sl
      JOIN users u ON sl.rider_id = u.id
      JOIN products p ON sl.product_id = p.id
      LEFT JOIN zones z ON sl.zone_id = z.id
      ${whereStr}
      ORDER BY sl.created_at DESC
      LIMIT 10;
    `;

    const [
      { rows: summaryRows },
      { rows: productRows },
      { rows: zoneRows },
      { rows: riderRows },
      { rows: recentRows },
    ] = await Promise.all([
      this.pool.query(summaryQuery, values),
      this.pool.query(productQuery, values),
      this.pool.query(zoneQuery, values),
      this.pool.query(riderQuery, values),
      this.pool.query(recentQuery, values),
    ]);

    const summary = summaryRows[0] || {
      total_transactions: 0,
      total_units_sold: 0,
      total_revenue: 0,
      avg_transaction_value: 0,
    };

    return {
      filters: {
        start_date: startDate || null,
        end_date: endDate || null,
        zone_id: zoneId || null,
        rider_id: riderId || null,
        product_id: productId || null,
      },
      summary: {
        total_transactions: summary.total_transactions,
        total_units_sold: summary.total_units_sold,
        total_revenue: parseFloat(summary.total_revenue || 0),
        avg_transaction_value: parseFloat(summary.avg_transaction_value || 0),
      },
      sales_by_product: productRows.map((r: any) => ({
        product_id: r.product_id,
        product_name: r.product_name,
        units_sold: r.units_sold,
        revenue: parseFloat(r.revenue || 0),
      })),
      sales_by_zone: zoneRows.map((r: any) => ({
        zone_id: r.zone_id,
        zone_name: r.zone_name,
        transactions_count: r.transactions_count,
        units_sold: r.units_sold,
        revenue: parseFloat(r.revenue || 0),
      })),
      sales_by_rider: riderRows.map((r: any) => ({
        rider_id: r.rider_id,
        rider_name: r.rider_name,
        rider_username: r.rider_username,
        transactions_count: r.transactions_count,
        units_sold: r.units_sold,
        revenue: parseFloat(r.revenue || 0),
      })),
      recent_transactions: recentRows.map((r: any) => ({
        ...r,
        unit_price: parseFloat(r.unit_price || 0),
        total_price: parseFloat(r.total_price || 0),
      })),
    };
  }
}

export const salesService = SalesService.getInstance();
