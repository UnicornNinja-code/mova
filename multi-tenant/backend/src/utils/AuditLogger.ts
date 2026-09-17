/*
 * AuditLogger.ts
 * Non-blocking Centralized Audit Interceptor in TypeScript
 */

import { pool } from "../config/database.js";
import type { Pool } from "pg";

export interface LogActionParams {
  userId?: number | string | null;
  userRole?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | number | null;
  details?: Record<string, any>;
  ipAddress?: string | null;
  userAgent?: string | null;
  status?: "SUCCESS" | "FAILED" | "ERROR";
}

export class AuditLogger {
  private static instance: AuditLogger | null = null;
  private pool: Pool;

  constructor(dbPool: Pool = pool) {
    if (AuditLogger.instance && dbPool === pool) {
      return AuditLogger.instance;
    }
    this.pool = dbPool;
    if (dbPool === pool) {
      AuditLogger.instance = this;
    }
  }

  public static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger();
    }
    return AuditLogger.instance;
  }

  /**
   * Log action asynchronously (Non-blocking)
   */
  public async logAction({
    userId = null,
    userRole = null,
    action,
    entityType = null,
    entityId = null,
    details = {},
    ipAddress = null,
    userAgent = null,
    status = "SUCCESS",
  }: LogActionParams): Promise<void> {
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
      } catch (error: any) {
        console.error(`⚠️ [AUDIT LOGGER ERROR] Failed to save log for action '${action}':`, error.message);
      }
    });
  }
}

export const auditLogger = AuditLogger.getInstance();
