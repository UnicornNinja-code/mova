import { auditRepository } from "../repositories/auditRepository.js";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 50;

export class AuditService {
  static instance = null;

  constructor(repo = auditRepository) {
    if (AuditService.instance && repo === auditRepository) {
      return AuditService.instance;
    }
    this.repo = repo;
    if (repo === auditRepository) {
      AuditService.instance = this;
    }
  }

  static getInstance() {
    if (!AuditService.instance) {
      AuditService.instance = new AuditService();
    }
    return AuditService.instance;
  }

  async getAuditLogs(filters = {}) {
    const logs = await this.repo.findAuditLogs(filters);
    return {
      logs,
      count: logs.length,
      page: filters.page || DEFAULT_PAGE,
      limit: filters.limit || DEFAULT_LIMIT,
    };
  }
}

export const auditService = AuditService.getInstance();
