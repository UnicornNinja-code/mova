import { swaggerSpec } from "../docs/swagger.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const frontendServicesDir = path.join(__dirname, "../../../frontend/src/services");

console.log("================================================================================");
console.log("🔍 AUDIT MENYELURUH ENDPOINT FRONTEND VS SWAGGER.TS CONTRACT");
console.log("================================================================================\n");

const swaggerPaths = Object.keys(swaggerSpec.paths || {});
console.log(`📋 Total Endpoints di Swagger.ts: ${swaggerPaths.length}`);

// Read all service files in frontend/src/services/
const serviceFiles = fs.readdirSync(frontendServicesDir).filter(f => f.endsWith(".ts"));

let totalServiceFiles = serviceFiles.length;
let allServiceContent = "";
let serviceEndpointsMap = new Map<string, { file: string; line: number; text: string }[]>();

for (const file of serviceFiles) {
  const filePath = path.join(frontendServicesDir, file);
  const content = fs.readFileSync(filePath, "utf-8");
  allServiceContent += `\n// File: ${file}\n` + content;
  
  const lines = content.split("\n");
  lines.forEach((line, idx) => {
    // Match endpoint patterns like axiosInstance.get('/api/users'), get('/users'), etc.
    const match = line.match(/(get|post|put|patch|delete)\s*(<[^>]+>)?\s*\(\s*[`'"](\/[^`'"]*)[`'"]/i);
    if (match) {
      const url = match[3];
      if (!serviceEndpointsMap.has(url)) {
        serviceEndpointsMap.set(url, []);
      }
      serviceEndpointsMap.get(url)?.push({ file, line: idx + 1, text: line.trim() });
    }
  });
}

console.log(`📂 Total Service Files di Frontend: ${totalServiceFiles}`);
console.log(`🌐 Total Endpoint Calls Unik di Frontend Service: ${serviceEndpointsMap.size}\n`);

// Check if any swagger path is missing in frontend
let missingInFrontend: string[] = [];
let matchedEndpoints: { swaggerPath: string; methods: string[]; usedIn: string[] }[] = [];

for (const sPath of swaggerPaths) {
  const cleanPath = sPath;
  const methods = Object.keys(swaggerSpec.paths[sPath]);
  
  // Find match in frontend services
  let matched = false;
  let matches: string[] = [];
  
  for (const [fUrl, locations] of serviceEndpointsMap.entries()) {
    const regexPattern = "^" + sPath
      .replace(/\/\{[^\}]+\}/g, "(/[^/]+|\\$\\{[^\\}]+\\}|/[0-9a-fA-F-]+)")
      .replace(/\//g, "\\/") + "$";
    
    const noApiPattern = "^" + sPath.replace(/^\/api/, "")
      .replace(/\/\{[^\}]+\}/g, "(/[^/]+|\\$\\{[^\\}]+\\}|/[0-9a-fA-F-]+)")
      .replace(/\//g, "\\/") + "$";

    const reg1 = new RegExp(regexPattern);
    const reg2 = new RegExp(noApiPattern);

    if (reg1.test(fUrl) || reg2.test(fUrl) || fUrl.startsWith(sPath.split("{")[0])) {
      matched = true;
      locations.forEach(loc => matches.push(`${loc.file}:${loc.line}`));
    }
  }

  if (matched) {
    matchedEndpoints.push({ swaggerPath: sPath, methods, usedIn: matches });
  } else {
    missingInFrontend.push(sPath);
  }
}

console.log(`✅ Endpoint Swagger yang Terhubung ke Frontend: ${matchedEndpoints.length} / ${swaggerPaths.length}`);
if (missingInFrontend.length > 0) {
  console.log(`\n⚠️  Daftar Endpoint Swagger yang Belum Terpetakan di Frontend (${missingInFrontend.length}):`);
  missingInFrontend.forEach((ep, i) => {
    const methods = Object.keys(swaggerSpec.paths[ep]).join(", ").toUpperCase();
    console.log(`   ${i + 1}. [${methods}] ${ep}`);
  });
} else {
  console.log(`\n🎉 100% Seluruh Endpoint di Swagger.ts telah terpetakan dan memiliki representasi di Frontend!`);
}

console.log("\n================================================================================");
console.log("🔍 DETAIL PEMETAAN SERVICE LAYER PER DOMAIN");
console.log("================================================================================");

for (const file of serviceFiles) {
  console.log(`\n📄 [${file}]`);
  const filePath = path.join(frontendServicesDir, file);
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  lines.forEach((line, idx) => {
    const match = line.match(/(get|post|put|patch|delete)\s*(<[^>]+>)?\s*\(\s*[`'"](\/[^`'"]*)[`'"]/i);
    if (match) {
      const method = match[1].toUpperCase();
      const url = match[3];
      console.log(`   • line ${idx + 1}: ${method} ${url}`);
    }
  });
}
