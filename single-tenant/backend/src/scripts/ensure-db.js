import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Client } = pg;

async function ensureDatabase() {
  const targetDb = process.env.DB_NAME || "kopigo_db";
  
  const client = new Client({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD,
    database: "postgres", // Connect to default maintenance database
  });

  try {
    await client.connect();
    console.log(`🔌 Terhubung ke Postgres maintenance db...`);

    const checkRes = await client.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [targetDb]
    );

    if (checkRes.rows.length === 0) {
      console.log(`📦 Database "${targetDb}" belum ada. Sedang membuat...`);
      await client.query(`CREATE DATABASE "${targetDb}"`);
      console.log(`✅ Database "${targetDb}" berhasil dibuat!`);
    } else {
      console.log(`ℹ️ Database "${targetDb}" sudah ada.`);
    }

    await client.end();

    // Now connect to targetDb to ensure PostGIS extension is ready
    const targetClient = new Client({
      host: process.env.DB_HOST || "127.0.0.1",
      port: Number(process.env.DB_PORT) || 5432,
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD,
      database: targetDb,
    });

    await targetClient.connect();
    await targetClient.query(`CREATE EXTENSION IF NOT EXISTS postgis;`);
    console.log(`🗺️ Ekstensi PostGIS dipastikan aktif pada "${targetDb}".`);
    await targetClient.end();

    console.log(`🎉 Database "${targetDb}" siap untuk migrasi dan seeding!`);
  } catch (err) {
    console.error(`❌ Gagal memastikan database:`, err.message);
    process.exit(1);
  }
}

ensureDatabase();
