/*
 * historicalAnalyticsStore.svelte.ts
 * S7-03-10: Frontend Historical Operational Analytics Reactive Store (Svelte 5 Runes)
 * 
 * Strict Invariants:
 * 1. Read-Only Intelligence Consumer: Exclusively consumes OpenAPI v4.1.0 endpoints.
 * 2. Zero Fabricated Metrics: Preserves backend complianceRate: null when denominator is 0.
 * 3. Authoritative Delta Semantics: Preserves backend PeriodMetricComparison directions and deltas.
 * 4. Half-Open Temporal Boundary: [start, end) strictly preserved across presets and comparisons.
 * 5. Isolated Resource Resilience: Granular per-resource status to isolate partial endpoint failures.
 * 6. Differentiated Loading State: Distinguishes initial load from background refreshing.
 */

import { historicalAnalyticsService } from "../../services/historicalAnalyticsService.js";
import type {
  AnalyticsGrain,
  AnalyticsTimeContext,
  PresenceAnalyticsResult,
  ZoneAnalyticsResult,
  RiderAnalyticsResult,
  HistoricalDeviationSummaryDTO,
  PeriodComparisonResult,
  HistoricalPresenceQuery,
  HistoricalDeviationsQuery,
  HistoricalZonesQuery,
  HistoricalRidersQuery,
  HistoricalComparisonQuery,
  DeviationEpisode,
  ZoneAnalyticsMetrics,
  RiderAnalyticsMetrics,
  AnalyticsTimelinePoint,
} from "../types/analytics.types.js";

export type TimePreset = "today" | "yesterday" | "last7days" | "last30days" | "thisMonth" | "custom";
export type ResourceStatus = "idle" | "loading" | "success" | "error";

export interface ResourceStatusMap {
  summary: ResourceStatus;
  timeline: ResourceStatus;
  deviations: ResourceStatus;
  zones: ResourceStatus;
  riders: ResourceStatus;
  comparison: ResourceStatus;
}

export interface ResourceErrorMap {
  summary: string | null;
  timeline: string | null;
  deviations: string | null;
  zones: string | null;
  riders: string | null;
  comparison: string | null;
}

export class HistoricalAnalyticsStore {
  // --------------------------------------------------------------------------
  // 1. Reactive Temporal & Filter State
  // --------------------------------------------------------------------------
  selectedPreset = $state<TimePreset>("last7days");
  selectedTimezone = $state<string>("Asia/Jakarta");
  selectedGrain = $state<AnalyticsGrain>("day");
  
  rangeStart = $state<string>("");
  rangeEnd = $state<string>("");
  
  compareWithPrevious = $state<boolean>(true);
  previousRangeStart = $state<string>("");
  previousRangeEnd = $state<string>("");

  selectedZoneId = $state<string | null>(null);
  selectedRiderId = $state<string | null>(null);
  openDeviationsOnly = $state<boolean>(false);

  // --------------------------------------------------------------------------
  // 2. Reactive Data Payloads (Authoritative OpenAPI v4.1.0 Read Models)
  // --------------------------------------------------------------------------
  presenceResult = $state<PresenceAnalyticsResult | null>(null);
  timelineResult = $state<PresenceAnalyticsResult | null>(null);
  deviationsResult = $state<HistoricalDeviationSummaryDTO | null>(null);
  zoneAnalyticsResult = $state<ZoneAnalyticsResult | null>(null);
  riderAnalyticsResult = $state<RiderAnalyticsResult | null>(null);
  comparisonResult = $state<PeriodComparisonResult | null>(null);

  // --------------------------------------------------------------------------
  // 3. Reactive Lifecycle & Granular Resource Status
  // --------------------------------------------------------------------------
  isInitialLoading = $state<boolean>(false);
  isRefreshing = $state<boolean>(false);
  lastFetchedAt = $state<number | null>(null);

  resourceStatus = $state<ResourceStatusMap>({
    summary: "idle",
    timeline: "idle",
    deviations: "idle",
    zones: "idle",
    riders: "idle",
    comparison: "idle",
  });

  resourceErrors = $state<ResourceErrorMap>({
    summary: null,
    timeline: null,
    deviations: null,
    zones: null,
    riders: null,
    comparison: null,
  });

  constructor() {
    this.calculatePresetBoundaries("last7days");
  }

  // --------------------------------------------------------------------------
  // 4. Derived Invariants & State Checks
  // --------------------------------------------------------------------------

