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
      SELECT id, email, username, name, phone, role, is_active, first_login, birth_date, created_at, updated_at
      FROM users
      ORDER BY created_at DESC;
    `;
    const { rows } = await this.pool.query(query);
    return rows;
  }

  async findById(id) {
    const query = `
      SELECT id, email, username, name, phone, role, is_active, first_login, birth_date, created_at, updated_at
      FROM users
      WHERE id = $1;
    `;
    const { rows } = await this.pool.query(query, [id]);
    return rows[0] || null;
  }

  async findByIdWithPassword(id) {
    const query = `
      SELECT id, email, username, password, name, phone, role, is_active, first_login, birth_date, created_at, updated_at
      FROM users
      WHERE id = $1;
    `;
    const { rows } = await this.pool.query(query, [id]);
    return rows[0] || null;
  }

  async findByEmailOrUsername(identifier) {
    const query = `
      SELECT id, email, username, password, name, phone, role, is_active, first_login, birth_date, created_at, updated_at 
      FROM users 
      WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($1);
    `;
    const { rows } = await this.pool.query(query, [identifier]);
    return rows[0] || null;
  }

  async createUser({ email, username, password, name, phone, role = 'RIDER', is_active = true, first_login = false, birth_date = null }) {
    const query = `
      INSERT INTO users (email, username, password, name, phone, role, is_active, first_login, birth_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, email, username, name, phone, role, is_active, first_login, birth_date, created_at, updated_at;
    `;
    const values = [email, username, password, name, phone || null, role, is_active, first_login, birth_date];
    const { rows } = await this.pool.query(query, values);
    return rows[0];
  }

  async updateUserRole(userId, newRole) {
    const query = `
      UPDATE users
      SET role = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, email, username, name, phone, role, is_active, first_login, birth_date, updated_at;
    `;
    const { rows } = await this.pool.query(query, [newRole, userId]);
    return rows[0] || null;
  }

  async updateUserStatus(userId, isActive) {
    const query = `
      UPDATE users
      SET is_active = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, email, username, name, phone, role, is_active, first_login, birth_date, updated_at;
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

  async activateUser(userId, { hashedPassword, name, birth_date }) {
    const query = `
      UPDATE users
      SET password = COALESCE($1, password),
          name = COALESCE($2, name),
          birth_date = COALESCE($3, birth_date),
          is_active = true,
          first_login = false,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING id, email, username, name, phone, role, is_active, first_login, birth_date, updated_at;
    `;
    const { rows } = await this.pool.query(query, [hashedPassword, name, birth_date, userId]);
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
