/*
 * FleetStateMachineService.ts
 * Clean Architecture Singleton Service for Fleet Claim, Atomic 5-Minute Reservation & State Machine
 * 
 * State Machine Transitions:
 * [ACTIVE] ──(reserveFleet 5-min hold)──> [RESERVED] ──(confirmClaim)──> [IN_USE] ──(releaseAndReturn)──> [ACTIVE]
 *                                              │
 *                                    (cancel / expire rollback)
 *                                              ▼
 *                                          [ACTIVE]
 */

import { pool } from "../../config/database.js";
import { redisClient } from "../../config/redis.js";
import { withTenantContext, withSystemBypassContext } from "../../lib/tenantContext.js";

export interface ReservationResult {
  reservation_id: string;
  armada_id: string;
  armada_code: string;
  rider_id: string;
  status: "ACTIVE" | "CLAIMED" | "EXPIRED" | "CANCELLED";
  expires_at: string;
  expires_in_seconds: number;
}

export interface ClaimResult {
  assignment_id: string;
  armada_id: string;
  armada_code: string;
  rider_id: string;
  zone_id: string | null;
  status: "IN_USE";
  claimed_at: string;
}

export interface ReturnResult {
  armada_id: string;
  armada_code: string;
  rider_id: string;
  status: "ACTIVE";
  returned_at: string;
}

export class FleetStateMachineService {
  private static instance: FleetStateMachineService | null = null;

  public static getInstance(): FleetStateMachineService {
    if (!FleetStateMachineService.instance) {
      FleetStateMachineService.instance = new FleetStateMachineService();
    }
    return FleetStateMachineService.instance;
  }

  /**
   * 1. Melakukan Reservasi / Hold Armada selama 5 Menit (Race Condition Protected)
   */
  public async reserveFleet(
    tenantId: string,
    armadaId: string,
    riderId: string,
    holdDurationSeconds: number = 300
  ): Promise<ReservationResult> {
    const lockKey = `fleet:claim:${tenantId}:${armadaId}`;

    return withTenantContext(tenantId, async (client) => {
      // Step 1: Cek apakah rider sudah memiliki reservasi aktif atau armada yang sedang in-use
      const riderCheck = await client.query(
        `SELECT id, status FROM armadas WHERE tenant_id = $1 AND current_rider_id = $2 AND status IN ('RESERVED', 'IN_USE');`,
        [tenantId, riderId]
      );
      if (riderCheck.rows.length > 0) {
        throw new Error("RIDER_ALREADY_HAS_ACTIVE_FLEET: Rider sudah memiliki reservasi atau unit armada aktif.");
      }

      // Step 2: Redis Distributed Lock (Fast-Path Concurrency Gate)
      let acquired = false;
      try {
        const setRes = await redisClient.set(lockKey, riderId, "EX", holdDurationSeconds, "NX");
        acquired = setRes === "OK";
      } catch {
        // Fallback jika Redis tidak responsif
        acquired = true;
      }

      if (!acquired) {
        throw new Error("FLEET_ALREADY_RESERVED: Unit armada sedang dalam proses reservasi oleh rider lain.");
      }

      // Step 3: Atomic PostgreSQL Transaction (Source of Truth)
      const armadaUpdate = await client.query(
        `UPDATE armadas
         SET status = 'RESERVED',
             current_rider_id = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
           AND status = 'ACTIVE'
         RETURNING id, code, status;`,
        [armadaId, riderId]
      );

      if (armadaUpdate.rows.length === 0) {
        // Rollback Redis lock
        try {
          await redisClient.del(lockKey);
        } catch {}
        throw new Error("FLEET_NOT_AVAILABLE: Unit armada tidak tersedia untuk direservasi (status bukan ACTIVE).");
      }

      const armada = armadaUpdate.rows[0];

      // Step 4: Insert record ke tabel fleet_reservations
      const resInsert = await client.query(
        `INSERT INTO fleet_reservations (
          tenant_id, armada_id, rider_id, status, expires_at
        ) VALUES (
          $1, $2, $3, 'ACTIVE', CURRENT_TIMESTAMP + ($4 || ' seconds')::interval
        ) RETURNING id, armada_id, rider_id, status, expires_at;`,
        [tenantId, armadaId, riderId, holdDurationSeconds]
      );

      const reservation = resInsert.rows[0];

      return {
        reservation_id: reservation.id,
        armada_id: armada.id,
        armada_code: armada.code,
        rider_id: riderId,
        status: "ACTIVE",
        expires_at: reservation.expires_at.toISOString(),
        expires_in_seconds: holdDurationSeconds,
      };
    });
  }

