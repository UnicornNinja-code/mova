/*
 *   Copyright (c) 2026 
 *   All rights reserved.
 *   AuditLogger.js (Non-blocking Centralized Audit Interceptor)
 */

import { pool } from "../config/database.js";

export class AuditLogger {
  static instance = null;

  constructor(dbPool = pool) {
    if (AuditLogger.instance && dbPool === pool) {
      return AuditLogger.instance;
    }
    this.pool = dbPool;
    if (dbPool === pool) {
      AuditLogger.instance = this;
    }
  }

  static getInstance() {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger();
    }
    return AuditLogger.instance;
  }

  /**
   * Log action asynchronously (Non-blocking)
   */
  async logAction({
    userId = null,
    userRole = null,
    action,
    entityType = null,
    entityId = null,
    details = {},
    ipAddress = null,
    userAgent = null,
    status = "SUCCESS",
  }) {
    if (!action) return;

    // Execute in background without awaiting to ensure 0-latency overhead
    setImmediate(async () => {
      try {
        const query = `
          INSERT INTO audit_logs (
            user_id, user_role, action, entity_type, entity_id, details, ip_address, user_agent, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);
        `;
        await this.pool.query(query, [
          userId,
          userRole,
          action,
          entityType,
          entityId,
          JSON.stringify(details),
          ipAddress,
          userAgent,
          status,
        ]);
      } catch (error) {
        console.error(`⚠️ [AUDIT LOGGER ERROR] Failed to save log for action '${action}':`, error.message);
      }
    });
  }
}

export const auditLogger = AuditLogger.getInstance();
