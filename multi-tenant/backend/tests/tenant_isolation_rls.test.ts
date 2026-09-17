/*
 * tenant_isolation_rls.test.ts
 * Integration Test for PostgreSQL Row-Level Security (RLS) & Anti-IDOR Tenant Isolation
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { pool } from "../src/config/database.js";
import { withTenantContext, withSystemBypassContext } from "../src/lib/tenantContext.js";
import { TenantModel } from "../src/models/tenantModel.js";

const TENANT_A = "test-tenant-coffee-01";
const TENANT_B = "test-tenant-bakery-02";

describe("Stage 1: Multi-Tenant PostgreSQL RLS & Safe Context Isolation", () => {
  beforeAll(async () => {
    // 1. Ensure test tenants exist
    await pool.query(
      `INSERT INTO tenants (id, name, code, status, max_fleets, max_riders, max_zones)
       VALUES ($1, 'Test Coffee Tenant', 'TEST_COFFEE', 'ACTIVE', 50, 100, 10),
              ($2, 'Test Bakery Tenant', 'TEST_BAKERY', 'ACTIVE', 50, 100, 10)
       ON CONFLICT (id) DO NOTHING;`,
      [TENANT_A, TENANT_B]
    );

    // 2. Clean up test products/armadas/zones for test isolation
    await pool.query(`DELETE FROM products WHERE tenant_id IN ($1, $2);`, [TENANT_A, TENANT_B]);
    await pool.query(`DELETE FROM armadas WHERE tenant_id IN ($1, $2);`, [TENANT_A, TENANT_B]);
  });

  afterAll(async () => {
    // Clean up test data
    await pool.query(`DELETE FROM products WHERE tenant_id IN ($1, $2);`, [TENANT_A, TENANT_B]);
    await pool.query(`DELETE FROM armadas WHERE tenant_id IN ($1, $2);`, [TENANT_A, TENANT_B]);
    await pool.query(`DELETE FROM tenants WHERE id IN ($1, $2);`, [TENANT_A, TENANT_B]);
  });

  test("1. Insert and query data within Tenant A context succeeds", async () => {
    const createdProduct = await withTenantContext(TENANT_A, async (client) => {
      const res = await client.query(
        `INSERT INTO products (tenant_id, name, price, category, status)
         VALUES ($1, 'Kopi Espresso A', 18000, 'KOPI', 'AVAILABLE')
         RETURNING id, name, tenant_id;`,
        [TENANT_A]
      );
      return res.rows[0];
    });

    expect(createdProduct).toBeDefined();
    expect(createdProduct.name).toBe("Kopi Espresso A");
    expect(createdProduct.tenant_id).toBe(TENANT_A);
  });

  test("2. Tenant B context CANNOT see Tenant A products due to RLS", async () => {
    // Insert Tenant B's own product
    await withTenantContext(TENANT_B, async (client) => {
      await client.query(
        `INSERT INTO products (tenant_id, name, price, category, status)
         VALUES ($1, 'Roti Croissant B', 25000, 'ROTI', 'AVAILABLE')
         RETURNING id;`,
        [TENANT_B]
      );
    });

    // Query from Tenant B context
    const tenantBProducts = await withTenantContext(TENANT_B, async (client) => {
      const res = await client.query(`SELECT id, name, tenant_id FROM products;`);
      return res.rows;
    });

    // Tenant B must only see products with tenant_id = TENANT_B
    const hasTenantAProduct = tenantBProducts.some((p) => p.tenant_id === TENANT_A);
    expect(hasTenantAProduct).toBe(false);

    const hasTenantBProduct = tenantBProducts.some((p) => p.tenant_id === TENANT_B);
    expect(hasTenantBProduct).toBe(true);
  });

  test("3. Tenant A context CANNOT see Tenant B products due to RLS", async () => {
    const tenantAProducts = await withTenantContext(TENANT_A, async (client) => {
      const res = await client.query(`SELECT id, name, tenant_id FROM products;`);
      return res.rows;
    });

    const hasTenantBProduct = tenantAProducts.some((p) => p.tenant_id === TENANT_B);
    expect(hasTenantBProduct).toBe(false);
  });

  test("4. Parameterized context is immune to SQL injection attempts in tenant_id", async () => {
    const maliciousTenantId = "non-existent' OR '1'='1";

    const products = await withTenantContext(maliciousTenantId, async (client) => {
      const res = await client.query(`SELECT id, name, tenant_id FROM products;`);
      return res.rows;
    });

    // With parameterized set_config, the literal string is treated as tenant_id, returning 0 rows
    expect(products.length).toBe(0);
  });

  test("5. System bypass context can view all tenants for administrative maintenance", async () => {
    const allProducts = await withSystemBypassContext(async (client) => {
      const res = await client.query(
        `SELECT id, name, tenant_id FROM products WHERE tenant_id IN ($1, $2);`,
        [TENANT_A, TENANT_B]
      );
      return res.rows;
    });

    expect(allProducts.length).toBe(2);
    expect(allProducts.some((p) => p.tenant_id === TENANT_A)).toBe(true);
    expect(allProducts.some((p) => p.tenant_id === TENANT_B)).toBe(true);
  });
});
