import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import YAML from "yamljs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const backendRoot = path.resolve(__dirname, "../../");
const frontendRoot = path.resolve(__dirname, "../../../frontend");

// 1. Parse Swagger
const swaggerDoc = YAML.load(path.join(backendRoot, "src/docs/swagger.yaml"));
const swaggerPaths = swaggerDoc.paths || {};
const swaggerEndpoints = [];

for (const [pKey, methods] of Object.entries(swaggerPaths)) {
  for (const [mKey, spec] of Object.entries(methods)) {
    if (["get", "post", "put", "patch", "delete"].includes(mKey.toLowerCase())) {
      swaggerEndpoints.push({
        method: mKey.toUpperCase(),
        path: "/api" + pKey,
        summary: spec.summary || "",
        tags: spec.tags || [],
      });
    }
  }
}

// 2. Parse Backend Routes directly from route files and index.js mapping
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
  let match;
  while ((match = regex.exec(content)) !== null) {
    const method = match[1].toUpperCase();
    const routePath = match[3];

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

// 3. Parse Frontend Services
const servicesDir = path.join(frontendRoot, "src/services");
const serviceFiles = fs.readdirSync(servicesDir).filter((f) => f.endsWith(".js"));

const frontendEndpoints = [];

for (const file of serviceFiles) {
  const content = fs.readFileSync(path.join(servicesDir, file), "utf8");
  // Regex to match axiosInstance.get('...', axiosInstance.post('...', etc.
  const regex = /(?:axiosInstance|apiClient|axios)\.(get|post|put|patch|delete)\s*\(\s*(?:`([^`]+)`|'([^']+)'|"([^"]+)")/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const method = match[1].toUpperCase();
    let rawUrl = match[2] || match[3] || match[4];
    let cleanUrl = rawUrl.split("?")[0].replace(/\$\{[^}]+\}/g, "{param}");
    if (!cleanUrl.startsWith("/")) cleanUrl = "/" + cleanUrl;
    let fullPath = cleanUrl;
    if (!fullPath.startsWith("/api")) {
      fullPath = "/api" + cleanUrl;
    }
    frontendEndpoints.push({
      method,
      path: fullPath,
      rawUrl,
      file,
    });
  }
}

function normalizePath(p) {
  return p
    .replace(/:([a-zA-Z0-9_]+)/g, "{$1}")
    .replace(/\{[^}]+\}/g, "{param}")
    .replace(/\/+$/, "")
    .toLowerCase();
}

console.log("\n=======================================================");
console.log("1. SWAGGER vs BACKEND ENDPOINTS AUDIT");
console.log("=======================================================");
console.log(`Total Swagger Endpoints : ${swaggerEndpoints.length}`);
console.log(`Total Backend Endpoints : ${backendEndpoints.length}`);

let swMatched = 0;
const swMissingInBackend = [];

for (const sw of swaggerEndpoints) {
  const swNorm = normalizePath(sw.path);
  const match = backendEndpoints.find(
    (b) => b.method === sw.method && normalizePath(b.path) === swNorm
  );
  if (match) {
    swMatched++;
  } else {
    swMissingInBackend.push(sw);
  }
}

console.log(`Matched Swagger in Backend: ${swMatched} / ${swaggerEndpoints.length} (${((swMatched / swaggerEndpoints.length) * 100).toFixed(1)}%)`);

if (swMissingInBackend.length > 0) {
  console.log("\n[!] Swagger endpoints NOT implemented in backend routes:");
  swMissingInBackend.forEach((s) => console.log(`  - [${s.method}] ${s.path} (${s.summary})`));
} else {
  console.log("ALL Swagger endpoints are supported in backend routes!");
}

const backendNotInSwagger = [];
for (const b of backendEndpoints) {
  const bNorm = normalizePath(b.path);
  const match = swaggerEndpoints.find(
    (sw) => sw.method === b.method && normalizePath(sw.path) === bNorm
  );
  if (!match) {
    if (!backendNotInSwagger.some((x) => x.method === b.method && x.path === b.path)) {
      backendNotInSwagger.push(b);
    }
  }
}

console.log(`\nBackend endpoints not in Swagger (Extensions): ${backendNotInSwagger.length}`);

console.log("\n=======================================================");
console.log("2. FRONTEND SERVICES vs BACKEND ENDPOINTS AUDIT");
console.log("=======================================================");
console.log(`Total Frontend Service Calls: ${frontendEndpoints.length}`);

let feMatched = 0;
const feMissingInBackend = [];

for (const fe of frontendEndpoints) {
  const feNorm = normalizePath(fe.path);
  const match = backendEndpoints.find(
    (b) => b.method === fe.method && normalizePath(b.path) === feNorm
  );
  if (match) {
    feMatched++;
  } else {
    feMissingInBackend.push(fe);
  }
}

console.log(`Matched Frontend calls in Backend: ${feMatched} / ${frontendEndpoints.length} (${((feMatched / frontendEndpoints.length) * 100).toFixed(1)}%)`);

if (feMissingInBackend.length > 0) {
  console.log("\n[!] Frontend Service endpoints MISMATCHED with Backend:");
  feMissingInBackend.forEach((fe) => {
    console.log(`  - [${fe.method}] ${fe.rawUrl} (in ${fe.file}) -> mapped to ${fe.path}`);
  });
} else {
  console.log("ALL Frontend Service endpoints match Backend routes!");
}

console.log("\n=======================================================");
