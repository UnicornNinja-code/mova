import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import YAML from "yamljs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const backendRoot = path.resolve(__dirname, "../..");
const docPath = path.resolve(__dirname, "../../../../docs/UI_API_REQUIREMENTS_BY_PAGE.md");
const swaggerPath = path.join(backendRoot, "src/docs/swagger.yaml");

// 1. Read and parse markdown file to extract all endpoints from tables
const docContent = fs.readFileSync(docPath, "utf8");
// Regex to match table rows: | `METHOD` | `/api/...` | ... |
const tableRowRegex = /\|\s*`(GET|POST|PUT|PATCH|DELETE)`\s*\|\s*`([^`]+)`\s*\|/g;

const requiredEndpoints = [];
let match;
while ((match = tableRowRegex.exec(docContent)) !== null) {
  const method = match[1].toUpperCase();
  const endpointPath = match[2].trim();
  // If endpoint has placeholders like :id or {id}
  requiredEndpoints.push({
    method,
    path: endpointPath,
  });
}

// 2. Parse Swagger
const swaggerDoc = YAML.load(swaggerPath);
const swaggerPaths = swaggerDoc.paths || {};
const swaggerEndpoints = [];

for (const [pKey, methods] of Object.entries(swaggerPaths)) {
  for (const [mKey, spec] of Object.entries(methods)) {
    if (["get", "post", "put", "patch", "delete"].includes(mKey.toLowerCase())) {
      swaggerEndpoints.push({
        method: mKey.toUpperCase(),
        path: "/api" + pKey,
        summary: spec.summary || "",
      });
    }
  }
}

// 3. Parse Backend Routes
const routeMounts = {
  authRoutes: ["/api/auth"],
  userRoutes: ["/api/users"],
  poiCategoryRoutes: ["/api/poi-categories"],
  poiRoutes: ["/api/pois"],
  roadRoutes: ["/api/roads"],
  weatherRoutes: ["/api/weathers", "/api/weather"],
  competitorRoutes: ["/api/competitors"],
  dssRoutes: ["/api/dss"],
  distributionRoutes: ["/api/distribution"],
  armadaRoutes: ["/api/armadas", "/api/fleets"],
  riderOperationalRoutes: ["/api/rider", "/api/rider-operational"],
  auditRoutes: ["/api/audit-logs"],
  cronRoutes: ["/api/cron-management"],
  lbsRoutes: ["/api/lbs"],
  zoneRoutes: ["/api/zones"],
  candidateSellingLocationRoutes: ["/api/candidate-selling-locations"],
  systemSettingRoutes: ["/api/system-settings", "/api/system"],
  productRoutes: ["/api/products"],
  salesRoutes: ["/api/sales"],
  dashboardRoutes: ["/api/dashboard"],
  syncRoutes: ["/api/sync"],
  analyticsRoutes: ["/api/analytics"],
  reportRoutes: ["/api/reports"],
  notificationRoutes: ["/api/notifications"],
};

const routesDir = path.join(backendRoot, "src/routes");
const routeFiles = fs.readdirSync(routesDir).filter((f) => f.endsWith(".js"));
const backendEndpoints = [];

for (const file of routeFiles) {
  const content = fs.readFileSync(path.join(routesDir, file), "utf8");
  const baseName = file.replace(".js", "");
  const prefixes = routeMounts[baseName] || [`/api/${baseName.replace("Routes", "").toLowerCase()}`];

  const regex = /router\.(get|post|put|patch|delete)\s*\(\s*(['"`])([^'"`]+)\2/g;
  let rMatch;
  while ((rMatch = regex.exec(content)) !== null) {
    const method = rMatch[1].toUpperCase();
    const routePath = rMatch[3];

    for (const prefix of prefixes) {
      let combined = prefix + (routePath === "/" ? "" : (routePath.startsWith("/") ? routePath : "/" + routePath));
      if (!combined.startsWith("/")) combined = "/" + combined;
      combined = combined.replace(/\/+$/, "") || "/";
      backendEndpoints.push({
        method,
        path: combined,
        file,
      });
    }
  }
}

function normalize(p) {
  return p
    .replace(/:([a-zA-Z0-9_]+)/g, "{$1}")
    .replace(/\{[^}]+\}/g, "{param}")
    .replace(/\/+$/, "")
    .toLowerCase();
}

console.log(`\nTotal Endpoints di UI_API_REQUIREMENTS_BY_PAGE.md: ${requiredEndpoints.length}`);

const results = [];
let backendCount = 0;
let swaggerCount = 0;

for (const req of requiredEndpoints) {
  const normPath = normalize(req.path);

  // Check Backend
  const bMatch = backendEndpoints.find(
    (b) => b.method === req.method && normalize(b.path) === normPath
  );

  // Check Swagger
  const sMatch = swaggerEndpoints.find(
    (s) => s.method === req.method && normalize(s.path) === normPath
  );

  if (bMatch) backendCount++;
  if (sMatch) swaggerCount++;

  results.push({
    method: req.method,
    path: req.path,
    inBackend: !!bMatch,
    backendRoute: bMatch ? bMatch.path : null,
    backendFile: bMatch ? bMatch.file : null,
    inSwagger: !!sMatch,
    swaggerPath: sMatch ? sMatch.path : null,
  });
}

console.log(`Backend Availability : ${backendCount} / ${requiredEndpoints.length} (${((backendCount / requiredEndpoints.length) * 100).toFixed(1)}%)`);
console.log(`Swagger Documented  : ${swaggerCount} / ${requiredEndpoints.length} (${((swaggerCount / requiredEndpoints.length) * 100).toFixed(1)}%)`);

console.log("\n=======================================================");
console.log("DETAIL AUDIT PER ENDPOINT");
console.log("=======================================================");

const missingBackend = results.filter((r) => !r.inBackend);
const missingSwagger = results.filter((r) => !r.inSwagger);

if (missingBackend.length > 0) {
  console.log("\n❌ BELUM TERSEDIA DI BACKEND:");
  missingBackend.forEach((r) => console.log(` - [${r.method}] ${r.path}`));
} else {
  console.log("\n✅ SEMUA endpoint di UI Requirements sudah TERSEDIA 100% di Backend!");
}

if (missingSwagger.length > 0) {
  console.log(`\n⚠️ BELUM TERDOKUMENTASI DI SWAGGER (${missingSwagger.length} endpoint):`);
  missingSwagger.forEach((r) => {
    console.log(` - [${r.method}] ${r.path} (Tersedia di backend: ${r.inBackend ? r.backendFile : "TIDAK"})`);
  });
} else {
  console.log("\n✅ SEMUA endpoint di UI Requirements sudah TERDOKUMENTASI di Swagger!");
}
