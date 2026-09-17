/*
 * armadaService.ts
 * Clean Architecture Singleton Service for 3-Dimensional Armada Management in TypeScript
 */

import { armadaRepository, ArmadaRepository } from "../repositories/armadaRepository.js";
import { auditService } from "./auditService.js";

export class ArmadaService {
  private static instance: ArmadaService | null = null;
  private repo: ArmadaRepository;

  constructor(repo: ArmadaRepository = armadaRepository) {
    if (ArmadaService.instance && repo === armadaRepository) {
      return ArmadaService.instance;
    }
    this.repo = repo;
    if (repo === armadaRepository) {
      ArmadaService.instance = this;
    }
  }

  public static getInstance(): ArmadaService {
    if (!ArmadaService.instance) {
      ArmadaService.instance = new ArmadaService();
    }
    return ArmadaService.instance;
  }

  /**
   * Fetch all armada units with 3-dimensional calculated states
   */
  public async getAllArmadas(filters: any = {}): Promise<{ armadas: any[]; count: number }> {
    const armadas = await this.repo.findAll(filters);
    return { armadas, count: armadas.length };
  }

  /**
   * Fetch single armada unit by ID
   */
  public async getArmadaById(id: number | string): Promise<any> {
    const armada = await this.repo.findById(id);
    if (!armada) {
      const error: any = new Error(`Unit armada dengan ID '${id}' tidak ditemukan.`);
      error.statusCode = 404;
      throw error;
    }
    return armada;
  }

  /**
   * Create a new master armada unit
   * BR-FLEET-01 (Unique Fleet Identity)
   */
  public async createArmada(
    {
      code,
      name,
      type = "GEROBAK",
      status = "ACTIVE",
    }: {
      code?: string;
      name?: string;
      type?: string;
      status?: string;
    },
    adminUser?: { id: string; role: string; email?: string }
  ): Promise<any> {
    const rawCode = code || name;
    if (!rawCode || typeof rawCode !== "string" || rawCode.trim() === "") {
      const error: any = new Error("Nomor seri/kode unit armada (code) harus diisi.");
      error.statusCode = 400;
      throw error;
    }

    const formattedCode = rawCode.trim().toUpperCase();

    const existing = await this.repo.findByCode(formattedCode);
    if (existing) {
      const error: any = new Error(`Nomor seri unit '${formattedCode}' sudah terdaftar.`);
      error.statusCode = 400;
      throw error;
    }

    let finalType = "GEROBAK";
    const typeUpper = (type || "").toString().trim().toUpperCase();
    if (typeUpper === "MOTOR_LISTRIK" || typeUpper.includes("MOTOR") || typeUpper.includes("E-BIKE")) {
      finalType = "MOTOR_LISTRIK";
    } else if (typeUpper === "LAINNYA" || typeUpper.includes("OTHER")) {
      finalType = "LAINNYA";
    } else {
      finalType = "GEROBAK";
    }

    let finalStatus = "ACTIVE";
    const statusUpper = (status || "").toString().trim().toUpperCase();
    if (statusUpper === "MAINTENANCE") {
      finalStatus = "MAINTENANCE";
    } else if (statusUpper === "RETIRED") {
      finalStatus = "RETIRED";
    } else {
      finalStatus = "ACTIVE";
    }

    const newArmada = await this.repo.create({
      code: formattedCode,
      type: finalType,
      status: finalStatus,
    });

    if (adminUser) {
      await auditService.logAction({
        userId: adminUser.id,
        userRole: adminUser.role,
        action: "ARMADA_CREATED",
        entityType: "ARMADA",
        entityId: String(newArmada.id),
        details: { code: newArmada.code, type: newArmada.type, status: newArmada.status },
        newValues: newArmada,
      });
    }

    console.log(`✅ Master Unit Armada Berhasil Dibuat: [${newArmada.code}] (${newArmada.type}) - Status: ${newArmada.status}`);
    return newArmada;
  }

