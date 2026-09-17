import { pool } from "../config/database.js";
import { hashPassword } from "../utils/crypto.js";
import { redisClient } from "../config/redis.js";

async function resetOnboarding() {
  console.log("🌱 Mereset status sistem ke ONBOARDING REQUIRED...");

  // 1. Reset system_settings
  await pool.query(`
    INSERT INTO system_settings (key, value, description)
    VALUES 
      ('SYSTEM_INITIALIZED', 'false', 'Status Inisialisasi Pertama Sistem'),
      ('SYSTEM_SETUP_CURRENT_STEP', 'IDENTITY', 'Tahapan Wizard Setup')
    ON CONFLICT (key) DO UPDATE SET
      value = EXCLUDED.value,
      updated_at = CURRENT_TIMESTAMP;
  `);

  // 2. Ensure superadmin test user has first_login = false (password already changed)
  const hashedPw = await hashPassword("SuperStrongPass2026!");
  await pool.query(`
    INSERT INTO users (email, username, password, name, role, is_active, first_login)
    VALUES ('superadmin.test@kopikeliling.com', 'superadmin_test', $1, 'Super Admin Test', 'SUPERADMIN'::"Role", true, false)
    ON CONFLICT (email) DO UPDATE SET
      password = $1,
      first_login = false,
      is_active = true,
      updated_at = CURRENT_TIMESTAMP;
  `, [hashedPw]);

  // 3. Clear Redis rate limit
  try {
    await redisClient.del([
      'auth:failed:user:superadmin.test@kopikeliling.com',
      'auth:failed:user:superadmin_test',
    ]);
  } catch {}

  console.log("✅ Sistem berhasil direset! Akun superadmin.test@kopikeliling.com siap login dan akan langsung masuk ke /onboarding/session-1.");
  process.exit(0);
}

resetOnboarding();
