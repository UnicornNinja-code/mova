/*
 * poiApprovalLogRepository.ts
 * Data Access Layer with N+1 Query Prevention via Explicit Joins in TypeScript
 */

import { pool } from "../config/database.js";
import type { Pool } from "pg";

export class POIApprovalLogRepository {
  private static instance: POIApprovalLogRepository | null = null;
  private pool: Pool;

  constructor(dbPool: Pool = pool) {
    if (POIApprovalLogRepository.instance && dbPool === pool) {
      return POIApprovalLogRepository.instance;
    }
    this.pool = dbPool;
    if (dbPool === pool) {
      POIApprovalLogRepository.instance = this;
    }
  }

  public static getInstance(dbPool: Pool = pool): POIApprovalLogRepository {
    if (!POIApprovalLogRepository.instance) {
      POIApprovalLogRepository.instance = new POIApprovalLogRepository(dbPool);
    }
    return POIApprovalLogRepository.instance;
  }

  /**
   * Create an audit log entry when a POI is approved or rejected
   */
  public async createLog(
    poiId: number | string,
    action: "APPROVE" | "REJECT" | "EDIT" | string,
    actionByUserId?: number | string | null,
    notes: string = ""
  ): Promise<any> {
    const query = `
      INSERT INTO poi_approval_logs (poi_id, action, action_by, notes)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    const { rows } = await this.pool.query(query, [poiId, action, actionByUserId, notes]);
    return rows[0];
  }

  /**
   * Fetch approval history logs with Eager Loaded User & POI details
   */
  public async findAllWithUser(limit: number = 50): Promise<any[]> {
    const query = `
      SELECT 
        l.id,
        l.poi_id,
        l.action,
        l.action_by,
        l.notes,
        l.created_at,
        p.name AS poi_name,
        p.category AS poi_category,
        p.latitude AS poi_latitude,
        p.longitude AS poi_longitude,
        u.name AS action_by_name,
        u.username AS action_by_username,
        u.email AS action_by_email,
        u.role AS action_by_role
      FROM poi_approval_logs l
      LEFT JOIN pois p ON l.poi_id = p.id
      LEFT JOIN users u ON l.action_by = u.id
      ORDER BY l.created_at DESC
      LIMIT $1;
    `;
    const { rows } = await this.pool.query(query, [limit]);
    return rows;
  }
}

export const poiApprovalLogRepository = POIApprovalLogRepository.getInstance();
