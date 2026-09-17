/*
 * RiderOperationalService.ts
 * Clean Architecture Singleton Service for Rider Operational Engine in TypeScript
 * Supports Ticket-Booking Lock Mechanism & PostGIS Geofenced Check-in.
 */

import { riderOperationalRepository, RiderOperationalRepository } from "../../repositories/riderOperationalRepository.js";
import { productRepository } from "../../repositories/productRepository.js";
import { addArmadaHoldReleaseJob, removeArmadaHoldReleaseJob } from "../../queues/armadaHoldQueue.js";
import { broadcastArmadaHeld, broadcastArmadaReleased } from "../../socket/armadaLockSocketHandler.js";
import { eventPublisher } from "../../events/eventPublisher.js";
import { redisGeoService } from "../lbs/RedisGeoService.js";

export class RiderOperationalService {
  private static instance: RiderOperationalService | null = null;
  private repo: RiderOperationalRepository;

  constructor(repo: RiderOperationalRepository = riderOperationalRepository) {
    if (RiderOperationalService.instance && repo === riderOperationalRepository) {
      return RiderOperationalService.instance;
    }
    this.repo = repo;
    if (repo === riderOperationalRepository) {
      RiderOperationalService.instance = this;
    }
  }

  public static getInstance(): RiderOperationalService {
    if (!RiderOperationalService.instance) {
      RiderOperationalService.instance = new RiderOperationalService();
    }
    return RiderOperationalService.instance;
  }

  /**
   * Get Rider Active Session & Assignment Info
   */
  public async getRiderActiveSession(riderId: number | string): Promise<any> {
    const session = await this.repo.findActiveRiderSession(riderId);
    return {
      has_active_session: !!session,
      session: session || null,
    };
  }

  /**
   * Get Hub Armada Catalog
   */
  public async getHubArmadaCatalog(riderId: number | string): Promise<any> {
    const armadas = await this.repo.getAvailableArmadasForHub(riderId);
    return {
      armadas,
      total_units: armadas.length,
    };
  }

  /**
   * Inspect & Hold Armada (Ticket-Booking Temporary Lock - 3 Minutes / 180 Seconds)
   */
  public async inspectAndHoldArmada({
    riderId,
    armadaId,
  }: {
    riderId: number | string;
    armadaId: number | string;
  }): Promise<any> {
    if (!riderId || !armadaId) {
      const error: any = new Error("Rider ID dan Armada ID harus diisi.");
      error.statusCode = 400;
      throw error;
    }

    const heldArmada = await this.repo.holdArmadaUnit({ riderId, armadaId, holdMinutes: 3 });
    console.log(`🔒 [HOLD LOCK] Unit Armada ${heldArmada.code} sementara dikunci untuk Rider ${riderId} selama 3 menit.`);

    await addArmadaHoldReleaseJob({
      armadaId: heldArmada.id,
      riderId,
      delayMs: 3 * 60 * 1000,
    });

    broadcastArmadaHeld({
      armadaId: heldArmada.id,
      code: heldArmada.code,
      riderId,
      riderName: "Rider",
    });

    return {
      message: `Unit Armada ${heldArmada.code} berhasil dipilih. Mengalihkan ke Halaman Detail Informasi.`,
      armada: heldArmada,
    };
  }

  /**
   * Cancel Armada Hold
   */
  public async cancelArmadaHold({
    riderId,
    armadaId,
  }: {
    riderId: number | string;
    armadaId: number | string;
  }): Promise<any> {
    if (!riderId || !armadaId) {
      const error: any = new Error("Rider ID dan Armada ID harus diisi.");
      error.statusCode = 400;
      throw error;
    }

    const released = await this.repo.cancelArmadaHold({ riderId, armadaId });
    if (released) {
      await removeArmadaHoldReleaseJob(released.id || armadaId);
      broadcastArmadaReleased({
        armadaId: released.id,
        code: released.code,
      });
      console.log(`🔓 [CANCEL HOLD] Reservasi unit Armada ${released.code} dibatalkan oleh Rider ${riderId}.`);
    }

    return {
      message: "Reservasi armada dibatalkan. Armada kembali tersedia untuk dipilih.",
      armada: released,
    };
  }

