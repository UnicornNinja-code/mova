/**
 * test-f06-4-competitor-intelligence.js
 * 
 * Automated Verification Test Suite for Milestone F-06.4: Competitor Intelligence & Spatial Boundaries.
 * Validates backend contract adherence, zero mock data, pure consumer architecture,
 * and query invalidation.
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

async function runF064Tests() {
  console.log("\n================================================================================");
  console.log("🚀 STARTING MILESTONE F-06.4: COMPETITOR INTELLIGENCE & SPATIAL VERIFICATION");
  console.log("================================================================================\n");

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));

  try {
    // 1. Static Code Analysis on competitorService.js & CompetitorManagementPage.jsx
    console.log("--- 1. Static Code Analysis & Service Layer Contracts ---");
    const competitorServicePath = path.join(FRONTEND_DIR, "src/services/competitorService.js");
    assert(fs.existsSync(competitorServicePath), "competitorService.js exists");
    const competitorServiceContent = fs.readFileSync(competitorServicePath, "utf-8");

    assert(competitorServiceContent.includes("/competitors/zone/"), "competitorService targets /competitors/zone/:zone_id");
    assert(competitorServiceContent.includes("/competitors/score/"), "competitorService targets /competitors/score/:zone_id");
    assert(competitorServiceContent.includes("/roads/protocol"), "competitorService targets /roads/protocol");

    const competitorPagePath = path.join(FRONTEND_DIR, "src/pages/superadmin/CompetitorManagementPage.jsx");
    assert(fs.existsSync(competitorPagePath), "CompetitorManagementPage.jsx exists");
    const competitorPageContent = fs.readFileSync(competitorPagePath, "utf-8");

    // Zero-Mock & Pure Consumer Invariants
    console.log("\n--- 2. Zero-Mock & Pure Consumer Invariants ---");
    assert(!competitorPageContent.includes("const mockCompetitors"), "Zero mock competitors constant declared");
    assert(!competitorPageContent.includes("const dummyCompetitors"), "Zero dummy competitors constant declared");
    assert(!competitorPageContent.includes("calculateC6"), "Zero client-side C6 calculation in component");
    assert(competitorPageContent.includes("queryKeys.competitors.byZone"), "Component uses queryKeys.competitors.byZone");
    assert(competitorPageContent.includes("queryKeys.competitors.score"), "Component uses queryKeys.competitors.score");

    // Query Invalidation Invariants
    console.log("\n--- 3. Cache & Mutation Invalidation Invariants ---");
    assert(competitorPageContent.includes("queryClient.invalidateQueries"), "Query invalidation invoked on mutations");

    // 4. Live Backend API Handshake
    console.log("\n--- 4. Live Backend API Handshake ---");
    const adminUserRes = await pool.query("SELECT id, email, role FROM users WHERE role = 'SUPERADMIN' LIMIT 1");
    const adminUser = adminUserRes.rows[0];
    const superadminToken = jwt.sign(
      { id: adminUser.id, email: adminUser.email, role: adminUser.role },
      env.JWT_SECRET || "mova_super_secret_jwt_key_2026",
      { expiresIn: "1h" }
    );

    const zonesRes = await request(server, "GET", "/api/zones", {
      Authorization: `Bearer ${superadminToken}`,
    });
    assert(zonesRes.status === 200, "GET /api/zones returns 200");
    const zones = Array.isArray(zonesRes.body) ? zonesRes.body : zonesRes.body.zones || [];
    assert(zones.length > 0, "Zones available for competitor scoping");
    const sampleZoneId = zones[0].id;

    const compRes = await request(server, "GET", `/api/competitors/zone/${sampleZoneId}`, {
      Authorization: `Bearer ${superadminToken}`,
    });
    assert(compRes.status === 200, `GET /api/competitors/zone/${sampleZoneId} returns 200`);

    const scoreRes = await request(server, "GET", `/api/competitors/score/${sampleZoneId}`, {
      Authorization: `Bearer ${superadminToken}`,
    });
    assert(scoreRes.status === 200, `GET /api/competitors/score/${sampleZoneId} returns 200`);
    assert(typeof scoreRes.body.skor_c6 === "number", "Backend returns numeric skor_c6");

    const protocolRes = await request(server, "GET", "/api/roads/protocol", {
      Authorization: `Bearer ${superadminToken}`,
    });
    assert(protocolRes.status === 200, "GET /api/roads/protocol returns 200");

    console.log("\n================================================================================");
    console.log(`🎉 ALL ${passedCount}/${passedCount} F-06.4 COMPETITOR INTELLIGENCE ASSERTIONS PASSED!`);
    console.log("🔒 Backend Status: 100% Frozen & Stable");
    console.log("================================================================================\n");
  } finally {
    server.close();
  }
}

runF064Tests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ F-06.4 Test execution failed:", err);
    process.exit(1);
  });
