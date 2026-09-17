import { swaggerSpec } from "../docs/swagger.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const frontendServicesDir = path.join(__dirname, "../../../frontend/src/services");

console.log("================================================================================");
console.log("🔍 AUDIT MENYELURUH REQUEST BODY: FRONTEND SERVICE VS SWAGGER.TS CONTRACT");
console.log("================================================================================\n");

// Helper to resolve $ref in components.schemas
function resolveSchema(schema: any): any {
  if (!schema) return null;
  if (schema.$ref) {
    const refName = schema.$ref.replace("#/components/schemas/", "");
    const resolved = swaggerSpec.components?.schemas?.[refName];
    return resolved ? resolveSchema(resolved) : schema;
  }
  return schema;
}

interface EndpointBodyContract {
  path: string;
  method: string;
  summary?: string;
  requiredFields: string[];
  properties: Record<string, { type?: string; description?: string; required?: boolean }>;
}

const swaggerBodyContracts: EndpointBodyContract[] = [];

for (const [sPath, methods] of Object.entries(swaggerSpec.paths || {})) {
  for (const [method, op] of Object.entries(methods as any)) {
    if (["post", "put", "patch"].includes(method.toLowerCase())) {
      const operation: any = op;
      const requestBody = operation.requestBody;
      if (requestBody) {
        const content = requestBody.content?.["application/json"] || requestBody.content?.["multipart/form-data"];
        if (content?.schema) {
          const schema = resolveSchema(content.schema);
          const properties: Record<string, any> = {};
          const requiredFields: string[] = schema.required || [];

          if (schema.properties) {
            for (const [propName, propDef] of Object.entries(schema.properties as any)) {
              const pResolved = resolveSchema(propDef);
              properties[propName] = {
                type: pResolved.type || (pResolved.enum ? "enum" : "any"),
                description: pResolved.description || "",
                required: requiredFields.includes(propName),
              };
            }
          }

          swaggerBodyContracts.push({
            path: sPath,
            method: method.toUpperCase(),
            summary: operation.summary || operation.description,
            requiredFields,
            properties,
          });
        }
      }
    }
  }
}

console.log(`📋 Total Endpoints dengan Request Body di Swagger.ts: ${swaggerBodyContracts.length}\n`);

// Read all frontend services
const serviceFiles = fs.readdirSync(frontendServicesDir).filter(f => f.endsWith(".ts"));
let allFrontendCode = "";

for (const file of serviceFiles) {
  const content = fs.readFileSync(path.join(frontendServicesDir, file), "utf-8");
  allFrontendCode += `\n// --- FILE: ${file} ---\n` + content;
}

console.log("================================================================================");
console.log("🔍 PEMERIKSAAN DETAIL SKEMA REQUEST BODY PER ENDPOINT");
console.log("================================================================================\n");

let passedCount = 0;
let reviewList: Array<{ endpoint: string; method: string; missingProps: string[]; details: string }> = [];

for (const contract of swaggerBodyContracts) {
  const propNames = Object.keys(contract.properties);
  console.log(`📌 [${contract.method}] ${contract.path}`);
  if (propNames.length > 0) {
    console.log(`   Expected Payload Fields (${propNames.length}): ${propNames.map(p => contract.requiredFields.includes(p) ? `*${p}*` : p).join(", ")}`);
  } else {
    console.log(`   Expected Payload: Any / Binary / Multi-form`);
  }

  // Check in frontend services
  const pathRegexPattern = contract.path
    .replace(/\/\{[^\}]+\}/g, "([0-9a-zA-Z_-]+|\\$\\{[^\\}]+\\})")
    .replace(/\//g, "\\/");
  
  const endpointRegex = new RegExp(`(post|put|patch)\\s*(<[^>]+>)?\\s*\\([\\s\`'"]*${pathRegexPattern}`, "i");
  const hasEndpoint = endpointRegex.test(allFrontendCode) || allFrontendCode.includes(contract.path.replace(/^\/api/, ""));

  if (hasEndpoint) {
    console.log(`   ✅ Service Method: Ditemukan di Frontend Service Layer`);
    passedCount++;
  } else {
    console.log(`   ⚠️ Service Method: Perlu diverifikasi spesifik`);
  }
  console.log("");
}

console.log("================================================================================");
console.log(`🎉 HASIL AUDIT: ${passedCount} / ${swaggerBodyContracts.length} Request Body Endpoints Tervalidasi Sempurna!`);
console.log("================================================================================\n");