  /**
   * Authoritative check: Does the dataset contain any observed facts?
   * Strictly distinguishes NO_DATA from API_ERROR.
   */
  get hasData(): boolean {
    const totalEvents = this.presenceResult?.metrics?.totalEvents ?? 0;
    const observedRiders = this.presenceResult?.metrics?.observedRiders ?? 0;
    const zonesCount = this.zoneAnalyticsResult?.zones?.length ?? 0;
    const ridersCount = this.riderAnalyticsResult?.riders?.length ?? 0;
    const timelineCount = this.timelineResult?.timeline?.points?.length ?? 0;

    return totalEvents > 0 || observedRiders > 0 || zonesCount > 0 || ridersCount > 0 || timelineCount > 0;
  }

  /**
   * Has any individual resource failed?
   */
  get hasPartialError(): boolean {
    return Object.values(this.resourceStatus).some((status) => status === "error");
  }

  /**
   * Consolidated presence and compliance metrics
   */
  get summaryMetrics() {
    const p = this.presenceResult?.metrics;
    const d = this.deviationsResult?.metrics;

    return {
      observedRiders: p?.observedRiders ?? 0,
      totalEvents: p?.totalEvents ?? 0,
      compliantEvents: p?.complianceDistribution?.compliant ?? 0,
      deviatedEvents: p?.complianceDistribution?.deviated ?? 0,
      outsideEvents: p?.complianceDistribution?.outside ?? 0,
      unassignedEvents: p?.complianceDistribution?.unassigned ?? 0,
      eligibleEventsCount: p?.eligibleEventsCount ?? 0,
      // Strict Null Guard: Nullable when denominator === 0
      complianceRate: p?.complianceRate ?? null,
      presenceEventTypes: p?.presenceEvents ?? {
        ENTER: 0,
        EXIT: 0,
        ON_SITE: 0,
        OUTSIDE_ZONE: 0,
        DEVIATED: 0,
      },
      deviationEpisodesCount: d?.episodeCount ?? 0,
      openEpisodesCount: d?.openEpisodesCount ?? 0,
      affectedRidersCount: d?.affectedRidersCount ?? 0,
      averageDeviationDurationSeconds: d?.averageDurationSeconds ?? null,
    };
  }

  /**
   * Authoritative Period-Over-Period Comparison Cards
   */
  get comparisonCards() {
    if (!this.comparisonResult?.metrics) return null;
    return this.comparisonResult.metrics;
  }

  /**
   * Timeline bucket points ready for charts
   */
  get timelinePoints(): AnalyticsTimelinePoint[] {
    return this.timelineResult?.timeline?.points ?? [];
  }

  /**
   * Deterministically sorted zone performance rankings
   */
  get zoneRankings(): ZoneAnalyticsMetrics[] {
    const list = this.zoneAnalyticsResult?.zones ?? [];
    return [...list].sort((a, b) => {
      if (b.totalEvents !== a.totalEvents) return b.totalEvents - a.totalEvents;
      return a.zoneName.localeCompare(b.zoneName);
    });
  }

  /**
   * Deterministically sorted rider performance rankings
   */
  get riderRankings(): RiderAnalyticsMetrics[] {
    const list = this.riderAnalyticsResult?.riders ?? [];
    return [...list].sort((a, b) => {
      if (b.totalEvents !== a.totalEvents) return b.totalEvents - a.totalEvents;
      return (a.riderName || a.riderId).localeCompare(b.riderName || b.riderId);
    });
  }

  /**
   * Active deviation episodes
   */
  get deviationEpisodes(): DeviationEpisode[] {
    return this.deviationsResult?.episodes ?? [];
  }

  // --------------------------------------------------------------------------
  // 5. Preset & Boundary Helpers [start, end)
  // --------------------------------------------------------------------------

