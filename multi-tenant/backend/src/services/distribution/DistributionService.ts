/*
 * DistributionService.ts
 * Clean Architecture Singleton Service for Rider Distribution Engine in TypeScript
 * Integrates Operational Sessions + Eligibility Checks + FIFO Queue + TOPSIS Zone Rankings + Preview & Commit Pipeline.
 */

import { distributionRepository, DistributionRepository } from "../../repositories/distributionRepository.js";
import { topsisEngineService } from "../dss/TopsisEngineService.js";
import { topsisRepository } from "../../repositories/topsisRepository.js";
import { TimeSlotEvaluator } from "../../utils/TimeSlotEvaluator.js";
import { addRiderAssignedNotifJob } from "../../queues/notificationQueue.js";
import { eventPublisher } from "../../events/eventPublisher.js";
import { armadaRepository } from "../../repositories/armadaRepository.js";
import { auditLogger } from "../../utils/AuditLogger.js";
import { ZoneModel } from "../../models/zoneModel.js";

export class DistributionService {
  private static instance: DistributionService | null = null;
  private repo: DistributionRepository;

  constructor(repo: DistributionRepository = distributionRepository) {
    if (DistributionService.instance && repo === distributionRepository) {
      return DistributionService.instance;
    }
    this.repo = repo;
    if (repo === distributionRepository) {
      DistributionService.instance = this;
    }
  }

  public static getInstance(): DistributionService {
    if (!DistributionService.instance) {
      DistributionService.instance = new DistributionService();
    }
    return DistributionService.instance;
  }

  /**
   * Rider confirms availability duty for today (Eligibility Check + FIFO Queue Entry)
   */
  public async confirmRiderDuty(riderId: number | string): Promise<any> {
    if (!riderId) {
      const error: any = new Error("Rider ID harus diisi.");
      error.statusCode = 400;
      throw error;
    }

    // 1. Eligibility Check (BR-DIST-01, RIDER-001)
    const eligibility = await this.repo.checkRiderEligibility(riderId);
    if (!eligibility.eligible) {
      const error: any = new Error(eligibility.reason || "Rider tidak memenuhi syarat untuk bertugas.");
      error.statusCode = 403;
      error.code = "RIDER_INACTIVE";
      throw error;
    }

    // 2. Ensure active operational session
    const currentSession = await this.repo.findOrCreateCurrentSession();

    // 3. Idempotency Check (RIDER-002, RIDER-003): If already confirmed today, return existing record
    const existingQueue = await this.repo.findTodayDutyQueue(riderId);
    if (existingQueue) {
      return {
        ...existingQueue,
        already_confirmed: true,
        msg: "Kesiapan tugas untuk hari ini sudah terkonfirmasi.",
        session: currentSession,
      };
    }

    // 4. Add to FIFO Duty Queue
    const queueEntry = await this.repo.addRiderToDutyQueue(riderId, currentSession.id);
    console.log(`✅ Rider ${riderId} berhasil masuk ke Antrean Tugas (${currentSession.session_code}) pada ${queueEntry.confirmed_at}`);

    await auditLogger.logAction({
      userId: riderId,
      action: "RIDER_DUTY_CONFIRMED",
      entityType: "DISTRIBUTION_QUEUE",
      entityId: queueEntry.id,
      details: { session_code: currentSession.session_code, time_slot: currentSession.time_slot },
    });

    return {
      ...queueEntry,
      already_confirmed: false,
      msg: "Kesiapan tugas berhasil dikonfirmasi.",
      session: currentSession,
    };
  }

