/*
 * productRepository.ts
 * Data Access Layer for Master products Table in TypeScript
 */

import { pool } from "../config/database.js";
import type { Pool } from "pg";

export class ProductRepository {
  private static instance: ProductRepository | null = null;
  private pool: Pool;

  constructor(dbPool: Pool = pool) {
    if (ProductRepository.instance && dbPool === pool) {
      return ProductRepository.instance;
    }
    this.pool = dbPool;
    if (dbPool === pool) {
      ProductRepository.instance = this;
    }
  }

  public static getInstance(dbPool: Pool = pool): ProductRepository {
    if (!ProductRepository.instance) {
      ProductRepository.instance = new ProductRepository(dbPool);
    }
    return ProductRepository.instance;
  }

  /**
   * Fetch all products with optional status, category, and search filters
   */
  public async findAll({
    status,
    category,
    search,
    limit = 50,
    offset = 0,
    sortBy = "name",
    sortOrder = "ASC",
  }: {
    status?: string;
    category?: string;
    search?: string;
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortOrder?: string;
  } = {}): Promise<any[]> {
    let query = `SELECT * FROM products WHERE 1=1`;
    const values: any[] = [];
    let paramIndex = 1;

    if (status && status !== "ALL") {
      query += ` AND status = $${paramIndex}::"ProductStatus"`;
      values.push(status.toUpperCase());
      paramIndex++;
    }

    if (category && category !== "ALL") {
      query += ` AND category = $${paramIndex}`;
      values.push(category.toUpperCase());
      paramIndex++;
    }

    if (search) {
      query += ` AND (name ILIKE $${paramIndex} OR description ILIKE $${paramIndex} OR sku ILIKE $${paramIndex})`;
      values.push(`%${search.trim()}%`);
      paramIndex++;
    }

    const validSortCols = ["name", "price", "base_price", "sku", "category", "status", "created_at", "updated_at"];
    const sortCol = validSortCols.includes(sortBy) ? sortBy : "name";
    const sortDir = sortOrder.toUpperCase() === "DESC" ? "DESC" : "ASC";

    query += ` ORDER BY ${sortCol} ${sortDir} LIMIT $${paramIndex} OFFSET $${paramIndex + 1};`;
    values.push(parseInt(String(limit), 10), parseInt(String(offset), 10));

    const { rows } = await this.pool.query(query, values);
    return rows;
  }

  /**
   * Count total products matching search, category & status filters
   */
  public async countAll({
    status,
    category,
    search,
  }: {
    status?: string;
    category?: string;
    search?: string;
  } = {}): Promise<number> {
    let query = `SELECT COUNT(*)::int AS total FROM products WHERE 1=1`;
    const values: any[] = [];
    let paramIndex = 1;

    if (status && status !== "ALL") {
      query += ` AND status = $${paramIndex}::"ProductStatus"`;
      values.push(status.toUpperCase());
      paramIndex++;
    }

    if (category && category !== "ALL") {
      query += ` AND category = $${paramIndex}`;
      values.push(category.toUpperCase());
      paramIndex++;
    }

    if (search) {
      query += ` AND (name ILIKE $${paramIndex} OR description ILIKE $${paramIndex} OR sku ILIKE $${paramIndex})`;
      values.push(`%${search.trim()}%`);
      paramIndex++;
    }

    const { rows } = await this.pool.query(query, values);
    return rows[0]?.total || 0;
  }

  /**
   * Fetch product by ID
   */
  public async findById(id: number | string): Promise<any | null> {
    if (!id) return null;
    const query = `SELECT * FROM products WHERE id = $1;`;
    const { rows } = await this.pool.query(query, [id]);
    return rows[0] || null;
  }

  /**
   * Find product by name (for uniqueness check)
   */
  public async findByName(name: string, excludeId: number | string | null = null): Promise<any | null> {
    let query = `SELECT * FROM products WHERE LOWER(name) = LOWER($1)`;
    const values: any[] = [name.trim()];
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
  public async create({
    name,
    sku,
    category = "KOPI",
    description = "",
    base_price = 0,
    price,
    image_url,
    status = "AVAILABLE",
  }: {
    name: string;
    sku?: string;
    category?: string;
    description?: string;
    base_price?: number;
    price: number;
    image_url?: string;
    status?: string;
  }): Promise<any> {
    const generatedSku = sku?.trim() || `COZ-${(category || "PROD").substring(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`;
    const query = `
      INSERT INTO products (name, sku, category, description, base_price, price, image_url, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::"ProductStatus")
      RETURNING *;
    `;
    const values = [
      name.trim(),
      generatedSku,
      (category || "KOPI").toUpperCase(),
      description,
      parseFloat(String(base_price || 0)),
      parseFloat(String(price)),
      image_url || null,
      status.toUpperCase(),
    ];
    const { rows } = await this.pool.query(query, values);
    return rows[0];
  }

  /**
   * Update product details
   */
  public async update(
    id: number | string,
    {
      name,
      sku,
      category,
      description,
      base_price,
      price,
      image_url,
      status,
    }: {
      name?: string;
      sku?: string;
      category?: string;
      description?: string;
      base_price?: number;
      price?: number;
      image_url?: string;
      status?: string;
    }
  ): Promise<any | null> {
    const setClauses: string[] = [];
    const values: any[] = [id];
    let paramIndex = 2;

    if (name !== undefined) {
      setClauses.push(`name = $${paramIndex}`);
      values.push(name.trim());
      paramIndex++;
    }
    if (sku !== undefined) {
      setClauses.push(`sku = $${paramIndex}`);
      values.push(sku.trim());
      paramIndex++;
    }
    if (category !== undefined) {
      setClauses.push(`category = $${paramIndex}`);
      values.push(category.toUpperCase());
      paramIndex++;
    }
    if (description !== undefined) {
      setClauses.push(`description = $${paramIndex}`);
      values.push(description);
      paramIndex++;
    }
    if (base_price !== undefined) {
      setClauses.push(`base_price = $${paramIndex}`);
      values.push(parseFloat(String(base_price)));
      paramIndex++;
    }
    if (price !== undefined) {
      setClauses.push(`price = $${paramIndex}`);
      values.push(parseFloat(String(price)));
      paramIndex++;
    }
    if (image_url !== undefined) {
      setClauses.push(`image_url = $${paramIndex}`);
      values.push(image_url);
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

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);

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
  public async updateStatus(id: number | string, status: string): Promise<any | null> {
    const query = `
      UPDATE products
      SET status = $2::"ProductStatus", updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *;
    `;
    const { rows } = await this.pool.query(query, [id, status.toUpperCase()]);
    return rows[0] || null;
  }

  /**
   * Check if a product has ever been sold in sales_logs
   */
  public async hasSalesHistory(productId: number | string): Promise<boolean> {
    const query = `SELECT COUNT(*)::int AS count FROM sales_logs WHERE product_id = $1;`;
    const { rows } = await this.pool.query(query, [productId]);
    return (rows[0]?.count || 0) > 0;
  }

  /**
   * Delete product by ID
   */
  public async delete(id: number | string): Promise<any | null> {
    const query = `DELETE FROM products WHERE id = $1 RETURNING *;`;
    const { rows } = await this.pool.query(query, [id]);
    return rows[0] || null;
  }
}

export const productRepository = ProductRepository.getInstance();
