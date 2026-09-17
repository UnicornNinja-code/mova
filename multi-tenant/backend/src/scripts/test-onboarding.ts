/*
 * test-onboarding.ts
 * Automated Onboarding Lifecycle & RBAC Verification Script
 *
 * Menguji seluruh alur onboarding secara end-to-end:
 * 1. Super Admin Bootstrap & Login
 * 2. Super Admin Provisioning Akun Management (Undangan & Token)
 * 3. Verifikasi Token Undangan & Aktivasi Akun Mandiri (Set Password & Birth Date)
 * 4. Login Akun Management & Pengujian Hak Akses RBAC (Penolakan Create Superadmin)
 * 5. Management Provisioning Akun Lapangan (Supervisor & Rider)
 * 6. Aktivasi Akun Rider dengan Tanggal Lahir (birth_date)
 * 7. Simulasi Sesi Rider, Profiling, dan Refresh Token (Anti-Reload Logout)
 * 8. Penonaktifan Akun (Deactivation Lifecycle) & Verifikasi Pencegahan Akses
 */

import { pool } from "../config/database.js";
import { UserModel } from "../models/userModel.js";
import { createUserService, setUserStatusService } from "../services/userService.js";
import {
  loginService,
  registerService,
  verifyResetTokenService,
  refreshTokenService,
} from "../services/authService.js";

interface StepResult {
  step: string;
  name: string;
  status: "PASS" | "FAIL";
  details: string;
  durationMs: number;
}

const results: StepResult[] = [];

async function recordStep(step: string, name: string, fn: () => Promise<string>) {
  const start = performance.now();
  try {
    const details = await fn();
    const duration = Math.round(performance.now() - start);
    results.push({ step, name, status: "PASS", details, durationMs: duration });
    console.log(` ✅ [${step}] ${name} (${duration}ms)`);
    console.log(`    ↳ ${details}`);
  } catch (err: any) {
    const duration = Math.round(performance.now() - start);
    results.push({ step, name, status: "FAIL", details: err.message, durationMs: duration });
    console.error(` ❌ [${step}] ${name} (${duration}ms)`);
    console.error(`    ↳ ERROR: ${err.message}`);
    throw err;
  }
}

