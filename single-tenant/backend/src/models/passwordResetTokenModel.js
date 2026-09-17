/*
 * passwordResetTokenModel.js
 * Model for Password Reset Tokens with explicit projections.
 * Optimized according to Postgres & SQL Best Practices.
 */

import { pool } from "../config/database.js";

export const PasswordResetTokenModel = {
  async create({ id, token, userId, expiresAt }) {
    const query = `
      INSERT INTO password_reset_tokens (id, token, user_id, expires_at)
      VALUES ($1, $2, $3, $4)
      RETURNING id, token, user_id, expires_at, used, created_at;
    `;
    const values = [id, token, userId, expiresAt];
    const { rows } = await pool.query(query, values);
    return rows[0];
  },

  async findByToken(token) {
    const query = `
      SELECT id, token, user_id, expires_at, used, created_at 
      FROM password_reset_tokens 
      WHERE token = $1;
    `;
    const { rows } = await pool.query(query, [token]);
    return rows[0] || null;
  },

  async markAsUsed(token) {
    const query = `
      UPDATE password_reset_tokens 
      SET used = TRUE 
      WHERE token = $1 
      RETURNING id;
    `;
    const { rows } = await pool.query(query, [token]);
    return rows[0] || null;
  },

  async revokeAllForUser(userId) {
    const query = `
      UPDATE password_reset_tokens 
      SET used = TRUE 
      WHERE user_id = $1 AND used = FALSE;
    `;
    await pool.query(query, [userId]);
  }
};


