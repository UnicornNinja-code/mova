/*
 *   Copyright (c) 2026 
 *   All rights reserved.
 *   productRepository.js (Data Access Layer for Master products Table)
 */

import { pool } from "../config/database.js";

export class ProductRepository {
  static instance = null;

  constructor(dbPool = pool) {
    if (ProductRepository.instance && dbPool === pool) {
      return ProductRepository.instance;
    }
    this.pool = dbPool;
    if (dbPool === pool) {
      ProductRepository.instance = this;
    }
  }

  static getInstance(dbPool = pool) {
    if (!ProductRepository.instance) {
      ProductRepository.instance = new ProductRepository(dbPool);
    }
    return ProductRepository.instance;
  }

  /**
   * Fetch all products with optional status and search filters
   */
  async findAll({ status, search, limit = 50, offset = 0, sortBy = "name", sortOrder = "ASC" } = {}) {
    let query = `SELECT * FROM products WHERE 1=1`;
    const values = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND status = $${paramIndex}::"ProductStatus"`;
      values.push(status.toUpperCase());
      paramIndex++;
    }

    if (search) {
      query += ` AND (name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
      values.push(`%${search.trim()}%`);
      paramIndex++;
    }

    const validSortCols = ["name", "price", "status", "created_at", "updated_at"];
    const sortCol = validSortCols.includes(sortBy) ? sortBy : "name";
    const sortDir = sortOrder.toUpperCase() === "DESC" ? "DESC" : "ASC";

    query += ` ORDER BY ${sortCol} ${sortDir} LIMIT $${paramIndex} OFFSET $${paramIndex + 1};`;
    values.push(parseInt(limit, 10), parseInt(offset, 10));

    const { rows } = await this.pool.query(query, values);
    return rows;
  }

  /**
   * Count total products matching search & status filters
   */
  async countAll({ status, search } = {}) {
    let query = `SELECT COUNT(*)::int AS total FROM products WHERE 1=1`;
    const values = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND status = $${paramIndex}::"ProductStatus"`;
      values.push(status.toUpperCase());
      paramIndex++;
    }

    if (search) {
      query += ` AND (name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
      values.push(`%${search.trim()}%`);
      paramIndex++;
    }

    const { rows } = await this.pool.query(query, values);
    return rows[0]?.total || 0;
  }

  /**
   * Fetch product by UUID
   */
  async findById(id) {
    if (!id) return null;
    const query = `SELECT * FROM products WHERE id = $1;`;
    const { rows } = await this.pool.query(query, [id]);
    return rows[0] || null;
  }

  /**
   * Find product by name (for uniqueness check)
   */
  async findByName(name, excludeId = null) {
    let query = `SELECT * FROM products WHERE LOWER(name) = LOWER($1)`;
    const values = [name.trim()];
    if (excludeId) {
      query += ` AND id != $2`;
      values.push(excludeId);
    }
    query += ` LIMIT 1;`;
    const { rows } = await this.pool.query(query, values);
    return rows[0] || null;
  }

  /**
   * Create a new product in master catalog
   */
  async create({ name, description = "", price, status = "AVAILABLE" }) {
    const query = `
      INSERT INTO products (name, description, price, status)
      VALUES ($1, $2, $3, $4::"ProductStatus")
      RETURNING *;
    `;
    const values = [name.trim(), description, parseFloat(price), status.toUpperCase()];
    const { rows } = await this.pool.query(query, values);
    return rows[0];
  }

  /**
   * Update product details
   */
  async update(id, { name, description, price, status }) {
    const setClauses = [];
    const values = [id];
    let paramIndex = 2;

    if (name !== undefined) {
      setClauses.push(`name = $${paramIndex}`);
      values.push(name.trim());
      paramIndex++;
    }
    if (description !== undefined) {
      setClauses.push(`description = $${paramIndex}`);
      values.push(description);
      paramIndex++;
    }
    if (price !== undefined) {
      setClauses.push(`price = $${paramIndex}`);
      values.push(parseFloat(price));
      paramIndex++;
    }
    if (status !== undefined) {
      setClauses.push(`status = $${paramIndex}::"ProductStatus"`);
      values.push(status.toUpperCase());
      paramIndex++;
    }

    if (setClauses.length === 0) {
      return this.findById(id);
    }

    const query = `
      UPDATE products
      SET ${setClauses.join(", ")}
      WHERE id = $1
      RETURNING *;
    `;
    const { rows } = await this.pool.query(query, values);
    return rows[0] || null;
  }

  /**
   * Update product status (AVAILABLE / DISCONTINUED)
   */
  async updateStatus(id, status) {
    const query = `
      UPDATE products
      SET status = $2::"ProductStatus"
      WHERE id = $1
      RETURNING *;
    `;
    const { rows } = await this.pool.query(query, [id, status.toUpperCase()]);
    return rows[0] || null;
  }

  /**
   * Check if a product has ever been sold in sales_logs
   */
  async hasSalesHistory(productId) {
    const query = `SELECT COUNT(*)::int AS count FROM sales_logs WHERE product_id = $1;`;
    const { rows } = await this.pool.query(query, [productId]);
    return (rows[0]?.count || 0) > 0;
  }

  /**
   * Delete product by ID
   */
  async delete(id) {
    const query = `DELETE FROM products WHERE id = $1 RETURNING *;`;
    const { rows } = await this.pool.query(query, [id]);
    return rows[0] || null;
  }
}

export const productRepository = ProductRepository.getInstance();
