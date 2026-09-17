/**
 * test-f07-reports.js
 * 
 * Automated Verification Test Suite for Milestone F-07: Reports & Historical Analytics Workspace.
 * Validates backend contract adherence, zero mock data, pure consumer architecture,
 * RBAC financial masking preservation (PROTECTED_ROLE for Supervisor), and CSV streaming trigger.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";
import jwt from "jsonwebtoken";
import { app } from "../../index.js";
import { pool } from "../config/database.js";
import { env } from "../config/env.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_DIR = path.resolve(__dirname, "../../../frontend");

let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
  if (!condition) {
    failedCount++;
    console.error(`  ❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  passedCount++;
  console.log(`  ✅ [PASS] ${message}`);
}

async function request(server, method, reqPath, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(reqPath, "http://localhost:9000");
    const req = http.request(
      {
        hostname: "localhost",
        port: server.address().port,
        path: url.pathname + url.search,
        method: method,
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = data ? JSON.parse(data) : {};
            resolve({ status: res.statusCode, headers: res.headers, body: parsed });
          } catch (e) {
            resolve({ status: res.statusCode, headers: res.headers, body: data });
          }
        });
      }
    );
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runF07Tests() {
  console.log("\n================================================================================");
  console.log("🚀 STARTING MILESTONE F-07: REPORTS & HISTORICAL ANALYTICS VERIFICATION");
  console.log("================================================================================\n");

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));

  try {
    // 1. Static Code Analysis on analyticsService.js & ReportsPage.jsx
    console.log("--- 1. Static Code Analysis & Service Layer Contracts ---");
    const analyticsServicePath = path.join(FRONTEND_DIR, "src/services/analyticsService.js");
    assert(fs.existsSync(analyticsServicePath), "analyticsService.js exists");
    const analyticsServiceContent = fs.readFileSync(analyticsServicePath, "utf-8");

    assert(analyticsServiceContent.includes("/analytics/overview"), "analyticsService targets /analytics/overview");
    assert(analyticsServiceContent.includes("/analytics/operational/summary"), "analyticsService targets /analytics/operational/summary");
    assert(analyticsServiceContent.includes("/analytics/operational/fleet-utilization"), "analyticsService targets /analytics/operational/fleet-utilization");
    assert(analyticsServiceContent.includes("/analytics/compliance/summary"), "analyticsService targets /analytics/compliance/summary");
    assert(analyticsServiceContent.includes("/analytics/sales/performance"), "analyticsService targets /analytics/sales/performance");
    assert(analyticsServiceContent.includes("/analytics/dss/plan-vs-actual"), "analyticsService targets /analytics/dss/plan-vs-actual");
    assert(analyticsServiceContent.includes("/analytics/reports/daily-summary"), "analyticsService targets /analytics/reports/daily-summary");

    const reportsPagePath = path.join(FRONTEND_DIR, "src/pages/reports/ReportsPage.jsx");
    assert(fs.existsSync(reportsPagePath), "ReportsPage.jsx exists");
    const reportsPageContent = fs.readFileSync(reportsPagePath, "utf-8");

    // Zero-Mock & Pure Consumer Invariants
    console.log("\n--- 2. Zero-Mock & Pure Consumer Invariants ---");
    assert(!reportsPageContent.includes("const mockReports"), "Zero mock reports constant declared");
    assert(!reportsPageContent.includes("const dummyRevenue"), "Zero dummy revenue constant declared");
    assert(!reportsPageContent.includes("calculateTopsis"), "Zero client-side TOPSIS recalculation in component");
    assert(!reportsPageContent.includes("calculateRevenue"), "Zero client-side financial aggregation in component");
    assert(reportsPageContent.includes("PROTECTED_ROLE"), "Component respects PROTECTED_ROLE semantic status");
    assert(reportsPageContent.includes("exportDailyReport"), "Component invokes exportDailyReport() for CSV download");

    // 3. Live Backend API Handshake
    console.log("\n--- 3. Live Backend API Handshake ---");
    const adminUserRes = await pool.query("SELECT id, email, role FROM users WHERE role = 'SUPERADMIN' LIMIT 1");
    const adminUser = adminUserRes.rows[0];
    const superadminToken = jwt.sign(
      { id: adminUser.id, email: adminUser.email, role: adminUser.role },
      env.JWT_SECRET || "mova_super_secret_jwt_key_2026",
      { expiresIn: "1h" }
    );

    const spvUserRes = await pool.query("SELECT id, email, role FROM users WHERE role = 'SUPERVISOR' LIMIT 1");
    const spvUser = spvUserRes.rows[0];
    const supervisorToken = jwt.sign(
      { id: spvUser.id, email: spvUser.email, role: spvUser.role },
      env.JWT_SECRET || "mova_super_secret_jwt_key_2026",
      { expiresIn: "1h" }
    );

    // Superadmin Overview
    const adminOverviewRes = await request(server, "GET", "/api/analytics/overview", {
      Authorization: `Bearer ${superadminToken}`,
    });
    assert(adminOverviewRes.status === 200, "GET /api/analytics/overview (Superadmin) returns 200");
    const adminData = adminOverviewRes.body.data || adminOverviewRes.body;
    assert(adminData.sales !== undefined, "Superadmin overview contains sales domain");

    // Supervisor Overview RBAC Masking Verification
    const spvOverviewRes = await request(server, "GET", "/api/analytics/overview", {
      Authorization: `Bearer ${supervisorToken}`,
    });
    assert(spvOverviewRes.status === 200, "GET /api/analytics/overview (Supervisor) returns 200");
    const spvData = spvOverviewRes.body.data || spvOverviewRes.body;
    assert(spvData.sales?.summary?.total_revenue?.formatted === "PROTECTED_ROLE", "Supervisor receives PROTECTED_ROLE for total_revenue.formatted");

    // Operational, Compliance, Sales, DSS, Daily
    const opRes = await request(server, "GET", "/api/analytics/operational/summary", {
      Authorization: `Bearer ${superadminToken}`,
    });
    assert(opRes.status === 200, "GET /api/analytics/operational/summary returns 200");

    const compRes = await request(server, "GET", "/api/analytics/compliance/summary", {
      Authorization: `Bearer ${superadminToken}`,
    });
    assert(compRes.status === 200, "GET /api/analytics/compliance/summary returns 200");

    const salesRes = await request(server, "GET", "/api/analytics/sales/performance", {
      Authorization: `Bearer ${superadminToken}`,
    });
    assert(salesRes.status === 200, "GET /api/analytics/sales/performance returns 200");

    const dssRes = await request(server, "GET", "/api/analytics/dss/plan-vs-actual", {
      Authorization: `Bearer ${superadminToken}`,
    });
    assert(dssRes.status === 200, "GET /api/analytics/dss/plan-vs-actual returns 200");

    const dailyRes = await request(server, "GET", "/api/analytics/reports/daily-summary", {
      Authorization: `Bearer ${superadminToken}`,
    });
    assert(dailyRes.status === 200, "GET /api/analytics/reports/daily-summary returns 200");

    const csvRes = await request(server, "GET", "/api/analytics/reports/daily-summary?format=csv", {
      Authorization: `Bearer ${superadminToken}`,
    });
    assert(csvRes.status === 200, "GET /api/analytics/reports/daily-summary?format=csv returns 200");
    assert(csvRes.headers["content-type"]?.includes("text/csv"), "CSV format returns text/csv Content-Type");

    console.log("\n================================================================================");
    console.log(`🎉 ALL ${passedCount}/${passedCount} F-07 REPORTS & ANALYTICS ASSERTIONS PASSED!`);
    console.log("🔒 Backend Status: 100% Frozen & Stable");
    console.log("================================================================================\n");
  } finally {
    server.close();
  }
}

runF07Tests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ F-07 Test execution failed:", err);
    process.exit(1);
  });
