/*
 * test_stage1_rls_isolation.ts
 * Stage 1 Regression Test: Multi-Tenant PostgreSQL RLS & Safe Context Isolation
 */

import { pool } from "../src/config/database.js";
import { withTenantContext, withSystemBypassContext } from "../src/lib/tenantContext.js";

const TENANT_A = "test-tenant-coffee-01";
const TENANT_B = "test-tenant-bakery-02";

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string, detail?: any) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ PASS: ${testName}`);
  } else {
    console.error(`  ❌ FAIL: ${testName}`, detail || "");
    process.exitCode = 1;
  }
}

async function runStage1Tests() {
  console.log("\n==================================================================");
  console.log("🔒  STAGE 1: MULTI-TENANT RLS ISOLATION REGRESSION SUITE");
  console.log("==================================================================\n");

  try {
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

    // TEST 1: Insert and query data within Tenant A context succeeds
    const createdProduct = await withTenantContext(TENANT_A, async (client) => {
      const res = await client.query(
        `INSERT INTO products (tenant_id, name, price, category, status)
         VALUES ($1, 'Kopi Espresso A', 18000, 'KOPI', 'AVAILABLE')
         RETURNING id, name, tenant_id;`,
        [TENANT_A]
      );
      return res.rows[0];
    });
    assert(
      createdProduct && createdProduct.name === "Kopi Espresso A" && createdProduct.tenant_id === TENANT_A,
      "Insert and query data within Tenant A context succeeds"
    );

    // TEST 2: Tenant B context CANNOT see Tenant A products due to RLS
    await withTenantContext(TENANT_B, async (client) => {
      await client.query(
        `INSERT INTO products (tenant_id, name, price, category, status)
         VALUES ($1, 'Roti Croissant B', 25000, 'ROTI', 'AVAILABLE')
         RETURNING id;`,
        [TENANT_B]
      );
    });

    const tenantBProducts = await withTenantContext(TENANT_B, async (client) => {
      const res = await client.query(`SELECT id, name, tenant_id FROM products;`);
      return res.rows;
    });

    const hasTenantAProduct = tenantBProducts.some((p) => p.tenant_id === TENANT_A);
    const hasTenantBProduct = tenantBProducts.some((p) => p.tenant_id === TENANT_B);
    assert(
      !hasTenantAProduct && hasTenantBProduct,
      "Tenant B context CANNOT see Tenant A products due to RLS"
    );

    // TEST 3: Tenant A context CANNOT see Tenant B products due to RLS
    const tenantAProducts = await withTenantContext(TENANT_A, async (client) => {
      const res = await client.query(`SELECT id, name, tenant_id FROM products;`);
      return res.rows;
    });
    assert(
      !tenantAProducts.some((p) => p.tenant_id === TENANT_B),
      "Tenant A context CANNOT see Tenant B products due to RLS"
    );

    // TEST 4: Parameterized context is immune to SQL injection attempts
    const maliciousTenantId = "non-existent' OR '1'='1";
    const sqliProducts = await withTenantContext(maliciousTenantId, async (client) => {
      const res = await client.query(`SELECT id, name, tenant_id FROM products;`);
      return res.rows;
    });
    assert(
      sqliProducts.length === 0,
      "Parameterized context is immune to SQL injection attempts in tenant_id"
    );

    // TEST 5: System bypass context can view all tenants for administrative maintenance
    const allProducts = await withSystemBypassContext(async (client) => {
      const res = await client.query(
        `SELECT id, name, tenant_id FROM products WHERE tenant_id IN ($1, $2);`,
        [TENANT_A, TENANT_B]
      );
      return res.rows;
    });
    assert(
      allProducts.length === 2 &&
        allProducts.some((p) => p.tenant_id === TENANT_A) &&
        allProducts.some((p) => p.tenant_id === TENANT_B),
      "System bypass context can view all tenants for administrative maintenance"
    );

    console.log("\n==================================================================");
    console.log(`🎯 STAGE 1 REGRESSION RESULTS: ${passedTests}/${totalTests} PASSED`);
    console.log("==================================================================\n");

  } catch (err: any) {
    console.error("💥 Error during Stage 1 test execution:", err);
    process.exitCode = 1;
  } finally {
    try {
      await pool.query(`DELETE FROM products WHERE tenant_id IN ($1, $2);`, [TENANT_A, TENANT_B]);
      await pool.query(`DELETE FROM armadas WHERE tenant_id IN ($1, $2);`, [TENANT_A, TENANT_B]);
      await pool.query(`DELETE FROM tenants WHERE id IN ($1, $2);`, [TENANT_A, TENANT_B]);
    } catch {
      // Ignore cleanup error
    }
  }

  if (passedTests === totalTests && totalTests > 0) {
    console.log("🎉 ALL STAGE 1 REGRESSION TESTS PASSED PERFECTLY!\n");
    process.exit(0);
  } else {
    console.error("💥 SOME STAGE 1 TESTS FAILED!\n");
    process.exit(1);
  }
}

runStage1Tests().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
