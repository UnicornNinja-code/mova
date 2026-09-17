import { pool } from "../config/database.js";

export const PasswordResetTokenModel = {
  async create({ id, token, userId, expiresAt }: { id: string; token: string; userId: number | string; expiresAt: Date | string }) {
    const query = `
      INSERT INTO password_reset_tokens (id, token, user_id, expires_at)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    const values = [id, token, userId, expiresAt];
    const { rows } = await pool.query(query, values);
    return rows[0];
  },

  async findByToken(token: string) {
    const query = `
      SELECT * FROM password_reset_tokens 
      WHERE token = $1;
    `;
    const { rows } = await pool.query(query, [token]);
    return rows[0];
  },

  async markAsUsed(token: string) {
    const query = `
      UPDATE password_reset_tokens 
      SET used = TRUE 
      WHERE token = $1 
      RETURNING id;
    `;
    const { rows } = await pool.query(query, [token]);
    return rows[0];
  }
};