  /**
   * Confirm Permanent Armada Claim with Checklist Verification
   */
  public async confirmArmadaClaim({
    riderId,
    armadaId,
    checklist,
    notes,
  }: {
    riderId: number | string;
    armadaId: number | string;
    checklist?: Record<string, any>;
    notes?: string;
  }): Promise<any> {
    if (!riderId || !armadaId) {
      const error: any = new Error("Rider ID dan Armada ID harus diisi.");
      error.statusCode = 400;
      throw error;
    }

    const sessionRes = await this.getRiderActiveSession(riderId);
    const assignmentId = sessionRes.session?.assignment_id;

    const claimedArmada = await this.repo.confirmArmadaClaim({
      riderId,
      armadaId,
      assignmentId,
      checklist,
      notes,
    });

    await removeArmadaHoldReleaseJob(claimedArmada.id || armadaId);

    eventPublisher.publishArmadaClaimed({
      armadaId: claimedArmada.id,
      code: claimedArmada.code,
      riderId,
      riderName: sessionRes.session?.rider_name || "Rider",
    });

    console.log(`🚚 [CLAIM ARMADA] Unit Armada ${claimedArmada.code} resmi diklaim oleh Rider ${riderId} (Status: IN_USE).`);

    return {
      message: `Armada ${claimedArmada.code} berhasil diklaim. Selamat bertugas!`,
      armada: claimedArmada,
    };
  }

  /**
   * Validate GPS Location and Check-in to Assigned Zone Polygon via PostGIS ST_Covers
   */
  public async checkInToZone({
    riderId,
    lat,
    lon,
  }: {
    riderId: number | string;
    lat: number | string;
    lon: number | string;
  }): Promise<any> {
    if (!riderId || lat === undefined || lon === undefined) {
      const error: any = new Error("Rider ID, Latitude, dan Longitude harus diisi untuk Check-in.");
      error.statusCode = 400;
      throw error;
    }

    const sessionRes = await this.getRiderActiveSession(riderId);
    if (!sessionRes.has_active_session) {
      const error: any = new Error("Anda tidak memiliki sesi penugasan zona aktif hari ini.");
      error.statusCode = 400;
      throw error;
    }

    const session = sessionRes.session;
    const checkInResult = await this.repo.validateAndCheckInRider({
      riderId,
      assignmentId: session.assignment_id,
      zoneId: session.zone_id,
      lat,
      lon,
    });

    eventPublisher.publishRiderCheckedIn({
      assignmentId: session.assignment_id,
      riderId,
      riderName: session.rider_name || "Rider",
      zoneId: session.zone_id,
      zoneName: checkInResult.zone_name,
      lat: parseFloat(String(lat)),
      lon: parseFloat(String(lon)),
    });

    console.log(`📍 [CHECK-IN SPASIAL] Rider ${riderId} berhasil Check-in di ${checkInResult.zone_name} (GPS: ${lat}, ${lon}).`);

    return {
      message: `Check-in Berhasil! Kehadiran Anda di ${checkInResult.zone_name} telah tervalidasi.`,
      check_in: checkInResult,
    };
  }

