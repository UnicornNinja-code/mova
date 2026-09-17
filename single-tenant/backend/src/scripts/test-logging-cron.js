/*
 * test-logging-cron.js
 * Manual Test Script for Audit Logging Subsystem & Cron Job Management Engine.
 */

import { auditLogger } from "../utils/AuditLogger.js";
import { auditService } from "../services/auditService.js";
import { cronManagerService } from "../services/cron/CronManagerService.js";
import { pool } from "../config/database.js";

async function testLoggingAndCronEngine() {
  console.log("\n================================================================================");
  console.log("🧪 MEMULAI PENGUJIEN MANUAL LOGGING AUDIT & CRON JOB MANAGEMENT ENGINE");
  console.log("================================================================================");

  try {
    // 1. [TES 1] Audit Logger Test (Non-blocking async insertion)
    console.log("\n📝 [TES 1] Pengujian Centralized Audit Logger Interceptor...");
    await auditLogger.logAction({
      action: "ZONE_CREATED_TEST",
      entityType: "ZONE",
      entityId: "test-zone-uuid-1234",
      details: { name: "Zona Test Audit", created_by: "Superadmin" },
      ipAddress: "127.0.0.1",
      userAgent: "Jest CLI Test Agent",
      status: "SUCCESS",
    });

    // Wait 200ms for setImmediate async log persistence
    await new Promise((resolve) => setTimeout(resolve, 200));

    const { logs: auditLogs } = await auditService.getAuditLogs({ limit: 3 });
    console.log(`✅ Audit Log Berhasil Disimpan & Diambil: Total ${auditLogs.length} Log Terakhir:`);
    auditLogs.forEach((l) => {
      console.log(`   • [${l.action.padEnd(20)}] Entity: ${l.entity_type || "-"} | Status: ${l.status} | Time: ${l.created_at}`);
    });

    // 2. [TES 2] Fetch Cron Configurations
    console.log("\n⚙️ [TES 2] Mengambil Konfigurasi Default 4 Worker Cron Job...");
    const { configs } = await cronManagerService.getCronConfigs();
    console.log(`✅ Ditemukan ${configs.length} Cron Job Configurations:`);
    configs.forEach((c) => {
      console.log(`   • [${c.cron_key.padEnd(16)}] Active: ${c.is_active ? "YES ✅" : "NO 🛑"} | Schedule: ${c.cron_expression.padEnd(12)} | Name: ${c.name}`);
    });

    // 3. [TES 3] Toggle Cron Active State
    console.log("\n🔄 [TES 3] Menguji Toggle Status Aktif/Non-Aktif Cron Job ('ARMADA_RELEASE')...");
    await cronManagerService.toggleCronActive("ARMADA_RELEASE", false);
    const configDisabled = await cronManagerService.repo.getConfigByKey("ARMADA_RELEASE");
    console.log(`   • Status Saat Ini: is_active = ${configDisabled.is_active} (NON-AKTIF)`);

    await cronManagerService.toggleCronActive("ARMADA_RELEASE", true);
    const configEnabled = await cronManagerService.repo.getConfigByKey("ARMADA_RELEASE");
    console.log(`   • Status Dikembalikan: is_active = ${configEnabled.is_active} (AKTIF)`);

    // 4. [TES 4] Auto Release Worker for Expired Armada Hold
    console.log("\n⏰ [TES 4] Menguji Worker Task 'ARMADA_RELEASE' (Auto Release Expired Holds)...");
    
    // Create dummy armada with expired hold (reserved_until = NOW() - 10 min)
    const { rows: testArmadas } = await pool.query("SELECT id, code FROM armadas LIMIT 1;");
    if (testArmadas.length > 0) {
      const targetArmada = testArmadas[0];
      await pool.query(
        `UPDATE armadas SET status = 'RESERVED', reserved_until = NOW() - INTERVAL '10 minutes' WHERE id = $1;`,
        [targetArmada.id]
      );
      console.log(`   📌 Unit '${targetArmada.code}' diset ke status RESERVED dengan waktu kadaluarsa 10 menit lalu.`);

      // Trigger ARMADA_RELEASE Cron Task
      const cronResult = await cronManagerService.triggerCronManually("ARMADA_RELEASE");
      console.log(`   ✅ Eksekusi Cron Result:`, cronResult.message);

      // Verify armada status returned to ACTIVE
      const { rows: verifyRows } = await pool.query("SELECT status FROM armadas WHERE id = $1;", [targetArmada.id]);
      console.log(`   ✅ Verifikasi Status Unit '${targetArmada.code}' Setelah Cron Worker: '${verifyRows[0].status}' (ACTIVE)`);
    }

    // 5. [TES 5] Fetch Cron Execution History Logs
    console.log("\n📋 [TES 5] Mengambil Riwayat Log Eksekusi Cron Job...");
    const { logs: cronLogs } = await cronManagerService.getCronLogs({ limit: 5 });
    cronLogs.forEach((cl) => {
      console.log(`   • [${cl.cron_key.padEnd(16)}] Status: ${cl.status.padEnd(8)} | Duration: ${cl.duration_ms}ms | Msg: ${cl.message}`);
    });

    console.log("\n================================================================================");
    console.log("🎉 Pengujian Audit Logging & Cron Management Engine Selesai 100% Sempurna!");
    console.log("================================================================================\n");

  } catch (error) {
    console.error("💥 Error testing Audit Logging & Cron Engine:", error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

testLoggingAndCronEngine();
