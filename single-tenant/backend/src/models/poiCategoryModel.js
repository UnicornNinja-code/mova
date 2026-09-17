/*
 * poiCategoryModel.js
 * Model for POI Categories and Crowd Time Score Weights
 * Optimized according to Postgres & SQL Best Practices.
 */

import { pool } from "../config/database.js";

export const PoiCategoryModel = {
  /**
   * Get all POI categories ordered by name
   */
  async findAll() {
    const query = `
      SELECT id, name, is_active, score_pagi, score_siang, score_sore, score_malam, created_at, updated_at 
      FROM poi_categories 
      ORDER BY name ASC;
    `;
    const { rows } = await pool.query(query);
    return rows;
  },

  /**
   * Find a category by UUID
   */
  async findById(id) {
    const query = `
      SELECT id, name, is_active, score_pagi, score_siang, score_sore, score_malam, created_at, updated_at 
      FROM poi_categories 
      WHERE id = $1;
    `;
    const { rows } = await pool.query(query, [id]);
    return rows[0] || null;
  },

  /**
   * Find a category by exact name
   */
  async findByName(name) {
    const query = `
      SELECT id, name, is_active, score_pagi, score_siang, score_sore, score_malam, created_at, updated_at 
      FROM poi_categories 
      WHERE name = $1;
    `;
    const { rows } = await pool.query(query, [name]);
    return rows[0] || null;
  },

  /**
   * Toggle category active status
   */
  async toggleStatus(id) {
    const query = `
      UPDATE poi_categories
      SET is_active = NOT is_active, updated_at = NOW()
      WHERE id = $1
      RETURNING id, name, is_active, score_pagi, score_siang, score_sore, score_malam, created_at, updated_at;
    `;
    const { rows } = await pool.query(query, [id]);
    return rows[0] || null;
  },

  /**
   * Batch insert categories using single UNNEST query to eliminate loop roundtrips
   */
  async bulkCreate(categories) {
    if (!categories || categories.length === 0) return [];
    
    const query = `
      INSERT INTO poi_categories (name, is_active)
      SELECT category_name, true
      FROM UNNEST($1::text[]) AS category_name
      ON CONFLICT (name) DO NOTHING;
    `;
    await pool.query(query, [categories]);
    return this.findAll();
  },

  /**
   * Get category crowd score weights formatted for DSS operational calculations
   */
  async getCrowdScores() {
    const query = `
      SELECT id, name, is_active, score_pagi, score_siang, score_sore, score_malam, updated_at
      FROM poi_categories
      ORDER BY name ASC;
    `;
    const { rows } = await pool.query(query);
    return rows.map((cat) => ({
      id: cat.id,
      code: cat.name.toUpperCase().replace(/[^A-Z0-9]/g, "_"),
      name: cat.name,
      is_active: cat.is_active,
      scores: {
        pagi: parseInt(cat.score_pagi || 1, 10),
        siang: parseInt(cat.score_siang || 1, 10),
        sore: parseInt(cat.score_sore || 1, 10),
        malam: parseInt(cat.score_malam || 1, 10),
      },
      updated_at: cat.updated_at,
    }));
  },

  /**
   * Update time-slot weights for a single category
   */
  async updateTimeScores(id, { score_pagi, score_siang, score_sore, score_malam }) {
    const query = `
      UPDATE poi_categories
      SET score_pagi = COALESCE($2, score_pagi),
          score_siang = COALESCE($3, score_siang),
          score_sore = COALESCE($4, score_sore),
          score_malam = COALESCE($5, score_malam),
          updated_at = NOW()
      WHERE id = $1
      RETURNING id, name, is_active, score_pagi, score_siang, score_sore, score_malam, created_at, updated_at;
    `;
    const { rows } = await pool.query(query, [id, score_pagi, score_siang, score_sore, score_malam]);
    return rows[0] || null;
  },

  /**
   * Atomic batch update for category time-slot scores using single JSONB-to-recordset query
   */
  async bulkUpdateTimeScores(items) {
    if (!items || !Array.isArray(items) || items.length === 0) return [];

    const query = `
      UPDATE poi_categories AS pc
      SET 
        score_pagi = COALESCE(payload.score_pagi, pc.score_pagi),
        score_siang = COALESCE(payload.score_siang, pc.score_siang),
        score_sore = COALESCE(payload.score_sore, pc.score_sore),
        score_malam = COALESCE(payload.score_malam, pc.score_malam),
        updated_at = NOW()
      FROM (
        SELECT 
          (x->>'id')::text AS id,
          (x->>'name')::text AS name,
          (x->>'score_pagi')::numeric AS score_pagi,
          (x->>'score_siang')::numeric AS score_siang,
          (x->>'score_sore')::numeric AS score_sore,
          (x->>'score_malam')::numeric AS score_malam
        FROM jsonb_array_elements($1::jsonb) AS x
      ) AS payload
      WHERE (payload.id IS NOT NULL AND pc.id::text = payload.id)
         OR (payload.id IS NULL AND payload.name IS NOT NULL AND pc.name = payload.name)
      RETURNING pc.id, pc.name, pc.is_active, pc.score_pagi, pc.score_siang, pc.score_sore, pc.score_malam, pc.created_at, pc.updated_at;
    `;

    const { rows } = await pool.query(query, [JSON.stringify(items)]);
    return rows;
  }
};


