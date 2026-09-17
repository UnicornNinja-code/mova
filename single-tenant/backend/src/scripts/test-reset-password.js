/*
 * test-reset-password.js
 * CLI Test Script for Password Reset Flow (forgotPasswordService -> resetPasswordService -> loginService)
 */

import { forgotPasswordService, resetPasswordService, loginService } from "../services/authService.js";
import { pool } from "../config/database.js";
import bcrypt from "bcrypt";

async function testResetPasswordFlow() {
  console.log("\n================================================================================");
  console.log("🧪 MEMULAI PENGUJIEN BACKEND PASSWORD RESET FLOW");
  console.log("================================================================================");

  const testEmail = "superadmin@kopikeliling.com";
  const tempNewPassword = "newpassword123_temp";
  const originalPassword = "password123";

  try {
    // 1. [TES 1] Request Forgot Password Token
    console.log(`\n🔑 [TES 1] Meminta Token Reset Password untuk Email: ${testEmail}...`);
    const forgotRes = await forgotPasswordService(testEmail);
    
    if (!forgotRes || !forgotRes.resetToken) {
      throw new Error("Gagal mendapatkan resetToken dari forgotPasswordService.");
    }
    const token = forgotRes.resetToken;
    console.log(`✅ Token Reset Berhasil Dibuat: '${token.slice(0, 16)}...'`);

    // 2. [TES 2] Execute Password Reset via Token
    console.log(`\n🔒 [TES 2] Memperbarui Kata Sandi Pengguna Menggunakan Token...`);
    const resetRes = await resetPasswordService({ token, password: tempNewPassword });
    console.log(`✅ Status Respon Backend: ${resetRes.msg}`);

    // 3. [TES 3] Test Login with New Password
    console.log(`\n🔓 [TES 3] Menguji Login Menggunakan Kata Sandi Baru ('${tempNewPassword}')...`);
    const loginRes = await loginService({ identifier: testEmail, password: tempNewPassword });
    console.log(`✅ Login Berhasil! User ID: '${loginRes.user.id}', Role: '${loginRes.user.role}'`);

    // 4. Restore original password so seed data remains clean
    console.log(`\n🧹 [CLEANUP] Mengembalikan Kata Sandi Asli ('${originalPassword}')...`);
    const hashedOriginal = await bcrypt.hash(originalPassword, 10);
    await pool.query("UPDATE users SET password = $1 WHERE email = $2;", [hashedOriginal, testEmail]);
    console.log("✅ Kata Sandi Asli Berhasil Dikembalikan!");

    console.log("\n================================================================================");
    console.log("🎉 Pengujian Backend Password Reset Flow Selesai 100% Sempurna!");
    console.log("================================================================================\n");

  } catch (error) {
    console.error("💥 Error saat menguji Reset Password Flow:", error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

testResetPasswordFlow();
