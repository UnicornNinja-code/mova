import pg from "pg";
import { env } from "./env.js";

const { Pool } = pg;

const IDLE_TIMEOUT_MS = 30000;
const CONNECTION_TIMEOUT_MS = 5000;
const KEEPALIVE_INITIAL_DELAY_MS = 10000;

export const pool = new Pool({
  host: env.DB.HOST,
  user: env.DB.USER,
  port: env.DB.PORT,
  password: env.DB.PASSWORD,
  database: env.DB.NAME,
  max: env.DB.POOL_MAX,
  min: env.DB.POOL_MIN,
  idleTimeoutMillis: IDLE_TIMEOUT_MS,
  connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
  keepAlive: true,
  keepAliveInitialDelayMillis: KEEPALIVE_INITIAL_DELAY_MS,
});

pool.on("error", (err) => {
  console.error("⚠️ Unexpected idle PostgreSQL client error:", err.message);
});

pool.connect((err, client, release) => {
  if (err) {
    return console.error("❌ Gagal terhubung ke PostgreSQL:", err.message);
  }
  console.log("🐘 PostgreSQL & PostGIS berhasil terhubung (Connection Pool Optimized)!");
  release();
});

export default pool;