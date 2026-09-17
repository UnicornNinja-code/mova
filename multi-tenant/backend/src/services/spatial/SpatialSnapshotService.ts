/*
 * SpatialSnapshotService.ts
 *
 * Intermediate Snapshot & Artifact Management Service for MOVA Spatial Pipeline
 * Manages raw Overpass responses, validated GeoJSON intermediate snapshots,
 * and SHA-256 checksummed manifest files in the filesystem.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";

export interface SnapshotManifest {
  dataset: string;
  version: number;
  source: string;
  fetched_at: string;
  feature_count: number;
  checksum_sha256: string;
  bounding_box?: [number, number, number, number] | null;
  validation_status: string;
  status: string;
  metadata?: any;
}

export class SpatialSnapshotService {
  private static instance: SpatialSnapshotService | null = null;
  private baseDataDir: string;

  constructor() {
    this.baseDataDir = path.resolve(process.cwd(), "data", "osm");
    this.ensureDirectoryTree();
  }

  public static getInstance(): SpatialSnapshotService {
    if (!SpatialSnapshotService.instance) {
      SpatialSnapshotService.instance = new SpatialSnapshotService();
    }
    return SpatialSnapshotService.instance;
  }

  /**
   * Ensure directory structure exists: data/osm/{poi,toll_roads,protocol_roads}/{raw,snapshots,manifests}
   */
  public ensureDirectoryTree(): void {
    const datasetTypes = ["poi", "toll_roads", "protocol_roads"];
    const subDirs = ["raw", "snapshots", "manifests"];

    for (const d of datasetTypes) {
      for (const s of subDirs) {
        const targetDir = path.join(this.baseDataDir, d, s);
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }
      }
    }
  }

  private normalizeDatasetFolder(datasetType: string): string {
    return datasetType.toLowerCase().trim();
  }

  /**
   * Calculate SHA-256 checksum of a string or Buffer
   */
  public calculateChecksum(content: string | Buffer): string {
    return crypto.createHash("sha256").update(content).digest("hex");
  }

  /**
   * Save Raw Overpass API response JSON artifact
   */
  public async saveRawSnapshot(datasetType: string, rawData: any): Promise<string> {
    const folder = this.normalizeDatasetFolder(datasetType);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `raw_${folder}_${timestamp}.json`;
    const filePath = path.join(this.baseDataDir, folder, "raw", filename);

    const jsonContent = typeof rawData === "string" ? rawData : JSON.stringify(rawData, null, 2);
    await fs.promises.writeFile(filePath, jsonContent, "utf8");
    return filePath;
  }

  /**
   * Save validated intermediate GeoJSON FeatureCollection artifact with checksum
   */
  public async saveGeoJsonSnapshot(
    datasetType: string,
    version: number,
    featureCollection: any
  ): Promise<{ filePath: string; checksum: string; featureCount: number }> {
    const folder = this.normalizeDatasetFolder(datasetType);
    const filename = `${folder}_snapshot_v${version}.geojson`;
    const filePath = path.join(this.baseDataDir, folder, "snapshots", filename);

    const jsonContent = JSON.stringify(featureCollection, null, 2);
    const checksum = this.calculateChecksum(jsonContent);
    const featureCount = Array.isArray(featureCollection.features) ? featureCollection.features.length : 0;

    await fs.promises.writeFile(filePath, jsonContent, "utf8");
    return { filePath, checksum, featureCount };
  }

  /**
   * Save metadata manifest JSON artifact
   */
  public async saveManifest(
    datasetType: string,
    version: number,
    manifest: SnapshotManifest
  ): Promise<string> {
    const folder = this.normalizeDatasetFolder(datasetType);
    const filename = `${folder}_manifest_v${version}.json`;
    const filePath = path.join(this.baseDataDir, folder, "manifests", filename);

    await fs.promises.writeFile(filePath, JSON.stringify(manifest, null, 2), "utf8");
    return filePath;
  }

  /**
   * Read GeoJSON snapshot from filesystem
   */
  public async readSnapshot(filePath: string): Promise<any> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Snapshot file not found: ${filePath}`);
    }
    const content = await fs.promises.readFile(filePath, "utf8");
    return JSON.parse(content);
  }

  /**
   * Read manifest from filesystem
   */
  public async readManifest(filePath: string): Promise<SnapshotManifest> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Manifest file not found: ${filePath}`);
    }
    const content = await fs.promises.readFile(filePath, "utf8");
    return JSON.parse(content);
  }
  /**
   * Locate canonical file paths for snapshot and manifest
   */
  public locateSnapshotPaths(datasetType: string, version: number): { snapshotPath: string; manifestPath: string } {
    const folder = this.normalizeDatasetFolder(datasetType);
    const snapshotFilename = `${folder}_snapshot_v${version}.geojson`;
    const manifestFilename = `${folder}_manifest_v${version}.json`;
    return {
      snapshotPath: path.join(this.baseDataDir, folder, "snapshots", snapshotFilename),
      manifestPath: path.join(this.baseDataDir, folder, "manifests", manifestFilename),
    };
  }

  /**
   * Verify Snapshot and Manifest File Integrity via SHA-256 Checksum
   */
  public async verifySnapshotIntegrity(
    datasetType: string,
    version: number,
    expectedChecksum?: string | null
  ): Promise<{ valid: boolean; error?: string; snapshotPath: string; manifestPath: string; featureCollection?: any }> {
    const { snapshotPath, manifestPath } = this.locateSnapshotPaths(datasetType, version);

    // 1. Check physical file existence
    if (!fs.existsSync(snapshotPath)) {
      return {
        valid: false,
        error: `SNAPSHOT_FILE_MISSING: Berkas snapshot tidak ditemukan di '${snapshotPath}'`,
        snapshotPath,
        manifestPath,
      };
    }

    if (!fs.existsSync(manifestPath)) {
      return {
        valid: false,
        error: `MANIFEST_FILE_MISSING: Berkas manifest tidak ditemukan di '${manifestPath}'`,
        snapshotPath,
        manifestPath,
      };
    }

    // 2. Compute SHA-256 hash of the physical snapshot
    const fileContent = await fs.promises.readFile(snapshotPath, "utf8");
    const computedChecksum = this.calculateChecksum(fileContent);

    // 3. Read manifest and verify checksum
    let manifest: SnapshotManifest;
    try {
      manifest = JSON.parse(await fs.promises.readFile(manifestPath, "utf8"));
    } catch {
      return {
        valid: false,
        error: `MANIFEST_CORRUPT: Berkas manifest di '${manifestPath}' bukan JSON valid`,
        snapshotPath,
        manifestPath,
      };
    }

    if (computedChecksum !== manifest.checksum_sha256) {
      return {
        valid: false,
        error: `SNAPSHOT_CHECKSUM_INVALID: Checksum fisik (${computedChecksum}) tidak cocok dengan manifest (${manifest.checksum_sha256})`,
        snapshotPath,
        manifestPath,
      };
    }

    if (expectedChecksum && computedChecksum !== expectedChecksum) {
      return {
        valid: false,
        error: `SNAPSHOT_CHECKSUM_INVALID: Checksum fisik (${computedChecksum}) tidak cocok dengan database (${expectedChecksum})`,
        snapshotPath,
        manifestPath,
      };
    }

    // 4. Parse GeoJSON FeatureCollection
    let featureCollection: any;
    try {
      featureCollection = JSON.parse(fileContent);
    } catch {
      return {
        valid: false,
        error: `SNAPSHOT_JSON_INVALID: Berkas GeoJSON di '${snapshotPath}' korup`,
        snapshotPath,
        manifestPath,
      };
    }

    return {
      valid: true,
      snapshotPath,
      manifestPath,
      featureCollection,
    };
  }
}

export const spatialSnapshotService = SpatialSnapshotService.getInstance();
