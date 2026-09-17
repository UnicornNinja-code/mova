/*
 * armadaService.ts
 * REST API client for Fleet & Armada Management in TypeScript
 * Strictly aligned with swagger.ts contracts (Canonical Prefix /api/fleets with /api/armadas fallback)
 */

import { axiosInstance } from "../lib/axios";

export interface ArmadaItem {
  id: string | number;
  code: string;
  name?: string;
  type: "ELECTRIC_BIKE" | "GEROBAK" | "MOTOR_LISTRIK" | "LAINNYA" | string;
  status: "ACTIVE" | "AVAILABLE" | "RESERVED" | "IN_USE" | "MAINTENANCE" | "RETIRED" | string;
  fleet_status?: "ACTIVE" | "MAINTENANCE" | "RETIRED" | string;
  reservation_state?: "AVAILABLE" | "HELD";
  assignment_state?: "UNASSIGNED" | "IN_USE";
  battery_level?: number;
  notes?: string;
  current_rider_id?: string | number | null;
  current_rider_name?: string | null;
  reserved_by_rider_id?: string | number | null;
  reserved_by_rider_name?: string | null;
  reserved_until?: string | null;
  is_available_for_duty?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface FleetIssueItem {
  id: string;
  armada_id: string;
  armada_code?: string;
  armada_type?: string;
  reporter_id?: string;
  rider_id?: string;
  rider_name?: string;
  rider_email?: string;
  category?: string;
  severity?: "MINOR" | "CRITICAL" | string;
  issue_type?: string;
  description: string;
  status: "OPEN" | "REPORTED" | "IN_REVIEW" | "REPLACED" | "RESOLVED" | "SENT_TO_MAINTENANCE" | string;
  resolution_notes?: string;
  reported_at: string;
  resolved_at?: string;
  created_at?: string;
}

export const armadaService = {
  /**
   * Get all armadas (canonical /api/fleets with fallback /api/armadas)
   * GET /api/fleets
   */
  getAllArmadas: async (filters: { status?: string; type?: string; reservation_state?: string } = {}): Promise<ArmadaItem[]> => {
    try {
      const res = await axiosInstance.get("/fleets", { params: filters });
      return res.data?.armadas || res.data?.data || (Array.isArray(res.data) ? res.data : []);
    } catch {
      const fallback = await axiosInstance.get("/armadas", { params: filters });
      return fallback.data?.armadas || fallback.data?.data || (Array.isArray(fallback.data) ? fallback.data : []);
    }
  },

  /**
   * Get single armada by ID
   * GET /api/fleets/{id}
   */
  getArmadaById: async (id: number | string): Promise<ArmadaItem> => {
    try {
      const res = await axiosInstance.get(`/fleets/${id}`);
      return res.data?.armada || res.data?.data || res.data;
    } catch {
      const fallback = await axiosInstance.get(`/armadas/${id}`);
      return fallback.data?.armada || fallback.data?.data || fallback.data;
    }
  },

  /**
   * Create a new armada unit
   * POST /api/fleets
   */
  createArmada: async (data: {
    code: string;
    name?: string;
    type: string;
    status?: string;
    battery_level?: number;
    notes?: string;
  }): Promise<any> => {
    try {
      const res = await axiosInstance.post("/fleets", data);
      return res.data;
    } catch {
      const fallback = await axiosInstance.post("/armadas", data);
      return fallback.data;
    }
  },

  /**
   * Update armada unit
   * PUT /api/fleets/{id}
   */
  updateArmada: async (id: number | string, data: {
    code?: string;
    name?: string;
    type?: string;
    status?: string;
    battery_level?: number;
    notes?: string;
    current_rider_id?: number | string | null;
    force?: boolean;
  }): Promise<any> => {
    try {
      const res = await axiosInstance.put(`/fleets/${id}`, data);
      return res.data;
    } catch {
      const fallback = await axiosInstance.put(`/armadas/${id}`, data);
      return fallback.data;
    }
  },

  /**
   * Delete armada unit
   * DELETE /api/fleets/{id}
   */
  deleteArmada: async (id: number | string): Promise<any> => {
    try {
      const res = await axiosInstance.delete(`/fleets/${id}`);
      return res.data;
    } catch {
      const fallback = await axiosInstance.delete(`/armadas/${id}`);
      return fallback.data;
    }
  },

  /**
   * Report an issue / damage on armada
   * POST /api/armadas/{id}/report-issue
   */
  reportIssue: async (armadaId: string | number, data: {
    category?: string;
    severity?: string;
    issue_type?: string;
    description: string;
  }): Promise<any> => {
    const res = await axiosInstance.post(`/armadas/${armadaId}/report-issue`, {
      category: data.category || data.issue_type || "OTHER",
      description: data.description,
    });
    return res.data;
  },

  /**
   * Fetch all issue reports (Supervisor & Management)
   * GET /api/fleets/issues
   */
  getAllIssueReports: async (statusFilter?: string): Promise<FleetIssueItem[]> => {
    try {
      const res = await axiosInstance.get("/fleets/issues", { params: { status: statusFilter } });
      return res.data?.data || res.data?.issues || (Array.isArray(res.data) ? res.data : []);
    } catch {
      const fallback = await axiosInstance.get("/armadas/issues", { params: { status: statusFilter } });
      return fallback.data?.data || fallback.data?.issues || (Array.isArray(fallback.data) ? fallback.data : []);
    }
  },

  /**
   * Resolve an issue report
   * PUT /api/fleets/issues/{id}/resolve
   */
  resolveIssueReport: async (issueId: string | number, data: {
    status?: string;
    resolution_notes?: string;
  }): Promise<any> => {
    try {
      const res = await axiosInstance.put(`/fleets/issues/${issueId}/resolve`, {
        resolution_notes: data.resolution_notes || "Resolved",
      });
      return res.data;
    } catch {
      const fallback = await axiosInstance.put(`/armadas/issues/${issueId}/resolve`, data);
      return fallback.data;
    }
  },

  /**
   * Get assignment history of an armada
   * GET /api/armadas/{id}/history
   */
  getArmadaHistory: async (armadaId: string | number): Promise<any[]> => {
    const res = await axiosInstance.get(`/armadas/${armadaId}/history`);
    return res.data?.history || res.data?.data || (Array.isArray(res.data) ? res.data : []);
  },
};

export default armadaService;
