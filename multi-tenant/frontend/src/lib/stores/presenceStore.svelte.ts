/*
 * presenceStore.svelte.ts
 * Production-Hardened Svelte 5 Reactive State Store for Stage 6 Operational Presence
 * Features:
 * - Synchronization Generation Guard (Anti-Race Condition on Reconnect)
 * - Automatic REST Resync on Socket.IO Reconnection
 * - Non-destructive incremental state mutations
 * - Observability integration with Zero-PII diagnostics
 * - Teardown / Cleanup for Zero Memory Leaks
 */

import { getSocket } from "../socket.js";
import { axiosInstance } from "../axios.js";
import { presenceTelemetry, type SocketConnectionState } from "./presenceTelemetry.svelte.js";

export interface LiveRiderTelemetry {
  rider_id: string;
  rider_name: string;
  fleet_code?: string;
  assigned_zone_id: string | null;
  assigned_zone_name: string | null;
  actual_zone_id: string | null;
  actual_zone_name: string | null;
  compliance_status: "COMPLIANT" | "DEVIATED" | "UNASSIGNED" | "OUTSIDE";
  event_type: "ENTER" | "EXIT" | "ON_SITE" | "OUTSIDE_ZONE" | "DEVIATED";
  latitude: number;
  longitude: number;
  speed_mps: number;
  heading_degrees: number;
  accuracy_meters?: number;
  last_ping: string;
}

export interface OperationalAlertItem {
  alert_id: string;
  tenant_id: string;
  rider_id: string;
  rider_name: string;
  assigned_zone_id: string | null;
  assigned_zone_name: string | null;
  actual_zone_id: string | null;
  actual_zone_name: string | null;
  deviation_type: "ZONE_DEVIATION" | "RESTRICTED_ROAD" | "GPS_STALE";
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "AUTO_RECOVERED";
  latitude: number;
  longitude: number;
  created_at: string;
  acknowledged_at?: string | null;
  acknowledged_by?: string | null;
  resolved_at?: string | null;
  resolved_by?: string | null;
  notes?: string | null;
}

export interface TransitionFeedItem {
  id: string;
  tenant_id: string;
  rider_id: string;
  rider_name: string;
  event_type: "ENTER" | "EXIT" | "ON_SITE" | "OUTSIDE_ZONE" | "DEVIATED";
  compliance_status: "COMPLIANT" | "DEVIATED" | "UNASSIGNED" | "OUTSIDE";
  actual_zone_id: string | null;
  actual_zone_name: string | null;
  assigned_zone_id: string | null;
  assigned_zone_name: string | null;
  latitude: number;
  longitude: number;
  captured_at: string;
}

export class PresenceStore {
  // Svelte 5 Reactive State Runes
  liveRiders = $state<Map<string, LiveRiderTelemetry>>(new Map());
  activeAlerts = $state<OperationalAlertItem[]>([]);
  recentTransitions = $state<TransitionFeedItem[]>([]);
  zonesGeoJson = $state<any[]>([]);

  // Filtering & Selection State
  activeStatusFilter = $state<string>("ALL"); // 'ALL' | 'COMPLIANT' | 'DEVIATED' | 'UNASSIGNED' | 'OUTSIDE'
  selectedZoneFilter = $state<string>("ALL");
  searchQuery = $state<string>("");
  selectedRiderId = $state<string | null>(null);
  selectedZoneId = $state<string | null>(null);
  mapFocusTarget = $state<{ latitude: number; longitude: number; zoom?: number } | null>(null);

  // Connection & Lifecycle State
  connectionState = $state<SocketConnectionState>("INITIALIZING");
  isLoading = $state<boolean>(false);
  lastSyncTimestamp = $state<string>(new Date().toISOString());
  reconnectAttempts = $state<number>(0);

  // Anti-Race Condition: Synchronization Generation Counter
  private syncGeneration = 0;
  private socketListenersBound = false;
  private staleCheckInterval: ReturnType<typeof setInterval> | null = null;

  // Derived KPIs
  kpi = $derived({
    total: this.liveRiders.size,
    compliant: Array.from(this.liveRiders.values()).filter((r) => r.compliance_status === "COMPLIANT").length,
    deviated: Array.from(this.liveRiders.values()).filter((r) => r.compliance_status === "DEVIATED").length,
    unassigned: Array.from(this.liveRiders.values()).filter((r) => r.compliance_status === "UNASSIGNED").length,
    outside: Array.from(this.liveRiders.values()).filter((r) => r.compliance_status === "OUTSIDE").length,
    openAlertsCount: this.activeAlerts.filter((a) => a.status === "OPEN" || a.status === "ACKNOWLEDGED").length,
  });

