/*
 * bwmRepository.ts
 * Data Access Layer for dss_configurations Table in TypeScript
 */

import { pool } from "../config/database.js";
import type { Pool } from "pg";

export class BwmRepository {
  private static instance: BwmRepository | null = null;
  private pool: Pool;

  constructor(dbPool: Pool = pool) {
    if (BwmRepository.instance && dbPool === pool) {
      return BwmRepository.instance;
    }
    this.pool = dbPool;
    if (dbPool === pool) {
      BwmRepository.instance = this;
    }
  }

  public static getInstance(dbPool: Pool = pool): BwmRepository {
    if (!BwmRepository.instance) {
      BwmRepository.instance = new BwmRepository(dbPool);
    }
    return BwmRepository.instance;
  }

  /**
   * Fetch active DSS Configuration
   */
  public async findActiveConfig(): Promise<any | null> {
    const query = `
      SELECT * FROM dss_configurations 
      WHERE is_active = true 
      ORDER BY updated_at DESC 
      LIMIT 1;
    `;
    const { rows } = await this.pool.query(query);
    return rows[0] || null;
  }

  /**
   * Fetch all BWM Configurations history
   */
  public async findAllConfigs(): Promise<any[]> {
    const query = `
      SELECT * FROM dss_configurations 
      ORDER BY updated_at DESC, id DESC;
    `;
    const { rows } = await this.pool.query(query);
    return rows;
  }

  /**
   * Fetch BWM Configuration by ID
   */
  public async findConfigById(id: number | string): Promise<any | null> {
    if (!id) return null;
    const query = `SELECT * FROM dss_configurations WHERE id = $1;`;
    const { rows } = await this.pool.query(query, [id]);
    return rows[0] || null;
  }

  /**
   * Deactivate all current configs and save new BWM Configuration as active
   */
  public async saveBwmConfig({
    name = "Konfigurasi Bobot BWM Sidoarjo",
    best_criteria_id,
    worst_criteria_id,
    best_to_others,
    worst_to_others,
    calculated_weights,
    consistency_ratio,
    created_by,
    created_by_name,
  }: {
    name?: string;
    best_criteria_id: string | number;
    worst_criteria_id: string | number;
    best_to_others: Record<string, number>;
    worst_to_others: Record<string, number>;
    calculated_weights?: any;
    consistency_ratio?: number;
    created_by?: string | null;
    created_by_name?: string | null;
  }): Promise<any> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      // Deactivate older configurations
      await client.query("UPDATE dss_configurations SET is_active = false;");

      const insertQuery = `
        INSERT INTO dss_configurations (
          name, 
          is_active, 
          best_criteria_id, 
          worst_criteria_id, 
          best_to_others, 
          worst_to_others,
          created_by,
          created_by_name,
          activated_at
        )
        VALUES ($1, true, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
        RETURNING *;
      `;
      const values = [
        name,
        best_criteria_id,
        worst_criteria_id,
        JSON.stringify(best_to_others),
        JSON.stringify(worst_to_others),
        created_by || null,
        created_by_name || null,
      ];

      const { rows } = await client.query(insertQuery, values);
      await client.query("COMMIT");
      return {
        ...rows[0],
        calculated_weights,
        consistency_ratio,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Activate a specific BWM configuration by ID
   */
  public async activateConfig(id: number | string): Promise<any> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("UPDATE dss_configurations SET is_active = false;");
      const { rows } = await client.query(
        "UPDATE dss_configurations SET is_active = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *;",
        [id]
      );
      await client.query("COMMIT");
      return rows[0] || null;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

export const bwmRepository = BwmRepository.getInstance();
