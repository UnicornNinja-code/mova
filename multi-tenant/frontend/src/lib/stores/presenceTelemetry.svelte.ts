/*
 * presenceTelemetry.svelte.ts
 * Svelte 5 Observability & Diagnostic Store for Stage 6 Operational Presence
 * Tracks connection health, mutation performance, and error metrics with Zero-PII security.
 */

export type SocketConnectionState = "INITIALIZING" | "LIVE" | "RECONNECTING" | "STALE" | "OFFLINE";

export interface PresenceTelemetryState {
  socketStatus: SocketConnectionState;
  lastSocketEventAt: number | null;
  lastSnapshotAt: number | null;
  lastSyncDurationMs: number | null;
  reconnectCount: number;
  activeRidersCount: number;
  activeAlertsCount: number;
  apiErrorsCount: number;
  socketErrorsCount: number;
  storeMutationsCount: number;
  mapMarkerRenderCount: number;
}

export class PresenceTelemetryStore {
  // Svelte 5 Reactive State Rune
  metrics = $state<PresenceTelemetryState>({
    socketStatus: "INITIALIZING",
    lastSocketEventAt: null,
    lastSnapshotAt: null,
    lastSyncDurationMs: null,
    reconnectCount: 0,
    activeRidersCount: 0,
    activeAlertsCount: 0,
    apiErrorsCount: 0,
    socketErrorsCount: 0,
    storeMutationsCount: 0,
    mapMarkerRenderCount: 0,
  });

  // Diagnostic Logs (In-memory circular buffer, max 100 entries, zero PII)
  diagnosticLogs = $state<Array<{ timestamp: number; level: "INFO" | "WARN" | "ERROR"; event: string; detail?: string }>>([]);

  public recordSocketStatus(status: SocketConnectionState) {
    this.metrics.socketStatus = status;
    if (status === "RECONNECTING") {
      this.metrics.reconnectCount += 1;
    }
    this.log("INFO", `socket.status_change -> ${status}`);
  }

  public recordSocketEvent(eventType: string) {
    this.metrics.lastSocketEventAt = Date.now();
    this.metrics.storeMutationsCount += 1;
    this.log("INFO", `socket.event_received -> ${eventType}`);
  }

  public recordSnapshotSuccess(durationMs: number, riderCount: number) {
    this.metrics.lastSnapshotAt = Date.now();
    this.metrics.lastSyncDurationMs = durationMs;
    this.metrics.activeRidersCount = riderCount;
    this.metrics.socketStatus = "LIVE";
    this.log("INFO", `presence.snapshot_success (${riderCount} riders in ${durationMs}ms)`);
  }

  public recordApiError(endpoint: string, errorMessage?: string) {
    this.metrics.apiErrorsCount += 1;
    this.log("ERROR", `api.error [${endpoint}]`, errorMessage);
  }

  public recordSocketError(errorMessage?: string) {
    this.metrics.socketErrorsCount += 1;
    this.log("WARN", "socket.connection_error", errorMessage);
  }

  public recordMarkerRender(count: number) {
    this.metrics.mapMarkerRenderCount = count;
  }

  private log(level: "INFO" | "WARN" | "ERROR", event: string, detail?: string) {
    const entry = {
      timestamp: Date.now(),
      level,
      event,
      detail: detail ? detail.substring(0, 150) : undefined, // Truncate to prevent memory bloat
    };
    this.diagnosticLogs = [entry, ...this.diagnosticLogs.slice(0, 99)];
  }
}

export const presenceTelemetry = new PresenceTelemetryStore();
