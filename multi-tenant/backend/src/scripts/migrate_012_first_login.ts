import { pool } from "../config/database.js";

async function runMigration() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS first_login boolean NOT NULL DEFAULT false;
    `);
    await client.query(`
      COMMENT ON COLUMN users.first_login IS
        'True if this account has never completed the mandatory first-time password setup. '
        'Set to true when account is provisioned, set to false after user completes first-login password change.';
    `);
    await client.query("COMMIT");
    console.log("✅ Migration 012: first_login column added to users table.");
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("❌ Migration 012 FAILED:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
