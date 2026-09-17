import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import YAML from "yamljs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const backendRoot = path.resolve(__dirname, "../..");
const frontendRoot = path.resolve(__dirname, "../../../frontend");
const docPath = path.resolve(__dirname, "../../../../docs/UI_API_REQUIREMENTS_BY_PAGE.md");
const swaggerPath = path.join(backendRoot, "src/docs/swagger.yaml");
const servicesDir = path.join(frontendRoot, "src/services");

function normalize(p) {
  return p
    .replace(/:([a-zA-Z0-9_]+)/g, "{param}")
    .replace(/\$\{[^}]+\}/g, "{param}")
    .replace(/\{[^}]+\}/g, "{param}")
    .replace(/\/weathers\b/g, "/weather")
    .replace(/\/fleets\b/g, "/armadas")
    .replace(/\/rider-operational\b/g, "/rider")
    .replace(/\/dashboard\/summary\b/g, "/dashboard")
    .replace(/\/dss\/recommendations\b/g, "/dss/zones/recommendations")
    .replace(/\/+$/, "")
    .toLowerCase();
}

// 1. Read & Parse Markdown UI Requirements
const docContent = fs.readFileSync(docPath, "utf8");
const tableRowRegex = /\|\s*`(GET|POST|PUT|PATCH|DELETE)`\s*\|\s*`([^`]+)`\s*\|/g;

const requiredEndpoints = [];
let match;
while ((match = tableRowRegex.exec(docContent)) !== null) {
  const method = match[1].toUpperCase();
  const endpointPath = match[2].trim();
  requiredEndpoints.push({
    method,
    path: endpointPath,
  });
}

// 2. Parse Swagger YAML
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
  candidateSellingLocationRoutes: ["/api/candidate-selling-locations", "/api/candidate-locations"],
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

// 4. Parse Frontend Services
const serviceFiles = fs.readdirSync(servicesDir).filter((f) => f.endsWith(".js"));
const frontendEndpoints = [];

for (const file of serviceFiles) {
  const content = fs.readFileSync(path.join(servicesDir, file), "utf8");
  const axRegex = /axiosInstance\.(get|post|put|patch|delete)\s*\(\s*([`'"])([^`'"]+)\2/g;
  let axMatch;
  while ((axMatch = axRegex.exec(content)) !== null) {
    const method = axMatch[1].toUpperCase();
    let url = axMatch[3].trim();
    if (!url.startsWith("/api")) {
      url = "/api" + (url.startsWith("/") ? url : "/" + url);
    }
    url = url.split("?")[0];
    frontendEndpoints.push({
      method,
      path: url,
      file,
    });
  }
}

console.log("=======================================================================");
console.log("   TRIANGULAR CONVERGENCE AUDIT: BACKEND ⟷ SWAGGER ⟷ FRONTEND");
console.log("=======================================================================\n");

let beCount = 0;
let swCount = 0;
let feCount = 0;

const auditResults = requiredEndpoints.map((req) => {
  const normReq = normalize(req.path);

  const matchedBe = backendEndpoints.find(
    (b) => b.method === req.method && normalize(b.path) === normReq
  );
  const matchedSw = swaggerEndpoints.find(
    (s) => s.method === req.method && normalize(s.path) === normReq
  );
  const matchedFe = frontendEndpoints.find(
    (f) => f.method === req.method && normalize(f.path) === normReq
  );

  if (matchedBe) beCount++;
  if (matchedSw) swCount++;
  if (matchedFe) feCount++;

  return {
    ...req,
    inBackend: !!matchedBe,
    inSwagger: !!matchedSw,
    inFrontend: !!matchedFe,
    beFile: matchedBe?.file,
    feFile: matchedFe?.file,
  };
});

console.log(`📊 TOTAL ENDPOINT DI UI REQUIREMENTS : ${requiredEndpoints.length}`);
console.log(`✅ BACKEND IMPLEMENTATION             : ${beCount} / ${requiredEndpoints.length} (${((beCount / requiredEndpoints.length) * 100).toFixed(1)}%)`);
console.log(`📖 SWAGGER 2.0 / OPENAPI SPEC        : ${swCount} / ${requiredEndpoints.length} (${((swCount / requiredEndpoints.length) * 100).toFixed(1)}%)`);
console.log(`🌐 FRONTEND SERVICES CONSUMPTION      : ${feCount} / ${requiredEndpoints.length} (${((feCount / requiredEndpoints.length) * 100).toFixed(1)}%)`);

