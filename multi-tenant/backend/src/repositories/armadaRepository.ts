/*
 * armadaRepository.ts
 * Data Access Layer for 3-Dimensional Armada & Fleet Management in TypeScript
 */

import { pool } from "../config/database.js";
import type { Pool } from "pg";
import type { Armada, ArmadaStatus, FleetIssueReport } from "../types/fleet.types.js";

export class ArmadaRepository {
  private static instance: ArmadaRepository | null = null;
  private pool: Pool;

  constructor(dbPool: Pool = pool) {
    if (ArmadaRepository.instance && dbPool === pool) {
      return ArmadaRepository.instance;
    }
    this.pool = dbPool;
    if (dbPool === pool) {
      ArmadaRepository.instance = this;
    }
  }

  public static getInstance(dbPool: Pool = pool): ArmadaRepository {
    if (!ArmadaRepository.instance) {
      ArmadaRepository.instance = new ArmadaRepository(dbPool);
    }
    return ArmadaRepository.instance;
  }

  /**
   * Fetch all armada units with 3-dimensional calculated states
   */
  public async findAll(filters: { status?: string; type?: string; reservation_state?: string } = {}): Promise<Armada[]> {
    const { status, type, reservation_state } = filters;
    let query = `
      SELECT 
        a.id,
        a.code,
        a.type,
        a.status,
        a.status AS fleet_status,
        a.current_rider_id,
        u.name AS current_rider_name,
        a.reserved_by_rider_id,
        u_res.name AS reserved_by_rider_name,
        a.reserved_until,
        CASE 
          WHEN a.status = 'ACTIVE' AND a.reserved_until IS NOT NULL AND a.reserved_until > NOW() THEN 'HELD'
          ELSE 'AVAILABLE'
        END AS reservation_state,
        CASE 
          WHEN a.current_rider_id IS NOT NULL THEN 'IN_USE'
          ELSE 'UNASSIGNED'
        END AS assignment_state,
        CASE 
          WHEN a.status = 'ACTIVE' AND a.current_rider_id IS NULL AND (a.reserved_until IS NULL OR a.reserved_until <= NOW()) THEN true
          ELSE false
        END AS is_available_for_duty,
        a.created_at,
        a.updated_at
      FROM armadas a
      LEFT JOIN users u ON a.current_rider_id = u.id
      LEFT JOIN users u_res ON a.reserved_by_rider_id = u_res.id
      WHERE 1=1
    `;
    const values: any[] = [];

    if (status && status !== 'ALL') {
      values.push(status);
      query += ` AND a.status = $${values.length}`;
    }
    if (type && type !== 'ALL') {
      values.push(type);
      query += ` AND a.type = $${values.length}`;
    }
    if (reservation_state === 'HELD') {
      query += ` AND a.status = 'ACTIVE' AND a.reserved_until IS NOT NULL AND a.reserved_until > NOW()`;
    } else if (reservation_state === 'AVAILABLE') {
      query += ` AND (a.reserved_until IS NULL OR a.reserved_until <= NOW())`;
    }

    query += ` ORDER BY a.code ASC;`;

    const { rows } = await this.pool.query(query, values);
    return rows;
  }

  /**
   * Fetch single armada unit by ID with 3-dimensional calculated states
   */
  public async findById(id: number | string): Promise<Armada | null> {
    const query = `
      SELECT 
        a.id,
        a.code,
        a.type,
        a.status,
        a.status AS fleet_status,
        a.current_rider_id,
        u.name AS current_rider_name,
        a.reserved_by_rider_id,
        u_res.name AS reserved_by_rider_name,
        a.reserved_until,
        CASE 
          WHEN a.status = 'ACTIVE' AND a.reserved_until IS NOT NULL AND a.reserved_until > NOW() THEN 'HELD'
          ELSE 'AVAILABLE'
        END AS reservation_state,
        CASE 
          WHEN a.current_rider_id IS NOT NULL THEN 'IN_USE'
          ELSE 'UNASSIGNED'
        END AS assignment_state,
        a.created_at,
        a.updated_at
      FROM armadas a
      LEFT JOIN users u ON a.current_rider_id = u.id
      LEFT JOIN users u_res ON a.reserved_by_rider_id = u_res.id
      WHERE a.id = $1;
    `;
    const { rows } = await this.pool.query(query, [id]);
    return rows[0] || null;
  }

  /**
   * Fetch single armada unit by code / serial number (case insensitive)
   */
  public async findByCode(code: string): Promise<Armada | null> {
    const query = `SELECT * FROM armadas WHERE LOWER(code) = LOWER($1);`;
    const { rows } = await this.pool.query(query, [code]);
    return rows[0] || null;
  }

