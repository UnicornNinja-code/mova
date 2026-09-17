import { distributionRepository } from "../../repositories/distributionRepository.js";
import { topsisEngineService } from "../dss/TopsisEngineService.js";
import { topsisRepository } from "../../repositories/topsisRepository.js";
import { TimeSlotEvaluator } from "../../utils/TimeSlotEvaluator.js";
import { addRiderAssignedNotifJob } from "../../queues/notificationQueue.js";
import { eventPublisher } from "../../events/eventPublisher.js";

const DEFAULT_ZONE_CAPACITY = 10;
const DEFAULT_DISTRIBUTION_RUNS_LIMIT = 20;
const DEFAULT_DUTY_HISTORY_LIMIT = 30;
const EVALUATION_VERSION_FALLBACK = "DSS-CRITERIA-v1.0";
const MODEL_VERSION_FALLBACK = "BWM-TOPSIS-v1.0";

export class DistributionService {
  static instance = null;

  constructor(repo = distributionRepository) {
    if (DistributionService.instance && repo === distributionRepository) {
      return DistributionService.instance;
    }
    this.repo = repo;
    if (repo === distributionRepository) {
      DistributionService.instance = this;
    }
  }

  static getInstance() {
    if (!DistributionService.instance) {
      DistributionService.instance = new DistributionService();
    }
    return DistributionService.instance;
  }

  async confirmRiderDuty(riderId) {
    if (!riderId) {
      const error = new Error("Rider ID harus diisi.");
      error.statusCode = 400;
      throw error;
    }
    return await this.repo.addRiderToDutyQueue(riderId);
  }

  async getRiderOperationalStatus(riderId) {
    if (!riderId) {
      const error = new Error("Rider ID harus diisi.");
      error.statusCode = 400;
      throw error;
    }
    return await this.repo.getRiderUnifiedStatus(riderId);
  }

  async getDistributionOverview(timeInput = null) {
    const currentSlot = timeInput ? TimeSlotEvaluator.getSlot(timeInput) : TimeSlotEvaluator.getSlot(new Date());

    const [waitingQueue, topsisResult, assignedCounts, activeZones] = await Promise.all([
      this.repo.getWaitingRidersQueue(),
      topsisEngineService.calculateTopsisRecommendations({
        timeSlot: currentSlot,
      }),
      this.repo.getAssignedRidersCountPerZone(),
      topsisRepository.findAllActiveZones(),
    ]);

    const fullZonesOverview = (topsisResult.rankings || []).map((rankItem) => {
      const activeZone = activeZones.find((az) => az.id === rankItem.zone_id) || {};
      const maxCap =
        activeZone.max_capacity !== undefined && activeZone.max_capacity !== null
          ? parseInt(activeZone.max_capacity, 10)
          : DEFAULT_ZONE_CAPACITY;
      const assigned = assignedCounts[rankItem.zone_id] || 0;
      const remaining = Math.max(0, maxCap - assigned);

      return {
        ...rankItem,
        max_capacity: maxCap,
        assigned_count: assigned,
        remaining_capacity: remaining,
        is_full: remaining === 0,
      };
    });

    const totalWaitingRiders = waitingQueue.length;
    const totalRemainingCapacity = fullZonesOverview.reduce((acc, z) => acc + z.remaining_capacity, 0);

    return {
      time_slot: currentSlot,
      evaluation_version: topsisResult.evaluation_version || EVALUATION_VERSION_FALLBACK,
      model_version: topsisResult.model_version || MODEL_VERSION_FALLBACK,
      total_waiting_riders: totalWaitingRiders,
      total_remaining_capacity: totalRemainingCapacity,
      is_capacity_sufficient: totalRemainingCapacity >= totalWaitingRiders,
      waiting_queue: waitingQueue,
      zones_overview: fullZonesOverview,
    };
  }