  /**
   * Record daily product sales log
   */
  public async recordProductSale({
    riderId,
    productId,
    quantity,
    paymentMethod = "CASH",
    idempotencyKey,
    lat,
    lon,
  }: {
    riderId: number | string;
    productId: number | string;
    quantity: number | string;
    paymentMethod?: string;
    idempotencyKey?: string;
    lat?: number;
    lon?: number;
  }): Promise<any> {
    if (!riderId || !productId || quantity === undefined) {
      const error: any = new Error("Rider ID, Product ID, dan Quantity harus diisi.");
      error.statusCode = 400;
      throw error;
    }

    const qty = parseInt(String(quantity), 10);
    if (isNaN(qty) || qty <= 0) {
      const error: any = new Error("Jumlah penjualan (quantity) harus angka positif lebih dari 0.");
      error.statusCode = 400;
      throw error;
    }

    const sessionRes = await this.getRiderActiveSession(riderId);
    if (!sessionRes.has_active_session) {
      const error: any = new Error("Anda tidak memiliki sesi operasional aktif hari ini.");
      error.statusCode = 400;
      throw error;
    }

    const session = sessionRes.session;

    if (session.assignment_status !== "CHECKED_IN") {
      const error: any = new Error("Anda belum melakukan Check-in di zona tugas. Harap lakukan Check-in lokasi terlebih dahulu sebelum mencatat penjualan.");
      error.statusCode = 400;
      throw error;
    }

    const product = await productRepository.findById(productId);
    if (!product) {
      const error: any = new Error(`Produk dengan ID '${productId}' tidak ditemukan di katalog menu.`);
      error.statusCode = 404;
      throw error;
    }

    if (product.status !== "AVAILABLE") {
      const error: any = new Error(`Produk '${product.name}' berstatus ${product.status} dan tidak dapat dijual.`);
      error.statusCode = 400;
      throw error;
    }

    const unitPrice = parseFloat(product.price);
    const totalPrice = parseFloat((qty * unitPrice).toFixed(2));

    const salesLog = await this.repo.insertSalesLog({
      riderId,
      zoneId: session.zone_id,
      assignmentId: session.assignment_id,
      productId,
      quantity: qty,
      unitPrice,
      totalPrice,
      paymentMethod,
      lat,
      lon,
    });

    eventPublisher.publishSaleRecorded({
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

    console.log(`💰 [SALES LOG] Rider ${riderId} mencatat penjualan ${qty}x ${product.name} (${paymentMethod} - Total: Rp${totalPrice.toLocaleString("id-ID")}).`);

    return {
      message: "Data penjualan produk berhasil dicatat.",
      sales_log: {
        ...salesLog,
        product_name: product.name,
        unit_price: unitPrice,
        total_price: totalPrice,
        payment_method: paymentMethod,
      },
    };
  }

  /**
   * Fetch personal sales history for authenticated rider
   */
  public async getMySalesHistory({
    riderId,
    date,
    page,
    limit,
  }: {
    riderId: number | string;
    date?: string | null;
    page?: number;
    limit?: number;
  }): Promise<any> {
    if (!riderId) {
      const error: any = new Error("Rider ID harus diisi.");
      error.statusCode = 400;
      throw error;
    }

    return await this.repo.getRiderSalesHistory({
      riderId,
      date,
      page,
      limit,
    });
  }

  /**
   * Checkout rider operational session & return armada unit
   */
  public async checkoutAndReturnArmada({
    riderId,
    returnStatus = "ACTIVE",
    inspectionCondition = {},
    notes = "",
    remainingCups = 0,
    actualCashSubmitted = 0,
    discrepancyAmount = 0,
    discrepancyReason = "",
  }: {
    riderId: number | string;
    returnStatus?: string;
    inspectionCondition?: Record<string, any>;
    notes?: string;
    remainingCups?: number;
    actualCashSubmitted?: number;
    discrepancyAmount?: number;
    discrepancyReason?: string;
  }): Promise<any> {
    if (!riderId) {
      const error: any = new Error("Rider ID harus diisi.");
      error.statusCode = 400;
      throw error;
    }

    const sessionRes = await this.getRiderActiveSession(riderId);
    if (!sessionRes.has_active_session) {
      const error: any = new Error("Anda tidak memiliki sesi operasional aktif untuk dicheckout.");
      error.statusCode = 400;
      throw error;
    }

    const session = sessionRes.session;
    const checkoutResult = await this.repo.checkoutRiderSession({
      assignmentId: session.assignment_id,
      armadaId: session.armada_id,
      riderId,
      returnStatus,
      inspectionCondition,
      notes,
      remainingCups,
      actualCashSubmitted,
      discrepancyAmount,
      discrepancyReason,
    });

    // Cleanup live location radar from Redis
    await redisGeoService.removeRiderLocation(riderId);

    eventPublisher.publishRiderCheckedOut({
      assignmentId: session.assignment_id,
      riderId,
      riderName: session.rider_name || "Rider",
      zoneId: session.zone_id,
      zoneName: session.zone_name,
      armadaId: session.armada_id,
      armadaCode: checkoutResult.armada_code,
      returnStatus: checkoutResult.armada_status || returnStatus,
    });

    if (session.armada_id) {
      eventPublisher.publishArmadaReleased({
        armadaId: session.armada_id,
        code: checkoutResult.armada_code,
      });
    }

    console.log(`🏁 [CHECKOUT SESSION] Sesi operasional Rider ${riderId} ditutup. Armada dikembalikan dengan status '${checkoutResult.armada_status || returnStatus}'.`);

    return {
      message: "Sesi operasional berhasil ditutup. Terima kasih atas kerja keras Anda hari ini!",
      checkout: checkoutResult,
    };
  }
}

export const riderOperationalService = RiderOperationalService.getInstance();