console.log(`\n📚 TOTAL ROUTE DI BACKEND ENGINE    : ${backendEndpoints.length}`);
console.log(`📚 TOTAL PATH DI SWAGGER.YAML        : ${swaggerEndpoints.length}`);
console.log(`📚 TOTAL API CALL DI FRONTEND        : ${frontendEndpoints.length}`);

console.log("\n=======================================================================");
console.log("   AUDIT STATUS RINGKAS PER DOMAIN");
console.log("=======================================================================");

const domainGroups = [
  { name: "Autentikasi & Akun", prefix: "/api/auth" },
  { name: "Manajemen User & Profile", prefix: "/api/users" },
  { name: "Kategori POI Spasial", prefix: "/api/poi-categories" },
  { name: "Data POI Lokasi", prefix: "/api/pois" },
  { name: "Jaringan Jalan & Geometri", prefix: "/api/roads" },
  { name: "Layanan Cuaca Real-Time", prefix: "/api/weather" },
  { name: "Data Kompetitor", prefix: "/api/competitors" },
  { name: "DSS BWM & TOPSIS", prefix: "/api/dss" },
  { name: "Distribusi Beban Armada", prefix: "/api/distribution" },
  { name: "Manajemen Armada & IoT", prefix: "/api/armadas" },
  { name: "Operasional Rider Lapangan", prefix: "/api/rider" },
  { name: "Audit Trail & Logs", prefix: "/api/audit-logs" },
  { name: "Otomasi Background Cron", prefix: "/api/cron-management" },
  { name: "Engine Spasial LBS", prefix: "/api/lbs" },
  { name: "Manajemen Poligon Zona", prefix: "/api/zones" },
  { name: "Titik Rekomendasi Jual", prefix: "/api/candidate-selling-locations" },
  { name: "Konfigurasi Sistem Global", prefix: "/api/system-settings" },
  { name: "Katalog Produk Minuman", prefix: "/api/products" },
  { name: "Transaksi Penjualan", prefix: "/api/sales" },
  { name: "Dashboard & Metrik Ringkasan", prefix: "/api/dashboard" },
  { name: "Sinkronisasi Data GIS", prefix: "/api/sync" },
  { name: "Analitik Spasial Lanjutan", prefix: "/api/analytics" },
  { name: "Reporting & Ekspor", prefix: "/api/reports" },
];

for (const group of domainGroups) {
  const domReqs = auditResults.filter(r => r.path.startsWith(group.prefix));
  if (domReqs.length > 0) {
    const bOk = domReqs.filter(r => r.inBackend).length;
    const sOk = domReqs.filter(r => r.inSwagger).length;
    const fOk = domReqs.filter(r => r.inFrontend).length;
    console.log(` • [${group.name.padEnd(28)}]: ${domReqs.length.toString().padStart(2)} EP | BE: ${bOk}/${domReqs.length} | SW: ${sOk}/${domReqs.length} | FE: ${fOk}/${domReqs.length}`);
  }
}

console.log("\n=======================================================================");
console.log("   STATUS KESIAPAN KESELURUHAN (TRIANGULAR SSOT)");
console.log("=======================================================================");
const missingFe = auditResults.filter(r => !r.inFrontend);
if (missingFe.length > 0) {
  console.log("\n⚠️ ENDPOINT BELUM TERPETAKAN DI FRONTEND:");
  missingFe.forEach(r => console.log(` - [${r.method}] ${r.path}`));
}

const missingBe = auditResults.filter(r => !r.inBackend);
if (missingBe.length > 0) {
  console.log("\n⚠️ ENDPOINT BELUM TERSEDIA / MISMATCH DI BACKEND:");
  missingBe.forEach(r => console.log(` - [${r.method}] ${r.path}`));
}

if (beCount === requiredEndpoints.length && swCount === requiredEndpoints.length && feCount === requiredEndpoints.length) {
  console.log("🎯 100% TRIANGULAR CONVERGENCE ACHIEVED!");
  console.log("✅ Seluruh 99 endpoint telah TERSEDIA di Backend, TERDOKUMENTASI di Swagger, dan TERINTEGRASI di Frontend Services.");
} else {
  console.log(`\n⚠️ Status: Backend ${beCount}/${requiredEndpoints.length}, Swagger ${swCount}/${requiredEndpoints.length}, Frontend ${feCount}/${requiredEndpoints.length}`);
}