  async autoDistributeRiders(executedBy = null, timeInput = null) {
    const overview = await this.getDistributionOverview(timeInput);
    const {
      waiting_queue: queue,
      zones_overview: zones,
      total_remaining_capacity: totalRemainingCapacity,
      time_slot: timeSlot,
    } = overview;

    const latestHistories = await topsisRepository.findHistories(1);
    const latestSnapshotId = latestHistories[0]?.id || null;

    if (queue.length === 0) {
      return {
        message: "Antrean Rider kosong. Tidak ada penugasan baru yang dilakukan.",
        assigned_riders_count: 0,
        unassigned_riders_count: 0,
        assignments: [],
      };
    }

    const assignments = [];
    let queueIndex = 0;
    const totalQueueCount = queue.length;

    const initialRun = await this.repo.createDistributionRun({
      dss_history_id: latestSnapshotId,
      time_slot: timeSlot || "pagi",
      execution_type: "AUTO",
      executed_by: executedBy,
      total_waiting_riders: totalQueueCount,
      total_assigned_riders: 0,
      total_unassigned_riders: totalQueueCount,
      is_capacity_sufficient: totalRemainingCapacity >= totalQueueCount,
      summary: { start_time: new Date().toISOString() },
    });

    for (const zone of zones) {
      let remainingCap = zone.remaining_capacity;

      while (remainingCap > 0 && queueIndex < totalQueueCount) {
        const rider = queue[queueIndex];

        const assignment = await this.repo.createAssignment({
          rider_id: rider.rider_id,
          zone_id: zone.zone_id,
          assigned_by: executedBy,
          assignment_type: "AUTO",
          distribution_run_id: initialRun.id,
          dss_history_id: latestSnapshotId,
          topsis_rank: zone.rank,
          preference_score: zone.preference_score,
          evaluation_version: overview.evaluation_version || EVALUATION_VERSION_FALLBACK,
          model_version: overview.model_version || MODEL_VERSION_FALLBACK,
        });

        assignments.push({
          ...assignment,
          rider_name: rider.rider_name,
          zone_name: zone.zone_name,
          topsis_rank: zone.rank,
          preference_score: zone.preference_score,
        });

        eventPublisher.publishRiderAssigned({
          assignmentId: assignment.id,
          riderId: rider.rider_id,
          zoneName: zone.zone_name,
          topsisRank: zone.rank,
          assignmentType: "AUTO",
        });

        await addRiderAssignedNotifJob({
          assignmentId: assignment.id,
          riderId: rider.rider_id,
          zoneName: zone.zone_name,
          topsisRank: zone.rank,
          assignmentType: "AUTO",
        });

        remainingCap--;
        queueIndex++;
      }

      if (queueIndex >= totalQueueCount) {
        break;
      }
    }

    const unassignedCount = totalQueueCount - queueIndex;
    const isSufficient = unassignedCount === 0;

    const responseMsg = isSufficient
      ? `Distribusi Otomatis Berhasil Selesai! ${assignments.length} Rider berhasil diploting ke zona prioritas TOPSIS.`
      : `⚠️ Kapasitas zona tidak mencukupi! ${assignments.length} Rider terploting, ${unassignedCount} Rider tetap berstatus Belum Terploting (menganggur).`;

    return {
      message: responseMsg,
      distribution_run_id: initialRun.id,
      dss_history_id: latestSnapshotId,
      is_capacity_sufficient: isSufficient,
      assigned_riders_count: assignments.length,
      unassigned_riders_count: unassignedCount,
      assignments,
    };
  }

  async manualDistributeRider({ riderId, zoneId, assignedBy = null, timeInput = null }) {
    if (!riderId || !zoneId) {
      const error = new Error("Rider ID dan Zone ID harus diisi.");
      error.statusCode = 400;
      throw error;
    }

    const overview = await this.getDistributionOverview(timeInput);
    const targetZone = overview.zones_overview.find((z) => z.zone_id === zoneId);

    if (!targetZone) {
      const error = new Error("Zona sasaran tidak ditemukan di database.");
      error.statusCode = 404;
      throw error;
    }

    if (targetZone.remaining_capacity <= 0) {
      const error = new Error("Zona sudah penuh, silakan pilih zona lain.");
      error.statusCode = 400;
      throw error;
    }

    const latestHistories = await topsisRepository.findHistories(1);
    const latestSnapshotId = latestHistories[0]?.id || null;

    const assignment = await this.repo.createAssignment({
      rider_id: riderId,
      zone_id: zoneId,
      assigned_by: assignedBy,
      assignment_type: "MANUAL",
      dss_history_id: latestSnapshotId,
      topsis_rank: targetZone.rank || null,
      preference_score: targetZone.preference_score || null,
      evaluation_version: overview.evaluation_version || EVALUATION_VERSION_FALLBACK,
      model_version: overview.model_version || MODEL_VERSION_FALLBACK,
    });

    eventPublisher.publishRiderAssigned({
      assignmentId: assignment.id,
      riderId,
      zoneName: targetZone.zone_name,
      topsisRank: targetZone.rank || 1,
      assignmentType: "MANUAL",
    });

    await addRiderAssignedNotifJob({
      assignmentId: assignment.id,
      riderId,
      zoneName: targetZone.zone_name,
      topsisRank: targetZone.rank || 1,
      assignmentType: "MANUAL",
    });

    return {
      message: `Rider berhasil diploting secara manual ke ${targetZone.zone_name}.`,
      assignment: {
        ...assignment,
        zone_name: targetZone.zone_name,
      },
    };
  }

  async getDistributionRuns(limit = DEFAULT_DISTRIBUTION_RUNS_LIMIT) {
    return await this.repo.findDistributionRuns(limit);
  }

  async getDistributionRunById(id) {
    const run = await this.repo.findDistributionRunById(id);
    if (!run) {
      const error = new Error(`Riwayat distribusi dengan ID '${id}' tidak ditemukan.`);
      error.statusCode = 404;
      throw error;
    }
    return run;
  }

  async getMyDutyHistory(riderId, limit = DEFAULT_DUTY_HISTORY_LIMIT) {
    if (!riderId) {
      const error = new Error("Rider ID required");
      error.statusCode = 400;
      throw error;
    }
    const history = await this.repo.getRiderDutyHistory(riderId, limit);
    return {
      rider_id: riderId,
      total_records: history.length,
      history,
    };
  }

  async getRidersSummary() {
    return await this.repo.getRidersSummary();
  }
}

export const distributionService = DistributionService.getInstance();
