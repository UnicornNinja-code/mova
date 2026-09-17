/*
 * seed_superadmin_first_login_test.ts
 * Seeder untuk membuat / me-reset akun Super Admin khusus testing first_login flow.
 *
 * Akun yang dibuat:
 *   Email    : superadmin.test@kopikeliling.com
 *   Password : TempPass123! (password sementara — harus diganti via FirstLoginPage)
 *   Role     : SUPERADMIN
 *   is_active: true
 *   first_login: true ← trigger mandatory password change flow
 *
 * Jalankan:
 *   bun src/scripts/seed_superadmin_first_login_test.ts
 *
 * Cara reset ke kondisi awal (untuk mengulang test):
 *   bun src/scripts/seed_superadmin_first_login_test.ts --reset
 */

import { pool } from "../config/database.js";
import { hashPassword } from "../utils/crypto.js";
import { redisClient } from "../config/redis.js";

const TEST_EMAIL = "superadmin.test@kopikeliling.com";
const TEST_USERNAME = "superadmin_test";
const TEST_TEMP_PASSWORD = "TempPass123!";
const TEST_NAME = "Super Admin (Test First-Login)";

async function seedTestSuperAdmin() {
  console.log("🌱 Menyiapkan akun Super Admin untuk testing first_login flow...\n");

  const hashedTempPassword = await hashPassword(TEST_TEMP_PASSWORD);

  // Upsert akun test — jika sudah ada, reset ke kondisi awal (first_login = true)
  const result = await pool.query(
    `
    INSERT INTO users (email, username, password, name, role, is_active, first_login)
    VALUES ($1, $2, $3, $4, 'SUPERADMIN'::"Role", true, true)
    ON CONFLICT (email) DO UPDATE SET
      username   = EXCLUDED.username,
      password   = EXCLUDED.password,
      name       = EXCLUDED.name,
      role       = EXCLUDED.role,
      is_active  = true,
      first_login = true,
      updated_at = CURRENT_TIMESTAMP
    RETURNING id, email, username, role, is_active, first_login;
    `,
    [TEST_EMAIL, TEST_USERNAME, hashedTempPassword, TEST_NAME]
  );

  const user = result.rows[0];

  // Bersihkan rate-limit Redis untuk akun test agar tidak kena progressive challenge
  try {
    await redisClient.del([
      `auth:failed:user:${TEST_EMAIL}`,
      `auth:failed:user:${TEST_USERNAME}`,
    ]);
    console.log("✅ Redis rate-limit counter untuk akun test berhasil dibersihkan.");
  } catch (redisErr: any) {
    console.warn("⚠️  Gagal membersihkan Redis (opsional):", redisErr.message);
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✅  AKUN TEST SIAP");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`📧  Email        : ${user.email}`);
  console.log(`👤  Username     : ${user.username}`);
  console.log(`🔑  Password Tmp : ${TEST_TEMP_PASSWORD}`);
  console.log(`🎭  Role         : ${user.role}`);
  console.log(`✔️  is_active    : ${user.is_active}`);
  console.log(`⚡  first_login  : ${user.first_login}  ← Flow wajib aktif`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("\n📋  LANGKAH PENGUJIAN:");
  console.log("  1. Buka browser → http://localhost:5173/login");
  console.log(`  2. Login dengan: ${TEST_EMAIL} / ${TEST_TEMP_PASSWORD}`);
  console.log("  3. Harusnya langsung diarahkan ke /first-login");
  console.log("  4. Ganti password → klik 'Perbarui Password & Mulai Bertugas'");
  console.log("  5. Harusnya diarahkan ke /dashboard setelah berhasil");
  console.log("  6. Login ulang → harusnya langsung ke /dashboard (first_login = false)");
  console.log("\n  Untuk mengulang test dari awal:");
  console.log("  bun src/scripts/seed_superadmin_first_login_test.ts\n");
}

async function main() {
  try {
    await seedTestSuperAdmin();
  } catch (err: any) {
    console.error("❌ Seeder gagal:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
    await redisClient.quit();
  }
}

main();
