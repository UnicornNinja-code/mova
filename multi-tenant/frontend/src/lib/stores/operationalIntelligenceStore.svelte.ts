/*
 * operationalIntelligenceStore.svelte.ts
 * S7-02: Operational Intelligence Reactive Aggregation Store (Svelte 5 Runes)
 * Strictly derived from frozen Stage 1-6 REST snapshots and Socket.IO presence events.
 * Deterministic calculations with zero fake metrics and explicit missing-data guards.
 */

import { presenceStore, type LiveRiderTelemetry, type OperationalAlertItem } from "./presenceStore.svelte.js";
import { armadaService, type ArmadaItem } from "../../services/armadaService.js";

class OperationalIntelligenceStore {
  // Local fleet state for intelligence aggregation
  armadas = $state<ArmadaItem[]>([]);
  isLoadingFleets = $state(false);
  lastFleetSync = $state<number | null>(null);
  fleetError = $state<string | null>(null);

  /**
   * 1. Presence Compliance Aggregations
   */
  presenceMetrics = $derived.by(() => {
    const riders = Array.from(presenceStore.liveRiders.values());
    const total = riders.length;

    let compliant = 0;
    let deviated = 0;
    let unassigned = 0;
    let outside = 0;

    for (const rider of riders) {
      switch (rider.compliance_status) {
        case "COMPLIANT":
          compliant++;
          break;
        case "DEVIATED":
          deviated++;
          break;
        case "UNASSIGNED":
          unassigned++;
          break;
        case "OUTSIDE":
          outside++;
          break;
      }
    }

    return {
      total,
      compliantCount: compliant,
      compliantRate: total > 0 ? (compliant / total) * 100 : null,
      deviatedCount: deviated,
      deviatedRate: total > 0 ? (deviated / total) * 100 : null,
      unassignedCount: unassigned,
      unassignedRate: total > 0 ? (unassigned / total) * 100 : null,
      outsideCount: outside,
      outsideRate: total > 0 ? (outside / total) * 100 : null,
      hasData: total > 0,
    };
  });

  /**
   * 2. Fleet Utilization Aggregations
   */
  fleetMetrics = $derived.by(() => {
    const list = this.armadas;
    const total = list.length;

    let inUse = 0;
    let active = 0;
    let reserved = 0;
    let maintenance = 0;
    let retired = 0;

    for (const item of list) {
      const st = (item.status || "").toUpperCase();
      if (st === "IN_USE") {
        inUse++;
      } else if (st === "ACTIVE" || st === "AVAILABLE") {
        active++;
      } else if (st === "RESERVED") {
        reserved++;
      } else if (st === "MAINTENANCE") {
        maintenance++;
      } else if (st === "RETIRED") {
        retired++;
      }
    }

    return {
      total,
      inUseCount: inUse,
      inUseRate: total > 0 ? (inUse / total) * 100 : null,
      activeCount: active,
      activeRate: total > 0 ? (active / total) * 100 : null,
      reservedCount: reserved,
      reservedRate: total > 0 ? (reserved / total) * 100 : null,
      maintenanceCount: maintenance,
      maintenanceRate: total > 0 ? (maintenance / total) * 100 : null,
      retiredCount: retired,
      retiredRate: total > 0 ? (retired / total) * 100 : null,
      hasData: total > 0,
    };
  });

  /**
   * 3. Alert Lifecycle & Triage Velocity Aggregations
   */
  alertMetrics = $derived.by(() => {
    const alerts = presenceStore.activeAlerts;
    const total = alerts.length;

    let open = 0;
    let acknowledged = 0;
    let resolved = 0;
    let autoRecovered = 0;

    let critical = 0;
    let high = 0;
    let medium = 0;

    let totalResolutionDurationMs = 0;
    let resolvedWithDurationCount = 0;

    for (const alert of alerts) {
      // Status breakdown
      switch (alert.status) {
        case "OPEN":
          open++;
          break;
        case "ACKNOWLEDGED":
          acknowledged++;
          break;
        case "RESOLVED":
          resolved++;
          break;
        case "AUTO_RECOVERED":
          autoRecovered++;
          break;
      }

      // Severity breakdown
      switch (alert.severity) {
        case "CRITICAL":
          critical++;
          break;
        case "HIGH":
          high++;
          break;
        case "MEDIUM":
          medium++;
          break;
      }

      // Exact mathematical calculation of resolution duration
      if (alert.resolved_at && alert.created_at) {
        const start = new Date(alert.created_at).getTime();
        const end = new Date(alert.resolved_at).getTime();
        if (!isNaN(start) && !isNaN(end) && end >= start) {
          totalResolutionDurationMs += (end - start);
          resolvedWithDurationCount++;
        }
      }
    }

    const avgResolutionSeconds = resolvedWithDurationCount > 0
      ? Math.round((totalResolutionDurationMs / resolvedWithDurationCount) / 1000)
      : null;

    return {
      total,
      openCount: open,
      acknowledgedCount: acknowledged,
      resolvedCount: resolved,
      autoRecoveredCount: autoRecovered,
      criticalCount: critical,
      highCount: high,
      mediumCount: medium,
      resolvedWithDurationCount,
      avgResolutionSeconds, // null if insufficient data
      hasData: total > 0,
    };
  });

  /**
   * Load fleet snapshot from canonical REST endpoint
   */
  async fetchFleets(): Promise<void> {
    this.isLoadingFleets = true;
    this.fleetError = null;
    try {
      const items = await armadaService.getAllArmadas();
      this.armadas = items;
      this.lastFleetSync = Date.now();
    } catch (err: any) {
      this.fleetError = err?.response?.data?.msg || err?.message || "Gagal memuat status armada.";
    } finally {
      this.isLoadingFleets = false;
    }
  }

  /**
   * Full Synchronous Refresh
   */
  async refreshAll(): Promise<void> {
    await Promise.allSettled([
      this.fetchFleets(),
      presenceStore.resyncAuthoritativeSnapshot(),
    ]);
  }
}

export const operationalIntelligenceStore = new OperationalIntelligenceStore();
