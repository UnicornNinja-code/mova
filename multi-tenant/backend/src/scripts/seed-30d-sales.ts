/*
 * seed-30d-sales.ts
 * Dedicated Seeding Script for 30-Day Historical Sales Logs in PostgreSQL
 */

import { pool } from "../config/database.js";

async function seed30DaysSales() {
  console.log("==================================================");
  console.log("☕ SEEDING 30-DAY HISTORICAL SALES LOGS (POSTGRESQL)");
  console.log("==================================================");

  try {
    // 1. Fetch Riders, Products, and Zones
    const [ridersRes, productsRes, zonesRes] = await Promise.all([
      pool.query("SELECT id, name FROM users WHERE role = 'RIDER' ORDER BY name;"),
      pool.query("SELECT id, name, price FROM products WHERE status = 'AVAILABLE' ORDER BY name;"),
      pool.query("SELECT id, name, polygon FROM zones WHERE status = 'ACTIVE' ORDER BY name;"),
    ]);

    const riders = ridersRes.rows;
    const products = productsRes.rows;
    const zones = zonesRes.rows;

    if (riders.length === 0 || products.length === 0 || zones.length === 0) {
      throw new Error("Master data Riders, Products, atau Zones belum ada. Jalankan db:seed terlebih dahulu.");
    }

    console.log(`📍 Ditemukan: ${riders.length} Riders, ${products.length} Products, ${zones.length} Zones.`);

    // 2. Clear old sales logs to prevent duplicate clutter
    console.log("🧹 Membersihkan data sales_logs lama...");
    await pool.query("DELETE FROM sales_logs;");

    let totalTransactionsInserted = 0;
    let totalRevenueAccumulated = 0;
    let totalCupsSold = 0;

    // 3. Generate 31 days (Day 30 ago down to Today 0)
    for (let dayOffset = 30; dayOffset >= 0; dayOffset--) {
      // Base date calculation in Asia/Jakarta
      const now = new Date();
      const baseDate = new Date(now.getTime() - dayOffset * 24 * 60 * 60 * 1000);
      const isWeekend = baseDate.getDay() === 0 || baseDate.getDay() === 6;

      // Higher transaction volume on weekends & recent days
      const baseCount = isWeekend ? 35 : 24;
      const randomVariance = Math.floor(Math.random() * 15);
      const txCount = dayOffset === 0 ? 32 : baseCount + randomVariance;

      const dateStr = baseDate.toISOString().split("T")[0];

      for (let t = 0; t < txCount; t++) {
        const rider = riders[t % riders.length];
        const prod = products[t % products.length];
        const zone = zones[t % zones.length];

        // Random transaction time between 07:00 and 19:30 WIB
        const hour = 7 + Math.floor(Math.random() * 12);
        const minute = Math.floor(Math.random() * 60);
        const second = Math.floor(Math.random() * 60);

        const txDateTime = new Date(`${dateStr}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}+07:00`);

        const qty = Math.floor(1 + Math.random() * 3); // 1-3 cups
        const unitPrice = parseFloat(prod.price) || 18000;
        const totalPrice = qty * unitPrice;

        // Realistic Sidoarjo coordinate variance around zone
        const lat = -7.4450 + (Math.random() - 0.5) * 0.015;
        const lon = 112.7150 + (Math.random() - 0.5) * 0.015;

        await pool.query(
          `INSERT INTO sales_logs (rider_id, product_id, qty, unit_price, total_price, latitude, longitude, zone_id, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);`,
          [
            rider.id,
            prod.id,
            qty,
            unitPrice,
            totalPrice,
            lat,
            lon,
            zone.id,
            txDateTime.toISOString(),
          ]
        );

        totalTransactionsInserted++;
        totalRevenueAccumulated += totalPrice;
        totalCupsSold += qty;
      }
    }

    console.log("==================================================");
    console.log(`✅ BERHASIL SEEDING ${totalTransactionsInserted} TRANSAKSI 30 HARI!`);
    console.log(`💰 Total Omzet Akumulasi: Rp ${totalRevenueAccumulated.toLocaleString("id-ID")}`);
    console.log(`☕ Total Volume Terjual: ${totalCupsSold.toLocaleString("id-ID")} Cup`);
    console.log("==================================================");
  } catch (error: any) {
    console.error("❌ Gagal seeding 30 hari sales logs:", error.message);
  } finally {
    await pool.end();
  }
}

seed30DaysSales();
