/*
 * systemSettingModel.js
 * Model for System Settings with explicit projections.
 * Optimized according to Postgres & SQL Best Practices.
 */

import { pool } from "../config/database.js";

export const SystemSettingModel = {
  async getByKey(key) {
    const query = `
      SELECT key, value, description, updated_at 
      FROM system_settings 
      WHERE key = $1;
    `;
    const { rows } = await pool.query(query, [key]);
    return rows[0] || null;
  },

  async upsert(key, value, description = "") {
    const query = `
      INSERT INTO system_settings (key, value, description)
      VALUES ($1, $2, $3)
      ON CONFLICT (key) DO UPDATE SET
        value = EXCLUDED.value,
        description = EXCLUDED.description,
        updated_at = CURRENT_TIMESTAMP
      RETURNING key, value, description, updated_at;
    `;
    const { rows } = await pool.query(query, [key, value, description]);
    return rows[0];
  }
};

