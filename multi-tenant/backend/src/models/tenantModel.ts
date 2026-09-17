/*
 * tenantModel.ts
 * Tenant Model for Multi-Tenant Management & Quota Configuration
 */

import { pool } from "../config/database.js";

export interface TenantData {
  id: string;
  name: string;
  code: string;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  max_fleets: number;
  max_riders: number;
  max_zones: number;
  metadata?: Record<string, any>;
  created_at?: Date;
  updated_at?: Date;
}

export class TenantModel {
  static async findById(id: string): Promise<TenantData | null> {
    const res = await pool.query(
      `SELECT id, name, code, status, max_fleets, max_riders, max_zones, metadata, created_at, updated_at
       FROM tenants WHERE id = $1`,
      [id]
    );
    return res.rows[0] || null;
  }

  static async findByCode(code: string): Promise<TenantData | null> {
    const res = await pool.query(
      `SELECT id, name, code, status, max_fleets, max_riders, max_zones, metadata, created_at, updated_at
       FROM tenants WHERE code = $1`,
      [code.toUpperCase()]
    );
    return res.rows[0] || null;
  }

  static async listAll(): Promise<TenantData[]> {
    const res = await pool.query(
      `SELECT id, name, code, status, max_fleets, max_riders, max_zones, metadata, created_at, updated_at
       FROM tenants ORDER BY created_at ASC`
    );
    return res.rows;
  }

  static async create(data: {
    id: string;
    name: string;
    code: string;
    status?: string;
    max_fleets?: number;
    max_riders?: number;
    max_zones?: number;
    metadata?: Record<string, any>;
  }): Promise<TenantData> {
    const res = await pool.query(
      `INSERT INTO tenants (id, name, code, status, max_fleets, max_riders, max_zones, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        data.id,
        data.name,
        data.code.toUpperCase(),
        data.status || "ACTIVE",
        data.max_fleets || 50,
        data.max_riders || 100,
        data.max_zones || 10,
        JSON.stringify(data.metadata || {}),
      ]
    );
    return res.rows[0];
  }

  static async updateQuota(
    id: string,
    quotas: { max_fleets?: number; max_riders?: number; max_zones?: number }
  ): Promise<TenantData | null> {
    const res = await pool.query(
      `UPDATE tenants 
       SET max_fleets = COALESCE($2, max_fleets),
           max_riders = COALESCE($3, max_riders),
           max_zones = COALESCE($4, max_zones),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id, quotas.max_fleets, quotas.max_riders, quotas.max_zones]
    );
    return res.rows[0] || null;
  }

  static async updateStatus(
    id: string,
    status: "ACTIVE" | "INACTIVE" | "SUSPENDED"
  ): Promise<TenantData | null> {
    const res = await pool.query(
      `UPDATE tenants SET status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
      [id, status]
    );
    return res.rows[0] || null;
  }
}
