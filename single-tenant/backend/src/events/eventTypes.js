/*
 *   Copyright (c) 2026 
 *   All rights reserved.
 *   eventTypes.js (Canonical Event Type Definitions for Real-Time Streaming & Notifications)
 */

export const EVENT_TYPES = {
  // 1. Rider Assignment & Duty Lifecycle
  RIDER_ASSIGNED: "RIDER_ASSIGNED",
  RIDER_CHECKED_IN: "RIDER_CHECKED_IN",
  RIDER_CHECKED_OUT: "RIDER_CHECKED_OUT",

  // 2. Fleet / Armada Ticket-Booking Lifecycle
  ARMADA_HELD: "ARMADA_HELD",
  ARMADA_RELEASED: "ARMADA_RELEASED",
  ARMADA_CLAIMED: "ARMADA_CLAIMED",

  // 3. POS Sales Transaction Live Ticker
  SALE_RECORDED: "SALE_RECORDED",

  // 4. LBS Geospatial Tracking & Geofence
  RIDER_LOCATION_UPDATED: "RIDER_LOCATION_UPDATED",
  GEOFENCE_BREACH: "GEOFENCE_BREACH",

  // 5. System Announcements
  SYSTEM_ANNOUNCEMENT: "SYSTEM_ANNOUNCEMENT",
};
