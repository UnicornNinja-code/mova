/*
 * tenantContext.ts
 * Safe Session-Bound Parameterized PostgreSQL Row-Level Security (RLS) Context Wrapper
 * 
 * Memastikan parameter `app.current_tenant_id` disetel secara parameterized
 * di dalam database transaction/session yang sama, sehingga context RLS terikat
 * secara eksklusif pada koneksi pool yang didapatkan dan bebas dari risiko SQL Injection.
 */

import type { PoolClient } from "pg";
import { pool } from "../config/database.js";

/**
 * Membungkus eksekusi query tenant-scoped dalam transaksi PostgreSQL terisolasi.
 * Menyetel session variable `app.current_tenant_id` secara aman.
 */
export async function withTenantContext<T>(
  tenantId: string,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Switch to application role (NOSUPERUSER, NOBYPASSRLS) to enforce RLS
    await client.query("SET LOCAL ROLE mova_app;");
    // Parameterized session set (Anti-SQLi & Connection-Pinned)
    await client.query("SELECT set_config('app.current_tenant_id', $1, true);", [tenantId]);
    
    const result = await fn(client);
    
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Eksekusi query dengan bypass RLS (khusus internal background maintenance / global superadmin setup)
 */
export async function withSystemBypassContext<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.bypass_rls', 'on', true);");
    
    const result = await fn(client);
    
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
