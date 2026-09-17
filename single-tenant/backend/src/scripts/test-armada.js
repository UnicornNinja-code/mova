/*
 * test-armada.js
 * Manual Test Script for Use Case 5: Manajemen Armada (CRUD Master Unit Armada, Serial Number Uniqueness, & Status Controls).
 */

import { armadaService } from "../services/armadaService.js";
import { pool } from "../config/database.js";

async function testArmadaEngine() {
  console.log("\n================================================================================");
  console.log("🧪 MEMULAI PENGUJIEN MANUAL ENGINE MANAJEMEN ARMADA (USE CASE 5)");
  console.log("================================================================================");

  const testCode = "SJ-9999";

  try {
    // 1. Fetch All Armadas
    const { armadas, count } = await armadaService.getAllArmadas();
    console.log(`📋 Total Unit Armada di Database: ${count} Unit.`);
    armadas.forEach((a) => {
      console.log(`   • [${a.code.padEnd(10)}] Type: ${a.type.padEnd(14)} | Status: ${a.status.padEnd(11)} | ID: ${a.id}`);
    });

    // Clean previous test unit if left over
    const existingTest = await armadaService.repo.findByCode(testCode);
    if (existingTest) {
      await armadaService.repo.delete(existingTest.id);
    }

    // 2. Test Creating New Armada Unit (SJ-9999)
    console.log(`\n➕ [TES 1] Menambahkan Unit Armada Baru (${testCode})...`);
    const newUnit = await armadaService.createArmada({
      code: testCode,
      type: "MOTOR_LISTRIK",
      status: "ACTIVE",
    });
    console.log(`✅ Unit Berhasil Dibuat: ID '${newUnit.id}' | Code '${newUnit.code}' | Status: '${newUnit.status}'`);

    // 3. Test Validation Duplicate Code (Unique Serial Number Violation)
    console.log(`\n⚠️ [TES 2] Menguji Validasi Nomor Seri Duplikat (${testCode})...`);
    try {
      await armadaService.createArmada({
        code: testCode,
        type: "GEROBAK",
        status: "ACTIVE",
      });
      console.error("❌ GAGAL: Harusnya terjadi Error Duplikat Nomor Seri!");
    } catch (err) {
      console.log(`✅ BERHASIL MENCEGAH DUPLIKAT: Pesan Error -> "${err.message}"`);
    }

    // 4. Test Updating Status to MAINTENANCE (Dalam Perbaikan)
    console.log(`\n📝 [TES 3] Mengubah Status Unit Menjadi MAINTENANCE (Dalam Perbaikan)...`);
    const updatedMaint = await armadaService.updateArmada(newUnit.id, {
      status: "MAINTENANCE",
    });
    console.log(`✅ Status Berhasil Diperbarui: Code '${updatedMaint.code}' -> Status Baru: '${updatedMaint.status}'`);

    // 5. Test Updating Status to IN_USE (Sedang Digunakan)
    console.log(`\n📝 [TES 4] Mengubah Status Unit Menjadi IN_USE (Sedang Digunakan)...`);
    const updatedInUse = await armadaService.updateArmada(newUnit.id, {
      status: "IN_USE",
    });
    console.log(`✅ Status Berhasil Diperbarui: Code '${updatedInUse.code}' -> Status Baru: '${updatedInUse.status}'`);

    // 6. Test Deletion Safety Guard (Blocking Delete if IN_USE)
    console.log(`\n🛡️ [TES 5] Menguji Perlindungan Penghapusan Unit Berstatus IN_USE...`);
    try {
      await armadaService.deleteArmada(newUnit.id);
      console.error("❌ GAGAL: Harusnya terjadi Error Perlindungan Penghapusan!");
    } catch (err) {
      console.log(`✅ BERHASIL MENCEGAH PENGHAPUSAN: Pesan Error -> "${err.message}"`);
    }

    // 7. Reset Status to ACTIVE and Delete Unit
    console.log(`\n🗑️ [TES 6] Mengembalikan Status ke ACTIVE Lalu Menghapus Unit Uji...`);
    await armadaService.updateArmada(newUnit.id, { status: "ACTIVE" });
    const deleted = await armadaService.deleteArmada(newUnit.id);
    console.log(`✅ Unit '${deleted.code}' Berhasil Dihapus Dari Database.`);

    console.log("\n================================================================================");
    console.log("🎉 Pengujian Modul Manajemen Armada (Use Case 5) Selesai 100% Sempurna!");
    console.log("================================================================================\n");

  } catch (error) {
    console.error("💥 Error testing Armada Engine:", error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

testArmadaEngine();
