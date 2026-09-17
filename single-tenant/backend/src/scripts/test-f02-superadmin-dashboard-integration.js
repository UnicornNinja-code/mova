/*
 * test-f02-superadmin-dashboard-integration.js
 * Comprehensive Verification Test Suite for Milestone F-02:
 * SuperAdmin Dashboard Integration & UI Foundation Refactor
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";
import { app } from "../../index.js";
import { env } from "../config/env.js";
import { pool } from "../config/database.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_DIR = path.resolve(__dirname, "../../../frontend");

function assert(condition, message) {
  if (!condition) {
    console.error(`  ❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✅ [PASS] ${message}`);
}

async function runF02Tests() {
  console.log("================================================================================");
  console.log("🚀 STARTING MILESTONE F-02: SUPERADMIN DASHBOARD INTEGRATION & UI FOUNDATION");
  console.log("================================================================================");

  // ---------------------------------------------------------------------------
  // 1. Source Code Audit: Hardcoded Production Data Removal
  // ---------------------------------------------------------------------------
  console.log("\n🔍 1. Auditing SuperAdminDashboardPage Source for Mock Data Removal...");
  const dashboardSourcePath = path.join(FRONTEND_DIR, "src/pages/superadmin/SuperAdminDashboardPage.jsx");
  const dashboardSource = fs.readFileSync(dashboardSourcePath, "utf-8");

  assert(!dashboardSource.includes("volumeChartData = ["), "volumeChartData hardcoded array is REMOVED");
  assert(!dashboardSource.includes("bwmWeights = ["), "bwmWeights hardcoded array is REMOVED");
  assert(!dashboardSource.includes("|| 18"), "totalZonesCount fallback to 18 is REMOVED");
  assert(!dashboardSource.includes("Rp 18.45M"), "revenueTotal fallback to 'Rp 18.45M' is REMOVED");
  assert(!dashboardSource.includes("94.6% Avg Accuracy"), "Static '94.6% Avg Accuracy' is REMOVED");
  assert(!dashboardSource.includes("Valid CR: 0.034"), "Static 'Valid CR: 0.034' is REMOVED");

  assert(dashboardSource.includes("analyticsService.getOverview"), "Dashboard integrates analyticsService.getOverview");
  assert(dashboardSource.includes("dssService.getActiveDssConfig"), "Dashboard integrates dssService.getActiveDssConfig");
  assert(dashboardSource.includes("analyticsService.exportDailyReport"), "Dashboard integrates exportDailyReport CSV CTA");
  assert(dashboardSource.includes("queryKeys.analytics.overview"), "Dashboard uses structured queryKeys.analytics.overview");

  // ---------------------------------------------------------------------------
  // 2. UI Foundation & Design System Tokens Verification
  // ---------------------------------------------------------------------------
  console.log("\n🎨 2. Verifying MOVA Design System Tokens & UI Primitives Foundation...");

  const tokensPath = path.join(FRONTEND_DIR, "src/styles/tokens.css");
  assert(fs.existsSync(tokensPath), "src/styles/tokens.css exists");
  const tokensContent = fs.readFileSync(tokensPath, "utf-8");

  assert(tokensContent.includes("--mova-bg-page: #FAFAFA"), "Tokens define neutral page background #FAFAFA");
  assert(tokensContent.includes("--mova-bg-panel: #FFFFFF"), "Tokens define panel background #FFFFFF");
  assert(tokensContent.includes("--mova-border: #E5E5E5"), "Tokens define border #E5E5E5");
  assert(tokensContent.includes("--mova-primary-600: #2563EB"), "Tokens define primary-600 #2563EB");
  assert(tokensContent.includes("--mova-radius-panel: 12px"), "Tokens define panel radius 12px");
  assert(tokensContent.includes("--mova-radius-control: 8px"), "Tokens define control radius 8px");
  assert(tokensContent.includes("Inter"), "Tokens define Inter as primary font family");

  const indexCssPath = path.join(FRONTEND_DIR, "src/index.css");
  const indexCssContent = fs.readFileSync(indexCssPath, "utf-8");
  assert(indexCssContent.includes('./styles/tokens.css'), "index.css imports tokens.css");

  // Check UI Primitives
  assert(fs.existsSync(path.join(FRONTEND_DIR, "src/components/ui/Panel.jsx")), "Panel.jsx primitive exists");
  assert(fs.existsSync(path.join(FRONTEND_DIR, "src/components/ui/SemanticMetric.jsx")), "SemanticMetric.jsx primitive exists");
  assert(fs.existsSync(path.join(FRONTEND_DIR, "src/components/ui/EmptyState.jsx")), "EmptyState.jsx primitive exists");
  assert(fs.existsSync(path.join(FRONTEND_DIR, "src/components/ui/ErrorFallbackBanner.jsx")), "ErrorFallbackBanner.jsx primitive exists");
  assert(fs.existsSync(path.join(FRONTEND_DIR, "src/components/ui/LoadingSkeleton.jsx")), "LoadingSkeleton.jsx primitive exists");

  const uiIndexPath = path.join(FRONTEND_DIR, "src/components/ui/index.js");
  const uiIndexContent = fs.readFileSync(uiIndexPath, "utf-8");
  assert(uiIndexContent.includes("Panel.jsx"), "ui/index.js exports Panel.jsx");
  assert(uiIndexContent.includes("SemanticMetric.jsx"), "ui/index.js exports SemanticMetric.jsx");
  assert(uiIndexContent.includes("EmptyState.jsx"), "ui/index.js exports EmptyState.jsx");
  assert(uiIndexContent.includes("ErrorFallbackBanner.jsx"), "ui/index.js exports ErrorFallbackBanner.jsx");
  assert(uiIndexContent.includes("LoadingSkeleton.jsx"), "ui/index.js exports LoadingSkeleton.jsx");

  // ---------------------------------------------------------------------------
  // 3. RBAC Projection & Financial Masking Verification
  // ---------------------------------------------------------------------------
  console.log("\n🛡️ 3. Testing RBAC Field-Level Projection on Analytics Service...");

  const { reportingService } = await import("../services/analytics/ReportingService.js");

  // SUPERADMIN Request
  const adminOverview = await reportingService.getUnifiedDashboardOverview("SUPERADMIN");
  assert(adminOverview.role_projection === "SUPERADMIN", "SUPERADMIN receives role_projection 'SUPERADMIN'");
  assert(adminOverview.sales.summary.total_revenue.formatted !== "PROTECTED_ROLE", "SUPERADMIN sees unmasked total_revenue");

  // SUPERVISOR Request
  const supOverview = await reportingService.getUnifiedDashboardOverview("SUPERVISOR");
  assert(supOverview.role_projection === "SUPERVISOR", "SUPERVISOR receives role_projection 'SUPERVISOR'");
  assert(supOverview.sales.summary.total_revenue.formatted === "PROTECTED_ROLE", "SUPERVISOR has macro total_revenue masked to 'PROTECTED_ROLE'");
  assert(supOverview.operational.population !== undefined, "SUPERVISOR receives full operational population metrics");
  assert(supOverview.compliance.telemetry_kpis !== undefined, "SUPERVISOR receives full spatial telemetry KPIs");

  // ---------------------------------------------------------------------------
  // 4. BWM Active Weights Contract Integration
  // ---------------------------------------------------------------------------
  console.log("\n📐 4. Testing DSS Active BWM Weights Contract Integration...");
  const { bwmRepository } = await import("../repositories/bwmRepository.js");
  const activeConfig = await bwmRepository.findActiveConfig();
  assert(activeConfig !== undefined, "Active BWM config query executes cleanly");

  console.log("\n================================================================================");
  console.log("🏆 MILESTONE F-02 VERIFICATION COMPLETE: ALL ASSERTIONS PASSED (0 FAILURES)");
  console.log("================================================================================");
}

runF02Tests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Fatal Verification Failure:", err);
    process.exit(1);
  });