  /**
   * Get distribution overview: Operational Session + FIFO Waiting Queue + TOPSIS Zone Rankings + Remaining Capacities
   */
  public async getDistributionOverview(): Promise<any> {
    const currentSession = await this.repo.findOrCreateCurrentSession();
    const currentSlot = currentSession.time_slot || TimeSlotEvaluator.getSlot(new Date());

    const waitingQueue = await this.repo.getWaitingRidersQueue(currentSession.id);

    const topsisResult = await topsisEngineService.calculateTopsisRecommendations({
      timeSlot: currentSlot,
    });

    const assignedCounts = await this.repo.getAssignedRidersCountPerZone(currentSession.id);

    const zonesOverview = topsisResult.rankings.map((rankItem: any) => {
      const assigned = assignedCounts[rankItem.zone_id] || 0;
      return {
        ...rankItem,
        assigned_count: assigned,
      };
    });

    const activeZones = await topsisRepository.findAllActiveZones();
    const fullZonesOverview = zonesOverview.map((z: any) => {
      const activeZone = activeZones.find((az: any) => String(az.id) === String(z.zone_id)) || {};
      const maxCap =
        activeZone.max_capacity !== undefined && activeZone.max_capacity !== null
          ? parseInt(activeZone.max_capacity, 10)
          : 10;
      const assigned = assignedCounts[z.zone_id] || 0;
      const remaining = Math.max(0, maxCap - assigned);
      return {
        ...z,
        max_capacity: maxCap,
        assigned_count: assigned,
        remaining_capacity: remaining,
        is_full: remaining === 0,
      };
    });

    const totalWaitingRiders = waitingQueue.length;
    const totalRemainingCapacity = fullZonesOverview.reduce((acc: number, z: any) => acc + z.remaining_capacity, 0);

    const [todayAssignments, allArmadas] = await Promise.all([
      this.repo.getAllTodayAssignments(),
      armadaRepository.findAll(),
    ]);

    const availableArmadas = allArmadas.filter((a: any) => a.status === "ACTIVE" && !a.current_rider_id && a.reservation_state !== "HELD");

    return {
      session: currentSession,
      duty_date: new Date().toISOString().split("T")[0],
      time_slot: currentSlot,
      summary: {
        total_waiting: totalWaitingRiders,
        total_plotted: todayAssignments.length,
        total_capacity: fullZonesOverview.reduce((acc: number, z: any) => acc + z.max_capacity, 0),
        total_remaining_capacity: totalRemainingCapacity,
        total_assigned: todayAssignments.filter((a: any) => a.status !== "CANCELLED").length,
        available_armadas_count: availableArmadas.length,
      },
      duty_queue: waitingQueue,
      zones: fullZonesOverview,
      assignments: todayAssignments,
      available_armadas: availableArmadas,
    };
  }

  /**
   * Preview Automatic Distribution without modifying the database (Human-in-the-Loop Review)
   */
  public async previewDistribution(): Promise<any> {
    const overview = await this.getDistributionOverview();
    const { duty_queue: queue, zones, session } = overview;

    if (queue.length === 0) {
      return {
        session,
        is_empty: true,
        message: "Antrean rider kosong. Tidak ada rider yang siap bertugas pada sesi ini.",
        proposed_allocations: [],
        unassigned_riders: [],
        zone_allocation_summary: [],
      };
    }

    const proposedAllocations: any[] = [];
    const unassignedRiders: any[] = [];
    const zoneAllocationMap: Record<string, { zone_name: string; rank: number; count: number; max: number }> = {};

    zones.forEach((z: any) => {
      zoneAllocationMap[z.zone_id] = {
        zone_name: z.zone_name,
        rank: z.rank,
        count: 0,
        max: z.remaining_capacity,
      };
    });

    let queueIndex = 0;
    const totalQueueCount = queue.length;

    // Distribute FIFO riders across ranked TOPSIS zones
    for (const zone of zones) {
      let remainingCap = zone.remaining_capacity;

      while (remainingCap > 0 && queueIndex < totalQueueCount) {
        const rider = queue[queueIndex];

        proposedAllocations.push({
          rider_id: rider.rider_id,
          rider_name: rider.rider_name,
          rider_email: rider.rider_email,
          zone_id: zone.zone_id,
          zone_name: zone.zone_name,
          topsis_rank: zone.rank,
          topsis_score: zone.topsis_score || zone.score || null,
          reason: `Rekomendasi TOPSIS Peringkat #${zone.rank} (${zone.zone_name})`,
        });

        zoneAllocationMap[zone.zone_id].count++;
        remainingCap--;
        queueIndex++;
      }

      if (queueIndex >= totalQueueCount) {
        break;
      }
    }

    // Remaining riders that exceed total zones capacity
    while (queueIndex < totalQueueCount) {
      const rider = queue[queueIndex];
      unassignedRiders.push({
        rider_id: rider.rider_id,
        rider_name: rider.rider_name,
        reason: "Kapasitas kuota seluruh zona operasional telah terpenuhi (Waiting List).",
      });
      queueIndex++;
    }

    return {
      session,
      is_empty: false,
      total_riders_in_queue: totalQueueCount,
      allocations_count: proposedAllocations.length,
      unassigned_count: unassignedRiders.length,
      proposed_allocations: proposedAllocations,
      unassigned_riders: unassignedRiders,
      zone_allocation_summary: Object.values(zoneAllocationMap),
    };
  }

