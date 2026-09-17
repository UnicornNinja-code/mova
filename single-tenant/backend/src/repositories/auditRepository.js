/*
 *   Copyright (c) 2026 
 *   All rights reserved.
 *   auditRepository.js (Data Access Layer for audit_logs Table)
 */

import { pool } from "../config/database.js";

export class AuditRepository {
  static instance = null;

  constructor(dbPool = pool) {
    if (AuditRepository.instance && dbPool === pool) {
      return AuditRepository.instance;
    }
    this.pool = dbPool;
    if (dbPool === pool) {
      AuditRepository.instance = this;
    }
  }

  static getInstance(dbPool = pool) {
    if (!AuditRepository.instance) {
      AuditRepository.instance = new AuditRepository(dbPool);
    }
    return AuditRepository.instance;
  }

  /**
   * Query audit logs with pagination and filters
   */
  async findAuditLogs({ userId, action, entityType, status, page = 1, limit = 50 }) {
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
    const values = [];

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
}

export const auditRepository = AuditRepository.getInstance();