  /**
   * 2. Konfirmasi Klaim & Check-In Fisik Armada (RESERVED -> IN_USE)
   */
  public async confirmClaimAndCheckIn(
    tenantId: string,
    armadaId: string,
    riderId: string,
    zoneId?: string | null,
    inspectionChecklist: any = {}
  ): Promise<ClaimResult> {
    const lockKey = `fleet:claim:${tenantId}:${armadaId}`;

    return withTenantContext(tenantId, async (client) => {
      // Step 1: Validasi keberlakuan reservasi
      const resCheck = await client.query(
        `SELECT id, status, expires_at 
         FROM fleet_reservations
         WHERE tenant_id = $1
           AND armada_id = $2
           AND rider_id = $3
           AND status = 'ACTIVE'
         ORDER BY created_at DESC
         LIMIT 1;`,
        [tenantId, armadaId, riderId]
      );

      if (resCheck.rows.length === 0) {
        throw new Error("NO_ACTIVE_RESERVATION: Tidak ditemukan tiket reservasi aktif untuk unit armada dan rider ini.");
      }

      const reservation = resCheck.rows[0];
      if (new Date(reservation.expires_at) < new Date()) {
        throw new Error("RESERVATION_EXPIRED: Masa berlaku reservasi 5-menit telah kedaluwarsa.");
      }

      // Step 2: Atomic State Transition (RESERVED -> IN_USE)
      const armadaUpdate = await client.query(
        `UPDATE armadas
         SET status = 'IN_USE',
             current_rider_id = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
           AND status = 'RESERVED'
           AND current_rider_id = $2
         RETURNING id, code, status;`,
        [armadaId, riderId]
      );

      if (armadaUpdate.rows.length === 0) {
        throw new Error("CLAIM_FAILED: Gagal mengklaim armada. Unit tidak dalam status RESERVED oleh rider ini.");
      }

      const armada = armadaUpdate.rows[0];

      // Step 3: Update status reservasi menjadi CLAIMED
      await client.query(
        `UPDATE fleet_reservations
         SET status = 'CLAIMED',
             released_at = CURRENT_TIMESTAMP
         WHERE id = $1;`,
        [reservation.id]
      );

      // Step 4: Buat penugasan operasional di fleet_assignments
      const assignInsert = await client.query(
        `INSERT INTO fleet_assignments (
          tenant_id, armada_id, rider_id, zone_id, status, initial_condition
        ) VALUES (
          $1, $2, $3, $4, 'IN_USE', $5
        ) RETURNING id, armada_id, rider_id, zone_id, status, claimed_at;`,
        [tenantId, armadaId, riderId, zoneId || null, JSON.stringify(inspectionChecklist)]
      );

      const assignment = assignInsert.rows[0];

      // Step 5: Update Redis state
      try {
        await redisClient.del(lockKey);
        await redisClient.set(`fleet:in_use:${tenantId}:${armadaId}`, riderId);
      } catch {}

      return {
        assignment_id: assignment.id,
        armada_id: armada.id,
        armada_code: armada.code,
        rider_id: riderId,
        zone_id: assignment.zone_id,
        status: "IN_USE",
        claimed_at: assignment.claimed_at.toISOString(),
      };
    });
  }

