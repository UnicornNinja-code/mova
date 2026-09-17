import crypto from "crypto";
import { cronRepository } from "../../repositories/cronRepository.js";
import { pool } from "../../config/database.js";
import { redisClient } from "../../config/redis.js";
import { poiWeatherService } from "../poi/POIWeatherService.js";
import { poiCronDetectionService } from "../poi/POICronDetectionService.js";
import { auditLogger } from "../../utils/AuditLogger.js";

const DEFAULT_LOGS_LIMIT = 50;
const LOCK_TTL_MS = 60000;
const LOCK_RENEW_INTERVAL_MS = 20000;

export class CronManagerService {
  static instance = null;

  constructor(repo = cronRepository) {
    if (CronManagerService.instance && repo === cronRepository) {
      return CronManagerService.instance;
    }
    this.repo = repo;
    this.intervalHandles = {};
    if (repo === cronRepository) {
      CronManagerService.instance = this;
    }
  }

  static getInstance() {
    if (!CronManagerService.instance) {
      CronManagerService.instance = new CronManagerService();
    }
    return CronManagerService.instance;
  }

  async getCronConfigs() {
    const configs = await this.repo.getAllConfigs();
    return { configs, count: configs.length };
  }

  async getCronLogs({ cronKey, limit = DEFAULT_LOGS_LIMIT }) {
    const logs = await this.repo.getLogs({ cronKey, limit });
    return { logs, count: logs.length };
  }

  async toggleCronActive(cronKey, isActive) {
    const config = await this.repo.getConfigByKey(cronKey);
    if (!config) {
      const error = new Error(`Cron configuration dengan key '${cronKey}' tidak ditemukan.`);
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

    return updated;
  }

  async taskReleaseExpiredArmadaHolds() {
    const query = `
      UPDATE armadas
      SET 
        status = 'ACTIVE',
        reserved_by_rider_id = NULL,
        reserved_until = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE status = 'RESERVED'
        AND reserved_until IS NOT NULL
        AND reserved_until < NOW()
      RETURNING id, code;
    `;
    const { rows } = await pool.query(query);
    return { released_count: rows.length, released_units: rows };
  }

  async taskWeatherSync() {
    const result = await poiWeatherService.syncAllZonesWeather();
    return { sync_result: result };
  }

  async taskPoiSync() {
    const result = await poiCronDetectionService.runCronPOIDetection();
    return { poi_result: result };
  }

  async taskDailyCleanup() {
    const query = `
      UPDATE zone_assignments
      SET status = 'CANCELLED'
      WHERE status IN ('ASSIGNED', 'CHECKED_IN')
        AND assignment_date < CURRENT_DATE
      RETURNING id;
    `;
    const { rows } = await pool.query(query);
    return { cleaned_sessions_count: rows.length };
  }

  async executeCronTask(cronKey, isManual = false) {
    const config = await this.repo.getConfigByKey(cronKey);
    if (!config) {
      const error = new Error(`Cron configuration '${cronKey}' tidak ditemukan.`);
      error.statusCode = 404;
      throw error;
    }

    if (!config.is_active && !isManual) {
      return { skipped: true, reason: "Cron is inactive" };
    }

    const lockKey = `lock:cron:${cronKey}`;
    const lockToken = crypto.randomUUID();
    let lockAcquired = false;

    if (redisClient && (redisClient.isOpen || redisClient.isReady)) {
      try {
        const lockRes = await redisClient.set(lockKey, lockToken, {
          NX: true,
          PX: LOCK_TTL_MS,
        });
        if (lockRes === "OK" || lockRes === true) {
          lockAcquired = true;
        }
      } catch (err) {
        console.warn(`⚠️ Warning: Gagal memproses Redis Lock untuk cron '${cronKey}':`, err.message);
      }
    } else {
      lockAcquired = true;
    }

    if (!lockAcquired && !isManual) {
      return { skipped: true, reason: "Task locked by another backend instance" };
    }

    let renewTimer = null;
    if (lockAcquired && redisClient && (redisClient.isOpen || redisClient.isReady)) {
      renewTimer = setInterval(async () => {
        try {
          const currentToken = await redisClient.get(lockKey);
          if (currentToken === lockToken) {
            await redisClient.expire(lockKey, Math.ceil(LOCK_TTL_MS / 1000));
          } else {
            clearInterval(renewTimer);
          }
        } catch (e) {
          console.warn(`⚠️ Warning renewing lock '${cronKey}':`, e.message);
        }
      }, LOCK_RENEW_INTERVAL_MS);
    }

    const startTime = Date.now();
    let status = "SUCCESS";
    let message = "";
    let taskResult = null;

    try {
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
    } catch (error) {
      status = "FAILED";
      message = error.message || "Unknown error during cron execution";
      console.error(`💥 [CRON FAILED] Tugas '${cronKey}' gagal:`, error);
    } finally {
      if (renewTimer) {
        clearInterval(renewTimer);
      }
      if (lockAcquired && redisClient && (redisClient.isOpen || redisClient.isReady)) {
        try {
          const currentToken = await redisClient.get(lockKey);
          if (currentToken === lockToken) {
            await redisClient.del(lockKey);
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

    return {
      cron_key: cronKey,
      status,
      duration_ms: durationMs,
      message,
      task_result: taskResult,
      log: logEntry,
    };
  }

  async triggerCronManually(cronKey) {
    return await this.executeCronTask(cronKey, true);
  }
}

export const cronManagerService = CronManagerService.getInstance();
