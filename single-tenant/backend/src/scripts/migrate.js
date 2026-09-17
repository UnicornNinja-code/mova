/*
 * migrate.js
 * Enterprise Database Migration Engine (Single-Tenant MOVA)
 * 
 * Features:
 *  - Idempotent schema.sql execution
 *  - Migration tracking via `_migrations` table
 *  - Transaction-safe execution per migration file
 *  - Detailed benchmark timing & error reporting
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pool } from "../config/database.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  console.log("════════════════════════════════════════════════════════════");
  console.log("🐘  MOVA — DATABASE MIGRATION ENGINE (PostgreSQL + PostGIS)");
  console.log("════════════════════════════════════════════════════════════\n");

  const startTime = Date.now();
  const client = await pool.connect();

  try {
    const dbDir = path.join(__dirname, "../db");

    // 1. Eksekusi Skema Master (schema.sql)
    console.log("⏳ [1/2] Memproses skema master DDL (schema.sql)...");
    const masterStart = Date.now();
    const sqlMaster = fs.readFileSync(path.join(dbDir, "schema.sql"), "utf8");
    
    await client.query("BEGIN");
    await client.query(sqlMaster);

    // 2. Siapkan Tabel Tracking Migrasi (_migrations)
    await client.query(`
      CREATE TABLE IF NOT EXISTS "_migrations" (
        "id" serial PRIMARY KEY,
        "name" varchar(255) UNIQUE NOT NULL,
        "batch" int NOT NULL DEFAULT 1,
        "executed_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "execution_time_ms" int NOT NULL DEFAULT 0
      );
    `);
    await client.query("COMMIT");
    console.log(`   ✅ Skema master & tabel _migrations siap (${Date.now() - masterStart}ms)\n`);

    // 3. Ambil Riwayat Migrasi yang Sudah Pernah Dijalankan
    const { rows: executedMigrations } = await client.query(
      `SELECT name FROM "_migrations" ORDER BY id ASC;`
    );
    const executedSet = new Set(executedMigrations.map((m) => m.name));

    // Hitung batch berikutnya
    const { rows: [batchRow] } = await client.query(
      `SELECT COALESCE(MAX(batch), 0) + 1 AS next_batch FROM "_migrations";`
    );
    const currentBatch = parseInt(batchRow?.next_batch || "1", 10);

    // 4. Baca dan Urutkan Seluruh File Migrasi
    const migrationsDir = path.join(dbDir, "migrations");
    if (fs.existsSync(migrationsDir)) {
      const migrationFiles = fs
        .readdirSync(migrationsDir)
        .filter((file) => file.endsWith(".sql") && !file.includes("rollback"))
        .sort();

      console.log(`⏳ [2/2] Memeriksa ${migrationFiles.length} berkas migrasi tambahan...`);

      let appliedCount = 0;
      let skippedCount = 0;

      for (let i = 0; i < migrationFiles.length; i++) {
        const file = migrationFiles[i];
        const stepNum = `[${i + 1}/${migrationFiles.length}]`;

        if (executedSet.has(file)) {
          console.log(`   ⏭️  ${stepNum} ${file} (Sudah diterapkan)`);
          skippedCount++;
          continue;
        }

        const fileStart = Date.now();
        console.log(`   ⏳ ${stepNum} Menjalankan ${file}...`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");

        try {
          await client.query("BEGIN");
          await client.query(sql);

          const elapsedMs = Date.now() - fileStart;
          await client.query(
            `INSERT INTO "_migrations" (name, batch, execution_time_ms) VALUES ($1, $2, $3);`,
            [file, currentBatch, elapsedMs]
          );
          await client.query("COMMIT");

          console.log(`      ✅ Selesai (${elapsedMs}ms)`);
          appliedCount++;
        } catch (migErr) {
          await client.query("ROLLBACK");
          console.error(`\n❌ Gagal pada berkas migrasi: ${file}`);
          console.error(`   Penyebab: ${migErr.message}`);
          throw migErr;
        }
      }

      console.log(`\n📊 Ringkasan: ${appliedCount} baru diaplikasikan, ${skippedCount} dilewati.`);
    }

    const totalElapsed = Date.now() - startTime;
    console.log("\n════════════════════════════════════════════════════════════");
    console.log(`🎉  MIGRASI DATABASE BERHASIL SEPENUHNYA (${totalElapsed}ms)`);
    console.log("════════════════════════════════════════════════════════════\n");

  } catch (error) {
    console.error("\n❌ Migrasi database dibatalkan karena kesalahan:", error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

if (process.argv[1] && process.argv[1].endsWith("migrate.js")) {
  runMigration();
}

export { runMigration };