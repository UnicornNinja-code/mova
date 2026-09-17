/*
 * seed-demo.ts
 * Seeding Script specifically for Demonstrations, Mockups & Presentations (Bun + TypeScript)
 * Menambahkan data simulasi lengkap: 5 Rider aktif, Supervisor, Manajemen, Armada IN_USE,
 * serta histori transaksi 30 hari untuk visualisasi grafik omzet dashboard.
 */

import bcrypt from "bcryptjs";
import { execSync } from "child_process";
import { pool } from "../config/database.js";

async function runDemoSeeding() {
  console.log("================================================================================");
  console.log("🚀 MENJALANKAN DEMO / MOCKUP SEEDING (COZIS DSS)");
  console.log("================================================================================\n");

  try {
    // 1. Pastikan Base Clean Seed sudah berjalan
    console.log("1️⃣  Menyiapkan Skema & Master Data Dasar...");
    execSync("bun src/scripts/seed.ts", { stdio: "inherit" });

    // 2. Tambah Akun Demo Staff (Manajemen, Supervisor, 5 Riders)
    console.log("\n2️⃣  Menambahkan Akun Demo (Manajemen, Supervisor, 5 Riders)...");
    const defaultPasswordHash = await bcrypt.hash("password123", 10);

    const demoUsers = [
      {
        email: "management@kopikeliling.com",
        username: "management",
        password: defaultPasswordHash,
        name: "Manajemen Operasional",
        role: "MANAGEMENT",
      },
      {
        email: "supervisor@kopikeliling.com",
        username: "supervisor1",
        password: defaultPasswordHash,
        name: "Supervisor Operasional",
        role: "SUPERVISOR",
      },
      {
        email: "rider@kopikeliling.com",
        username: "rider1",
        password: defaultPasswordHash,
        name: "Doni Pratama",
        role: "RIDER",
      },
      {
        email: "rider2@kopikeliling.com",
        username: "rider2",
        password: defaultPasswordHash,
        name: "Dimas Kurniawan",
        role: "RIDER",
      },
      {
        email: "rider3@kopikeliling.com",
        username: "rider3",
        password: defaultPasswordHash,
        name: "Ahmad Fauzi",
        role: "RIDER",
      },
      {
        email: "rider4@kopikeliling.com",
        username: "rider4",
        password: defaultPasswordHash,
        name: "Rizky Ramadhan",
        role: "RIDER",
      },
      {
        email: "rider5@kopikeliling.com",
        username: "rider5",
        password: defaultPasswordHash,
        name: "Eko Setiawan",
        role: "RIDER",
      },
    ];

    for (const u of demoUsers) {
      await pool.query(
        `
        INSERT INTO users (email, username, password, name, role, is_active)
        VALUES ($1, $2, $3, $4, $5::"Role", true)
        ON CONFLICT (email) DO UPDATE SET
          username = EXCLUDED.username,
          password = EXCLUDED.password,
          name = EXCLUDED.name,
          role = EXCLUDED.role,
          is_active = true;
      `,
        [u.email, u.username, u.password, u.name, u.role]
      );
    }
    console.log(`✅ ${demoUsers.length} akun demo staf & rider berhasil ditambahkan.`);

    // 3. Ambil data zona, armada, dan rider untuk penugasan demo
    console.log("\n3️⃣  Menyiapkan Penugasan Demo & Status Armada...");
    const { rows: riders } = await pool.query("SELECT id, name FROM users WHERE role = 'RIDER' ORDER BY name;");
    const { rows: zones } = await pool.query("SELECT id, name FROM zones ORDER BY name;");
    const { rows: armadas } = await pool.query("SELECT id, code FROM armadas ORDER BY code;");
    const { rows: products } = await pool.query("SELECT id, name, price FROM products ORDER BY id;");

    const today = new Date().toISOString().split("T")[0];

    // Plotting dan penugasan rider ke zona & armada
    for (let i = 0; i < Math.min(riders.length, armadas.length); i++) {
      const rider = riders[i];
      const armada = armadas[i];
      const zone = zones[i % zones.length];

      // Update armada status jadi IN_USE untuk 4 unit pertama
      if (i < 4) {
        await pool.query("UPDATE armadas SET status = 'IN_USE' WHERE id = $1;", [armada.id]);
      }

      await pool.query(
        `
        INSERT INTO zone_assignments (rider_id, zone_id, armada_id, assignment_date, status, check_in_time)
        VALUES ($1, $2, $3, $4::date, 'CHECKED_IN', CURRENT_TIMESTAMP)
        ON CONFLICT DO NOTHING;
      `,
        [rider.id, zone.id, armada.id, today]
      );

      await pool.query(
        `
        INSERT INTO rider_duty_queues (rider_id, duty_date, status)
        VALUES ($1, $2::date, 'PLOTTED')
        ON CONFLICT DO NOTHING;
      `,
        [rider.id, today]
      );
    }
    console.log(`✅ Penugasan 5 rider aktif ke zona operasional siap.`);

    // 4. Seeding Histori Transaksi 30 Hari
    console.log("\n4️⃣  Men-generate 30 Hari Riwayat Transaksi Penjualan...");
    let totalTrx = 0;
    for (let dayOffset = 30; dayOffset >= 0; dayOffset--) {
      const txDate = new Date(Date.now() - dayOffset * 24 * 60 * 60 * 1000);
      const txCount = dayOffset === 0 ? 35 : Math.floor(20 + Math.random() * 25);

      for (let t = 0; t < txCount; t++) {
        const rider = riders[t % riders.length];
        const prod = products[t % products.length];
        const zone = zones[t % zones.length];
        const qty = Math.floor(1 + Math.random() * 3);
        const unitPrice = prod?.price || 18000;
        const totalPrice = qty * unitPrice;

        await pool.query(
          `
          INSERT INTO sales_logs (rider_id, product_id, qty, unit_price, total_price, latitude, longitude, zone_id, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);
        `,
          [
            rider.id,
            prod.id,
            qty,
            unitPrice,
            totalPrice,
            -7.4450 + (Math.random() - 0.5) * 0.01,
            112.7150 + (Math.random() - 0.5) * 0.01,
            zone.id,
            txDate.toISOString(),
          ]
        );
        totalTrx++;
      }
    }
    console.log(`✅ ${totalTrx} transaksi penjualan historis berhasil dibuat.`);

    // 5. Tandai status sistem demo sebagai sudah terinisialisasi
    await pool.query(`
      INSERT INTO system_settings (key, value, description)
      VALUES 
        ('SYSTEM_INITIALIZED', 'true', 'Status Inisialisasi Pertama Sistem'),
        ('SYSTEM_SETUP_CURRENT_STEP', 'COMPLETED', 'Tahapan Wizard Setup')
      ON CONFLICT (key) DO UPDATE SET
        value = EXCLUDED.value,
        updated_at = CURRENT_TIMESTAMP;
    `);

    console.log("\n================================================================================");
    console.log("🎉 SEEDING DEMO & PRESENTASI SELESAI SUKSES!");
    console.log("================================================================================");
    console.log(" Akun Demo Tersedia (Password: password123):");
    console.log("  • Super Admin : superadmin@kopikeliling.com");
    console.log("  • Management  : management@kopikeliling.com");
    console.log("  • Supervisor  : supervisor@kopikeliling.com");
    console.log("  • Riders      : rider@kopikeliling.com, rider2 s/d rider5");
    console.log("================================================================================\n");
  } catch (err: any) {
    console.error("💥 Gagal menjalankan demo seeding:", err.message);
  } finally {
    await pool.end();
  }
}

runDemoSeeding();
