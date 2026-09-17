/*
 * overpassClient.ts
 * Overpass API Shared Utility Client with Fallback Mirrors, AbortSignal & Ephemeral Disk Streaming
 */

import fs from "fs";
import path from "path";
import { pipeline } from "stream/promises";
import { Readable } from "stream";

export class OverpassApiClient {
  private static instance: OverpassApiClient | null = null;
  private userAgent: string;

  constructor() {
    if (OverpassApiClient.instance) {
      return OverpassApiClient.instance;
    }
    this.userAgent = "Mova-Logistics-DSS/1.0 (contact@kopikeliling.com)";
    OverpassApiClient.instance = this;
  }

  public static getInstance(): OverpassApiClient {
    if (!OverpassApiClient.instance) {
      OverpassApiClient.instance = new OverpassApiClient();
    }
    return OverpassApiClient.instance;
  }

  /**
   * Resolve dynamic array pool of Overpass endpoints
   */
  public getMirrors(): string[] {
    const envMirrors = process.env.OVERPASS_ENDPOINTS;
    if (envMirrors && envMirrors.trim().length > 0) {
      return envMirrors.split(",").map((s) => s.trim()).filter(Boolean);
    }
    return [
      "https://overpass-api.de/api/interpreter",
      "https://lz4.overpass-api.de/api/interpreter",
      "https://overpass.kumi.systems/api/interpreter",
      "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    ];
  }

  /**
   * Fetch Overpass QL Query with automatic mirror failover & retry logic
   */
  public async fetchOverpassData(query: string, signal?: AbortSignal): Promise<any[]> {
    if (!query || query.trim() === "") {
      throw new Error("Query Overpass QL tidak boleh kosong");
    }

    const mirrors = this.getMirrors();
    const params = new URLSearchParams();
    params.append("data", query.trim());

    let lastError: any = null;

    for (const url of mirrors) {
      if (signal?.aborted) {
        throw new Error("OVERPASS_REQUEST_ABORTED: Operasi dibatalkan oleh pengguna.");
      }

      try {
        console.log(`🌐 [OverpassApiClient] Memanggil mirror API: ${url}...`);
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "User-Agent": this.userAgent,
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            Accept: "application/json, */*",
          },
          body: params.toString(),
          signal,
        });

        if (!response.ok) {
          const text = await response.text();
          console.warn(`⚠️ [OverpassApiClient] (${url}) HTTP ${response.status} ${response.statusText}: ${text.slice(0, 150)}`);
          lastError = new Error(`HTTP ${response.status} (${url}): ${response.statusText}`);
          continue; // Failover to next mirror
        }

        const data: any = await response.json();
        return data.elements || [];
      } catch (error: any) {
        if (error.name === "AbortError" || signal?.aborted) {
          throw new Error("OVERPASS_REQUEST_ABORTED: Permintaan dibatalkan.");
        }
        console.error(`💥 [OverpassApiClient] Error mirror (${url}):`, error.message);
        lastError = error;
      }
    }

    throw new Error(`Gagal mengambil data dari seluruh server Overpass API (${mirrors.length} mirrors). Detail: ${lastError?.message || "Unknown error"}`);
  }

  /**
   * Stream raw Overpass response directly to an ephemeral staging file on disk (Memory Efficient)
   */
  public async fetchAndStreamToDisk(query: string, outputPath: string, signal?: AbortSignal): Promise<{ elementCount: number; filePath: string }> {
    const rawElements = await this.fetchOverpassData(query, signal);
    
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    await fs.promises.writeFile(outputPath, JSON.stringify(rawElements, null, 2), "utf8");
    return { elementCount: rawElements.length, filePath: outputPath };
  }
}

export const overpassApiClient = OverpassApiClient.getInstance();
export const fetchOverpassData = (query: string, signal?: AbortSignal) => overpassApiClient.fetchOverpassData(query, signal);