  // Filtered Riders List for Data Grid & Map Display
  filteredRiders = $derived(
    Array.from(this.liveRiders.values()).filter((r) => {
      // 1. Status Filter
      if (this.activeStatusFilter !== "ALL" && r.compliance_status !== this.activeStatusFilter) {
        return false;
      }
      // 2. Zone Filter
      if (this.selectedZoneFilter !== "ALL") {
        if (r.actual_zone_id !== this.selectedZoneFilter && r.assigned_zone_id !== this.selectedZoneFilter) {
          return false;
        }
      }
      // 3. Search Query
      if (this.searchQuery.trim().length > 0) {
        const query = this.searchQuery.toLowerCase();
        const matchName = r.rider_name.toLowerCase().includes(query);
        const matchFleet = r.fleet_code?.toLowerCase().includes(query) || false;
        const matchZone = r.actual_zone_name?.toLowerCase().includes(query) || false;
        if (!matchName && !matchFleet && !matchZone) return false;
      }
      return true;
    })
  );

  /**
   * Initialize Snapshot from REST API & Listen for Real-Time Socket.IO Mutations
   */
  public async init() {
    this.isLoading = true;
    this.setConnectionState("INITIALIZING");

    try {
      // 1. Fetch Zones GeoJSON & Authoritative Initial Snapshot
      await this.fetchZones();
      await this.resyncAuthoritativeSnapshot();

      // 2. Attach Socket.IO Listeners
      this.attachSocketListeners();

      // 3. Start Staleness Heartbeat Check (Every 10 seconds)
      this.startStalenessMonitor();
    } catch (err: any) {
      console.warn("⚠️ [PresenceStore] Initial fetch error:", err);
      presenceTelemetry.recordApiError("/lbs/initial-init", err.message);
      this.setConnectionState("STALE");
    } finally {
      this.isLoading = false;
    }
  }

  private setConnectionState(state: SocketConnectionState) {
    this.connectionState = state;
    presenceTelemetry.recordSocketStatus(state);
  }

  /**
   * Resynchronize authoritative REST snapshot with Generation Guard
   */
  public async resyncAuthoritativeSnapshot() {
    const currentGen = ++this.syncGeneration;
    const startTime = Date.now();

    try {
      const res = await axiosInstance.get("/lbs/riders/nearby", {
        params: { lat: -7.4478, lon: 112.7183, radiusKm: 50, limit: 150 },
      });

      // If a newer sync started while this request was in-flight, discard old response
      if (currentGen !== this.syncGeneration) {
        return;
      }

      if (res.data && res.data.riders) {
        const newMap = new Map<string, LiveRiderTelemetry>();
        for (const r of res.data.riders) {
          const existing = this.liveRiders.get(r.rider_id);
          newMap.set(r.rider_id, {
            rider_id: r.rider_id,
            rider_name: r.rider_name || "Rider Operasional",
            assigned_zone_id: existing?.assigned_zone_id || null,
            assigned_zone_name: existing?.assigned_zone_name || null,
            actual_zone_id: r.telemetry?.zone_id || null,
            actual_zone_name: r.telemetry?.zone_name || null,
            compliance_status: r.telemetry?.zone_id ? "COMPLIANT" : "OUTSIDE",
            event_type: "ON_SITE",
            latitude: r.location.latitude,
            longitude: r.location.longitude,
            speed_mps: r.telemetry?.speed || 0,
            heading_degrees: r.telemetry?.heading || 0,
            last_ping: r.telemetry?.updated_at || new Date().toISOString(),
          });
        }
        this.liveRiders = newMap;
        this.lastSyncTimestamp = new Date().toISOString();
        this.setConnectionState("LIVE");
        presenceTelemetry.recordSnapshotSuccess(Date.now() - startTime, newMap.size);
      }
    } catch (err: any) {
      console.warn("[PresenceStore] Authoritative snapshot sync error:", err.message);
      presenceTelemetry.recordApiError("/lbs/riders/nearby", err.message);
      if (this.connectionState === "LIVE") {
        this.setConnectionState("STALE");
      }
    }
  }

  /**
   * Fetch active zones for PostGIS polygon rendering
   */
  public async fetchZones() {
    try {
      const res = await axiosInstance.get("/zones");
      if (res.data && res.data.data) {
        this.zonesGeoJson = res.data.data;
      }
    } catch (err: any) {
      console.warn("[PresenceStore] Failed to load zones:", err.message);
      presenceTelemetry.recordApiError("/zones", err.message);
    }
  }

