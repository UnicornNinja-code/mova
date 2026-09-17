/*
 * userPreferenceModel.ts
 * Data Access Model for user_preferences table
 */

import { pool } from "../config/database.js";

export interface UserPreferences {
  user_id: string;
  map_theme: string;
  dashboard_layout: any;
  notifications_enabled: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export const UserPreferenceModel = {
  async getByUserId(userId: string): Promise<UserPreferences | null> {
    const query = `
      SELECT user_id, map_theme, dashboard_layout, notifications_enabled, created_at, updated_at
      FROM user_preferences
      WHERE user_id = $1;
    `;
    const { rows } = await pool.query(query, [userId]);
    if (rows.length === 0) {
      return null;
    }
    return rows[0];
  },

  async upsert(userId: string, data: { map_theme?: string; dashboard_layout?: any; notifications_enabled?: boolean }): Promise<UserPreferences> {
    const query = `
      INSERT INTO user_preferences (user_id, map_theme, dashboard_layout, notifications_enabled, updated_at)
      VALUES ($1, COALESCE($2, 'openmaptiles-dark'), COALESCE($3, '{}'::jsonb), COALESCE($4, true), CURRENT_TIMESTAMP)
      ON CONFLICT (user_id) DO UPDATE SET
        map_theme = COALESCE($2, user_preferences.map_theme),
        dashboard_layout = COALESCE($3, user_preferences.dashboard_layout),
        notifications_enabled = COALESCE($4, user_preferences.notifications_enabled),
        updated_at = CURRENT_TIMESTAMP
      RETURNING user_id, map_theme, dashboard_layout, notifications_enabled, created_at, updated_at;
    `;
    const values = [
      userId,
      data.map_theme || null,
      data.dashboard_layout ? JSON.stringify(data.dashboard_layout) : null,
      data.notifications_enabled !== undefined ? data.notifications_enabled : null,
    ];
    const { rows } = await pool.query(query, values);
    return rows[0];
  },
};
