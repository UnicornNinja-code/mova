/*
 * UserRepository.ts
 * Data Access Layer for Users, Refresh Tokens, Password Reset Tokens & RBAC in TypeScript
 */

import { pool } from "../config/database.js";
import type { Pool } from "pg";
import type { User, UserRole, UserSanitized } from "../types/user.types.js";

export class UserRepository {
  private static instance: UserRepository | null = null;
  private pool: Pool;

  constructor(dbPool: Pool = pool) {
    if (UserRepository.instance && dbPool === pool) {
      return UserRepository.instance;
    }
    this.pool = dbPool;
    if (dbPool === pool) {
      UserRepository.instance = this;
    }
  }

  public static getInstance(dbPool: Pool = pool): UserRepository {
    if (!UserRepository.instance) {
      UserRepository.instance = new UserRepository(dbPool);
    }
    return UserRepository.instance;
  }

  public async findAll(): Promise<UserSanitized[]> {
    const query = `
      SELECT id, tenant_id, email, username, name, role, birth_date, is_active, first_login, created_at, updated_at
      FROM users
      ORDER BY created_at DESC;
    `;
    const { rows } = await this.pool.query(query);
    return rows;
  }

  public async findById(id: number | string): Promise<UserSanitized | null> {
    const query = `
      SELECT id, tenant_id, email, username, name, role, birth_date, is_active, first_login, created_at, updated_at
      FROM users
      WHERE id = $1;
    `;
    const { rows } = await this.pool.query(query, [id]);
    return rows[0] || null;
  }

  public async findByIdWithPassword(id: number | string): Promise<User | null> {
    const query = `
      SELECT id, tenant_id, email, username, password, name, role, birth_date, is_active, first_login, created_at, updated_at
      FROM users
      WHERE id = $1;
    `;
    const { rows } = await this.pool.query(query, [id]);
    return rows[0] || null;
  }

  public async findByEmailOrUsername(identifier: string): Promise<User | null> {
    const query = `
      SELECT * FROM users 
      WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($1);
    `;
    const { rows } = await this.pool.query(query, [identifier]);
    return rows[0] || null;
  }

  public async countActiveSuperadmins(): Promise<number> {
    const query = `SELECT COUNT(*) as count FROM users WHERE role = 'SUPERADMIN' AND is_active = true;`;
    const { rows } = await this.pool.query(query);
    return parseInt(rows[0]?.count || "0", 10);
  }

  public async createUser({
    tenant_id = "thesis-default",
    email,
    username,
    password,
    name,
    role = "RIDER",
    isActive = false,
    firstLogin = false,
  }: {
    tenant_id?: string;
    email: string;
    username?: string;
    password?: string;
    name: string;
    role?: UserRole;
    isActive?: boolean;
    firstLogin?: boolean;
  }): Promise<UserSanitized> {
    const query = `
      INSERT INTO users (tenant_id, email, username, password, name, role, is_active, first_login)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, tenant_id, email, username, name, role, is_active, first_login, created_at, updated_at;
    `;
    const values = [tenant_id, email, username || email.split("@")[0], password, name, role, isActive, firstLogin];
    const { rows } = await this.pool.query(query, values);
    return rows[0];
  }

  /**
   * Mark first-login as completed — called after user successfully sets their own password
   */
  public async setFirstLoginDone(userId: number | string): Promise<void> {
    const query = `
      UPDATE users
      SET first_login = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1;
    `;
    await this.pool.query(query, [userId]);
  }

  public async updateUserRole(userId: number | string, newRole: UserRole): Promise<UserSanitized | null> {
    const query = `
      UPDATE users
      SET role = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, email, username, name, role, is_active, updated_at;
    `;
    const { rows } = await this.pool.query(query, [newRole, userId]);
    return rows[0] || null;
  }

  public async updateUserStatus(userId: number | string, isActive: boolean): Promise<UserSanitized | null> {
    const query = `
      UPDATE users
      SET is_active = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, email, username, name, role, is_active, updated_at;
    `;
    const { rows } = await this.pool.query(query, [isActive, userId]);
    return rows[0] || null;
  }

  public async saveRefreshToken({
    id,
    token,
    user_id,
    expires_at,
  }: {
    id: string;
    token: string;
    user_id: number | string;
    expires_at: Date | string;
  }): Promise<any> {
    const query = `
      INSERT INTO refresh_tokens (id, token, user_id, expires_at)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    const { rows } = await this.pool.query(query, [id, token, user_id, expires_at]);
    return rows[0];
  }

  public async updateGoogleInfo(userId: number | string, googleId: string, avatarUrl?: string): Promise<void> {
    const query = `
      UPDATE users
      SET google_id = COALESCE(google_id, $1),
          avatar_url = COALESCE(avatar_url, $2),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3;
    `;
    await this.pool.query(query, [googleId, avatarUrl || null, userId]);
  }

  public async findRefreshToken(token: string): Promise<any> {
    const query = `SELECT * FROM refresh_tokens WHERE token = $1 AND revoked = false;`;
    const { rows } = await this.pool.query(query, [token]);
    return rows[0] || null;
  }

  public async revokeRefreshToken(token: string): Promise<void> {
    const query = `UPDATE refresh_tokens SET revoked = true WHERE token = $1;`;
    await this.pool.query(query, [token]);
  }

  public async updateUser(
    id: number | string,
    { name, email, role }: { name?: string; email?: string; role?: UserRole }
  ): Promise<UserSanitized | null> {
    const query = `
      UPDATE users
      SET name = COALESCE($1, name),
          email = COALESCE($2, email),
          role = COALESCE($3, role),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING id, email, username, name, role, is_active, updated_at;
    `;
    const { rows } = await this.pool.query(query, [name, email, role, id]);
    return rows[0] || null;
  }

  public async updatePassword(
    userId: number | string,
    hashedPassword: string,
    birthDate?: string | Date | null
  ): Promise<UserSanitized | null> {
    const query = `
      UPDATE users
      SET password = $1,
          birth_date = COALESCE($2, birth_date),
          is_active = TRUE,
          first_login = FALSE,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING id, email, username, name, role, birth_date, is_active, first_login, updated_at;
    `;
    const { rows } = await this.pool.query(query, [hashedPassword, birthDate || null, userId]);
    return rows[0] || null;
  }

  public async deleteUser(id: number | string): Promise<UserSanitized | null> {
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