  /**
   * Attach Socket.IO Real-Time Telemetry & Deviation Event Listeners
   */
  public attachSocketListeners() {
    if (this.socketListenersBound) return;
    const socket = getSocket();

    if (socket.connected) {
      this.setConnectionState("LIVE");
    }

    socket.on("connect", () => {
      this.reconnectAttempts = 0;
      this.setConnectionState("LIVE");
      // Authoritative resynchronization on reconnection
      this.resyncAuthoritativeSnapshot();
    });

    socket.on("disconnect", (reason) => {
      console.warn("⚠️ [PresenceStore] Socket disconnected:", reason);
      this.setConnectionState("RECONNECTING");
    });

    socket.on("connect_error", (error) => {
      this.reconnectAttempts += 1;
      presenceTelemetry.recordSocketError(error.message);
      if (this.reconnectAttempts >= 3) {
        this.setConnectionState("OFFLINE");
      } else {
        this.setConnectionState("RECONNECTING");
      }
    });

    // 1. Live Position Ping (`rider:position_updated`)
    socket.on("rider:position_updated", (payload: any) => {
      this.handleLivePositionUpdate(payload);
      presenceTelemetry.recordSocketEvent("rider:position_updated");
    });

    // 2. Operational Zone Transition (`presence:transition`)
    socket.on("presence:transition", (payload: any) => {
      this.handlePresenceTransition(payload);
      presenceTelemetry.recordSocketEvent("presence:transition");
    });

    // 3. Operational Deviation Alert (`presence:deviation_alert`)
    socket.on("presence:deviation_alert", (payload: any) => {
      this.handleDeviationAlert(payload);
      presenceTelemetry.recordSocketEvent("presence:deviation_alert");
    });

    this.socketListenersBound = true;
  }

  /**
   * Staleness Heartbeat Monitor (Runs every 10 seconds)
   */
  private startStalenessMonitor() {
    if (this.staleCheckInterval) clearInterval(this.staleCheckInterval);
    this.staleCheckInterval = setInterval(() => {
      if (this.connectionState === "LIVE") {
        const lastEventAt = presenceTelemetry.metrics.lastSocketEventAt || new Date(this.lastSyncTimestamp).getTime();
        const elapsedSeconds = (Date.now() - lastEventAt) / 1000;
        if (elapsedSeconds > 120 && this.liveRiders.size > 0) {
          // If no GPS pings received in > 2 minutes on live riders, mark as STALE
          this.setConnectionState("STALE");
        }
      }
    }, 10000);
  }

  /**
   * Incremental Mutation: Live GPS Position Update
   */
  public handleLivePositionUpdate(payload: any) {
    const existing = this.liveRiders.get(payload.rider_id);
    const updated: LiveRiderTelemetry = {
      rider_id: payload.rider_id,
      rider_name: payload.rider_name || existing?.rider_name || "Rider Operasional",
      fleet_code: payload.fleet_code || existing?.fleet_code,
      assigned_zone_id: existing?.assigned_zone_id || null,
      assigned_zone_name: existing?.assigned_zone_name || null,
      actual_zone_id: payload.zone_id || null,
      actual_zone_name: payload.zone_name || null,
      compliance_status: existing?.compliance_status || (payload.zone_id ? "COMPLIANT" : "OUTSIDE"),
      event_type: existing?.event_type || "ON_SITE",
      latitude: payload.latitude,
      longitude: payload.longitude,
      speed_mps: payload.speed_mps || 0,
      heading_degrees: payload.heading_degrees || 0,
      last_ping: payload.captured_at || new Date().toISOString(),
    };

    this.liveRiders.set(payload.rider_id, updated);
    this.lastSyncTimestamp = new Date().toISOString();
    if (this.connectionState === "STALE") {
      this.setConnectionState("LIVE");
    }
  }

