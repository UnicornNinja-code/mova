/*
 *   Copyright (c) 2026 
 *   All rights reserved.
 *   UserRepository (Data Access Layer for Users, Refresh Tokens, Password Reset Tokens & RBAC)
 */

import { pool } from "../config/database.js";

export class UserRepository {
  static instance = null;

  constructor(dbPool = pool) {
    if (UserRepository.instance && dbPool === pool) {
      return UserRepository.instance;
    }
    this.pool = dbPool;
    if (dbPool === pool) {
      UserRepository.instance = this;
    }
  }

  static getInstance(dbPool = pool) {
    if (!UserRepository.instance) {
      UserRepository.instance = new UserRepository(dbPool);
    }
    return UserRepository.instance;
  }

  async findAll() {
    const query = `
      SELECT 
        u.id, 
        u.email, 
        u.username, 
        u.name, 
        u.phone, 
        u.role, 
        u.is_active, 
        u.first_login, 
        u.birth_date, 
        COALESCE(u.auth_version, 1)::int AS auth_version,
        u.created_at, 
        u.updated_at,
        CASE 
          WHEN prt.has_pending_invitation THEN 'PENDING'
          WHEN u.is_active = true THEN 'ACTIVE'
          ELSE 'SUSPENDED'
        END AS account_status,
        COALESCE(sess.latest_session, u.updated_at, u.created_at) AS last_active_at,
        COALESCE(sess.active_sessions_count, 0)::int AS active_sessions_count
      FROM users u
      LEFT JOIN (
        SELECT user_id, bool_or(used = false AND expires_at > CURRENT_TIMESTAMP) AS has_pending_invitation
        FROM password_reset_tokens
        GROUP BY user_id
      ) prt ON prt.user_id = u.id
      LEFT JOIN (
        SELECT user_id, MAX(created_at) AS latest_session, COUNT(*) FILTER (WHERE revoked = false AND expires_at > CURRENT_TIMESTAMP) AS active_sessions_count
        FROM refresh_tokens
        GROUP BY user_id
      ) sess ON sess.user_id = u.id
      ORDER BY u.created_at DESC;
    `;
    const { rows } = await this.pool.query(query);
    return rows;
  }

  async findById(id) {
    const query = `
      SELECT 
        u.id, 
        u.email, 
        u.username, 
        u.name, 
        u.phone, 
        u.role, 
        u.is_active, 
        u.first_login, 
        u.birth_date, 
        COALESCE(u.auth_version, 1)::int AS auth_version,
        u.created_at, 
        u.updated_at,
        CASE 
          WHEN prt.has_pending_invitation THEN 'PENDING'
          WHEN u.is_active = true THEN 'ACTIVE'
          ELSE 'SUSPENDED'
        END AS account_status,
        COALESCE(sess.latest_session, u.updated_at, u.created_at) AS last_active_at,
        COALESCE(sess.active_sessions_count, 0)::int AS active_sessions_count
      FROM users u
      LEFT JOIN (
        SELECT user_id, bool_or(used = false AND expires_at > CURRENT_TIMESTAMP) AS has_pending_invitation
        FROM password_reset_tokens
        WHERE user_id = $1
        GROUP BY user_id
      ) prt ON prt.user_id = u.id
      LEFT JOIN (
        SELECT user_id, MAX(created_at) AS latest_session, COUNT(*) FILTER (WHERE revoked = false AND expires_at > CURRENT_TIMESTAMP) AS active_sessions_count
        FROM refresh_tokens
        WHERE user_id = $1
        GROUP BY user_id
      ) sess ON sess.user_id = u.id
      WHERE u.id = $1;
    `;
    const { rows } = await this.pool.query(query, [id]);
    return rows[0] || null;
  }

  async findByIdWithPassword(id) {
    const query = `
      SELECT id, email, username, password, name, phone, role, is_active, first_login, birth_date, COALESCE(auth_version, 1)::int AS auth_version, created_at, updated_at
      FROM users
      WHERE id = $1;
    `;
    const { rows } = await this.pool.query(query, [id]);
    return rows[0] || null;
  }

  async findByEmailOrUsername(identifier) {
    const query = `
      SELECT id, email, username, password, name, phone, role, is_active, first_login, birth_date, COALESCE(auth_version, 1)::int AS auth_version, created_at, updated_at 
      FROM users 
      WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($1);
    `;
    const { rows } = await this.pool.query(query, [identifier]);
    return rows[0] || null;
  }

