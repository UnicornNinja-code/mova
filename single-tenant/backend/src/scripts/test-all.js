/*
 * test-all.js
 * Master Integration Test Suite Runner for Mobile Coffee Vendor DSS App.
 * Sequentially executes and validates all 5 Test Phases concise and clean.
 */

import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../../");

const isVerbose = process.argv.includes("--verbose");

const testPhases = [
  {
    phase: "FASE 1",
    name: "Infrastruktur Dasar, Auth, & Akses RBAC",
    script: "src/scripts/test-api.js",
  },
  {
    phase: "FASE 2",
    name: "Engine SPK (BWM Optimization & TOPSIS Recommendation)",
    script: "src/scripts/test-bwm.js",
    subScript: "src/scripts/test-topsis.js",
  },
  {
    phase: "FASE 3",
    name: "Manajemen Armada & Distribusi Rider (FIFO Queue)",
    script: "src/scripts/test-armada.js",
    subScript: "src/scripts/test-distribution.js",
  },
  {
    phase: "FASE 4",
    name: "Operasional Harian Rider & Ticket-Booking Lock",
    script: "tests/integration/test-rider-op.js",
  },
  {
    phase: "FASE 5",
    name: "Centralized Audit Logging & Dynamic Cron Engine",
    script: "src/scripts/test-logging-cron.js",
  },
];

async function runMasterTestSuite() {
  console.log("\n================================================================================");
  console.log("🚀 MASTER INTEGRATION TEST SUITE - MOBILE COFFEE VENDOR DSS APP");
  console.log(`📌 Mode Output: ${isVerbose ? "VERBOSE (FULL LOGS)" : "CONCISE (RINGKAS & RAPI)"}`);
  console.log("================================================================================\n");

  const results = [];
  const startTimeTotal = Date.now();

  for (let i = 0; i < testPhases.length; i++) {
    const item = testPhases[i];
    process.stdout.write(`⏳ [${item.phase}] ${item.name.padEnd(55)} ... `);

    const startTime = Date.now();
    let isSuccess = true;
    let errorMsg = "";

    try {
      if (isVerbose) console.log("\n");
      
      // Execute main script
      const runnerBin = process.versions.bun ? "bun" : (process.execPath || "node");
      execSync(`${runnerBin} ${item.script}`, {
        cwd: rootDir,
        stdio: isVerbose ? "inherit" : "pipe",
      });

      // Execute sub-script if present in phase
      if (item.subScript) {
        execSync(`${runnerBin} ${item.subScript}`, {
          cwd: rootDir,
          stdio: isVerbose ? "inherit" : "pipe",
        });
      }
    } catch (error) {
      isSuccess = false;
      errorMsg = error.message;
    }

    const durationMs = Date.now() - startTime;

    if (isSuccess) {
      if (!isVerbose) console.log(`PASSED ✅ (${durationMs}ms)`);
      results.push({ ...item, status: "PASSED ✅", durationMs });
    } else {
      if (!isVerbose) console.log(`FAILED ❌ (${durationMs}ms)`);
      results.push({ ...item, status: "FAILED ❌", durationMs, errorMsg });
    }
  }

  const totalDurationMs = Date.now() - startTimeTotal;
  const passedCount = results.filter((r) => r.status.includes("PASSED")).length;
  const failedCount = results.length - passedCount;

  console.log("\n================================================================================");
  console.log("📊 RINGKASAN HASIL PENGUJIAN 5 FASE SYSTEM BACKEND:");
  console.log("================================================================================");
  results.forEach((r) => {
    console.log(`   • [${r.status}] ${r.phase}: ${r.name.padEnd(52)} (${r.durationMs}ms)`);
  });
  console.log("--------------------------------------------------------------------------------");
  console.log(` Total Fase Pengujian : ${results.length} Fase`);
  console.log(` Status Kelulusan     : ${passedCount}/${results.length} Fase Lulus ${failedCount === 0 ? "✅ (100% Sempurna)" : "❌"}`);
  console.log(` Total Durasi         : ${(totalDurationMs / 1000).toFixed(2)} detik`);
  console.log("================================================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runMasterTestSuite();
