/*
 * CronManagerService.ts
 * Clean Architecture Singleton Service for Cron Job Scheduler & Management in TypeScript
 */

import crypto from "crypto";
import { cronRepository, CronRepository } from "../../repositories/cronRepository.js";
import { pool } from "../../config/database.js";
import { redisClient } from "../../config/redis.js";
import { poiWeatherService } from "../poi/POIWeatherService.js";
import { poiCronDetectionService } from "../poi/POICronDetectionService.js";
import { auditLogger } from "../../utils/AuditLogger.js";

export class CronManagerService {
  private static instance: CronManagerService | null = null;
  private repo: CronRepository;
  public intervalHandles: Record<string, any>;

  constructor(repo: CronRepository = cronRepository) {
    if (CronManagerService.instance && repo === cronRepository) {
      return CronManagerService.instance;
    }
    this.repo = repo;
    this.intervalHandles = {};
    if (repo === cronRepository) {
      CronManagerService.instance = this;
    }
  }

  public static getInstance(): CronManagerService {
    if (!CronManagerService.instance) {
      CronManagerService.instance = new CronManagerService();
    }
    return CronManagerService.instance;
  }

  /**
   * Fetch all cron configurations with status overview
   */
  public async getCronConfigs(): Promise<{ configs: any[]; count: number }> {
    const configs = await this.repo.getAllConfigs();
    return { configs, count: configs.length };
  }

  /**
   * Fetch execution logs
   */
  public async getCronLogs({ cronKey, limit = 50 }: { cronKey?: string; limit?: number } = {}): Promise<{ logs: any[]; count: number }> {
    const logs = await this.repo.getLogs({ cronKey, limit });
    return { logs, count: logs.length };
  }

  /**
   * Toggle cron job active state dynamically
   */
  public async toggleCronActive(cronKey: string, isActive: boolean): Promise<any> {
    const config = await this.repo.getConfigByKey(cronKey);
    if (!config) {
      const error: any = new Error(`Cron configuration dengan key '${cronKey}' tidak ditemukan.`);
      error.statusCode = 404;
      throw error;
    }

    const updated = await this.repo.updateConfig(cronKey, { is_active: isActive });

    await auditLogger.logAction({
      action: "CRON_CONFIG_TOGGLED",
      entityType: "CRON",
      entityId: cronKey,
      details: { cron_key: cronKey, is_active: isActive },
    });

    console.log(`⚙️ [CRON MANAGER] Cron '${cronKey}' status diubah menjadi: ${isActive ? "ACTIVE ✅" : "INACTIVE 🛑"}`);
    return updated;
  }

  /**
   * Worker Task 1: Release expired ticket-booking armada holds
   */
  public async taskReleaseExpiredArmadaHolds(): Promise<{ released_count: number; released_units: any[] }> {
    await pool.query(`
      UPDATE fleet_reservations
      SET status = 'EXPIRED', released_at = CURRENT_TIMESTAMP
      WHERE status = 'ACTIVE' AND expires_at < NOW();
    `);

    const query = `
      UPDATE armadas
      SET 
        status = 'ACTIVE',
        reserved_by_rider_id = NULL,
        reserved_until = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE reserved_until IS NOT NULL
        AND reserved_until < NOW()
      RETURNING id, code;
    `;
    const { rows } = await pool.query(query);
    if (rows.length > 0) {
      console.log(`⏰ [CRON WORKER: ARMADA_RELEASE] Otomatis melepaskan ${rows.length} armada yang kadaluarsa (> 5 min): ${rows.map((r: any) => r.code).join(", ")}`);
    }
    return { released_count: rows.length, released_units: rows };
  }

  /**
   * Worker Task 2: Batch Open-Meteo Weather Sync
   */
  public async taskWeatherSync(): Promise<{ sync_result: any }> {
    const result = await poiWeatherService.syncAllZonesWeather();
    return { sync_result: result };
  }

  /**
   * Worker Task 3: Automated POI Scan & Detection
   */
  public async taskPoiSync(): Promise<{ poi_result: any }> {
    const result = await poiCronDetectionService.detectNewPois();
    return { poi_result: result };
  }

  /**
   * Worker Task 4: Daily Session & Stale Queue Cleanup
   */
  public async taskDailyCleanup(): Promise<{ cleaned_sessions_count: number }> {
    const query = `
      UPDATE zone_assignments
      SET status = 'CANCELLED'
      WHERE status IN ('ASSIGNED', 'CHECKED_IN')
        AND assignment_date < CURRENT_DATE
      RETURNING id;
    `;
    const { rows } = await pool.query(query);
    console.log(`🧹 [CRON WORKER: DAILY_CLEANUP] Otomatis menutup ${rows.length} sesi operasional kadaluarsa.`);
    return { cleaned_sessions_count: rows.length };
  }

