/*
 *   Copyright (c) 2026 
 *   All rights reserved.
 *   eventPublisher.js (Single Canonical Real-Time Event Publisher with Role Projection & Idempotency)
 */

import { socketManager } from "../socket/socketManager.js";
import { EVENT_TYPES } from "./eventTypes.js";
import {
  createEventEnvelope,
  generateDeterministicEventId,
  generateSlidingWindowDeduplicationId,
} from "./eventEnvelope.js";

export class EventPublisher {
  static instance = null;

  constructor(manager = socketManager) {
    if (EventPublisher.instance && manager === socketManager) {
      return EventPublisher.instance;
    }
    this.socketManager = manager;
    if (manager === socketManager) {
      EventPublisher.instance = this;
    }
  }

  static getInstance(manager = socketManager) {
    if (!EventPublisher.instance) {
      EventPublisher.instance = new EventPublisher(manager);
    }
    return EventPublisher.instance;
  }

  /**
   * 1. Publish Rider Assignment (Auto or Manual Plotting)
   */
  publishRiderAssigned({ assignmentId, riderId, zoneName, topsisRank = 1, assignmentType = "AUTO" }) {
    const eventId = generateDeterministicEventId("assign", assignmentId || riderId);
    const payload = createEventEnvelope({
      eventId,
      type: EVENT_TYPES.RIDER_ASSIGNED,
      data: {
        assignment_id: assignmentId,
        rider_id: riderId,
        zone_name: zoneName,
        topsis_rank: topsisRank,
        assignment_type: assignmentType,
        message: `🎉 ANDA TELAH DITUGASKAN! Anda berhasil diploting ke ${zoneName} (Prioritas TOPSIS Rank #${topsisRank}).`,
      },
    });

    // 1. Deliver to specific Rider private room
    this.socketManager.sendToRider(riderId, "rider:assigned_notification", payload);

    // 2. Broadcast to Supervisors room
    this.socketManager.broadcastToSupervisors("supervisor:rider_assigned", payload);

    console.log(`📡 [EVENT PUBLISHED] ${EVENT_TYPES.RIDER_ASSIGNED} -> Rider: ${riderId}, Zona: ${zoneName} (ID: ${eventId})`);
    return payload;
  }

  /**
   * 2. Publish Rider Geofence Check-in Event
   */
  publishRiderCheckedIn({ assignmentId, riderId, riderName, zoneId, zoneName, lat, lon }) {
    const eventId = generateDeterministicEventId("checkin", assignmentId || riderId);
    const payload = createEventEnvelope({
      eventId,
      type: EVENT_TYPES.RIDER_CHECKED_IN,
      data: {
        assignment_id: assignmentId,
        rider_id: riderId,
        rider_name: riderName,
        zone_id: zoneId,
        zone_name: zoneName,
        latitude: parseFloat(lat),
        longitude: parseFloat(lon),
        message: `📍 [CHECK-IN] Rider '${riderName}' telah tiba dan Check-in di ${zoneName}.`,
      },
    });

    this.socketManager.broadcastToSupervisors("supervisor:rider_checked_in", payload);
    console.log(`📡 [EVENT PUBLISHED] ${EVENT_TYPES.RIDER_CHECKED_IN} -> Rider: ${riderName} di ${zoneName} (ID: ${eventId})`);
    return payload;
  }

  /**
   * 3. Publish Rider Operational Session Checkout & Armada Return
   */
  publishRiderCheckedOut({ assignmentId, riderId, riderName, zoneId, zoneName, armadaId, armadaCode, returnStatus = "ACTIVE" }) {
    const eventId = generateDeterministicEventId("checkout", assignmentId || riderId);
    const payload = createEventEnvelope({
      eventId,
      type: EVENT_TYPES.RIDER_CHECKED_OUT,
      data: {
        assignment_id: assignmentId,
        rider_id: riderId,
        rider_name: riderName,
        zone_id: zoneId,
        zone_name: zoneName,
        armada_id: armadaId,
        armada_code: armadaCode,
        return_status: returnStatus,
        message: `🏁 [CHECKOUT] Rider '${riderName}' telah menyelesaikan sesi tugas di ${zoneName}. Armada '${armadaCode}' siap digunakan kembali.`,
      },
    });

    this.socketManager.broadcastToSupervisors("supervisor:rider_checked_out", payload);
    console.log(`📡 [EVENT PUBLISHED] ${EVENT_TYPES.RIDER_CHECKED_OUT} -> Rider: ${riderName} (ID: ${eventId})`);
    return payload;
  }

  /**
   * 4. Publish Armada Ticket-Booking Lock (Hold)
   */
  publishArmadaHeld({ armadaId, code, riderId }) {
    const eventId = generateDeterministicEventId("hold", armadaId, riderId);
    const payload = createEventEnvelope({
      eventId,
      type: EVENT_TYPES.ARMADA_HELD,
      data: {
        armada_id: armadaId,
        code,
        held_by_rider_id: riderId,
        is_claimable: false,
        is_faded_out: true,
      },
    });

    this.socketManager.broadcastAll("armada:held_broadcast", payload);
    console.log(`📡 [EVENT PUBLISHED] ${EVENT_TYPES.ARMADA_HELD} -> Armada '${code}' HELD (ID: ${eventId})`);
    return payload;
  }

