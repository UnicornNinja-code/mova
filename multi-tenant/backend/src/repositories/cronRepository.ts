/*
 * cronRepository.ts
 * Data Access Layer for cron_configurations & cron_logs Tables in TypeScript
 */

import { pool } from "../config/database.js";
import type { Pool } from "pg";

export class CronRepository {
  private static instance: CronRepository | null = null;
  private pool: Pool;

  constructor(dbPool: Pool = pool) {
    if (CronRepository.instance && dbPool === pool) {
      return CronRepository.instance;
    }
    this.pool = dbPool;
    if (dbPool === pool) {
      CronRepository.instance = this;
    }
  }

  public static getInstance(dbPool: Pool = pool): CronRepository {
    if (!CronRepository.instance) {
      CronRepository.instance = new CronRepository(dbPool);
    }
    return CronRepository.instance;
  }

  /**
   * Fetch all cron configurations
   */
  public async getAllConfigs(): Promise<any[]> {
    const query = `SELECT * FROM cron_configurations ORDER BY cron_key ASC;`;
    const { rows } = await this.pool.query(query);
    return rows;
  }

  /**
   * Fetch single cron config by cron_key
   */
  public async getConfigByKey(cronKey: string): Promise<any | null> {
    const query = `SELECT * FROM cron_configurations WHERE cron_key = $1;`;
    const { rows } = await this.pool.query(query, [cronKey]);
    return rows[0] || null;
  }

  /**
   * Update cron configuration status or last_run_at timestamp
   */
  public async updateConfig(
    cronKey: string,
    {
      is_active,
      cron_expression,
      last_run_at,
    }: {
      is_active?: boolean;
      cron_expression?: string;
      last_run_at?: Date | string | null;
    }
  ): Promise<any | null> {
    const query = `
      UPDATE cron_configurations
      SET 
        is_active = COALESCE($2, is_active),
        cron_expression = COALESCE($3, cron_expression),
        last_run_at = COALESCE($4, last_run_at),
        updated_at = CURRENT_TIMESTAMP
      WHERE cron_key = $1
      RETURNING *;
    `;
    const { rows } = await this.pool.query(query, [
      cronKey,
      is_active !== undefined ? is_active : null,
      cron_expression || null,
      last_run_at || null,
    ]);
    return rows[0] || null;
  }

  /**
   * Insert execution log into cron_logs
   */
  public async createLog({
    cron_key,
    status,
    duration_ms = 0,
    message = "",
  }: {
    cron_key: string;
    status: string;
    duration_ms?: number;
    message?: string;
  }): Promise<any> {
    const query = `
      INSERT INTO cron_logs (cron_key, status, duration_ms, message)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    const { rows } = await this.pool.query(query, [cron_key, status, duration_ms, message]);
    return rows[0];
  }

  /**
   * Fetch execution logs
   */
  public async getLogs({ cronKey, limit = 50 }: { cronKey?: string; limit?: number }): Promise<any[]> {
    let query = `SELECT * FROM cron_logs WHERE 1=1`;
    const values: any[] = [];

    if (cronKey) {
      values.push(cronKey);
      query += ` AND cron_key = $${values.length}`;
    }

    query += ` ORDER BY executed_at DESC LIMIT $${values.length + 1};`;
    values.push(limit);

    const { rows } = await this.pool.query(query, values);
    return rows;
  }
}

export const cronRepository = CronRepository.getInstance();
