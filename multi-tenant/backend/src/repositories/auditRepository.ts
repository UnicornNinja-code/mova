/*
 * auditRepository.ts
 * Data Access Layer for audit_logs Table in TypeScript
 */

import { pool } from "../config/database.js";
import type { Pool } from "pg";
import type { AuditLog } from "../types/misc.types.js";

export interface FindAuditLogsParams {
  userId?: number | string;
  action?: string;
  entityType?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export class AuditRepository {
  private static instance: AuditRepository | null = null;
  private pool: Pool;

  constructor(dbPool: Pool = pool) {
    if (AuditRepository.instance && dbPool === pool) {
      return AuditRepository.instance;
    }
    this.pool = dbPool;
    if (dbPool === pool) {
      AuditRepository.instance = this;
    }
  }

  public static getInstance(dbPool: Pool = pool): AuditRepository {
    if (!AuditRepository.instance) {
      AuditRepository.instance = new AuditRepository(dbPool);
    }
    return AuditRepository.instance;
  }

  /**
   * Query audit logs with pagination and filters
   */
  public async findAuditLogs({
    userId,
    action,
    entityType,
    status,
    page = 1,
    limit = 50,
  }: FindAuditLogsParams): Promise<AuditLog[]> {
    const offset = (page - 1) * limit;
    let query = `
      SELECT 
        al.id,
        al.user_id,
        al.user_role,
        al.action,
        al.entity_type,
        al.entity_id,
        al.details,
        al.ip_address,
        al.user_agent,
        al.status,
        al.created_at,
        u.name AS user_name,
        u.email AS user_email
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;
    const values: any[] = [];

    if (userId) {
      values.push(userId);
      query += ` AND al.user_id = $${values.length}`;
    }
    if (action) {
      values.push(action);
      query += ` AND al.action = $${values.length}`;
    }
    if (entityType) {
      values.push(entityType);
      query += ` AND al.entity_type = $${values.length}`;
    }
    if (status) {
      values.push(status);
      query += ` AND al.status = $${values.length}`;
    }

    query += ` ORDER BY al.created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2};`;
    values.push(limit, offset);

    const { rows } = await this.pool.query(query, values);
    return rows;
  }

  /**
   * Insert a new audit log record
   */
  public async createAuditLog({
    userId,
    userRole,
    action,
    entityType,
    entityId,
    details = {},
    ipAddress,
    userAgent,
    status = "SUCCESS",
    oldValues,
    newValues,
  }: {
    userId?: number | string | null;
    userRole?: string | null;
    action: string;
    entityType?: string | null;
    entityId?: string | null;
    details?: any;
    ipAddress?: string | null;
    userAgent?: string | null;
    status?: string;
    oldValues?: any;
    newValues?: any;
  }): Promise<AuditLog> {
    const query = `
      INSERT INTO audit_logs (
        user_id, user_role, action, entity_type, entity_id, details, ip_address, user_agent, status, old_values, new_values
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *;
    `;
    const values = [
      userId || null,
      userRole || null,
      action,
      entityType || null,
      entityId || null,
      JSON.stringify(details || {}),
      ipAddress || null,
      userAgent || null,
      status || "SUCCESS",
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null,
    ];
    const { rows } = await this.pool.query(query, values);
    return rows[0];
  }
}

export const auditRepository = AuditRepository.getInstance();
