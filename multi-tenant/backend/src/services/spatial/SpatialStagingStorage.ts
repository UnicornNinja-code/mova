/*
 * SpatialStagingStorage.ts
 * Manages the lifecycle of ephemeral disk staging files for large GeoJSON / OSM payload streams
 */

import fs from "fs";
import path from "path";

export class SpatialStagingStorage {
  private static instance: SpatialStagingStorage | null = null;
  private baseDir: string;

  constructor() {
    this.baseDir = path.resolve(process.cwd(), process.env.SPATIAL_STAGING_DIR || "uploads/temp/staging");
    this.ensureBaseDir();
  }

  public static getInstance(): SpatialStagingStorage {
    if (!SpatialStagingStorage.instance) {
      SpatialStagingStorage.instance = new SpatialStagingStorage();
    }
    return SpatialStagingStorage.instance;
  }

  private ensureBaseDir(): void {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  public getStagingFilePath(hubId: string, datasetName: string, versionTag: string = "v1"): string {
    this.ensureBaseDir();
    const safeHubId = hubId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeDataset = datasetName.replace(/[^a-zA-Z0-9_-]/g, "_");
    return path.join(this.baseDir, `staging_${safeHubId}_${safeDataset}_${versionTag}.json`);
  }

  public async readStagedElements(filePath: string): Promise<any[]> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Staging file '${filePath}' tidak ditemukan pada ephemeral disk.`);
    }
    const content = await fs.promises.readFile(filePath, "utf8");
    return JSON.parse(content);
  }

  public async cleanupStagingFile(filePath: string): Promise<void> {
    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        console.log(`🧹 [SpatialStagingStorage] Ephemeral file '${filePath}' berhasil dibersihkan.`);
      }
    } catch (err: any) {
      console.warn(`⚠️ [SpatialStagingStorage] Gagal membersihkan staging file '${filePath}':`, err.message);
    }
  }
}

export const spatialStagingStorage = SpatialStagingStorage.getInstance();
