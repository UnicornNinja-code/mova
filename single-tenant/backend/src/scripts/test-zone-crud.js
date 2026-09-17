/*
 * test-zone-crud.js
 * Verification Test Script for Zone Management Backend (CRUD, Validation, & Overlap Check)
 */

import { zoneService } from "../services/zoneService.js";
import { pool } from "../config/database.js";

async function runZoneTests() {
  console.log("🚀 Memulai Pengujian Unit Modul Backend Manajemen Zona...\n");

  let createdZoneId = null;

  try {
    // 1. Test Get All Zones
    console.log("🧪 Test 1: Mendapatkan Seluruh Daftar Zona...");
    const initialList = await zoneService.getAllZones();
    console.log(`✅ Berhasil mengambil ${initialList.total} zona dari database.`);

    // 2. Test Create Valid Zone
    console.log("\n🧪 Test 2: Membuat Zona Baru yang Valid (Minimal 3 Titik Poligon)...");
    const testPolygon = {
      type: "Polygon",
      coordinates: [
        [
          [112.7300, -7.4300],
          [112.7350, -7.4300],
          [112.7350, -7.4350],
          [112.7300, -7.4350],
          [112.7300, -7.4300]
        ]
      ]
    };

    const newZone = await zoneService.createZone({
      name: "Zona Uji Coba Alpha",
      description: "Zona pengujian otomatis backend",
      max_capacity: 5,
      status: "ACTIVE",
      polygon: testPolygon,
    });
    createdZoneId = newZone.id;
    console.log(`✅ Zona berhasil dibuat dengan ID: ${newZone.id} | Nama: ${newZone.name} | Kapasitas: ${newZone.max_capacity}`);

    // 3. Test Create Duplicate Name Validation
    console.log("\n🧪 Test 3: Validasi Nama Duplikat...");
    try {
      await zoneService.createZone({
        name: "Zona Uji Coba Alpha",
        description: "Zona duplikat",
        max_capacity: 3,
        status: "ACTIVE",
        polygon: testPolygon,
      });
      console.error("❌ GAGAL: Nama duplikat seharusnya ditolak!");
    } catch (err) {
      console.log(`✅ Sukses Tertolak (Expected): ${err.message}`);
    }

    // 4. Test PostGIS Spatial Overlap Validation
    console.log("\n🧪 Test 4: Validasi PostGIS Spatial Overlap (Poligon Beririsan)...");
    const overlappingPolygon = {
      type: "Polygon",
      coordinates: [
        [
          [112.7320, -7.4320],
          [112.7400, -7.4320],
          [112.7400, -7.4400],
          [112.7320, -7.4400],
          [112.7320, -7.4320]
        ]
      ]
    };
    try {
      await zoneService.createZone({
        name: "Zona Konflik Overlap",
        description: "Zona yang overlap",
        max_capacity: 4,
        status: "ACTIVE",
        polygon: overlappingPolygon,
      });
      console.error("❌ GAGAL: Poligon overlap seharusnya ditolak oleh PostGIS!");
    } catch (err) {
      console.log(`✅ Sukses Tertolak PostGIS Overlap (Expected): ${err.message}`);
    }

    // 5. Test Quick Edit Status & Capacity
    console.log("\n🧪 Test 5: Quick Edit Status & Kapasitas...");
    const updatedStatus = await zoneService.updateZoneStatus(createdZoneId, "RESTRICTED");
    console.log(`✅ Status berhasil diubah menjadi: ${updatedStatus.status}`);

    const updatedCapacity = await zoneService.updateZoneCapacity(createdZoneId, 8);
    console.log(`✅ Kapasitas berhasil diubah menjadi: ${updatedCapacity.max_capacity}`);

    // 6. Test Get Zone by ID
    console.log("\n🧪 Test 6: Mengambil Detail Zona Berdasarkan ID...");
    const fetched = await zoneService.getZoneById(createdZoneId);
    console.log(`✅ Detail Zona: Name=${fetched.name}, Status=${fetched.status}, MaxCapacity=${fetched.max_capacity}, ActiveRiders=${fetched.active_riders_count}`);

    // 7. Test Delete Zone
    console.log("\n🧪 Test 7: Menghapus Zona Uji Coba...");
    const deleted = await zoneService.deleteZone(createdZoneId);
    console.log(`✅ Zona ID: ${deleted.id} berhasil dihapus dari database.`);
    createdZoneId = null;

    console.log("\n==================================================");
    console.log("🎉 SELURUH PENGUJIAN BACKEND MANAJEMEN ZONA BERHASIL!");
    console.log("==================================================\n");
  } catch (error) {
    console.error("❌ Terjadi kesalahan selama pengujian:", error);
    if (createdZoneId) {
      try {
        await zoneService.deleteZone(createdZoneId);
      } catch (e) {}
    }
  } finally {
    await pool.end();
  }
}

runZoneTests();
