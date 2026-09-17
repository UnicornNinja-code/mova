import { pool } from "../config/database.js";

export const PoiCategoryModel = {
  async findAll() {
    const query = `SELECT * FROM poi_categories ORDER BY name ASC;`;
    const { rows } = await pool.query(query);
    return rows;
  },

  async findById(id: number | string) {
    const query = `SELECT * FROM poi_categories WHERE id = $1;`;
    const { rows } = await pool.query(query, [id]);
    return rows[0];
  },

  async findByName(name: string) {
    const query = `SELECT * FROM poi_categories WHERE name = $1;`;
    const { rows } = await pool.query(query, [name]);
    return rows[0];
  },

  async toggleStatus(id: number | string) {
    const query = `
      UPDATE poi_categories
      SET is_active = NOT is_active
      WHERE id = $1
      RETURNING *;
    `;
    const { rows } = await pool.query(query, [id]);
    return rows[0];
  },

  async bulkCreate(categories: string[]) {
    if (!categories || categories.length === 0) return [];
    
    for (const name of categories) {
      await pool.query(
        `INSERT INTO poi_categories (name, is_active) VALUES ($1, true) ON CONFLICT (name) DO NOTHING;`,
        [name]
      );
    }
    return this.findAll();
  },

  async updateTimeScores(
    id: number | string,
    {
      score_pagi,
      score_siang,
      score_sore,
      score_malam,
    }: {
      score_pagi?: number;
      score_siang?: number;
      score_sore?: number;
      score_malam?: number;
    }
  ) {
    const query = `
      UPDATE poi_categories
      SET score_pagi = COALESCE($2, score_pagi),
          score_siang = COALESCE($3, score_siang),
          score_sore = COALESCE($4, score_sore),
          score_malam = COALESCE($5, score_malam)
      WHERE id = $1
      RETURNING *;
    `;
    const { rows } = await pool.query(query, [id, score_pagi, score_siang, score_sore, score_malam]);
    return rows[0];
  },

  async bulkUpdateTimeScores(items: any[]) {
    if (!items || !Array.isArray(items) || items.length === 0) return [];

    const updated = [];
    for (const item of items) {
      const { id, name, score_pagi, score_siang, score_sore, score_malam } = item;
      let query: string, params: any[];

      if (id) {
        query = `
          UPDATE poi_categories
          SET score_pagi = COALESCE($2, score_pagi),
              score_siang = COALESCE($3, score_siang),
              score_sore = COALESCE($4, score_sore),
              score_malam = COALESCE($5, score_malam)
          WHERE id = $1
          RETURNING *;
        `;
        params = [id, score_pagi, score_siang, score_sore, score_malam];
      } else if (name) {
        query = `
          UPDATE poi_categories
          SET score_pagi = COALESCE($2, score_pagi),
              score_siang = COALESCE($3, score_siang),
              score_sore = COALESCE($4, score_sore),
              score_malam = COALESCE($5, score_malam)
          WHERE name = $1
          RETURNING *;
        `;
        params = [name, score_pagi, score_siang, score_sore, score_malam];
      } else {
        continue;
      }

      const { rows } = await pool.query(query, params);
      if (rows[0]) updated.push(rows[0]);
    }
    return updated;
  }
};