  async createUser({ email, username, password, name, phone, role = 'RIDER', is_active = true, first_login = false, birth_date = null }) {
    const query = `
      INSERT INTO users (email, username, password, name, phone, role, is_active, first_login, birth_date, auth_version)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1)
      RETURNING id, email, username, name, phone, role, is_active, first_login, birth_date, auth_version, created_at, updated_at;
    `;
    const values = [email, username, password, name, phone || null, role, is_active, first_login, birth_date];
    const { rows } = await this.pool.query(query, values);
    return rows[0];
  }

  async updateUserRole(userId, newRole, client = null) {
    const runner = client || this.pool;
    const query = `
      UPDATE users
      SET role = $1, auth_version = COALESCE(auth_version, 1) + 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, email, username, name, phone, role, is_active, first_login, birth_date, auth_version, updated_at;
    `;
    const { rows } = await runner.query(query, [newRole, userId]);
    return rows[0] || null;
  }

  async incrementAuthVersion(userId, client = null) {
    const runner = client || this.pool;
    const query = `
      UPDATE users
      SET auth_version = COALESCE(auth_version, 1) + 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, auth_version;
    `;
    const { rows } = await runner.query(query, [userId]);
    return rows[0] || null;
  }

  async updateUserStatus(userId, isActive) {
    const query = `
      UPDATE users
      SET is_active = $1, auth_version = COALESCE(auth_version, 1) + 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, email, username, name, phone, role, is_active, first_login, birth_date, auth_version, updated_at;
    `;
    const { rows } = await this.pool.query(query, [isActive, userId]);
    return rows[0] || null;
  }

  async saveRefreshToken({ id, token, user_id, expires_at }) {
    const query = `
      INSERT INTO refresh_tokens (id, token, user_id, expires_at)
      VALUES ($1, $2, $3, $4)
      RETURNING id, token, user_id, expires_at, revoked, created_at;
    `;
    const { rows } = await this.pool.query(query, [id, token, user_id, expires_at]);
    return rows[0];
  }

  async findRefreshToken(token) {
    const query = `
      SELECT id, token, user_id, expires_at, revoked, created_at 
      FROM refresh_tokens 
      WHERE token = $1 AND revoked = false;
    `;
    const { rows } = await this.pool.query(query, [token]);
    return rows[0] || null;
  }

  async revokeRefreshToken(token) {
    const query = `UPDATE refresh_tokens SET revoked = true WHERE token = $1;`;
    await this.pool.query(query, [token]);
  }

  async updateUser(id, { name, email, phone, role, birth_date }) {
    const query = `
      UPDATE users
      SET name = COALESCE($1, name),
          email = COALESCE($2, email),
          phone = COALESCE($3, phone),
          role = COALESCE($4, role),
          birth_date = COALESCE($5, birth_date),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING id, email, username, name, phone, role, is_active, first_login, birth_date, updated_at;
    `;
    const { rows } = await this.pool.query(query, [name, email, phone, role, birth_date, id]);
    return rows[0] || null;
  }

  async updatePassword(userId, hashedPassword) {
    const query = `
      UPDATE users
      SET password = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, email, username, name, phone, role, is_active, first_login, birth_date, updated_at;
    `;
    const { rows } = await this.pool.query(query, [hashedPassword, userId]);
    return rows[0] || null;
  }

  async updateFirstLoginPassword(userId, hashedPassword) {
    const query = `
      UPDATE users
      SET password = $1, first_login = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, email, username, name, phone, role, is_active, first_login, birth_date, updated_at;
    `;
    const { rows } = await this.pool.query(query, [hashedPassword, userId]);
    return rows[0] || null;
  }

  async activateUser(userId, { hashedPassword, name, phone, birth_date }) {
    const query = `
      UPDATE users
      SET password = COALESCE($1, password),
          name = COALESCE($2, name),
          phone = COALESCE($3, phone),
          birth_date = COALESCE($4, birth_date),
          is_active = true,
          first_login = false,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING id, email, username, name, phone, role, is_active, first_login, birth_date, updated_at;
    `;
    const { rows } = await this.pool.query(query, [hashedPassword, name, phone, birth_date, userId]);
    return rows[0] || null;
  }

  async deleteUser(id) {
    const query = `
      DELETE FROM users
      WHERE id = $1
      RETURNING id, email, username, name, role, is_active;
    `;
    const { rows } = await this.pool.query(query, [id]);
    return rows[0] || null;
  }
}

export const userRepository = UserRepository.getInstance();
