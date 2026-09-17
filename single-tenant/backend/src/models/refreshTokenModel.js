/*
 * refreshTokenModel.js
 * Model for Refresh Tokens with explicit projections and partial index utilization.
 * Optimized according to Postgres & SQL Best Practices.
 */

import { pool } from "../config/database.js";

export const RefreshTokenModel = {
  async create({ id, token, userId, expiresAt }) {
    const query = `
      INSERT INTO refresh_tokens (id, token, user_id, expires_at)
      VALUES ($1, $2, $3, $4)
      RETURNING id, token, user_id, expires_at, revoked, created_at;
    `;
    const values = [id, token, userId, expiresAt];
    const { rows } = await pool.query(query, values);
    return rows[0];
  },

  async findByToken(token) {
    const query = `
      SELECT id, token, user_id, expires_at, revoked, created_at 
      FROM refresh_tokens 
      WHERE token = $1;
    `;
    const { rows } = await pool.query(query, [token]);
    return rows[0] || null;
  },

  async findValidToken(token) {
    const query = `
      SELECT id, token, user_id, expires_at, revoked, created_at 
      FROM refresh_tokens 
      WHERE token = $1 AND revoked = FALSE AND expires_at > CURRENT_TIMESTAMP;
    `;
    const { rows } = await pool.query(query, [token]);
    return rows[0] || null;
  },

  async revoke(token) {
    const query = `
      UPDATE refresh_tokens 
      SET revoked = TRUE 
      WHERE token = $1 
      RETURNING id;
    `;
    const { rows } = await pool.query(query, [token]);
    return rows[0] || null;
  },

  async revokeAllForUser(userId) {
    const query = `
      UPDATE refresh_tokens 
      SET revoked = TRUE 
      WHERE user_id = $1 AND revoked = FALSE;
    `;
    await pool.query(query, [userId]);
  }
};