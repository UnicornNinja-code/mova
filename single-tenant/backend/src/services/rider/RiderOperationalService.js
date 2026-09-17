/*
 * RiderOperationalService.js
 * Domain Service for Milestone B-11: Rider Daily Operational Engine & Field Execution
 * Implements:
 * - Operational Sessions State Machine: CLAIMED -> CHECKED_IN -> OPERATING -> CHECKED_OUT -> COMPLETED
 * - PostGIS ST_Covers Spatial Check-In & Sale Zone Compliance
 * - Server-Side Financial Field Sales Recording with Provenance
 * - 5-Minute Ticket-Booking Hold Locks
 * - Decoupled Non-Blocking Socket.IO & BullMQ Event Transport
 */

import { riderOperationalRepository } from "../../repositories/riderOperationalRepository.js";
import { operationalSessionRepository } from "../../repositories/operationalSessionRepository.js";
import { productRepository } from "../../repositories/productRepository.js";
import { addArmadaHoldReleaseJob, removeArmadaHoldReleaseJob } from "../../queues/armadaHoldQueue.js";
import { broadcastArmadaHeld, broadcastArmadaReleased } from "../../socket/armadaLockSocketHandler.js";
import { eventPublisher } from "../../events/eventPublisher.js";
import { dashboardService } from "../dashboard/DashboardService.js";

/**
 * Coordinate parser and validator helper
 */
function parseAndValidateCoordinates(
  { lat, lon, latitude, longitude },
  { defaultLat = null, defaultLon = null, required = true } = {}
) {
  const rawLat = lat !== undefined ? lat : (latitude !== undefined ? latitude : defaultLat);
  const rawLon = lon !== undefined ? lon : (longitude !== undefined ? longitude : defaultLon);

  if (rawLat === null || rawLat === undefined || rawLon === null || rawLon === undefined) {
    if (required) {
      const error = new Error("Parameter koordinat 'latitude' dan 'longitude' wajib diisi.");
      error.statusCode = 400;
      throw error;
    }
    return { lat: null, lon: null };
  }

  const parsedLat = parseFloat(rawLat);
  const parsedLon = parseFloat(rawLon);

  if (isNaN(parsedLat) || parsedLat < -90 || parsedLat > 90) {
    const error = new Error("Parameter 'latitude' tidak valid (harus berada dalam rentang -90 hingga 90).");
    error.statusCode = 400;
    throw error;
  }

  if (isNaN(parsedLon) || parsedLon < -180 || parsedLon > 180) {
    const error = new Error("Parameter 'longitude' tidak valid (harus berada dalam rentang -180 hingga 180).");
    error.statusCode = 400;
    throw error;
  }

  return { lat: parsedLat, lon: parsedLon };
}

export class RiderOperationalService {
  static instance = null;

  constructor(
    repo = riderOperationalRepository,
    sessionRepo = operationalSessionRepository,
    productRepo = productRepository,
    eventPub = eventPublisher
  ) {
    if (RiderOperationalService.instance && repo === riderOperationalRepository) {
      return RiderOperationalService.instance;
    }
    this.repo = repo;
    this.sessionRepo = sessionRepo;
    this.productRepo = productRepo;
    this.eventPublisher = eventPub;

    if (repo === riderOperationalRepository) {
      RiderOperationalService.instance = this;
    }
  }

  static getInstance(
    repo = riderOperationalRepository,
    sessionRepo = operationalSessionRepository,
    productRepo = productRepository,
    eventPub = eventPublisher
  ) {
    if (!RiderOperationalService.instance) {
      RiderOperationalService.instance = new RiderOperationalService(repo, sessionRepo, productRepo, eventPub);
    }
    return RiderOperationalService.instance;
  }

  /**
   * Get Rider Active Session & Assignment Info
   */
  async getRiderActiveSession(riderId) {
    if (!riderId) {
      const error = new Error("Rider ID harus diisi.");
      error.statusCode = 400;
      throw error;
    }

    const session = await this.repo.findActiveRiderSession(riderId);
    return {
      has_active_session: !!session,
      session: session || null,
    };
  }

  /**
   * Get Hub Armada Catalog (Ticket-Booking Hold UX Status)
   */
  async getHubArmadaCatalog(riderId) {
    const armadas = await this.repo.getAvailableArmadasForHub(riderId);
    return {
      armadas,
      total_units: armadas.length,
    };
  }

