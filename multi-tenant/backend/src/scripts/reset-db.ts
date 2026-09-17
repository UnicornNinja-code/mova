/*
 * reset-db.ts
 * Database reset utility in TypeScript
 */

import { pool } from "../config/database.js";

async function resetDatabase() {
  try {
    console.log("⏳ Sedang menghapus seluruh tabel, fungsi, dan enum pengguna (preservasi PostGIS spatial_ref_sys)...");

    const dropQuery = `
      DO $$ 
      DECLARE
        r RECORD;
      BEGIN
        -- 1. Hapus seluruh tabel di schema public kecuali spatial_ref_sys (bawaan PostGIS)
        FOR r IN (
          SELECT tablename 
          FROM pg_tables 
          WHERE schemaname = 'public' AND tablename != 'spatial_ref_sys'
        ) LOOP
          EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;

        -- 2. Hapus seluruh tipe ENUM custom di schema public
        FOR r IN (
          SELECT typname 
          FROM pg_type t 
          JOIN pg_namespace n ON n.oid = t.typnamespace 
          WHERE n.nspname = 'public' AND t.typtype = 'e'
        ) LOOP
          EXECUTE 'DROP TYPE IF EXISTS public.' || quote_ident(r.typname) || ' CASCADE';
        END LOOP;
      END $$;

      -- 3. Hapus trigger function helper jika ada
      DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
    `;

    await pool.query(dropQuery);
    console.log("🔥 Berhasil mengosongkan seluruh tabel dan enum pengguna dari database!");
  } catch (error: any) {
    console.error("❌ Gagal mereset database:", error.message);
  } finally {
    await pool.end();
  }
}

resetDatabase();