  /**
   * Commit verified distribution preview to database in an ACID Transaction
   */
  public async confirmDistributionRun({
    executionType = "AUTO",
    executedBy = null,
    allocations = [],
    unassignedRiders = [],
  }: {
    executionType?: string;
    executedBy?: string | null;
    allocations: any[];
    unassignedRiders?: any[];
  }): Promise<any> {
    if (allocations.length === 0) {
      const error: any = new Error("Daftar alokasi penugasan rider tidak boleh kosong.");
      error.statusCode = 400;
      throw error;
    }

    const currentSession = await this.repo.findOrCreateCurrentSession();

    const dssSnapshot = {
      session_code: currentSession.session_code,
      time_slot: currentSession.time_slot,
      timestamp: new Date().toISOString(),
    };

    const result = await this.repo.commitBatchDistribution({
      sessionId: currentSession.id,
      executionType,
      executedBy,
      dssSnapshot,
      allocations,
      unassignedRiders,
    });

    console.log(`🚀 [DISTRIBUTION COMMITTED] Run ${result.run.run_number}: ${allocations.length} Rider berhasil diploting.`);

    // Publish events & dispatch notifications
    for (const alloc of allocations) {
      eventPublisher.publishRiderAssigned({
        assignmentId: alloc.zone_id,
        riderId: alloc.rider_id,
        zoneName: alloc.zone_name,
        topsisRank: alloc.topsis_rank || 1,
        assignmentType: executionType,
      });

      await addRiderAssignedNotifJob({
        assignmentId: alloc.zone_id,
        riderId: alloc.rider_id,
        zoneName: alloc.zone_name,
        topsisRank: alloc.topsis_rank || 1,
        assignmentType: executionType,
      });
    }

    await auditLogger.logAction({
      userId: executedBy || undefined,
      action: "DISTRIBUTION_RUN_EXECUTED",
      entityType: "DISTRIBUTION_RUN",
      entityId: result.run.id,
      details: {
        run_number: result.run.run_number,
        session_code: currentSession.session_code,
        assigned_count: allocations.length,
        unassigned_count: unassignedRiders.length,
      },
    });

    return {
      message: `Distribusi operasional berhasil dieksekusi! ${allocations.length} Rider telah ditugaskan ke zona masing-masing.`,
      run: result.run,
      assignments: result.assignments,
    };
  }

  /**
   * Execute Automatic Distribution (Preview + Commit in one step)
   */
  public async autoDistributeRiders(executedBy: string | null = null): Promise<any> {
    const preview = await this.previewDistribution();
    if (preview.is_empty || preview.proposed_allocations.length === 0) {
      return {
        message: "Antrean Rider kosong. Tidak ada penugasan baru yang dilakukan.",
        assigned_riders_count: 0,
        unassigned_riders_count: 0,
        assignments: [],
      };
    }

    return this.confirmDistributionRun({
      executionType: "AUTO",
      executedBy,
      allocations: preview.proposed_allocations,
      unassignedRiders: preview.unassigned_riders,
    });
  }

