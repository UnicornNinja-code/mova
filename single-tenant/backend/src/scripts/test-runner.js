/*
 * test-runner.js
 * Universal Test Suite Runner supporting Node Native Test Runner (node:test) & Custom Scripts.
 */

import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

const category = process.argv[2] || process.env.TEST_CATEGORY || "integration";
const testsDir = path.resolve(process.cwd(), "tests", category);

console.log("\n========================================================");
console.log(`🧪 RUNNING TEST SUITE: [${category.toUpperCase()}]`);
console.log(`📁 Directory: ${testsDir}`);
console.log("========================================================\n");

if (!fs.existsSync(testsDir)) {
  console.log(`ℹ️  No tests found for category '${category}'. Directory missing: ${testsDir}`);
  process.exit(0);
}

const files = fs.readdirSync(testsDir)
  .filter((f) => f.endsWith(".js") || f.endsWith(".ts"))
  .map((f) => path.join(testsDir, f));

if (files.length === 0) {
  console.log(`ℹ️  No test files found in ${testsDir}`);
  process.exit(0);
}

let passedCount = 0;
let failedCount = 0;
const startTime = Date.now();

for (const filePath of files) {
  const fileName = path.basename(filePath);
  console.log(`\n▶ Executing: ${fileName}...`);

  const fileContent = fs.readFileSync(filePath, "utf-8");
  const isNodeTest = fileContent.includes("node:test") || fileName.includes(".unit.") || fileName.includes(".test.");

  const args = isNodeTest ? ["--test", filePath] : [filePath];
  const runner = process.execPath;

  const result = spawnSync(runner, args, {
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "test" },
  });

  if (result.status === 0) {
    passedCount++;
    console.log(`✅ [PASSED]: ${fileName}`);
  } else {
    failedCount++;
    console.error(`❌ [FAILED]: ${fileName} (Exit Code: ${result.status})`);
  }
}

const duration = ((Date.now() - startTime) / 1000).toFixed(2);
console.log("\n========================================================");
console.log(`📊 [${category.toUpperCase()}] TEST RUN COMPLETE`);
console.log(`   • Passed  : ${passedCount}`);
console.log(`   • Failed  : ${failedCount}`);
console.log(`   • Total   : ${files.length}`);
console.log(`   • Duration: ${duration}s`);
console.log("========================================================\n");

process.exit(failedCount > 0 ? 1 : 0);