  /**
   * 5. Publish Armada Lock Release
   */
  publishArmadaReleased({ armadaId, code }) {
    const eventId = generateDeterministicEventId("release", armadaId, String(Date.now()));
    const payload = createEventEnvelope({
      eventId,
      type: EVENT_TYPES.ARMADA_RELEASED,
      data: {
        armada_id: armadaId,
        code,
        is_claimable: true,
        is_faded_out: false,
      },
    });

    this.socketManager.broadcastAll("armada:released_broadcast", payload);
    console.log(`📡 [EVENT PUBLISHED] ${EVENT_TYPES.ARMADA_RELEASED} -> Armada '${code}' RELEASED (ID: ${eventId})`);
    return payload;
  }

  /**
   * 6. Publish Armada Permanent Claim (Status IN_USE)
   */
  publishArmadaClaimed({ armadaId, code, riderId, riderName }) {
    const eventId = generateDeterministicEventId("claim", armadaId);
    const payload = createEventEnvelope({
      eventId,
      type: EVENT_TYPES.ARMADA_CLAIMED,
      data: {
        armada_id: armadaId,
        code,
        claimed_by_rider_id: riderId,
        rider_name: riderName,
        is_claimable: false,
        status: "IN_USE",
      },
    });

    this.socketManager.broadcastAll("armada:claimed_broadcast", payload);
    console.log(`📡 [EVENT PUBLISHED] ${EVENT_TYPES.ARMADA_CLAIMED} -> Armada '${code}' CLAIMED by ${riderName} (ID: ${eventId})`);
    return payload;
  }

  /**
   * 7. Publish POS Sales Transaction Live Ticker with Field-Level Role Projection
   */
  publishSaleRecorded({
    saleId,
    assignmentId,
    riderId,
    riderName,
    zoneId,
    zoneName,
    productId,
    productName,
    qty,
    unitPrice,
    totalPrice,
  }) {
    const eventId = generateDeterministicEventId("sale", saleId);

    // A. Executive Management Room Payload (Full Financial Figures)
    const mgtPayload = createEventEnvelope({
      eventId,
      type: EVENT_TYPES.SALE_RECORDED,
      data: {
        sale_id: saleId,
        assignment_id: assignmentId,
        rider_id: riderId,
        rider_name: riderName,
        zone_id: zoneId,
        zone_name: zoneName,
        product_id: productId,
        product_name: productName,
        qty: parseInt(qty, 10),
        unit_price: parseFloat(unitPrice),
        total_price: parseFloat(totalPrice),
      },
    });

    // B. Supervisor Room Payload (Operational Volume Only - Financial Revenue Excluded)
    const spvPayload = createEventEnvelope({
      eventId,
      type: EVENT_TYPES.SALE_RECORDED,
      data: {
        sale_id: saleId,
        assignment_id: assignmentId,
        rider_id: riderId,
        rider_name: riderName,
        zone_id: zoneId,
        zone_name: zoneName,
        product_id: productId,
        product_name: productName,
        qty: parseInt(qty, 10),
      },
    });

    // Dispatch role-scoped payloads
    this.socketManager.broadcastToManagement("management:sale_recorded", mgtPayload);
    this.socketManager.broadcastToSupervisors("supervisor:sale_recorded", spvPayload);

    console.log(`📡 [EVENT PUBLISHED] ${EVENT_TYPES.SALE_RECORDED} -> Sale ${saleId}: ${qty}x ${productName} by ${riderName} (ID: ${eventId})`);
    return { mgtPayload, spvPayload };
  }

  /**
   * 8. Publish Geofence Breach Alert (Sliding Window Deduplication)
   */
  publishGeofenceBreach({ riderId, riderName, zoneName, lat, lon, message }) {
    // 10-second sliding time-window deduplication key
    const eventId = generateSlidingWindowDeduplicationId("geofence", riderId, 10);
    const payload = createEventEnvelope({
      eventId,
      type: EVENT_TYPES.GEOFENCE_BREACH,
      data: {
        rider_id: riderId,
        rider_name: riderName,
        zone_name: zoneName,
        latitude: parseFloat(lat),
        longitude: parseFloat(lon),
        message,
      },
    });

    // Send warning to Rider HP
    this.socketManager.sendToRider(riderId, "rider:geofence_warning", payload);

    // Broadcast alert to Supervisors
    this.socketManager.broadcastToSupervisors("supervisor:geofence_alert", payload);

    console.log(`📡 [EVENT PUBLISHED] ${EVENT_TYPES.GEOFENCE_BREACH} -> Rider: ${riderName} di luar ${zoneName} (ID: ${eventId})`);
    return payload;
  }
}

export const eventPublisher = EventPublisher.getInstance();