  /**
   * Execute single cron task safely with performance measurement & logging
   */
  public async executeCronTask(cronKey: string, isManual: boolean = false): Promise<any> {
    const config = await this.repo.getConfigByKey(cronKey);
    if (!config) {
      const error: any = new Error(`Cron configuration '${cronKey}' tidak ditemukan.`);
      error.statusCode = 404;
      throw error;
    }

    if (!config.is_active && !isManual) {
      console.log(`🛑 [CRON SKIPPED] Cron '${cronKey}' sedang NON-AKTIF.`);
      return { skipped: true, reason: "Cron is inactive" };
    }

    const lockKey = `lock:cron:${cronKey}`;
    const lockToken = crypto.randomUUID();
    const lockTtlMs = 60000;
    let lockAcquired = false;

    if (redisClient && ((redisClient as any).isOpen || (redisClient as any).isReady)) {
      try {
        const lockRes = await (redisClient as any).set(lockKey, lockToken, {
          NX: true,
          PX: lockTtlMs,
        });
        if (lockRes === "OK" || lockRes === true) {
          lockAcquired = true;
        }
      } catch (err: any) {
        console.warn(`⚠️ Warning: Gagal memproses Redis Lock untuk cron '${cronKey}':`, err.message);
      }
    } else {
      lockAcquired = true;
    }

    if (!lockAcquired && !isManual) {
      console.log(`🔒 [CRON LOCK SKIPPED] Task '${cronKey}' sedang dieksekusi oleh instance backend lain.`);
      return { skipped: true, reason: "Task locked by another backend instance" };
    }

    let renewTimer: any = null;
    const renewIntervalMs = 20000;
    if (lockAcquired && redisClient && ((redisClient as any).isOpen || (redisClient as any).isReady)) {
      renewTimer = setInterval(async () => {
        try {
          const currentToken = await (redisClient as any).get(lockKey);
          if (currentToken === lockToken) {
            await (redisClient as any).expire(lockKey, Math.ceil(lockTtlMs / 1000));
          } else {
            clearInterval(renewTimer);
          }
        } catch (e: any) {
          console.warn(`⚠️ Warning renewing lock '${cronKey}':`, e.message);
        }
      }, renewIntervalMs);
    }

    const startTime = Date.now();
    let status: "SUCCESS" | "FAILED" | "ERROR" = "SUCCESS";
    let message = "";
    let taskResult: any = null;

    try {
      console.log(`🚀 [CRON EXECUTING] Memulai tugas '${cronKey}' (${isManual ? "MANUAL ON-DEMAND" : "SCHEDULED"})...`);

      switch (cronKey) {
        case "ARMADA_RELEASE":
          taskResult = await this.taskReleaseExpiredArmadaHolds();
          message = `Berhasil melepaskan ${taskResult.released_count} unit armada kadaluarsa.`;
          break;
        case "WEATHER_SYNC":
          taskResult = await this.taskWeatherSync();
          message = "Berhasil memperbarui cache cuaca Open-Meteo batch.";
          break;
        case "POI_SYNC":
          taskResult = await this.taskPoiSync();
          message = "Berhasil memindai POI baru via Overpass API.";
          break;
        case "DAILY_CLEANUP":
          taskResult = await this.taskDailyCleanup();
          message = `Berhasil melepaskan ${taskResult.cleaned_sessions_count} sesi kadaluarsa.`;
          break;
        default:
          message = "Tugas cron umum dieksekusi.";
      }
    } catch (error: any) {
      status = "FAILED";
      message = error.message || "Unknown error during cron execution";
      console.error(`💥 [CRON FAILED] Tugas '${cronKey}' gagal:`, error);
    } finally {
      if (renewTimer) {
        clearInterval(renewTimer);
      }
      if (lockAcquired && redisClient && ((redisClient as any).isOpen || (redisClient as any).isReady)) {
        try {
          const currentToken = await (redisClient as any).get(lockKey);
          if (currentToken === lockToken) {
            await (redisClient as any).del(lockKey);
          }
        } catch (e) {}
      }
    }

    const durationMs = Date.now() - startTime;

    await this.repo.updateConfig(cronKey, { last_run_at: new Date() });
    const logEntry = await this.repo.createLog({
      cron_key: cronKey,
      status,
      duration_ms: durationMs,
      message,
    });

    await auditLogger.logAction({
      action: "CRON_EXECUTED",
      entityType: "CRON",
      entityId: cronKey,
      details: {
        cron_key: cronKey,
        status,
        duration_ms: durationMs,
        is_manual: isManual,
        message,
      },
      status,
    });

    console.log(`✅ [CRON COMPLETED] '${cronKey}' Selesai dalam ${durationMs}ms -> Status: ${status}`);

    return {
      cron_key: cronKey,
      status,
      duration_ms: durationMs,
      message,
      task_result: taskResult,
      log: logEntry,
    };
  }

  /**
   * Initialize Native Bun 1.4 Cron Schedulers
   */
  public initBunCronScheduler(): void {
    if (typeof Bun !== "undefined" && typeof (Bun as any).cron === "function") {
      try {
        // Schedule Armada Release every 1 minute
        (Bun as any).cron("ARMADA_RELEASE", "*/1 * * * *", async () => {
          await this.executeCronTask("ARMADA_RELEASE");
        });

        // Schedule Weather Sync every 30 minutes
        (Bun as any).cron("WEATHER_SYNC", "*/30 * * * *", async () => {
          await this.executeCronTask("WEATHER_SYNC");
        });

        // Schedule Daily Cleanup every midnight
        (Bun as any).cron("DAILY_CLEANUP", "0 0 * * *", async () => {
          await this.executeCronTask("DAILY_CLEANUP");
        });

        console.log("⏰ [BUN 1.4 NATIVE CRON] Native Bun.cron schedulers active (Armada Release, Weather Sync, Daily Cleanup).");
      } catch (err: any) {
        console.warn("⚠️ Bun.cron initialization note:", err.message);
      }
    }
  }

  /**
   * Trigger Cron Job Manually On-Demand
   */
  public async triggerCronManually(cronKey: string): Promise<any> {
    return await this.executeCronTask(cronKey, true);
  }
}

export const cronManagerService = CronManagerService.getInstance();

