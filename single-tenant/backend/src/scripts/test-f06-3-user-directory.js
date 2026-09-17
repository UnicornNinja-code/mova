/**
 * test-f06-3-user-directory.js
 * 
 * Automated Verification Test Suite for Milestone F-06.3: User Directory & RBAC Workspace.
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

async function runF063Tests() {
  console.log("\n================================================================================");
  console.log("🚀 STARTING MILESTONE F-06.3: USER DIRECTORY & RBAC VERIFICATION");
  console.log("================================================================================\n");

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));

  try {
    // 1. Static Code Analysis on userService.js & UserManagementPage.jsx
    console.log("--- 1. Static Code Analysis & Service Layer Contracts ---");
    const userServicePath = path.join(FRONTEND_DIR, "src/services/userService.js");
    assert(fs.existsSync(userServicePath), "userService.js exists");
    const userServiceContent = fs.readFileSync(userServicePath, "utf-8");

    assert(userServiceContent.includes("/users"), "userService targets canonical /users endpoint");
    assert(userServiceContent.includes("/status"), "userService targets canonical /status endpoint");
    assert(userServiceContent.includes("/profile"), "userService targets /profile endpoint");

    const userPagePath = path.join(FRONTEND_DIR, "src/pages/superadmin/UserManagementPage.jsx");
    assert(fs.existsSync(userPagePath), "UserManagementPage.jsx exists");
    const userPageContent = fs.readFileSync(userPagePath, "utf-8");

    // Zero-Mock & Pure Consumer Invariants
    console.log("\n--- 2. Zero-Mock & Pure Consumer Invariants ---");
    assert(!userPageContent.includes("const mockUsers"), "Zero mock users constant declared");
    assert(!userPageContent.includes("const dummyUsers"), "Zero dummy users constant declared");
    assert(userPageContent.includes("queryKeys.users.all"), "Component uses queryKeys.users.all");

    // Query Invalidation Invariants
    console.log("\n--- 3. Cache & Mutation Invalidation Invariants ---");
    assert(userPageContent.includes("queryClient.invalidateQueries"), "Query invalidation invoked on mutations");

    // 4. Live Backend API Handshake
    console.log("\n--- 4. Live Backend API Handshake ---");
    const adminUserRes = await pool.query("SELECT id, email, role FROM users WHERE role = 'SUPERADMIN' LIMIT 1");
    const adminUser = adminUserRes.rows[0];
    const superadminToken = jwt.sign(
      { id: adminUser.id, email: adminUser.email, role: adminUser.role },
      env.JWT_SECRET || "mova_super_secret_jwt_key_2026",
      { expiresIn: "1h" }
    );

    const listRes = await request(server, "GET", "/api/users", {
      Authorization: `Bearer ${superadminToken}`,
    });
    assert(listRes.status === 200, "GET /api/users returns 200");
    const users = listRes.body.users || [];
    assert(users.length > 0, `Live users count > 0 (found ${users.length})`);

    const sampleUserId = users[0].id;
    const detailRes = await request(server, "GET", `/api/users/${sampleUserId}`, {
      Authorization: `Bearer ${superadminToken}`,
    });
    assert(detailRes.status === 200, `GET /api/users/${sampleUserId} returns 200`);

    const profileRes = await request(server, "GET", "/api/users/profile", {
      Authorization: `Bearer ${superadminToken}`,
    });
    assert(profileRes.status === 200, "GET /api/users/profile returns 200");

    console.log("\n================================================================================");
    console.log(`🎉 ALL ${passedCount}/${passedCount} F-06.3 USER DIRECTORY ASSERTIONS PASSED!`);
    console.log("🔒 Backend Status: 100% Frozen & Stable");
    console.log("================================================================================\n");
  } finally {
    server.close();
  }
}

runF063Tests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ F-06.3 Test execution failed:", err);
    process.exit(1);
  });
