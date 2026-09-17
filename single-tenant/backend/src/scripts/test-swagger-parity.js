/*
 * test-swagger-parity.js
 * Automated Script to Parse Swagger.yaml and Validate Against Backend Express Routes
 * Checks parity, status codes, and HTTP methods across all endpoints.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import YAML from "yamljs";
import http from "http";
import { app } from "../../index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const swaggerPath = path.resolve(__dirname, "../docs/swagger.yaml");

function getAllRegisteredRoutes(expressApp) {
  const routes = [];
  const router = expressApp._router || expressApp.router || (expressApp._events && expressApp._events.request && expressApp._events.request._router);

  if (!router && expressApp.stack) {
    return traverseStack(expressApp.stack, []);
  }

  function traverseStack(stack, pathArr) {
    if (!stack || !Array.isArray(stack)) return;
    stack.forEach((layer) => {
      if (layer.route) {
        const routePath = layer.route.path;
        const methods = Object.keys(layer.route.methods || {});
        methods.forEach((method) => {
          const fullPath = (pathArr.join("") + routePath).replace(/\/+/g, "/");
          routes.push({ method: method.toUpperCase(), path: fullPath });
        });
      } else if (layer.name === "router" && layer.handle && layer.handle.stack) {
        let routerPath = "";
        if (layer.regexp) {
          const match = layer.regexp.source
            .replace("^\\", "")
            .replace("\\/?(?=\\/|$)", "")
            .replace("(?=\\/|$)", "")
            .replace(/\\\//g, "/")
            .replace(/\^/g, "")
            .replace(/\$/g, "");
          if (match && match !== "/" && !match.startsWith("(?=")) {
            routerPath = match;
          }
        }
        traverseStack(layer.handle.stack, [...pathArr, routerPath]);
      }
    });
  }

  if (router && router.stack) {
    traverseStack(router.stack, []);
  } else if (expressApp._router && expressApp._router.stack) {
    traverseStack(expressApp._router.stack, []);
  }

  return routes;
}

async function runParityCheck() {
  console.log("\n================================================================================");
  console.log("🔍 SWAGGER.YAML VS EXPRESS ROUTE PARITY & CONTRACT AUDIT");
  console.log("================================================================================\n");

  if (!fs.existsSync(swaggerPath)) {
    console.error("❌ swagger.yaml tidak ditemukan di:", swaggerPath);
    process.exit(1);
  }

  const swaggerDoc = YAML.load(swaggerPath);
  const swaggerPaths = swaggerDoc.paths || {};

  const swaggerEndpoints = [];
  for (const [pathKey, methods] of Object.entries(swaggerPaths)) {
    for (const [methodKey, spec] of Object.entries(methods)) {
      if (["get", "post", "put", "patch", "delete"].includes(methodKey.toLowerCase())) {
        swaggerEndpoints.push({
          method: methodKey.toUpperCase(),
          path: "/api" + pathKey,
          summary: spec.summary || "",
          tags: spec.tags || [],
          responses: Object.keys(spec.responses || {}),
        });
      }
    }
  }

  console.log(`📋 Total Endpoint Terdaftar di Swagger.yaml : ${swaggerEndpoints.length} Endpoint`);

  const expressRoutes = getAllRegisteredRoutes(app);
  console.log(`🚀 Total Endpoint Terpasang di Express Router: ${expressRoutes.length} Route\n`);

  // Normalize path pattern for comparison: e.g. /users/:id -> /users/{id}
  function normalizePath(p) {
    return p
      .replace(/:([a-zA-Z0-9_]+)/g, "{$1}")
      .replace(/\/+$/, "")
      .toLowerCase();
  }

  let matchedCount = 0;
  let missingInExpress = [];
  let documentedEndpoints = [];

  for (const sw of swaggerEndpoints) {
    const swNorm = normalizePath(sw.path);
    const match = expressRoutes.find(
      (r) => r.method === sw.method && normalizePath(r.path) === swNorm
    );

    if (match) {
      matchedCount++;
      documentedEndpoints.push({
        status: "MATCHED ✅",
        method: sw.method,
        path: sw.path,
        expectedCodes: sw.responses.join(", "),
      });
    } else {
      // Check if alternative route exists (e.g. /api/fleets vs /api/armadas or /api/weathers vs /api/weather)
      const altMatch = expressRoutes.find((r) => {
        const rNorm = normalizePath(r.path);
        return (
          r.method === sw.method &&
          (rNorm === swNorm ||
            rNorm.replace("/armadas", "/fleets") === swNorm ||
            rNorm.replace("/fleets", "/armadas") === swNorm ||
            rNorm.replace("/weathers", "/weather") === swNorm ||
            rNorm.replace("/weather", "/weathers") === swNorm)
        );
      });

      if (altMatch) {
        matchedCount++;
        documentedEndpoints.push({
          status: "ALIASED 🔀",
          method: sw.method,
          path: sw.path + ` (Mapped to ${altMatch.path})`,
          expectedCodes: sw.responses.join(", "),
        });
      } else {
        missingInExpress.push({
          method: sw.method,
          path: sw.path,
          summary: sw.summary,
        });
      }
    }
  }

  // Find Express routes not in Swagger
  const unDocumentedRoutes = [];
  for (const r of expressRoutes) {
    const rNorm = normalizePath(r.path);
    if (rNorm.startsWith("/api")) {
      const match = swaggerEndpoints.find(
        (sw) => normalizePath(sw.path) === rNorm && sw.method === r.method
      );
      if (!match) {
        unDocumentedRoutes.push({
          method: r.method,
          path: r.path,
        });
      }
    }
  }

  console.log("--------------------------------------------------------------------------------");
  console.log(`✅ MATCHED / SUPPORTED ENDPOINTS : ${matchedCount} / ${swaggerEndpoints.length} (${((matchedCount/swaggerEndpoints.length)*100).toFixed(1)}%)`);
  console.log(`⚠️ MISSING IN EXPRESS ROUTER    : ${missingInExpress.length}`);
  console.log(`ℹ️ EXTRA / EXTENDED IN EXPRESS  : ${unDocumentedRoutes.length} (New Reports/Onboarding routes)`);
  console.log("--------------------------------------------------------------------------------\n");

  if (missingInExpress.length > 0) {
    console.log("⚠️ DAFTAR ENDPOINT DI SWAGGER YANG BELUM TERHUBUNG DI ROUTER:");
    missingInExpress.forEach((m, idx) => {
      console.log(`   ${idx + 1}. [${m.method}] ${m.path} - ${m.summary}`);
    });
    console.log("");
  }

  if (unDocumentedRoutes.length > 0) {
    console.log("ℹ️ DAFTAR ENDPOINT BARU DI EXPRESS (EXTENDED / REPORTS / ONBOARDING / DISTRIBUTION):");
    unDocumentedRoutes.forEach((u, idx) => {
      console.log(`   ${idx + 1}. [${u.method}] ${u.path}`);
    });
    console.log("");
  }

  console.log("================================================================================");
  console.log("🎉 AUDIT PARITY SELESAI!");
  console.log("================================================================================\n");

  process.exit(0);
}

runParityCheck();