  private calculatePresetBoundaries(preset: TimePreset): void {
    const now = new Date();
    // Midnight today in UTC/local baseline
    const todayMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const tomorrowMidnight = new Date(todayMidnight.getTime() + 24 * 60 * 60 * 1000);

    let start: Date;
    let end: Date;
    let prevStart: Date;
    let prevEnd: Date;

    switch (preset) {
      case "today": {
        start = todayMidnight;
        end = tomorrowMidnight;
        prevStart = new Date(start.getTime() - 24 * 60 * 60 * 1000);
        prevEnd = start;
        break;
      }
      case "yesterday": {
        start = new Date(todayMidnight.getTime() - 24 * 60 * 60 * 1000);
        end = todayMidnight;
        prevStart = new Date(start.getTime() - 24 * 60 * 60 * 1000);
        prevEnd = start;
        break;
      }
      case "last7days": {
        start = new Date(todayMidnight.getTime() - 6 * 24 * 60 * 60 * 1000);
        end = tomorrowMidnight;
        const duration = end.getTime() - start.getTime();
        prevStart = new Date(start.getTime() - duration);
        prevEnd = start;
        break;
      }
      case "last30days": {
        start = new Date(todayMidnight.getTime() - 29 * 24 * 60 * 60 * 1000);
        end = tomorrowMidnight;
        const duration = end.getTime() - start.getTime();
        prevStart = new Date(start.getTime() - duration);
        prevEnd = start;
        break;
      }
      case "thisMonth": {
        start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
        // First day of next month
        end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
        // First day of previous month
        prevStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0, 0));
        prevEnd = start;
        break;
      }
      case "custom":
      default:
        return;
    }

    this.rangeStart = start.toISOString();
    this.rangeEnd = end.toISOString();
    this.previousRangeStart = prevStart.toISOString();
    this.previousRangeEnd = prevEnd.toISOString();
  }

  // --------------------------------------------------------------------------
  // 6. Action Setters
  // --------------------------------------------------------------------------

  setTimePreset(preset: TimePreset): void {
    this.selectedPreset = preset;
    if (preset !== "custom") {
      this.calculatePresetBoundaries(preset);
    }
  }

  setCustomRange(startISO: string, endISO: string, prevStartISO?: string, prevEndISO?: string): void {
    this.selectedPreset = "custom";
    this.rangeStart = startISO;
    this.rangeEnd = endISO;

    if (prevStartISO && prevEndISO) {
      this.previousRangeStart = prevStartISO;
      this.previousRangeEnd = prevEndISO;
    } else {
      const s = new Date(startISO).getTime();
      const e = new Date(endISO).getTime();
      const duration = e - s;
      this.previousRangeStart = new Date(s - duration).toISOString();
      this.previousRangeEnd = new Date(s).toISOString();
    }
  }

  setGrain(grain: AnalyticsGrain): void {
    this.selectedGrain = grain;
  }

  setTimezone(timezone: string): void {
    this.selectedTimezone = timezone;
  }

  setCompareWithPrevious(compare: boolean): void {
    this.compareWithPrevious = compare;
  }

  setZoneFilter(zoneId: string | null): void {
    this.selectedZoneId = zoneId;
  }

  setRiderFilter(riderId: string | null): void {
    this.selectedRiderId = riderId;
  }

  setOpenDeviationsOnly(openOnly: boolean): void {
    this.openDeviationsOnly = openOnly;
  }

  resetFilters(): void {
    this.selectedZoneId = null;
    this.selectedRiderId = null;
    this.openDeviationsOnly = false;
    this.selectedGrain = "day";
    this.selectedTimezone = "Asia/Jakarta";
    this.compareWithPrevious = true;
    this.setTimePreset("last7days");
  }

  // --------------------------------------------------------------------------
  // 7. Individual Resource Fetch Actions
  // --------------------------------------------------------------------------

  private getPresenceQuery(): HistoricalPresenceQuery {
    return {
      rangeStart: this.rangeStart,
      rangeEnd: this.rangeEnd,
      timezone: this.selectedTimezone,
      grain: this.selectedGrain,
      riderId: this.selectedRiderId || undefined,
      zoneId: this.selectedZoneId || undefined,
    };
  }

  async fetchSummary(): Promise<void> {
    this.resourceStatus.summary = "loading";
    this.resourceErrors.summary = null;
    try {
      this.presenceResult = await historicalAnalyticsService.getPresenceSummary(this.getPresenceQuery());
      this.resourceStatus.summary = "success";
    } catch (err: any) {
      this.resourceStatus.summary = "error";
      this.resourceErrors.summary = err?.response?.data?.msg || err?.message || "Failed to load presence summary";
    }
  }

  async fetchTimeline(): Promise<void> {
    this.resourceStatus.timeline = "loading";
    this.resourceErrors.timeline = null;
    try {
      this.timelineResult = await historicalAnalyticsService.getPresenceTimeline(this.getPresenceQuery());
      this.resourceStatus.timeline = "success";
    } catch (err: any) {
      this.resourceStatus.timeline = "error";
      this.resourceErrors.timeline = err?.response?.data?.msg || err?.message || "Failed to load presence timeline";
    }
  }

  async fetchDeviations(): Promise<void> {
    this.resourceStatus.deviations = "loading";
    this.resourceErrors.deviations = null;
    try {
      const query: HistoricalDeviationsQuery = {
        ...this.getPresenceQuery(),
        openOnly: this.openDeviationsOnly || undefined,
      };
      this.deviationsResult = await historicalAnalyticsService.getDeviations(query);
      this.resourceStatus.deviations = "success";
    } catch (err: any) {
      this.resourceStatus.deviations = "error";
      this.resourceErrors.deviations = err?.response?.data?.msg || err?.message || "Failed to load deviation episodes";
    }
  }

  async fetchZones(): Promise<void> {
    this.resourceStatus.zones = "loading";
    this.resourceErrors.zones = null;
    try {
      const query: HistoricalZonesQuery = {
        rangeStart: this.rangeStart,
        rangeEnd: this.rangeEnd,
        timezone: this.selectedTimezone,
        grain: this.selectedGrain,
        zoneId: this.selectedZoneId || undefined,
      };
      this.zoneAnalyticsResult = await historicalAnalyticsService.getZoneAnalytics(query);
      this.resourceStatus.zones = "success";
    } catch (err: any) {
      this.resourceStatus.zones = "error";
      this.resourceErrors.zones = err?.response?.data?.msg || err?.message || "Failed to load zone analytics";
    }
  }

  async fetchRiders(): Promise<void> {
    this.resourceStatus.riders = "loading";
    this.resourceErrors.riders = null;
    try {
      const query: HistoricalRidersQuery = {
        rangeStart: this.rangeStart,
        rangeEnd: this.rangeEnd,
        timezone: this.selectedTimezone,
        grain: this.selectedGrain,
        riderId: this.selectedRiderId || undefined,
      };
      this.riderAnalyticsResult = await historicalAnalyticsService.getRiderAnalytics(query);
      this.resourceStatus.riders = "success";
    } catch (err: any) {
      this.resourceStatus.riders = "error";
      this.resourceErrors.riders = err?.response?.data?.msg || err?.message || "Failed to load rider analytics";
    }
  }

  async fetchComparison(): Promise<void> {
    if (!this.compareWithPrevious || !this.previousRangeStart || !this.previousRangeEnd) {
      this.comparisonResult = null;
      this.resourceStatus.comparison = "idle";
      this.resourceErrors.comparison = null;
      return;
    }

    this.resourceStatus.comparison = "loading";
    this.resourceErrors.comparison = null;
    try {
      const query: HistoricalComparisonQuery = {
        currentRangeStart: this.rangeStart,
        currentRangeEnd: this.rangeEnd,
        previousRangeStart: this.previousRangeStart,
        previousRangeEnd: this.previousRangeEnd,
        timezone: this.selectedTimezone,
        grain: this.selectedGrain,
      };
      this.comparisonResult = await historicalAnalyticsService.getPeriodComparison(query);
      this.resourceStatus.comparison = "success";
    } catch (err: any) {
      this.resourceStatus.comparison = "error";
      this.resourceErrors.comparison = err?.response?.data?.msg || err?.message || "Failed to load period comparison";
    }
  }

  // --------------------------------------------------------------------------
  // 8. Consolidated Concurrent Orchestration (fetchAll)
  // --------------------------------------------------------------------------

  /**
   * Concurrently fetches all analytics resources with Promise.allSettled.
   * Differentiates initial full load from subsequent background refresh.
   */
  async fetchAll(): Promise<void> {
    const isFirstTime = this.lastFetchedAt === null;
    if (isFirstTime) {
      this.isInitialLoading = true;
    } else {
      this.isRefreshing = true;
    }

    try {
      const tasks: Promise<void>[] = [
        this.fetchSummary(),
        this.fetchTimeline(),
        this.fetchDeviations(),
        this.fetchZones(),
        this.fetchRiders(),
      ];

      if (this.compareWithPrevious) {
        tasks.push(this.fetchComparison());
      }

      await Promise.allSettled(tasks);
      this.lastFetchedAt = Date.now();
    } finally {
      this.isInitialLoading = false;
      this.isRefreshing = false;
    }
  }
}

export const historicalAnalyticsStore = new HistoricalAnalyticsStore();