  /**
   * Inspect & Hold Armada (Ticket-Booking Temporary Lock - 5 Minutes)
   */
  async inspectAndHoldArmada({ riderId, armadaId }) {
    if (!riderId || !armadaId) {
      const error = new Error("Rider ID dan Armada ID harus diisi.");
      error.statusCode = 400;
      throw error;
    }

    const heldArmada = await this.repo.holdArmadaUnit({ riderId, armadaId, holdMinutes: 5 });
    console.log(`🔒 [HOLD LOCK] Unit Armada ${heldArmada.code} sementara dikunci untuk Rider ${riderId} selama 5 menit.`);

    // Non-blocking BullMQ Delayed Job & Socket Broadcast
    try {
      await addArmadaHoldReleaseJob({
        armadaId: heldArmada.id,
        riderId,
        delayMs: 5 * 60 * 1000,
      });
    } catch (qErr) {
      console.warn("⚠️ BullMQ hold job warning:", qErr.message);
    }

    try {
      broadcastArmadaHeld({ armadaId: heldArmada.id, code: heldArmada.code, riderId });
    } catch (sErr) {
      console.warn("⚠️ Socket broadcast warning:", sErr.message);
    }

    return {
      message: `Unit Armada ${heldArmada.code} berhasil dipilih. Mengalihkan ke Halaman Detail Informasi.`,
      armada: heldArmada,
    };
  }

  /**
   * Cancel Armada Hold (Rider backs out / cancels inspection)
   */
  async cancelArmadaHold({ riderId, armadaId }) {
    if (!riderId || !armadaId) {
      const error = new Error("Rider ID dan Armada ID harus diisi.");
      error.statusCode = 400;
      throw error;
    }

    const released = await this.repo.cancelArmadaHold({ riderId, armadaId });
    if (!released) {
      const error = new Error("Unit armada tidak dalam status reservasi Anda.");
      error.statusCode = 400;
      throw error;
    }

    try {
      await removeArmadaHoldReleaseJob(released.id || armadaId);
    } catch (qErr) {}

    try {
      broadcastArmadaReleased({ armadaId: released.id || armadaId, code: released.code });
    } catch (sErr) {}

    console.log(`🔓 [RELEASE LOCK] Reservasi Unit Armada ${released.code} dibatalkan.`);
    return {
      message: `Klaim unit ${released.code} dibatalkan. Ketersediaan armada dikembalikan seperti semula.`,
      armada: released,
    };
  }

  /**
   * Confirm Final Claim on Armada (Permanent IN_USE Status)
   */
  async confirmArmadaClaim({ riderId, armadaId }) {
    if (!riderId || !armadaId) {
      const error = new Error("Rider ID dan Armada ID harus diisi.");
      error.statusCode = 400;
      throw error;
    }

    const sessionRes = await this.getRiderActiveSession(riderId);
    const assignmentId = sessionRes.session?.assignment_id || null;

    const claimed = await this.repo.confirmArmadaClaim({
      riderId,
      armadaId,
      assignmentId,
    });

    try {
      await removeArmadaHoldReleaseJob(claimed.id || armadaId);
    } catch (qErr) {}

    try {
      this.eventPublisher.publishArmadaClaimed({
        armadaId: claimed.id || armadaId,
        code: claimed.code,
        riderId,
        riderName: sessionRes.session?.rider_name || "Rider",
      });
    } catch (sErr) {}

    console.log(`✅ [CONFIRM CLAIM] Rider ${riderId} resmi mengklaim Unit Armada ${claimed.code}.`);

    return {
      message: `Selamat! Unit Armada ${claimed.code} berhasil diklaim. Silakan berkendara menuju zona tugas.`,
      armada: claimed,
    };
  }

