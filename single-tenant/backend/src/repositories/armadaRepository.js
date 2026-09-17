/*
 *   Copyright (c) 2026 
 *   All rights reserved.
 *   armadaRepository.js (Data Access Layer for armadas Table)
 */

import { pool } from "../config/database.js";

export class ArmadaRepository {
  static instance = null;

  constructor(dbPool = pool) {
    if (ArmadaRepository.instance && dbPool === pool) {
      return ArmadaRepository.instance;
    }
    this.pool = dbPool;
    if (dbPool === pool) {
      ArmadaRepository.instance = this;
    }
  }

  static getInstance(dbPool = pool) {
    if (!ArmadaRepository.instance) {
      ArmadaRepository.instance = new ArmadaRepository(dbPool);
    }
    return ArmadaRepository.instance;
  }

  /**
   * Fetch all armada units with optional filters (status, type)
   */
  async findAll(filters = {}) {
    const { status, type } = filters;
    let query = `
      SELECT 
        a.id,
        a.code,
        a.type,
        a.status,
        a.current_rider_id,
        u.name AS current_rider_name,
        a.reserved_by_rider_id,
        a.reserved_until,
        ru.name AS reserved_by_rider_name,
        za.zone_id,
        z.name AS zone_name,
        a.created_at,
        a.updated_at
      FROM armadas a
      LEFT JOIN users u ON a.current_rider_id = u.id
      LEFT JOIN users ru ON a.reserved_by_rider_id = ru.id
      LEFT JOIN zone_assignments za ON a.current_rider_id = za.rider_id AND za.assignment_date = CURRENT_DATE
      LEFT JOIN zones z ON za.zone_id = z.id
      WHERE 1=1
    `;
    const values = [];

    if (status) {
      values.push(status);
      query += ` AND a.status = $${values.length}`;
    }
    if (type) {
      values.push(type);
      query += ` AND a.type = $${values.length}`;
    }

    query += ` ORDER BY a.code ASC;`;

    const { rows } = await this.pool.query(query, values);
    return rows;
  }

  /**
   * Fetch single armada unit by ID
   */
  async findById(id) {
    const query = `
      SELECT 
        a.id,
        a.code,
        a.type,
        a.status,
        a.current_rider_id,
        u.name AS current_rider_name,
        a.reserved_by_rider_id,
        a.reserved_until,
        ru.name AS reserved_by_rider_name,
        za.zone_id,
        z.name AS zone_name,
        a.created_at,
        a.updated_at
      FROM armadas a
      LEFT JOIN users u ON a.current_rider_id = u.id
      LEFT JOIN users ru ON a.reserved_by_rider_id = ru.id
      LEFT JOIN zone_assignments za ON a.current_rider_id = za.rider_id AND za.assignment_date = CURRENT_DATE
      LEFT JOIN zones z ON za.zone_id = z.id
      WHERE a.id = $1;
    `;
    const { rows } = await this.pool.query(query, [id]);
    return rows[0] || null;
  }


  /**
   * Fetch single armada unit by code / serial number (case insensitive)
   */
  async findByCode(code) {
    const query = `SELECT * FROM armadas WHERE LOWER(code) = LOWER($1);`;
    const { rows } = await this.pool.query(query, [code]);
    return rows[0] || null;
  }

  /**
   * Create a new armada unit
   */
  async create({ code, type = "GEROBAK", status = "ACTIVE" }) {
    const query = `
      INSERT INTO armadas (code, type, status)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;
    const { rows } = await this.pool.query(query, [code, type, status]);
    return rows[0];
  }

  /**
   * Update armada unit details or status
   */
  async update(id, { code, type, status, current_rider_id }) {
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
  async delete(id) {
    const query = `DELETE FROM armadas WHERE id = $1 RETURNING *;`;
    const { rows } = await this.pool.query(query, [id]);
    return rows[0] || null;
  }
}

export const armadaRepository = ArmadaRepository.getInstance();
