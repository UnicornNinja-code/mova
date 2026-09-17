#!/usr/bin/env bun
/*
 * dev.ts
 * Unified Development Runner for MOVA (Backend + Frontend)
 * Runs Backend on Port 9968 and Frontend on Port 9967 with single command.
 */

import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const backendDir = path.join(__dirname, "backend");
const frontendDir = path.join(__dirname, "frontend");

const cyan = "\x1b[36m";
const green = "\x1b[32m";
const yellow = "\x1b[33m";
const bold = "\x1b[1m";
const reset = "\x1b[0m";

console.log(`${bold}${green}====================================================${reset}`);
console.log(`${bold}${green} 🚀 MOVA DSS - Starting Fullstack Application ${reset}`);
console.log(`${bold}${green}====================================================${reset}`);
console.log(`📡 ${cyan}Frontend:${reset} http://localhost:9967 (Vite Dev Server)`);
console.log(`🔌 ${yellow}Backend:${reset}  http://localhost:9968 (Bun + Express API)`);
console.log(`📚 ${yellow}API Docs:${reset} http://localhost:9968/api/docs`);
console.log(`${bold}${green}====================================================${reset}\n`);

// Start Backend Process
const backendProcess = spawn("bun", ["run", "dev"], {
  cwd: backendDir,
  shell: true,
  env: { ...process.env, PORT: "9968" },
  stdio: ["inherit", "pipe", "pipe"],
});

// Start Frontend Process
const frontendProcess = spawn("bun", ["run", "dev"], {
  cwd: frontendDir,
  shell: true,
  stdio: ["inherit", "pipe", "pipe"],
});

// Log Stream Handlers
backendProcess.stdout?.on("data", (data) => {
  const lines = data.toString().split("\n");
  for (const line of lines) {
    if (line.trim()) {
      console.log(`${cyan}[BACKEND]${reset} ${line}`);
    }
  }
});

backendProcess.stderr?.on("data", (data) => {
  const lines = data.toString().split("\n");
  for (const line of lines) {
    if (line.trim()) {
      console.error(`${yellow}[BACKEND-ERR]${reset} ${line}`);
    }
  }
});

frontendProcess.stdout?.on("data", (data) => {
  const lines = data.toString().split("\n");
  for (const line of lines) {
    if (line.trim()) {
      console.log(`${green}[FRONTEND]${reset} ${line}`);
    }
  }
});

frontendProcess.stderr?.on("data", (data) => {
  const lines = data.toString().split("\n");
  for (const line of lines) {
    if (line.trim()) {
      console.error(`${yellow}[FRONTEND-ERR]${reset} ${line}`);
    }
  }
});

// Clean shutdown handler
function cleanup() {
  console.log(`\n${yellow}🛑 Shutting down MOVA Fullstack servers...${reset}`);
  try {
    backendProcess.kill("SIGTERM");
  } catch {}
  try {
    frontendProcess.kill("SIGTERM");
  } catch {}
  process.exit(0);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
process.on("exit", cleanup);
