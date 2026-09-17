import { pool } from "../config/database.js";

async function migrate() {
  await pool.query(`
    ALTER TABLE sales_logs ADD COLUMN IF NOT EXISTS assignment_id uuid REFERENCES zone_assignments(id) ON DELETE SET NULL;
    ALTER TABLE sales_logs ADD COLUMN IF NOT EXISTS unit_price numeric(12,2) DEFAULT 0;
    ALTER TABLE sales_logs ADD COLUMN IF NOT EXISTS total_price numeric(14,2) DEFAULT 0;
    CREATE INDEX IF NOT EXISTS idx_sales_logs_rider ON sales_logs(rider_id);
    CREATE INDEX IF NOT EXISTS idx_sales_logs_assignment ON sales_logs(assignment_id);
    CREATE INDEX IF NOT EXISTS idx_sales_logs_created_at ON sales_logs(created_at);
  `);
  console.log("✅ Migration Phase 4 (sales_logs enhancements) applied successfully.");
  await pool.end();
}

migrate();
