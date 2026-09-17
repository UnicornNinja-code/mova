import { armadaRepository } from "../repositories/armadaRepository.js";

export const ARMADA_TYPES = Object.freeze({
  GEROBAK: "GEROBAK",
  MOTOR_LISTRIK: "MOTOR_LISTRIK",
  LAINNYA: "LAINNYA",
});

export const ARMADA_STATUSES = Object.freeze({
  ACTIVE: "ACTIVE",
  MAINTENANCE: "MAINTENANCE",
  IN_USE: "IN_USE",
  RESERVED: "RESERVED",
});

const normalizeArmadaType = (type) => {
  const typeUpper = String(type || "").trim().toUpperCase();
  if (typeUpper === "MOTOR_LISTRIK" || typeUpper.includes("MOTOR") || typeUpper.includes("E-BIKE")) {
    return ARMADA_TYPES.MOTOR_LISTRIK;
  }
  if (typeUpper === "LAINNYA" || typeUpper.includes("OTHER")) {
    return ARMADA_TYPES.LAINNYA;
  }
  return ARMADA_TYPES.GEROBAK;
};

const normalizeArmadaStatus = (status) => {
  const statusUpper = String(status || "").trim().toUpperCase();
  if (statusUpper === "MAINTENANCE") return ARMADA_STATUSES.MAINTENANCE;
  if (statusUpper === "IN_USE" || statusUpper.includes("USE")) return ARMADA_STATUSES.IN_USE;
  if (statusUpper === "RESERVED") return ARMADA_STATUSES.RESERVED;
  return ARMADA_STATUSES.ACTIVE;
};

export class ArmadaService {
  static instance = null;

  constructor(repo = armadaRepository) {
    if (ArmadaService.instance && repo === armadaRepository) {
      return ArmadaService.instance;
    }
    this.repo = repo;
    if (repo === armadaRepository) {
      ArmadaService.instance = this;
    }
  }

  static getInstance() {
    if (!ArmadaService.instance) {
      ArmadaService.instance = new ArmadaService();
    }
    return ArmadaService.instance;
  }

  async getAllArmadas(filters = {}) {
    const armadas = await this.repo.findAll(filters);
    return { armadas, count: armadas.length };
  }

  async getArmadaById(id) {
    const armada = await this.repo.findById(id);
    if (!armada) {
      const error = new Error(`Unit armada dengan ID '${id}' tidak ditemukan.`);
      error.statusCode = 404;
      throw error;
    }
    return armada;
  }

  async createArmada({ code, name, type = ARMADA_TYPES.GEROBAK, status = ARMADA_STATUSES.ACTIVE }) {
    const rawCode = code || name;
    if (!rawCode || typeof rawCode !== "string" || !rawCode.trim()) {
      const error = new Error("Nomor seri unit armada (code) harus diisi.");
      error.statusCode = 400;
      throw error;
    }

    const formattedCode = rawCode.trim().toUpperCase();

    const existing = await this.repo.findByCode(formattedCode);
    if (existing) {
      const error = new Error("Nomor seri unit sudah terdaftar.");
      error.statusCode = 400;
      throw error;
    }

    const finalType = normalizeArmadaType(type);
    const finalStatus = normalizeArmadaStatus(status);

    return await this.repo.create({
      code: formattedCode,
      type: finalType,
      status: finalStatus,
    });
  }

  async updateArmada(id, updateData = {}) {
    const existing = await this.getArmadaById(id);

    let formattedCode = existing.code;
    if (updateData.code && updateData.code.trim() !== "") {
      formattedCode = updateData.code.trim().toUpperCase();
      if (formattedCode !== existing.code) {
        const duplicate = await this.repo.findByCode(formattedCode);
        if (duplicate) {
          const error = new Error("Nomor seri unit sudah terdaftar.");
          error.statusCode = 400;
          throw error;
        }
      }
    }

    return await this.repo.update(id, {
      code: formattedCode,
      type: updateData.type || existing.type,
      status: updateData.status || existing.status,
      current_rider_id: updateData.current_rider_id !== undefined ? updateData.current_rider_id : existing.current_rider_id,
    });
  }

  async deleteArmada(id) {
    const existing = await this.getArmadaById(id);

    if (existing.status === ARMADA_STATUSES.IN_USE) {
      const error = new Error("Armada sedang digunakan oleh Rider dan tidak dapat dihapus.");
      error.statusCode = 400;
      throw error;
    }

    return await this.repo.delete(id);
  }

  async setMaintenance(id) {
    return await this.updateArmada(id, { status: ARMADA_STATUSES.MAINTENANCE });
  }

  async releaseMaintenance(id) {
    return await this.updateArmada(id, { status: ARMADA_STATUSES.ACTIVE, current_rider_id: null });
  }
}

export const armadaService = ArmadaService.getInstance();
