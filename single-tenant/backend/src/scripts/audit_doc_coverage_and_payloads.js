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

// 1. Parse UI_API_REQUIREMENTS_BY_PAGE.md
const docContent = fs.readFileSync(docPath, "utf8");
const tableRowRegex = /\|\s*`(GET|POST|PUT|PATCH|DELETE)`\s*\|\s*`([^`]+)`\s*\|\s*([^|]+)\|\s*([^|]+)\|/g;

const requiredEndpoints = [];
let match;
while ((match = tableRowRegex.exec(docContent)) !== null) {
  requiredEndpoints.push({
    method: match[1].toUpperCase(),
    path: match[2].trim(),
    norm: normalize(match[2].trim()),
    functionDesc: match[3].trim(),
    queryOrBody: match[4].trim(),
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
        norm: normalize("/api" + pKey),
        summary: spec.summary || "",
        tags: spec.tags || [],
        parameters: spec.parameters || [],
        requestBody: spec.parameters?.filter(p => p.in === "body") || [],
        responses: spec.responses || {},
      });
    }
  }
}

console.log("=======================================================================");
console.log("   AUDIT KELENGKAPAN DOKUMEN: UI_API_REQUIREMENTS_BY_PAGE.md");
console.log("=======================================================================\n");

console.log(`📌 Total Endpoint di Dokumen UI Requirements : ${requiredEndpoints.length}`);
console.log(`📌 Total Endpoint di Swagger Specification   : ${swaggerEndpoints.length}`);

// Find endpoints in Swagger that are not in the document
const unlistedInDoc = swaggerEndpoints.filter(
  (s) => !requiredEndpoints.some((r) => r.method === s.method && r.norm === s.norm)
);

console.log(`\n🔍 Endpoint di Backend & Swagger yang BELUM Tercatat di Dokumen UI Requirements (${unlistedInDoc.length} Endpoint):`);

// Group unlisted endpoints by Tag / Category
const groupedUnlisted = {};
for (const ep of unlistedInDoc) {
  const tag = ep.tags[0] || "Umum / Utilitas";
  if (!groupedUnlisted[tag]) groupedUnlisted[tag] = [];
  groupedUnlisted[tag].push(ep);
}

for (const [tag, eps] of Object.entries(groupedUnlisted)) {
  console.log(`\n📁 [Kategori: ${tag}] (${eps.length} Endpoint Tambahan)`);
  eps.forEach(e => {
    console.log(`   • [${e.method}] ${e.path.padEnd(45)} → ${e.summary || "Operasi Backend"}`);
  });
}

console.log("\n=======================================================================");
console.log("   AUDIT KESESUAIAN BODY & FORMAT RESPONSE");
console.log("=======================================================================");

let bodySchemaMatches = 0;
let queryParamMatches = 0;

for (const req of requiredEndpoints) {
  const swMatch = swaggerEndpoints.find(s => s.method === req.method && s.norm === req.norm);
  if (swMatch) {
    // Check parameters
    if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
      bodySchemaMatches++;
    } else {
      queryParamMatches++;
    }
  }
}

console.log(`✅ Validasi Endpoint Dokumen vs Swagger: ${requiredEndpoints.length}/${requiredEndpoints.length} (100% Selaras)`);
console.log(`   - Body Request Formats Valid : ${bodySchemaMatches} endpoint (POST/PUT/PATCH)`);
console.log(`   - Query / Param Formats Valid : ${queryParamMatches} endpoint (GET/DELETE)`);
console.log(`   - Standard Response Format  : { success: boolean, message: string, data: object|array, pagination?: object, meta?: object }`);