async function runOnboardingTest() {
  console.log("================================================================================");
  console.log("🚀 MEMULAI PENGUJIAN END-TO-END ONBOARDING LIFECYCLE (COZIS DSS)");
  console.log("================================================================================\n");

  const timestamp = Date.now().toString().slice(-6);
  const testManagementEmail = `mgt.test.${timestamp}@kopikeliling.com`;
  const testSupervisorEmail = `spv.test.${timestamp}@kopikeliling.com`;
  const testRiderEmail = `rider.test.${timestamp}@kopikeliling.com`;

  let superadminUser: any = null;
  let superadminToken: string = "";

  let managementInvitation: any = null;
  let managementUser: any = null;
  let managementToken: string = "";

  let supervisorInvitation: any = null;
  let riderInvitation: any = null;
  let riderUser: any = null;
  let riderToken: string = "";

  try {
    // -------------------------------------------------------------------------
    // TAHAP 1: Super Admin Authentication
    // -------------------------------------------------------------------------
    await recordStep("STEP-01", "Autentikasi Akun Super Admin", async () => {
      const loginRes = await loginService({
        identifier: "superadmin@kopikeliling.com",
        password: "password123",
      });
      superadminUser = loginRes.user;
      superadminToken = loginRes.token;
      if (!superadminToken || superadminUser.role !== "SUPERADMIN") {
        throw new Error("Gagal memvalidasi token atau role Super Admin");
      }
      return `Login sukses sebagai Super Admin: ${superadminUser.name} (${superadminUser.email})`;
    });

    // -------------------------------------------------------------------------
    // TAHAP 2: Super Admin Provisioning Akun Management
    // -------------------------------------------------------------------------
    await recordStep("STEP-02", "Super Admin Membuat Akun Management & Mengirim Undangan", async () => {
      managementInvitation = await createUserService(
        {
          name: `Budi Manajemen ${timestamp}`,
          email: testManagementEmail,
          role: "MANAGEMENT",
        },
        superadminUser
      );

      if (!managementInvitation.invitation_token || !managementInvitation.invitation_link) {
        throw new Error("Token undangan atau tautan aktivasi tidak digenerate");
      }

      // Pastikan status akun awal belum aktif (is_active = false)
      const userInDb = await UserModel.findById(managementInvitation.id);
      if (userInDb?.is_active !== false) {
        throw new Error("Status awal pengguna yang diundang harus is_active = false");
      }

      return `Akun Management dibuat: ${testManagementEmail} | Token: ${managementInvitation.invitation_token.slice(0, 10)}... | Link: ${managementInvitation.invitation_link}`;
    });

    // -------------------------------------------------------------------------
    // TAHAP 3: Verifikasi Token Undangan Management
    // -------------------------------------------------------------------------
    await recordStep("STEP-03", "Verifikasi Validitas Token Undangan Management", async () => {
      const verifyRes = await verifyResetTokenService(managementInvitation.invitation_token);
      if (!verifyRes.valid || verifyRes.email !== testManagementEmail) {
        throw new Error(`Token aktivasi tidak valid: ${verifyRes.reason}`);
      }
      return `Token terverifikasi valid untuk pengguna: ${verifyRes.name} (${verifyRes.role})`;
    });

    // -------------------------------------------------------------------------
    // TAHAP 4: Aktivasi Akun Mandiri oleh Management (Set Password & Tanggal Lahir)
    // -------------------------------------------------------------------------
    const newManagementPassword = "ManagementPass123!";
    const managementBirthDate = "1992-05-20";

    await recordStep("STEP-04", "Aktivasi Akun Management (Set Sandi Baru & Tanggal Lahir)", async () => {
      const activateRes = await registerService({
        token: managementInvitation.invitation_token,
        password: newManagementPassword,
        name: `Budi Manajemen ${timestamp}`,
        birth_date: managementBirthDate,
      });

      if (!activateRes.is_active) {
        throw new Error("Akun gagal diaktifkan setelah registrasi mandiri");
      }

      // Verifikasi kolom birth_date tersimpan di database
      const dbUser = await UserModel.findById(activateRes.id);
      if (!dbUser?.birth_date) {
        throw new Error("Kolom birth_date gagal tersimpan di database users");
      }

      return `Akun Management berhasil aktif! Status: is_active = true | Tanggal Lahir: ${managementBirthDate}`;
    });

    // -------------------------------------------------------------------------
    // TAHAP 5: Login Akun Management yang Baru Diaktifkan
    // -------------------------------------------------------------------------
    await recordStep("STEP-05", "Login dengan Kredensial Baru Management", async () => {
      const loginRes = await loginService({
        identifier: testManagementEmail,
        password: newManagementPassword,
      });
      managementUser = loginRes.user;
      managementToken = loginRes.token;
      if (!managementToken || managementUser.role !== "MANAGEMENT") {
        throw new Error("Gagal login dengan akun Management yang baru diaktifkan");
      }
      return `Login Management berhasil! Token JWT diperoleh untuk sesi operasional.`;
    });

    // -------------------------------------------------------------------------
    // TAHAP 6: Uji Batasan RBAC: Management DILARANG membuat Superadmin
    // -------------------------------------------------------------------------
    await recordStep("STEP-06", "Enforcement RBAC: Management Tidak Berhak Membuat Super Admin", async () => {
      try {
        await createUserService(
          {
            name: "Hacker Admin",
            email: `hacker.${timestamp}@kopikeliling.com`,
            role: "SUPERADMIN",
          },
          managementUser
        );
        throw new Error("VULNERABILITY: Akun Management berhasil membuat Super Admin!");
      } catch (err: any) {
        if (err.statusCode === 403) {
          return `Akses Ditolak dengan Benar (HTTP 403): ${err.message}`;
        }
        throw err;
      }
    });

    // -------------------------------------------------------------------------
    // TAHAP 7: Management Provisioning Akun Lapangan (Supervisor & Rider)
    // -------------------------------------------------------------------------
    await recordStep("STEP-07", "Management Membuat Akun Supervisor & Rider Lapangan", async () => {
      supervisorInvitation = await createUserService(
        {
          name: `Maya Supervisor ${timestamp}`,
          email: testSupervisorEmail,
          role: "SUPERVISOR",
        },
        managementUser
      );

      riderInvitation = await createUserService(
        {
          name: `Fajar Rider ${timestamp}`,
          email: testRiderEmail,
          role: "RIDER",
        },
        managementUser
      );

      return `Supervisor (${testSupervisorEmail}) & Rider (${testRiderEmail}) berhasil diundang oleh Management.`;
    });

    // -------------------------------------------------------------------------
    // TAHAP 8: Aktivasi Akun Rider Lapangan
    // -------------------------------------------------------------------------
    const riderPassword = "RiderPass123!";
    const riderBirthDate = "1998-11-10";

    await recordStep("STEP-08", "Rider Mengaktivasi Akun dengan Sandi & Tanggal Lahir", async () => {
      const activateRiderRes = await registerService({
        token: riderInvitation.invitation_token,
        password: riderPassword,
        name: `Fajar Rider ${timestamp}`,
        birth_date: riderBirthDate,
      });

      const riderInDb = await UserModel.findById(activateRiderRes.id);
      if (!riderInDb || !riderInDb.is_active || !riderInDb.birth_date) {
        throw new Error("Rider gagal aktif atau birth_date tidak terdaftar di database");
      }

      return `Rider ${riderInDb.name} aktif! Role: ${riderInDb.role} | Tanggal Lahir: ${riderBirthDate}`;
    });

    // -------------------------------------------------------------------------
    // TAHAP 9: Login Rider & Verifikasi Sesi Terhindar dari Reload Logout
    // -------------------------------------------------------------------------
    await recordStep("STEP-09", "Login Rider & Verifikasi Sesi Anti-Reload Kickout", async () => {
      const riderLoginRes = await loginService({
        identifier: testRiderEmail,
        password: riderPassword,
      });

      riderUser = riderLoginRes.user;
      riderToken = riderLoginRes.token;

      // Verifikasi query findById (yang dipanggil /api/auth/me saat reload halaman)
      const sessionUser = await UserModel.findById(riderUser.id);
      if (!sessionUser) {
        throw new Error("Sesi pengguna tidak ditemukan");
      }

      // Simulasi refresh token
      const refreshed = await refreshTokenService(riderLoginRes.refreshToken);
      if (!refreshed.token) {
        throw new Error("Refresh token gagal memperbarui access token");
      }

      return `Sesi Rider valid! Query /api/auth/me & token refresh 30-hari berjalan sempurna (Bebas dari issue reload logout).`;
    });

    // -------------------------------------------------------------------------
    // TAHAP 10: Siklus Deaktivasi Akun & Pencabutan Sesi
    // -------------------------------------------------------------------------
    await recordStep("STEP-10", "Uji Penonaktifan Akun (Deactivation) & Pencabutan Akses", async () => {
      await setUserStatusService(riderUser.id, false, superadminUser);

      const checkDeactivated = await UserModel.findById(riderUser.id);
      if (checkDeactivated?.is_active !== false) {
        throw new Error("Akun gagal dinonaktifkan");
      }

      // Coba login dengan akun nonaktif, harus gagal
      try {
        await loginService({
          identifier: testRiderEmail,
          password: riderPassword,
        });
        throw new Error("Akun nonaktif seharusnya dilarang login!");
      } catch (err: any) {
        if (err.statusCode === 403) {
          // Re-aktifkan kembali untuk memulihkan status
          await setUserStatusService(riderUser.id, true, superadminUser);
          return `Enforcement Berhasil: Pengguna berstatus is_active = false dicegat dengan HTTP 403 (${err.message}). Akun dipulihkan kembali.`;
        }
        throw err;
      }
    });

    // -------------------------------------------------------------------------
    // RINGKASAN HASIL PENGUJIAN
    // -------------------------------------------------------------------------
    console.log("\n================================================================================");
    console.log("📊 RINGKASAN HASIL PENGUJIAN ONBOARDING LIFECYCLE");
    console.log("================================================================================");
    console.table(
      results.map((r) => ({
        Langkah: r.step,
        Nama_Uji: r.name,
        Status: r.status,
        Waktu_ms: r.durationMs,
      }))
    );

    console.log("\n📋 KREDENSIAL AKUN TESTING YANG DIHASILKAN:");
    console.log("--------------------------------------------------------------------------------");
    console.log(`1. Super Admin : superadmin@kopikeliling.com | Sandi: password123`);
    console.log(`2. Management  : ${testManagementEmail} | Sandi: ${newManagementPassword}`);
    console.log(`3. Supervisor  : ${testSupervisorEmail} | Tautan: ${supervisorInvitation.invitation_link}`);
    console.log(`4. Rider       : ${testRiderEmail} | Sandi: ${riderPassword}`);
    console.log("--------------------------------------------------------------------------------");
    console.log("🎉 SELURUH SKENARIO ONBOARDING TERVERIFIKASI 100% SUKSES DAN SIAP DIGUNAKAN!\n");
  } catch (error: any) {
    console.error("\n💥 PENGUJIAN ONBOARDING GAGAL PADA TAHAP DI ATAS:", error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runOnboardingTest();