  /**
   * Check-in Rider GPS coordinates to zone polygon via PostGIS ST_Covers
   * Explicit Lifecycle Transition: CLAIMED / ASSIGNED -> CHECKED_IN -> OPERATING
   */
  async checkInToZone({ riderId, lat, lon, latitude, longitude }) {
    if (!riderId) {
      const error = new Error("Parameter 'rider_id' wajib diisi.");
      error.statusCode = 400;
      throw error;
    }

    const { lat: finalLat, lon: finalLon } = parseAndValidateCoordinates(
      { lat, lon, latitude, longitude },
      { required: true }
    );

    const sessionRes = await this.getRiderActiveSession(riderId);
    if (!sessionRes.has_active_session) {
      const error = new Error("Anda tidak memiliki penugasan zona aktif hari ini.");
      error.statusCode = 400;
      throw error;
    }

    const session = sessionRes.session;

    const checkInResult = await this.repo.validateAndCheckInRider({
      riderId,
      assignmentId: session.assignment_id,
      sessionId: session.session_id || session.id,
      zoneId: session.zone_id,
      lat: finalLat,
      lon: finalLon,
    });

    // Real-Time Event Emission to Supervisors Room (Non-blocking)
    try {
      this.eventPublisher.publishRiderCheckedIn({
        assignmentId: session.assignment_id,
        riderId,
        riderName: session.rider_name || "Rider",
        zoneId: session.zone_id,
        zoneName: checkInResult.zone_name,
        lat: finalLat,
        lon: finalLon,
      });
    } catch (sockErr) {
      console.warn("⚠️ Non-blocking Socket.IO check-in publish error:", sockErr.message);
    }

    console.log(`📍 [CHECK-IN SPASIAL] Rider ${riderId} berhasil Check-in di ${checkInResult.zone_name} (GPS: ${finalLat}, ${finalLon}) -> Status: OPERATING.`);

    return {
      message: `Check-in Berhasil! Kehadiran Anda di ${checkInResult.zone_name} telah tervalidasi. Status operasional: OPERATING.`,
      check_in: checkInResult,
    };
  }

  /**
   * Record field product sales transaction with provenance & server-side pricing
   */
  async recordProductSale({ riderId, productId, quantity, lat, lon, latitude, longitude }) {
    if (!riderId || !productId || quantity === undefined) {
      const error = new Error("Parameter 'rider_id', 'product_id', dan 'quantity' wajib diisi.");
      error.statusCode = 400;
      throw error;
    }

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0 || qty > 10000 || !Number.isInteger(Number(quantity))) {
      const error = new Error("Jumlah penjualan (quantity) harus berupa bilangan bulat positif antara 1 dan 10.000.");
      error.statusCode = 400;
      throw error;
    }

    const { lat: finalLat, lon: finalLon } = parseAndValidateCoordinates(
      { lat, lon, latitude, longitude },
      { defaultLat: -7.4478, defaultLon: 112.7183, required: false }
    );

    // 1. Validate active session
    const sessionRes = await this.getRiderActiveSession(riderId);
    if (!sessionRes.has_active_session) {
      const error = new Error("Anda tidak memiliki sesi operasional aktif hari ini.");
      error.statusCode = 400;
      throw error;
    }

    const session = sessionRes.session;

    // 2. Validate session state: must NOT be COMPLETED or CHECKED_OUT, and must be CHECKED_IN / OPERATING
    if (["COMPLETED", "CHECKED_OUT"].includes(session.session_status) || ["COMPLETED", "CANCELLED"].includes(session.assignment_status)) {
      const error = new Error("Sesi operasional Anda telah ditutup. Tidak dapat mencatat transaksi penjualan baru.");
      error.statusCode = 400;
      throw error;
    }

    const isCheckedIn = session.assignment_status === "CHECKED_IN" || ["CHECKED_IN", "OPERATING"].includes(session.session_status);
    if (!isCheckedIn) {
      const error = new Error("Anda harus melakukan check-in spasial di zona terlebih dahulu sebelum mencatat penjualan.");
      error.statusCode = 400;
      throw error;
    }

    // 3. Validate Master Product existence and AVAILABLE status
    const product = await this.productRepo.findById(productId);
    if (!product) {
      const error = new Error(`Produk dengan ID '${productId}' tidak ditemukan di katalog menu.`);
      error.statusCode = 404;
      throw error;
    }

    if (product.status !== "AVAILABLE") {
      const error = new Error(`Produk '${product.name}' berstatus ${product.status} dan tidak dapat dijual.`);
      error.statusCode = 400;
      throw error;
    }

    // 4. Server-side price snapshot & total calculation
    const unitPrice = parseFloat(product.price);
    const totalPrice = parseFloat((qty * unitPrice).toFixed(2));

    // 5. Spatial Zone Compliance Evaluation at Sale Time via Repository
    let actualZoneId = null;
    let complianceAtSale = "OUTSIDE_ZONE";

    try {
      const actualZone = await this.repo.findZoneCoveringPoint({
        lon: finalLon,
        lat: finalLat,
        prioritizedZoneId: session.zone_id,
      });

      if (actualZone) {
        actualZoneId = actualZone.id;
        complianceAtSale = (actualZoneId === session.zone_id) ? "COMPLIANT" : "DEVIATED";
      } else {
        complianceAtSale = "OUTSIDE_ZONE";
      }
    } catch (zErr) {
      complianceAtSale = "COMPLIANT";
    }