  /**
   * Update armada unit details / lifecycle status
   * BR-FLEET-09 (Maintenance Protection), BR-FLEET-10 (Active Assignment Protection)
   */
  public async updateArmada(
    id: number | string, 
    updateData: any = {},
    adminUser?: { id: string; role: string; email?: string }
  ): Promise<any> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      const error: any = new Error(`Unit armada dengan ID '${id}' tidak ditemukan.`);
      error.statusCode = 404;
      throw error;
    }

    let formattedCode = existing.code;
    if (updateData.code && updateData.code.trim() !== "") {
      formattedCode = updateData.code.trim().toUpperCase();
      if (formattedCode !== existing.code) {
        const duplicate = await this.repo.findByCode(formattedCode);
        if (duplicate) {
          const error: any = new Error(`Nomor seri unit '${formattedCode}' sudah digunakan.`);
          error.statusCode = 400;
          throw error;
        }
      }
    }

    // Protection rule: If moving to MAINTENANCE or RETIRED while currently IN_USE by a rider
    const targetStatus = updateData.status ? updateData.status.toUpperCase() : existing.status;
    if (
      (targetStatus === "MAINTENANCE" || targetStatus === "RETIRED") &&
      existing.current_rider_id &&
      !updateData.force
    ) {
      const error: any = new Error(
        `Unit ${existing.code} sedang bertugas di lapangan (IN_USE). Selesaikan proses pengembalian armada sebelum memindahkannya ke status ${targetStatus}.`
      );
      error.statusCode = 400;
      throw error;
    }

    const updated = await this.repo.update(id, {
      code: formattedCode,
      type: updateData.type || existing.type,
      status: targetStatus,
      current_rider_id: updateData.current_rider_id !== undefined ? updateData.current_rider_id : existing.current_rider_id,
    });

    if (adminUser && updated) {
      await auditService.logAction({
        userId: adminUser.id,
        userRole: adminUser.role,
        action: "ARMADA_UPDATED",
        entityType: "ARMADA",
        entityId: String(updated.id),
        details: { oldStatus: existing.status, newStatus: updated.status },
        oldValues: existing,
        newValues: updated,
      });
    }

    if (updated) {
      console.log(`📝 Unit Armada [${updated.code}] Berhasil Diperbarui -> Status: ${updated.status}`);
    }
    return updated;
  }

  /**
   * Delete armada unit by ID
   * BR-FLEET-10 (Active Assignment Protection)
   */
  public async deleteArmada(
    id: number | string,
    adminUser?: { id: string; role: string; email?: string }
  ): Promise<any> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      const error: any = new Error(`Unit armada dengan ID '${id}' tidak ditemukan.`);
      error.statusCode = 404;
      throw error;
    }

    if (existing.current_rider_id || existing.status === "IN_USE") {
      const error: any = new Error(`Unit ${existing.code} sedang digunakan oleh Rider dan tidak dapat dihapus.`);
      error.statusCode = 400;
      throw error;
    }

    const deleted = await this.repo.delete(id);
    if (deleted) {
      if (adminUser) {
        await auditService.logAction({
          userId: adminUser.id,
          userRole: adminUser.role,
          action: "ARMADA_DELETED",
          entityType: "ARMADA",
          entityId: String(deleted.id),
          details: { code: deleted.code },
          oldValues: deleted,
        });
      }
      console.log(`🗑️ Unit Armada [${deleted.code}] Berhasil Dihapus.`);
    }
    return deleted;
  }

  /**
   * Report an issue with an armada
   */
  public async reportIssue({
    armadaId,
    riderId,
    severity = "MINOR",
    issueType,
    description,
  }: {
    armadaId: string | number;
    riderId: string | number;
    severity?: string;
    issueType: string;
    description: string;
  }): Promise<any> {
    if (!armadaId || !riderId || !issueType || !description) {
      const error: any = new Error("Data pelaporan kerusakan (armadaId, issueType, description) wajib diisi.");
      error.statusCode = 400;
      throw error;
    }

    const armada = await this.repo.findById(armadaId);
    if (!armada) {
      const error: any = new Error("Unit armada tidak ditemukan.");
      error.statusCode = 404;
      throw error;
    }

    const issue = await this.repo.createIssueReport({
      armadaId,
      riderId,
      severity,
      issueType,
      description,
    });

    if (severity === "CRITICAL") {
      await this.repo.update(armadaId, { status: "MAINTENANCE" });
    }

    console.log(`⚠️ [ISSUE REPORTED] Kerusakan dilaporkan pada Armada ${armada.code}: [${severity}] ${issueType} - ${description}`);
    return {
      success: true,
      message: "Laporan kerusakan berhasil dicatat.",
      issue,
    };
  }

  /**
   * Get all issue reports
   */
  public async getIssueReports(statusFilter?: string): Promise<any[]> {
    return this.repo.findAllIssueReports(statusFilter);
  }

  /**
   * Resolve or process an issue report
   */
  public async resolveIssueReport(
    issueId: string | number,
    {
      status = "RESOLVED",
      resolutionNotes,
    }: {
      status?: string;
      resolutionNotes?: string;
    },
    adminUser?: { id: string; role: string }
  ): Promise<any> {
    const updated = await this.repo.updateIssueReportStatus(issueId, status, resolutionNotes);
    if (!updated) {
      const error: any = new Error("Laporan kendala tidak ditemukan.");
      error.statusCode = 404;
      throw error;
    }

    // If resolved, return armada back to ACTIVE if it was in MAINTENANCE
    if (status === "RESOLVED" && updated.armada_id) {
      await this.repo.update(updated.armada_id, { status: "ACTIVE" });
    } else if (status === "SENT_TO_MAINTENANCE" && updated.armada_id) {
      await this.repo.update(updated.armada_id, { status: "MAINTENANCE" });
    }

    if (adminUser) {
      await auditService.logAction({
        userId: adminUser.id,
        userRole: adminUser.role,
        action: "ARMADA_ISSUE_RESOLVED",
        entityType: "FLEET_ISSUE",
        entityId: String(issueId),
        details: { status, resolutionNotes },
        newValues: updated,
      });
    }

    return {
      success: true,
      message: "Laporan kendala berhasil ditangani.",
      issue: updated,
    };
  }

  /**
   * Shorthand alias for resolveIssueReport
   */
  public async resolveIssue(
    issueId: string | number,
    resolutionNotes: string,
    adminUser?: { id: string; role: string }
  ): Promise<any> {
    return this.resolveIssueReport(issueId, { status: "RESOLVED", resolutionNotes }, adminUser);
  }

  /**
   * Get assignment history of an armada
   */
  public async getArmadaHistory(armadaId: string | number): Promise<any[]> {
    return this.repo.getArmadaAssignmentHistory(armadaId);
  }
}

export const armadaService = ArmadaService.getInstance();
