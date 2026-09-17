/*
 * test_setup_wizard.ts
 * Automated integration test for First-Run Setup Wizard endpoints
 */

import { pool } from "../config/database.js";
import { SystemSettingModel } from "../models/systemSettingModel.js";

async function runTest() {
  console.log("🧪 Memulai Pengujian Wizard Inisialisasi Sistem (System Setup Gate)...");

  try {
    // 1. Reset setup setting to uninitialized
    await SystemSettingModel.upsert("SYSTEM_INITIALIZED", "false");
    await SystemSettingModel.upsert("SYSTEM_SETUP_CURRENT_STEP", "IDENTITY");

    // 2. Test getInitializationState
    const state = await SystemSettingModel.getInitializationState();
    console.log("Step 1 State:", {
      status: state.status,
      current_step: state.current_step,
      hub_city: state.hub_config.hub_city_name,
      lat: state.hub_config.central_hub_lat,
      lng: state.hub_config.central_hub_lng,
    });

    if (state.status !== "REQUIRED" || state.current_step !== "IDENTITY") {
      throw new Error(`Status tidak sesuai ekspektasi: ${state.status} / ${state.current_step}`);
    }
    console.log("✅ Step 1: Status REQUIRED & CURRENT_STEP IDENTITY PASS!");

    // 3. Test progress step update
    await SystemSettingModel.upsert("SYSTEM_SETUP_CURRENT_STEP", "OPERATIONS");
    const stateAfterStep = await SystemSettingModel.getInitializationState();
    if (stateAfterStep.status !== "IN_PROGRESS" || stateAfterStep.current_step !== "OPERATIONS") {
      throw new Error(`State transisi gagal: ${stateAfterStep.status}`);
    }
    console.log("✅ Step 2: Transisi ke IN_PROGRESS & OPERATIONS PASS!");

    // 4. Test completeSystemInitialization
    await SystemSettingModel.completeSystemInitialization({
      system_name: "MantaKopi COZIS Enterprise",
      hub_city_name: "Sidoarjo",
      central_hub_name: "Central Hub Alun-Alun Sidoarjo",
      central_hub_address: "Jl. Cokronegoro No. 1, Sidoarjo",
      central_hub_lat: -7.4478,
      central_hub_lng: 112.7183,
      operational_radius_km: 15,
      operating_hours_start: "06:00",
      operating_hours_end: "22:00",
      timezone: "Asia/Jakarta",
    });

    const stateFinal = await SystemSettingModel.getInitializationState();
    console.log("Final State:", {
      status: stateFinal.status,
      current_step: stateFinal.current_step,
      system_name: stateFinal.hub_config.system_name,
    });

    if (stateFinal.status !== "COMPLETED") {
      throw new Error(`Final status gagal: ${stateFinal.status}`);
    }
    console.log("✅ Step 3: completeSystemInitialization -> COMPLETED PASS!");

    console.log("\n🎉 SELURUH PENGUJIAN WIZARD INISIALISASI SISTEM SUKSES (100% PASS)!\n");
  } catch (err: any) {
    console.error("❌ Test Gagal:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTest();
