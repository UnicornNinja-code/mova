/*
 * migrate.ts
 * Database migration runner in TypeScript
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pool } from "../config/database.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  try {
    const dbDir = path.join(__dirname, "../db");

    console.log("⏳ Memproses migrasi skema utama (schema.sql)...");
    const sqlMaster = fs.readFileSync(path.join(dbDir, "schema.sql"), "utf8");
    await pool.query(sqlMaster);

    const migrationsDir = path.join(dbDir, "migrations");
    if (fs.existsSync(migrationsDir)) {
      const migrationFiles = fs
        .readdirSync(migrationsDir)
        .filter((file) => file.endsWith(".sql") && !file.includes("rollback"))
        .sort();

      for (let i = 0; i < migrationFiles.length; i++) {
        const file = migrationFiles[i];
        console.log(`⏳ [${i + 1}/${migrationFiles.length}] Memproses migrasi (${file})...`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
        await pool.query(sql);
      }
    }

    console.log("✅ Seluruh skema database dan migrasi berhasil dieksekusi!");
  } catch (error: any) {
    console.error("❌ Gagal migrasi database:", error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
