import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Strict Zero-Mock Governance & Pure Database Consumer Invariants", () => {
  const pagesDir = path.resolve(__dirname, "../pages");
  const servicesDir = path.resolve(__dirname, "../services");

  function getFilesRecursive(dir, fileList = []) {
    if (!fs.existsSync(dir)) return fileList;
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      if (fs.statSync(filePath).isDirectory()) {
        getFilesRecursive(filePath, fileList);
      } else if (filePath.endsWith(".jsx") || filePath.endsWith(".js")) {
        fileList.push(filePath);
      }
    }
    return fileList;
  }

  it("should ensure no production pages contain hardcoded mock or sample array declarations", () => {
    const pageFiles = getFilesRecursive(pagesDir);
    expect(pageFiles.length).toBeGreaterThan(0);

    const forbiddenPatterns = [
      /const\s+sampleMetrics\s*=/i,
      /const\s+sampleData\s*=/i,
      /const\s+mockPois\s*=/i,
      /const\s+mockZones\s*=/i,
      /const\s+mockProducts\s*=/i,
      /const\s+mockUsers\s*=/i,
      /const\s+mockCompetitors\s*=/i,
      /const\s+mockReports\s*=/i,
      /const\s+mockRiders\s*=/i,
      /const\s+dummyData\s*=/i,
    ];

    const violations = [];

    for (const file of pageFiles) {
      const content = fs.readFileSync(file, "utf8");
      const relativePath = path.relative(pagesDir, file);

      for (const pattern of forbiddenPatterns) {
        if (pattern.test(content)) {
          violations.push(`File ${relativePath} violates Zero-Mock invariant: matches ${pattern}`);
        }
      }
    }

    expect(violations, `Zero-Mock violations detected in pages:\n${violations.join("\n")}`).toEqual([]);
  });

  it("should ensure all production services utilize centralized Axios HTTP transport", () => {
    const serviceFiles = getFilesRecursive(servicesDir);
    expect(serviceFiles.length).toBeGreaterThan(0);

    for (const file of serviceFiles) {
      const content = fs.readFileSync(file, "utf8");
      const relativePath = path.relative(servicesDir, file);

      // Exclude index.js or helper files if any
      if (relativePath.endsWith("index.js")) continue;

      const isWebSocket = relativePath.includes("socket") || content.includes("io(") || content.includes("socket");
      const usesAxiosOrApi = content.includes("api.") || content.includes("apiClient") || content.includes("axios");
      
      expect(
        usesAxiosOrApi || isWebSocket,
        `Service ${relativePath} must communicate via centralized API client/Axios transport or WebSocket transport`
      ).toBe(true);
    }
  });
});