  /**
   * Execute Manual Distribution by Supervisor (Validates Zone Capacity & Rider Eligibility)
   */
  public async manualDistributeRider({
    riderId,
    zoneId,
    assignedBy = null,
  }: {
    riderId: number | string;
    zoneId: number | string;
    assignedBy?: number | string | null;
  }): Promise<any> {
    if (!riderId || !zoneId) {
      const error: any = new Error("Rider ID dan Zone ID harus diisi.");
      error.statusCode = 400;
      throw error;
    }

    // 1. Eligibility Check
    const eligibility = await this.repo.checkRiderEligibility(riderId);
    if (!eligibility.eligible) {
      const error: any = new Error(eligibility.reason || "Rider tidak memenuhi syarat untuk ditugaskan.");
      error.statusCode = 400;
      throw error;
    }

    const currentSession = await this.repo.findOrCreateCurrentSession();
    const overview = await this.getDistributionOverview();
    let targetZone = overview.zones.find((z: any) => String(z.zone_id || z.id) === String(zoneId));

    if (!targetZone) {
      const dbZone = await ZoneModel.findById(zoneId);
      if (!dbZone || dbZone.status !== "ACTIVE") {
        const error: any = new Error("Zona sasaran tidak ditemukan di database.");
        error.statusCode = 404;
        throw error;
      }
      const assignedCounts = await this.repo.getAssignedRidersCountPerZone(currentSession.id);
      const assigned = assignedCounts[dbZone.id] || 0;
      const maxCap = dbZone.max_capacity !== undefined && dbZone.max_capacity !== null ? parseInt(dbZone.max_capacity, 10) : 10;
      targetZone = {
        zone_id: dbZone.id,
        zone_name: dbZone.name,
        max_capacity: maxCap,
        assigned_count: assigned,
        remaining_capacity: Math.max(0, maxCap - assigned),
      };
    }

    if (targetZone.remaining_capacity <= 0) {
      const error: any = new Error(`Zona ${targetZone.zone_name} sudah penuh, silakan pilih zona lain.`);
      error.statusCode = 400;
      throw error;
    }

    const assignment = await this.repo.createAssignment({
      rider_id: riderId,
      zone_id: zoneId,
      session_id: currentSession.id,
      assigned_by: assignedBy,
      assignment_type: "MANUAL",
    });

    console.log(`   ✍️ [MANUAL PLOT] Rider ${riderId} -> Zona: ${targetZone.zone_name} (Oleh SPV/Admin)`);

    eventPublisher.publishRiderAssigned({
      assignmentId: assignment.id,
      riderId,
      zoneName: targetZone.zone_name,
      topsisRank: 1,
      assignmentType: "MANUAL",
    });

    await addRiderAssignedNotifJob({
      assignmentId: assignment.id,
      riderId,
      zoneName: targetZone.zone_name,
      topsisRank: 1,
      assignmentType: "MANUAL",
    });

    await auditLogger.logAction({
      userId: assignedBy || undefined,
      action: "MANUAL_ZONE_ASSIGNMENT",
      entityType: "ZONE_ASSIGNMENT",
      entityId: assignment.id,
      details: {
        rider_id: riderId,
        zone_id: zoneId,
        zone_name: targetZone.zone_name,
        session_code: currentSession.session_code,
      },
    });

    return {
      message: `Rider berhasil diploting secara manual ke ${targetZone.zone_name}.`,
      assignment: {
        ...assignment,
        zone_name: targetZone.zone_name,
      },
    };
  }

  /**
   * Fetch all past distribution runs
   */
  public async getDistributionRunsHistory(limit = 20): Promise<any[]> {
    return this.repo.findAllDistributionRuns(limit);
  }

  /**
   * Update Rider Duty Status (e.g. mark NO_SHOW, CANCELLED)
   */
  public async updateRiderDutyStatus({
    riderId,
    status,
    notes,
    updatedBy,
  }: {
    riderId: number | string;
    status: string;
    notes?: string;
    updatedBy?: number | string;
  }): Promise<any> {
    const updated = await this.repo.updateDutyQueueStatus(riderId, status, notes);

    await auditLogger.logAction({
      userId: updatedBy || undefined,
      action: "RIDER_DUTY_STATUS_UPDATED",
      entityType: "DISTRIBUTION_QUEUE",
      entityId: updated?.id,
      details: { rider_id: riderId, status, notes },
    });

    return updated;
  }

  /**
   * Mid-Day Emergency Incident / Armada Swap
   */
  public async emergencySwap({
    previousRiderId,
    newRiderId,
    supervisorId,
    incidentType,
    notes,
    armadaAction = "KEEP_ARMADA",
  }: {
    previousRiderId: string;
    newRiderId: string;
    supervisorId?: string | null;
    incidentType: string;
    notes?: string;
    armadaAction?: string;
  }): Promise<any> {
    if (!previousRiderId || !newRiderId) {
      const err: any = new Error("previous_rider_id dan new_rider_id harus disertakan.");
      err.statusCode = 400;
      throw err;
    }

    const result = await this.repo.emergencySwapAssignment({
      previousRiderId,
      newRiderId,
      supervisorId,
      incidentType,
      notes,
      armadaAction,
    });

    await auditLogger.logAction({
      userId: supervisorId || undefined,
      action: "EMERGENCY_RIDER_SWAP",
      entityType: "ZONE_ASSIGNMENT",
      entityId: result.new_assignment?.id,
      details: {
        previous_rider_id: previousRiderId,
        new_rider_id: newRiderId,
        incident_type: incidentType,
        armada_action: armadaAction,
        notes,
      },
    });

    return {
      msg: "Pengalihan tugas darurat berhasil dilakukan.",
      ...result,
    };
  }

  /**
   * Fetch personal operational duty & assignment history for authenticated user
   */
  public async getMyDutyHistory(riderId: number | string, limit: number = 30): Promise<any> {
    if (!riderId) {
      const error: any = new Error("Rider ID required");
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
}

export const distributionService = DistributionService.getInstance();