  /**
   * 3. Selesai Beroperasi & Pengembalian Armada (IN_USE -> ACTIVE)
   */
  public async releaseAndReturnFleet(
    tenantId: string,
    armadaId: string,
    riderId: string,
    returnCondition: any = {}
  ): Promise<ReturnResult> {
    return withTenantContext(tenantId, async (client) => {
      // Step 1: Atomic state transition (IN_USE -> ACTIVE, clear rider)
      const armadaUpdate = await client.query(
        `UPDATE armadas
         SET status = 'ACTIVE',
             current_rider_id = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
           AND status = 'IN_USE'
           AND current_rider_id = $2
         RETURNING id, code, status;`,
        [armadaId, riderId]
      );

      if (armadaUpdate.rows.length === 0) {
        throw new Error("RETURN_FAILED: Gagal mengembalikan armada. Unit tidak dalam status IN_USE oleh rider ini.");
      }

      const armada = armadaUpdate.rows[0];

      // Step 2: Tutup penugasan di fleet_assignments
      await client.query(
        `UPDATE fleet_assignments
         SET status = 'RETURNED',
             returned_at = CURRENT_TIMESTAMP,
             return_condition = $4,
             updated_at = CURRENT_TIMESTAMP
         WHERE tenant_id = $1
           AND armada_id = $2
           AND rider_id = $3
           AND status = 'IN_USE';`,
        [tenantId, armadaId, riderId, JSON.stringify(returnCondition)]
      );

      // Step 3: Bersihkan Redis cache
      try {
        await redisClient.del(`fleet:claim:${tenantId}:${armadaId}`);
        await redisClient.del(`fleet:in_use:${tenantId}:${armadaId}`);
      } catch {}

      return {
        armada_id: armada.id,
        armada_code: armada.code,
        rider_id: riderId,
        status: "ACTIVE",
        returned_at: new Date().toISOString(),
      };
    });
  }

  /**
   * 4. Pembatalan Reservasi Sukarela oleh Rider (RESERVED -> ACTIVE)
   */
  public async cancelReservation(
    tenantId: string,
    armadaId: string,
    riderId: string
  ): Promise<{ message: string; armada_id: string }> {
    const lockKey = `fleet:claim:${tenantId}:${armadaId}`;

    return withTenantContext(tenantId, async (client) => {
      // Rollback status armada
      const armadaUpdate = await client.query(
        `UPDATE armadas
         SET status = 'ACTIVE',
             current_rider_id = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
           AND status = 'RESERVED'
           AND current_rider_id = $2
         RETURNING id;`,
        [armadaId, riderId]
      );

      if (armadaUpdate.rows.length === 0) {
        throw new Error("CANCEL_FAILED: Reservasi tidak dapat dibatalkan (unit tidak berstatus RESERVED oleh rider ini).");
      }

      // Update tiket reservasi menjadi CANCELLED
      await client.query(
        `UPDATE fleet_reservations
         SET status = 'CANCELLED',
             released_at = CURRENT_TIMESTAMP
         WHERE tenant_id = $1
           AND armada_id = $2
           AND rider_id = $3
           AND status = 'ACTIVE';`,
        [tenantId, armadaId, riderId]
      );

      // Bersihkan Redis lock
      try {
        await redisClient.del(lockKey);
      } catch {}

      return {
        message: "Reservasi armada berhasil dibatalkan.",
        armada_id: armadaId,
      };
    });
  }

  /**
   * 5. Rekonsiliasi Otomatis Reservasi Kedaluwarsa (Expired Reservations Rollback)
   */
  public async reconcileExpiredReservations(tenantId?: string): Promise<{ expired_count: number }> {
    return withSystemBypassContext(async (client) => {
      const tenantClause = tenantId ? `AND r.tenant_id = '${tenantId}'` : "";

      // Cari seluruh reservasi yang expired_at < NOW() dan status masih ACTIVE
      const { rows: expiredList } = await client.query(
        `SELECT r.id as reservation_id, r.tenant_id, r.armada_id, r.rider_id
         FROM fleet_reservations r
         WHERE r.status = 'ACTIVE'
           AND r.expires_at < CURRENT_TIMESTAMP
           ${tenantClause};`
      );

      for (const item of expiredList) {
        // Rollback status armada ke ACTIVE jika masih RESERVED oleh rider tersebut
        await client.query(
          `UPDATE armadas
           SET status = 'ACTIVE',
               current_rider_id = NULL,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1
             AND status = 'RESERVED'
             AND current_rider_id = $2;`,
          [item.armada_id, item.rider_id]
        );

        // Update status reservasi menjadi EXPIRED
        await client.query(
          `UPDATE fleet_reservations
           SET status = 'EXPIRED',
               released_at = CURRENT_TIMESTAMP
           WHERE id = $1;`,
          [item.reservation_id]
        );

        // Bersihkan Redis lock
        try {
          await redisClient.del(`fleet:claim:${item.tenant_id}:${item.armada_id}`);
        } catch {}
      }

      return { expired_count: expiredList.length };
    });
  }
}

export const fleetStateMachineService = FleetStateMachineService.getInstance();
