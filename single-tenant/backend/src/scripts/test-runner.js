import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

const category = process.argv[2] || process.env.TEST_CATEGORY || "integration";
const testsDir = path.resolve(process.cwd(), "tests", category);

function runFile(filePath) {
  console.log(`Running ${path.basename(filePath)}`);
  const res = spawnSync(process.execPath, [filePath], { stdio: "inherit" });
  return res.status === 0;
}

if (!fs.existsSync(testsDir)) {
  console.log(`No tests found for category '${category}'. Directory missing: ${testsDir}`);
  process.exit(0);
}

const files = fs.readdirSync(testsDir).filter((f) => f.endsWith(".js")).map((f) => path.join(testsDir, f));
if (files.length === 0) {
  console.log(`No test files found in ${testsDir}`);
  process.exit(0);
}

let allPassed = true;
for (const f of files) {
  const ok = runFile(f);
  if (!ok) {
    console.error(`❌ FAILED: ${path.basename(f)} exited with non-zero code.`);
    allPassed = false;
  } else {
    console.log(`✅ PASSED: ${path.basename(f)}`);
  }
}

process.exit(allPassed ? 0 : 1);