  /**
   * Incremental Mutation: Operational Zone Transition Event
   */
  public handlePresenceTransition(payload: any) {
    const existing = this.liveRiders.get(payload.rider_id);
    const updated: LiveRiderTelemetry = {
      rider_id: payload.rider_id,
      rider_name: payload.rider_name || existing?.rider_name || "Rider Operasional",
      fleet_code: existing?.fleet_code,
      assigned_zone_id: payload.assigned_zone_id || null,
      assigned_zone_name: payload.assigned_zone_name || null,
      actual_zone_id: payload.actual_zone_id || null,
      actual_zone_name: payload.actual_zone_name || null,
      compliance_status: payload.compliance_status || "COMPLIANT",
      event_type: payload.event_type || "ON_SITE",
      latitude: payload.latitude,
      longitude: payload.longitude,
      speed_mps: existing?.speed_mps || 0,
      heading_degrees: existing?.heading_degrees || 0,
      last_ping: payload.captured_at || new Date().toISOString(),
    };

    this.liveRiders.set(payload.rider_id, updated);

    // Prepend to Transition Feed (Capped to latest 50 items)
    const feedItem: TransitionFeedItem = {
      id: `trans-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      tenant_id: payload.tenant_id,
      rider_id: payload.rider_id,
      rider_name: payload.rider_name,
      event_type: payload.event_type,
      compliance_status: payload.compliance_status,
      actual_zone_id: payload.actual_zone_id,
      actual_zone_name: payload.actual_zone_name,
      assigned_zone_id: payload.assigned_zone_id,
      assigned_zone_name: payload.assigned_zone_name,
      latitude: payload.latitude,
      longitude: payload.longitude,
      captured_at: payload.captured_at || new Date().toISOString(),
    };

    this.recentTransitions = [feedItem, ...this.recentTransitions.slice(0, 49)];

    // If rider status recovered to COMPLIANT, auto-recover any active alert
    if (payload.compliance_status === "COMPLIANT") {
      this.autoRecoverAlert(payload.rider_id);
    }
  }

  /**
   * Incremental Mutation: Deviation Alert Item
   */
  public handleDeviationAlert(payload: any) {
    const alertId = `alert-${payload.rider_id}-${Date.now()}`;
    const alertItem: OperationalAlertItem = {
      alert_id: alertId,
      tenant_id: payload.tenant_id,
      rider_id: payload.rider_id,
      rider_name: payload.rider_name,
      assigned_zone_id: payload.assigned_zone_id || null,
      assigned_zone_name: payload.assigned_zone_name || null,
      actual_zone_id: payload.actual_zone_id || null,
      actual_zone_name: payload.actual_zone_name || null,
      deviation_type: "ZONE_DEVIATION",
      severity: "HIGH",
      status: "OPEN",
      latitude: payload.latitude,
      longitude: payload.longitude,
      created_at: payload.captured_at || new Date().toISOString(),
    };

    // Upsert alert
    const existingIndex = this.activeAlerts.findIndex((a) => a.rider_id === payload.rider_id && a.status !== "RESOLVED");
    if (existingIndex >= 0) {
      this.activeAlerts[existingIndex] = alertItem;
    } else {
      this.activeAlerts = [alertItem, ...this.activeAlerts];
    }
  }

  /**
   * Alert Triage Actions
   */
  public acknowledgeAlert(alertId: string, supervisorName = "Supervisor") {
    const alert = this.activeAlerts.find((a) => a.alert_id === alertId);
    if (alert) {
      alert.status = "ACKNOWLEDGED";
      alert.acknowledged_at = new Date().toISOString();
      alert.acknowledged_by = supervisorName;
    }
  }

  public resolveAlert(alertId: string, supervisorName = "Supervisor", notes?: string) {
    const alert = this.activeAlerts.find((a) => a.alert_id === alertId);
    if (alert) {
      alert.status = "RESOLVED";
      alert.resolved_at = new Date().toISOString();
      alert.resolved_by = supervisorName;
      alert.notes = notes;
    }
  }

  public autoRecoverAlert(riderId: string) {
    const alert = this.activeAlerts.find((a) => a.rider_id === riderId && (a.status === "OPEN" || a.status === "ACKNOWLEDGED"));
    if (alert) {
      alert.status = "AUTO_RECOVERED";
      alert.resolved_at = new Date().toISOString();
    }
  }

  /**
   * Map & Selection Focus Actions
   */
  public focusRider(riderId: string) {
    this.selectedRiderId = riderId;
    const rider = this.liveRiders.get(riderId);
    if (rider) {
      this.mapFocusTarget = {
        latitude: rider.latitude,
        longitude: rider.longitude,
        zoom: 16,
      };
    }
  }

  public focusZone(zoneId: string) {
    this.selectedZoneId = zoneId;
    const zone = this.zonesGeoJson.find((z) => z.id === zoneId);
    if (zone && zone.center) {
      this.mapFocusTarget = {
        latitude: zone.center.latitude || zone.center[1],
        longitude: zone.center.longitude || zone.center[0],
        zoom: 15,
      };
    }
  }

  public setStatusFilter(status: string) {
    this.activeStatusFilter = status;
  }

  /**
   * Teardown / Cleanup for Zero Memory Leaks on Page Navigation
   */
  public destroy() {
    if (this.staleCheckInterval) {
      clearInterval(this.staleCheckInterval);
      this.staleCheckInterval = null;
    }
    const socket = getSocket();
    socket.off("connect");
    socket.off("disconnect");
    socket.off("connect_error");
    socket.off("rider:position_updated");
    socket.off("presence:transition");
    socket.off("presence:deviation_alert");
    this.socketListenersBound = false;
  }
}

export const presenceStore = new PresenceStore();