  /**
   * Create a new armada unit
   */
  public async create({
    code,
    type = "GEROBAK",
    status = "ACTIVE",
  }: {
    code: string;
    type?: string;
    status?: ArmadaStatus | string;
  }): Promise<Armada> {
    const query = `
      INSERT INTO armadas (code, type, status)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;
    const { rows } = await this.pool.query(query, [code, type, status]);
    return rows[0];
  }

  /**
   * Update armada unit details or lifecycle status
   */
  public async update(
    id: number | string,
    {
      code,
      type,
      status,
      current_rider_id,
    }: {
      code?: string;
      type?: string;
      status?: ArmadaStatus | string;
      current_rider_id?: number | string | null;
    }
  ): Promise<Armada | null> {
    const query = `
      UPDATE armadas 
      SET 
        code = COALESCE($2, code),
        type = COALESCE($3, type),
        status = COALESCE($4, status),
        current_rider_id = $5,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *;
    `;
    const { rows } = await this.pool.query(query, [
      id,
      code || null,
      type || null,
      status || null,
      current_rider_id !== undefined ? current_rider_id : null,
    ]);
    return rows[0] || null;
  }

  /**
   * Delete armada unit by ID
   */
  public async delete(id: number | string): Promise<Armada | null> {
    const query = `DELETE FROM armadas WHERE id = $1 RETURNING *;`;
    const { rows } = await this.pool.query(query, [id]);
    return rows[0] || null;
  }

  /**
   * Create a fleet issue report (e.g. reported during duty or physical inspection)
   */
  public async createIssueReport({
    armadaId,
    riderId,
    severity = "MINOR",
    issueType,
    description,
  }: {
    armadaId: string | number;
    riderId: string | number;
    severity?: string;
    issueType: string;
    description: string;
  }): Promise<FleetIssueReport> {
    const query = `
      INSERT INTO fleet_issue_reports (armada_id, rider_id, severity, issue_type, description, status)
      VALUES ($1, $2, $3, $4, $5, 'REPORTED')
      RETURNING *;
    `;
    const { rows } = await this.pool.query(query, [armadaId, riderId, severity, issueType, description]);
    return rows[0];
  }

  /**
   * Fetch all issue reports with armada & reporter details
   */
  public async findAllIssueReports(statusFilter?: string): Promise<any[]> {
    let query = `
      SELECT 
        fir.*,
        a.code AS armada_code,
        a.type AS armada_type,
        u.name AS rider_name,
        u.email AS rider_email
      FROM fleet_issue_reports fir
      JOIN armadas a ON fir.armada_id = a.id
      JOIN users u ON fir.rider_id = u.id
      WHERE 1=1
    `;
    const values: any[] = [];
    if (statusFilter && statusFilter !== 'ALL') {
      values.push(statusFilter);
      query += ` AND fir.status = $1`;
    }
    query += ` ORDER BY fir.reported_at DESC;`;
    const { rows } = await this.pool.query(query, values);
    return rows;
  }

  /**
   * Update issue report status (e.g., SENT_TO_MAINTENANCE, REPLACED, RESOLVED)
   */
  public async updateIssueReportStatus(
    id: string | number,
    status: string,
    resolutionNotes?: string
  ): Promise<any> {
    const query = `
      UPDATE fleet_issue_reports
      SET 
        status = $2::varchar,
        resolution_notes = COALESCE($3, resolution_notes),
        resolved_at = CASE WHEN $2::varchar IN ('RESOLVED', 'SENT_TO_MAINTENANCE') THEN CURRENT_TIMESTAMP ELSE resolved_at END
      WHERE id = $1
      RETURNING *;
    `;
    const { rows } = await this.pool.query(query, [id, status, resolutionNotes || null]);
    return rows[0];
  }

  /**
   * Get assignment history for an armada
   */
  public async getArmadaAssignmentHistory(armadaId: string | number): Promise<any[]> {
    const query = `
      SELECT 
        fa.*,
        u.name AS rider_name,
        u.email AS rider_email,
        z.name AS zone_name
      FROM fleet_assignments fa
      JOIN users u ON fa.rider_id = u.id
      LEFT JOIN zones z ON fa.zone_id = z.id
      WHERE fa.armada_id = $1
      ORDER BY fa.created_at DESC
      LIMIT 20;
    `;
    const { rows } = await this.pool.query(query, [armadaId]);
    return rows;
  }
}

export const armadaRepository = ArmadaRepository.getInstance();