    // 6. Insert into sales_logs with session and compliance linkage
    const salesLog = await this.repo.insertSalesLog({
      sessionId: session.session_id || null,
      assignmentId: session.assignment_id || session.id || null,
      riderId,
      zoneId: session.zone_id,
      actualZoneId,
      complianceAtSale,
      productId,
      quantity: qty,
      unitPrice,
      totalPrice,
      lat: finalLat,
      lon: finalLon,
    });

    // 7. Post-Commit Dashboard Read-Model Cache Invalidation
    try {
      await dashboardService.invalidateDashboardSummaryCache(salesLog.created_at);
    } catch (cacheErr) {
      console.warn("⚠️ [DASHBOARD CACHE] Failed to invalidate summary cache post-sale:", cacheErr.message);
    }

    // 8. Non-blocking Real-Time Event Emission
    try {
      this.eventPublisher.publishSaleRecorded({
        saleId: salesLog.id,
        assignmentId: session.assignment_id,
        riderId,
        riderName: session.rider_name || "Rider",
        zoneId: session.zone_id,
        zoneName: session.zone_name,
        productId,
        productName: product.name,
        qty,
        unitPrice,
        totalPrice,
      });
    } catch (sockErr) {
      console.warn("⚠️ Non-blocking Socket.IO sale publish error:", sockErr.message);
    }

    console.log(`💰 [SALES LOG] Rider ${riderId} mencatat penjualan ${qty}x ${product.name} (Total: Rp${totalPrice.toLocaleString("id-ID")}) [Compliance: ${complianceAtSale}].`);

    return {
      message: "Data penjualan produk berhasil dicatat.",
      sales_log: {
        ...salesLog,
        product_name: product.name,
        unit_price: unitPrice,
        total_price: totalPrice,
        compliance_at_sale: complianceAtSale,
      },
    };
  }

  /**
   * Fetch personal sales history for authenticated rider
   */
  async getMySalesHistory({ riderId, date, page, limit }) {
    if (!riderId) {
      const error = new Error("Rider ID harus diisi.");
      error.statusCode = 400;
      throw error;
    }

    const result = await this.repo.getRiderSalesHistory({
      riderId,
      date,
      page,
      limit,
    });

    return result;
  }

  /**
   * Checkout rider operational session & return armada unit
   * Lifecycle Transition: OPERATING -> CHECKED_OUT / COMPLETED
   */
  async checkoutAndReturnArmada({ riderId, returnStatus = "ACTIVE", lat = null, lon = null, notes = "" }) {
    if (!riderId) {
      const error = new Error("Rider ID harus diisi.");
      error.statusCode = 400;
      throw error;
    }

    const sessionRes = await this.getRiderActiveSession(riderId);
    if (!sessionRes.has_active_session) {
      const error = new Error("Anda tidak memiliki sesi operasional aktif untuk dicheckout.");
      error.statusCode = 400;
      throw error;
    }

    const session = sessionRes.session;
    const checkoutResult = await this.repo.checkoutRiderSession({
      sessionId: session.session_id || session.id,
      assignmentId: session.assignment_id,
      armadaId: session.armada_id,
      returnStatus,
      lat,
      lon,
      notes,
    });

    // Post-Commit Dashboard Read-Model Cache Invalidation
    try {
      await dashboardService.invalidateDashboardSummaryCache();
    } catch (cacheErr) {
      console.warn("⚠️ [DASHBOARD CACHE] Failed to invalidate summary cache post-checkout:", cacheErr.message);
    }

    // 1. Emit Session Checkout to Supervisors Room (Non-blocking)
    try {
      this.eventPublisher.publishRiderCheckedOut({
        assignmentId: session.assignment_id,
        riderId,
        riderName: session.rider_name || "Rider",
        zoneId: session.zone_id,
        zoneName: session.zone_name,
        armadaId: session.armada_id,
        armadaCode: session.armada_code,
        returnStatus,
      });
    } catch (sockErr) {}

    // 2. Emit Armada Lock Release to all Riders Hub UI
    try {
      if (session.armada_id) {
        this.eventPublisher.publishArmadaReleased({
          armadaId: session.armada_id,
          code: session.armada_code,
        });
      }
    } catch (sockErr) {}

    console.log(`🏁 [CHECKOUT SESSION] Sesi operasional Rider ${riderId} ditutup. Armada '${session.armada_code || session.armada_id}' dikembalikan dengan status '${returnStatus}'.`);

    return {
      message: "Sesi operasional berhasil ditutup. Terima kasih atas kerja keras Anda hari ini!",
      checkout: checkoutResult,
    };
  }
}

export const riderOperationalService = RiderOperationalService.getInstance();
