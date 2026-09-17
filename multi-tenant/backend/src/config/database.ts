import pg from "pg";
import { env } from "./env.js";

const { Pool } = pg;

export const pool = new Pool({
  host: env.DB.HOST,
  user: env.DB.USER,
  port: env.DB.PORT,
  password: env.DB.PASSWORD,
  database: env.DB.NAME,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

