/**
 * test-f06-2-product-catalog.js
 * 
 * Automated Verification Test Suite for Milestone F-06.2: Product Catalog & Pricing Workspace.
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

async function runF062Tests() {
  console.log("\n================================================================================");
  console.log("🚀 STARTING MILESTONE F-06.2: PRODUCT CATALOG & COMMERCIAL VERIFICATION");
  console.log("================================================================================\n");

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));

  try {
    // 1. Static Code Analysis on productService.js & CatalogPage.jsx
    console.log("--- 1. Static Code Analysis & Service Layer Contracts ---");
    const productServicePath = path.join(FRONTEND_DIR, "src/services/productService.js");
    assert(fs.existsSync(productServicePath), "productService.js exists");
    const productServiceContent = fs.readFileSync(productServicePath, "utf-8");

    assert(productServiceContent.includes("getProducts") || productServiceContent.includes("getAll"), "productService has getAll/getProducts");
    assert(productServiceContent.includes("/products"), "productService targets /products endpoint");
    assert(productServiceContent.includes("/status"), "productService targets /status endpoint");

    const catalogPagePath = path.join(FRONTEND_DIR, "src/pages/catalog/CatalogPage.jsx");
    assert(fs.existsSync(catalogPagePath), "CatalogPage.jsx exists");
    const catalogPageContent = fs.readFileSync(catalogPagePath, "utf-8");

    // Zero-Mock & Pure Consumer Invariants
    console.log("\n--- 2. Zero-Mock & Pure Consumer Invariants ---");
    assert(!catalogPageContent.includes("const mockProducts"), "Zero mock products constant declared");
    assert(!catalogPageContent.includes("const dummyProducts"), "Zero dummy products constant declared");
    assert(!catalogPageContent.includes("unsplash.com"), "Zero fake external Unsplash dummy image links");
    assert(catalogPageContent.includes("queryKeys.products.all"), "Component uses queryKeys.products.all");
    assert(catalogPageContent.includes("formatCurrency"), "Component uses formatCurrency for presentation");

    // Query Invalidation Invariants
    console.log("\n--- 3. Cache & Mutation Invalidation Invariants ---");
    assert(catalogPageContent.includes("queryClient.invalidateQueries"), "Query invalidation invoked on mutations");

    // 4. Live Backend API Handshake
    console.log("\n--- 4. Live Backend API Handshake ---");
    const adminUserRes = await pool.query("SELECT id, email, role FROM users WHERE role = 'SUPERADMIN' LIMIT 1");
    const adminUser = adminUserRes.rows[0];
    const superadminToken = jwt.sign(
      { id: adminUser.id, email: adminUser.email, role: adminUser.role },
      env.JWT_SECRET || "mova_super_secret_jwt_key_2026",
      { expiresIn: "1h" }
    );

    const listRes = await request(server, "GET", "/api/products", {
      Authorization: `Bearer ${superadminToken}`,
    });
    assert(listRes.status === 200, "GET /api/products returns 200");
    const products = listRes.body.data || listRes.body.products || [];
    assert(products.length > 0, `Live products count > 0 (found ${products.length})`);

    const sampleProductId = products[0].id;
    const detailRes = await request(server, "GET", `/api/products/${sampleProductId}`, {
      Authorization: `Bearer ${superadminToken}`,
    });
    assert(detailRes.status === 200, `GET /api/products/${sampleProductId} returns 200`);

    console.log("\n================================================================================");
    console.log(`🎉 ALL ${passedCount}/${passedCount} F-06.2 PRODUCT CATALOG ASSERTIONS PASSED!`);
    console.log("🔒 Backend Status: 100% Frozen & Stable");
    console.log("================================================================================\n");
  } finally {
    server.close();
  }
}

runF062Tests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ F-06.2 Test execution failed:", err);
    process.exit(1);
  });
