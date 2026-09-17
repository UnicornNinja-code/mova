import { pool } from "../config/database.js";

async function inspect() {

  for (const tbl of ['sales_logs', 'rider_zone_logs', 'operational_sessions', 'latest_rider_positions', 'rider_telemetry_logs']) {
    const res = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1;`, [tbl]);
    console.log(`=== ${tbl} ===`);
    console.log(res.rows);
  }
  process.exit(0);
}



inspect();
