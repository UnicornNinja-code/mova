/*
 *   Copyright (c) 2026 
 *   All rights reserved.
 *   distributionRepository.js (Data Access Layer for distribution_runs, rider_duty_queues, and zone_assignments)
 */

import { pool } from "../config/database.js";

export class DistributionRepository {
  static instance = null;

  constructor(dbPool = pool) {
    if (DistributionRepository.instance && dbPool === pool) {
      return DistributionRepository.instance;
    }
    this.pool = dbPool;
    if (dbPool === pool) {
      DistributionRepository.instance = this;
    }
  }

  static getInstance(dbPool = pool) {
    if (!DistributionRepository.instance) {
      DistributionRepository.instance = new DistributionRepository(dbPool);
    }
    return DistributionRepository.instance;
  }

  /**
   * Add rider to today's duty availability queue (FIFO)
   */
  async addRiderToDutyQueue(riderId) {
    const query = `
      INSERT INTO rider_duty_queues (rider_id, duty_date, confirmed_at, status)
      VALUES ($1, CURRENT_DATE, CURRENT_TIMESTAMP, 'WAITING')
      ON CONFLICT (rider_id, duty_date) DO UPDATE 
      SET status = 'WAITING', confirmed_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;
    const { rows } = await this.pool.query(query, [riderId]);
    return rows[0];
  }

  /**
   * Fetch active waiting riders for today in FIFO order (First-In-First-Out)
   */
  async getWaitingRidersQueue() {
    const query = `
      SELECT 
        q.id AS queue_id,
        q.rider_id,
        q.confirmed_at,
        q.status,
        u.name AS rider_name,
        u.username AS rider_username,
        u.email AS rider_email
      FROM rider_duty_queues q
      JOIN users u ON q.rider_id = u.id
      WHERE q.duty_date = CURRENT_DATE 
        AND q.status = 'WAITING'
      ORDER BY q.confirmed_at ASC;
    `;
    const { rows } = await this.pool.query(query);
    return rows;
  }

  /**
   * Count currently assigned riders per zone today
   */
  async getAssignedRidersCountPerZone() {
    const query = `
      SELECT zone_id, COUNT(*)::int AS assigned_count
      FROM zone_assignments
      WHERE assignment_date = CURRENT_DATE
        AND status IN ('ASSIGNED', 'CHECKED_IN', 'COMPLETED')
      GROUP BY zone_id;
    `;
    const { rows } = await this.pool.query(query);
    const countMap = {};
    rows.forEach((r) => {
      countMap[r.zone_id] = parseInt(r.assigned_count, 10);
    });
    return countMap;
  }

  /**
   * Create Distribution Execution Run Record
   */
  async createDistributionRun({
    dss_history_id = null,
    time_slot,
    execution_type = "AUTO",
    executed_by = null,
    total_waiting_riders = 0,
    total_assigned_riders = 0,
    total_unassigned_riders = 0,
    is_capacity_sufficient = true,
    summary = {},
  }) {
    const query = `
      INSERT INTO distribution_runs (
        dss_history_id, time_slot, execution_type, executed_by,
        total_waiting_riders, total_assigned_riders, total_unassigned_riders,
        is_capacity_sufficient, summary
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *;
    `;
    const { rows } = await this.pool.query(query, [
      dss_history_id,
      time_slot,
      execution_type,
      executed_by,
      total_waiting_riders,
      total_assigned_riders,
      total_unassigned_riders,
      is_capacity_sufficient,
      JSON.stringify(summary),
    ]);
    return rows[0];
  }

  /**
   * Fetch recent distribution runs
   */
  async findDistributionRuns(limit = 20) {
    const query = `
      SELECT 
        dr.*,
        u.name AS executed_by_name,
        u.role AS executed_by_role
      FROM distribution_runs dr
      LEFT JOIN users u ON dr.executed_by = u.id
      ORDER BY dr.created_at DESC
      LIMIT $1;
    `;
    const { rows } = await this.pool.query(query, [limit]);
    return rows;
  }

  /**
   * Fetch single distribution run by ID with associated assignments
   */
  async findDistributionRunById(id) {
    const runQuery = `
      SELECT 
        dr.*,
        u.name AS executed_by_name
      FROM distribution_runs dr
      LEFT JOIN users u ON dr.executed_by = u.id
      WHERE dr.id = $1;
    `;
    const { rows: runRows } = await this.pool.query(runQuery, [id]);
    if (!runRows[0]) return null;

    const assignmentsQuery = `
      SELECT 
        za.*,
        u.name AS rider_name,
        z.name AS zone_name,
        a.code AS armada_code
      FROM zone_assignments za
      JOIN users u ON za.rider_id = u.id
      JOIN zones z ON za.zone_id = z.id
      LEFT JOIN armadas a ON za.armada_id = a.id
      WHERE za.distribution_run_id = $1
      ORDER BY za.topsis_rank ASC NULLS LAST, za.created_at ASC;
    `;
    const { rows: assignRows } = await this.pool.query(assignmentsQuery, [id]);

    return {
      ...runRows[0],
      assignments: assignRows,
    };
  }

  /**
   * Create zone assignment for rider & update duty queue status (with DSS Linkage)
   */
  async createAssignment(params) {
    const rider_id = params.rider_id || params.riderId;
    const zone_id = params.zone_id || params.zoneId;
    const assigned_by = params.assigned_by || params.assignedBy || null;
    const assignment_type = params.assignment_type || params.assignmentType || "AUTO";
    const distribution_run_id = params.distribution_run_id || params.distributionRunId || null;
    const dss_history_id = params.dss_history_id || params.dssHistoryId || null;
    const topsis_rank = params.topsis_rank || params.topsisRank || null;
    const preference_score = params.preference_score || params.preferenceScore || null;
    const evaluation_version = params.evaluation_version || params.evaluationVersion || "DSS-CRITERIA-v1.0";
    const model_version = params.model_version || params.modelVersion || "BWM-TOPSIS-v1.0";
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      // 1. Insert or update zone_assignments with DSS Linkage
      const assignQuery = `
        INSERT INTO zone_assignments (
          rider_id, zone_id, assigned_by, assignment_type, assignment_date, status,
          distribution_run_id, dss_history_id, topsis_rank, preference_score,
          evaluation_version, model_version
        )
        VALUES ($1, $2, $3, $4, CURRENT_DATE, 'ASSIGNED', $5, $6, $7, $8, $9, $10)
        ON CONFLICT (rider_id, assignment_date) DO UPDATE
        SET zone_id = EXCLUDED.zone_id,
            assigned_by = EXCLUDED.assigned_by,
            assignment_type = EXCLUDED.assignment_type,
            distribution_run_id = EXCLUDED.distribution_run_id,
            dss_history_id = EXCLUDED.dss_history_id,
            topsis_rank = EXCLUDED.topsis_rank,
            preference_score = EXCLUDED.preference_score,
            evaluation_version = EXCLUDED.evaluation_version,
            model_version = EXCLUDED.model_version,
            status = 'ASSIGNED',
            created_at = CURRENT_TIMESTAMP
        RETURNING *;
      `;
      const { rows } = await client.query(assignQuery, [
        rider_id,
        zone_id,
        assigned_by,
        assignment_type,
        distribution_run_id,
        dss_history_id,
        topsis_rank,
        preference_score,
        evaluation_version,
        model_version,
      ]);
      const assignment = rows[0];

      // 2. Mark queue status as PLOTTED
      await client.query(
        `UPDATE rider_duty_queues SET status = 'PLOTTED' WHERE rider_id = $1 AND duty_date = CURRENT_DATE;`,
        [rider_id]
      );

      await client.query("COMMIT");
      return assignment;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get Unified Operational Status for Rider (One-Stop Status Aggregation)
   */
  async getRiderUnifiedStatus(riderId) {
    // 1. Check today's duty queue
    const queueQuery = `
      SELECT * FROM rider_duty_queues 
      WHERE rider_id = $1 AND duty_date = CURRENT_DATE;
    `;
    const { rows: queueRows } = await this.pool.query(queueQuery, [riderId]);
    const queueItem = queueRows[0] || null;

    // 2. Calculate FIFO queue position if WAITING
    let queuePosition = null;
    if (queueItem && queueItem.status === "WAITING") {
      const posQuery = `
        SELECT COUNT(*)::int AS position 
        FROM rider_duty_queues 
        WHERE duty_date = CURRENT_DATE 
          AND status = 'WAITING' 
          AND confirmed_at <= $1;
      `;
      const { rows: posRows } = await this.pool.query(posQuery, [queueItem.confirmed_at]);
      queuePosition = posRows[0]?.position || 1;
    }

    // 3. Check today's assignment
    const assignQuery = `
      SELECT 
        za.*,
        z.name AS zone_name,
        z.polygon AS zone_polygon,
        u.name AS assigned_by_name
      FROM zone_assignments za
      JOIN zones z ON za.zone_id = z.id
      LEFT JOIN users u ON za.assigned_by = u.id
      WHERE za.rider_id = $1 AND za.assignment_date = CURRENT_DATE;
    `;
    const { rows: assignRows } = await this.pool.query(assignQuery, [riderId]);
    const assignment = assignRows[0] || null;

    // 4. Check active/held armada
    const armadaQuery = `
      SELECT 
        id, code, type, status, reserved_until,
        CASE 
          WHEN current_rider_id = $1 THEN 'CLAIMED'
          WHEN reserved_by_rider_id = $1 AND reserved_until >= NOW() THEN 'HELD'
          ELSE 'NONE'
        END AS rider_relation
      FROM armadas
      WHERE current_rider_id = $1 
         OR (reserved_by_rider_id = $1 AND reserved_until >= NOW());
    `;
    const { rows: armadaRows } = await this.pool.query(armadaQuery, [riderId]);
    const armada = armadaRows[0] || null;

    let dutyStatus = "UNCONFIRMED";
    if (assignment) {
      dutyStatus = assignment.status; // 'ASSIGNED', 'CHECKED_IN', 'COMPLETED'
    } else if (queueItem) {
      dutyStatus = queueItem.status; // 'WAITING', 'PLOTTED'
    }

    return {
      duty_status: dutyStatus,
      queue_position: queuePosition,
      duty_confirmed_at: queueItem?.confirmed_at || null,
      assignment: assignment ? {
        id: assignment.id,
        zone_id: assignment.zone_id,
        zone_name: assignment.zone_name,
        assignment_type: assignment.assignment_type,
        status: assignment.status,
        topsis_rank: assignment.topsis_rank,
        preference_score: assignment.preference_score,
        dss_history_id: assignment.dss_history_id,
        distribution_run_id: assignment.distribution_run_id,
        evaluation_version: assignment.evaluation_version,
        model_version: assignment.model_version,
        assigned_at: assignment.created_at,
      } : null,
      fleet: armada ? {
        armada_id: armada.id,
        code: armada.code,
        type: armada.type,
        status: armada.rider_relation,
        reserved_until: armada.reserved_until,
      } : null,
    };
  }

  /**
   * Fetch personal operational duty & assignment history for a specific rider
   */
  async getRiderDutyHistory(riderId, limit = 30) {
    const query = `
      SELECT 
        za.id AS assignment_id,
        za.assignment_date,
        za.assignment_type,
        za.status AS assignment_status,
        za.topsis_rank,
        za.preference_score,
        za.dss_history_id,
        za.created_at AS assigned_at,
        z.id AS zone_id,
        z.name AS zone_name,
        a.id AS armada_id,
        a.code AS armada_code,
        a.type AS armada_type,
        q.confirmed_at AS duty_confirmed_at,
        q.status AS queue_status
      FROM zone_assignments za
      JOIN zones z ON za.zone_id = z.id
      LEFT JOIN armadas a ON za.armada_id = a.id
      LEFT JOIN rider_duty_queues q ON q.rider_id = za.rider_id AND q.duty_date = za.assignment_date
      WHERE za.rider_id = $1
      ORDER BY za.assignment_date DESC, za.created_at DESC
      LIMIT $2;
    `;
    const { rows } = await this.pool.query(query, [riderId, limit]);
    return rows;
  }

  /**
   * Aggregate complete rider operational status summary for today
   */
  async getRidersSummary() {
    // 1. Fetch all registered riders
    const ridersQuery = `
      SELECT id, name, username, email, phone, status AS user_status
      FROM users
      WHERE role = 'RIDER'
      ORDER BY name ASC;
    `;
    const { rows: allRiders } = await this.pool.query(ridersQuery);

    // 2. Fetch today's duty queue
    const queueQuery = `
      SELECT rider_id, status, confirmed_at
      FROM rider_duty_queues
      WHERE duty_date = CURRENT_DATE;
    `;
    const { rows: queueRows } = await this.pool.query(queueQuery);
    const queueMap = {};
    queueRows.forEach((q) => {
      queueMap[q.rider_id] = q;
    });

    // 3. Fetch today's assignments
    const assignQuery = `
      SELECT za.*, z.name AS zone_name, a.code AS armada_code
      FROM zone_assignments za
      JOIN zones z ON za.zone_id = z.id
      LEFT JOIN armadas a ON za.armada_id = a.id
      WHERE za.assignment_date = CURRENT_DATE;
    `;
    const { rows: assignRows } = await this.pool.query(assignQuery);
    const assignMap = {};
    assignRows.forEach((a) => {
      assignMap[a.rider_id] = a;
    });

    // 4. Fetch active operational sessions & live position
    const sessionQuery = `
      SELECT os.rider_id, os.status AS session_status, os.started_at, os.checked_in_at,
             lrp.latitude, lrp.longitude, lrp.zone_compliance, lrp.speed, lrp.is_inside_zone
      FROM operational_sessions os
      LEFT JOIN latest_rider_positions lrp ON os.rider_id = lrp.rider_id
      WHERE os.completed_at IS NULL;
    `;
    let sessionMap = {};
    try {
      const { rows: sessionRows } = await this.pool.query(sessionQuery);
      sessionRows.forEach((s) => {
        sessionMap[s.rider_id] = s;
      });
    } catch (e) {
      // ignore if tables not present
    }

    let unconfirmedCount = 0;
    let waitingQueueCount = 0;
    let plottedCount = 0;
    let operatingCount = 0;
    let deviatedCount = 0;
    let offDutyCount = 0;

    const detailedRiders = allRiders.map((r) => {
      const queueItem = queueMap[r.id] || null;
      const assignItem = assignMap[r.id] || null;
      const sessionItem = sessionMap[r.id] || null;

      let operationalStatus = "UNCONFIRMED";

      if (sessionItem && (sessionItem.session_status === "OPERATING" || sessionItem.session_status === "CHECKED_IN")) {
        if (sessionItem.zone_compliance === "DEVIATED") {
          operationalStatus = "DEVIATION";
          deviatedCount++;
        } else {
          operationalStatus = "OPERATING";
          operatingCount++;
        }
      } else if (assignItem) {
        if (assignItem.status === "CHECKED_IN") {
          operationalStatus = "OPERATING";
          operatingCount++;
        } else if (assignItem.status === "COMPLETED") {
          operationalStatus = "OFF_DUTY";
          offDutyCount++;
        } else if (assignItem.status === "CANCELLED") {
          operationalStatus = "OFF_DUTY";
          offDutyCount++;
        } else {
          operationalStatus = "PLOTTED";
          plottedCount++;
        }
      } else if (queueItem) {
        if (queueItem.status === "WAITING") {
          operationalStatus = "WAITING";
          waitingQueueCount++;
        } else if (queueItem.status === "CANCELLED") {
          operationalStatus = "OFF_DUTY";
          offDutyCount++;
        } else {
          operationalStatus = "PLOTTED";
          plottedCount++;
        }
      } else {
        operationalStatus = "UNCONFIRMED";
        unconfirmedCount++;
      }

      return {
        rider_id: r.id,
        name: r.name,
        username: r.username,
        email: r.email,
        phone: r.phone,
        status: operationalStatus,
        zone_id: assignItem?.zone_id || null,
        zone_name: assignItem?.zone_name || null,
        armada_code: assignItem?.armada_code || null,
        topsis_rank: assignItem?.topsis_rank || null,
        duty_confirmed_at: queueItem?.confirmed_at || null,
        checked_in_at: sessionItem?.checked_in_at || null,
        latitude: sessionItem?.latitude || null,
        longitude: sessionItem?.longitude || null,
      };
    });

    return {
      total_riders: allRiders.length,
      unconfirmed: unconfirmedCount,
      waiting_queue: waitingQueueCount,
      plotted: plottedCount,
      operating: operatingCount,
      deviated: deviatedCount,
      off_duty: offDutyCount,
      riders: detailedRiders,
    };
  }

  /**
   * Reset today's distribution assignments and duty queue for testing
   */
  async resetTodayDistribution() {
    await this.pool.query("DELETE FROM zone_assignments WHERE assignment_date = CURRENT_DATE;");
    await this.pool.query("DELETE FROM rider_duty_queues WHERE duty_date = CURRENT_DATE;");
    await this.pool.query("DELETE FROM distribution_runs WHERE created_at::date = CURRENT_DATE;");
  }
}

export const distributionRepository = DistributionRepository.getInstance();
