/*
 *   Copyright (c) 2026 
 *   All rights reserved.
 *   BwmRepository.js (Data Access Layer for dss_configurations Table)
 */

import { pool } from "../config/database.js";

export class BwmRepository {
  static instance = null;

  constructor(dbPool = pool) {
    if (BwmRepository.instance && dbPool === pool) {
      return BwmRepository.instance;
    }
    this.pool = dbPool;
    if (dbPool === pool) {
      BwmRepository.instance = this;
    }
  }

  static getInstance(dbPool = pool) {
    if (!BwmRepository.instance) {
      BwmRepository.instance = new BwmRepository(dbPool);
    }
    return BwmRepository.instance;
  }

  /**
   * Fetch all active criteria list
   */
  async findActiveCriterias() {
    const query = `SELECT id, name, type FROM criterias WHERE is_active = true ORDER BY name ASC;`;
    const { rows } = await this.pool.query(query);
    return rows;
  }

  /**
   * Fetch active DSS Configuration
   */
  async findActiveConfig() {
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
   * Fetch BWM Configuration by ID
   */
  async findConfigById(id) {
    if (!id) return null;
    const query = `SELECT * FROM dss_configurations WHERE id = $1;`;
    const { rows } = await this.pool.query(query, [id]);
    return rows[0] || null;
  }

  /**
   * Deactivate all current configs and save new BWM Configuration as active
   */
  async saveBwmConfig({
    name = "Konfigurasi Bobot BWM Sidoarjo",
    best_criteria_id,
    worst_criteria_id,
    best_to_others,
    worst_to_others,
    calculated_weights,
    consistency_ratio,
  }) {
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
          worst_to_others
        )
        VALUES ($1, true, $2, $3, $4, $5)
        RETURNING *;
      `;
      const values = [
        name,
        best_criteria_id,
        worst_criteria_id,
        JSON.stringify(best_to_others),
        JSON.stringify(worst_to_others),
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
   * Fetch all saved BWM configurations
   */
  async findAllConfigs() {
    const query = `
      SELECT dc.*, 
             bc.name AS best_criteria_name, 
             wc.name AS worst_criteria_name
      FROM dss_configurations dc
      LEFT JOIN criterias bc ON dc.best_criteria_id = bc.id
      LEFT JOIN criterias wc ON dc.worst_criteria_id = wc.id
      ORDER BY dc.created_at DESC;
    `;
    const { rows } = await this.pool.query(query);
    return rows;
  }

  /**
   * Activate specific BWM configuration and deactivate all others
   */
  async activateConfig(id) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("UPDATE dss_configurations SET is_active = false;");
      const { rows } = await client.query(
        "UPDATE dss_configurations SET is_active = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *;",
        [id]
      );
      if (rows.length === 0) {
        throw new Error(`Konfigurasi BWM dengan ID '${id}' tidak ditemukan.`);
      }
      await client.query("COMMIT");
      return rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

export const bwmRepository = BwmRepository.getInstance();
