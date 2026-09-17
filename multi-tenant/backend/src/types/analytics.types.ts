/*
 * analytics.types.ts
 * S7-03-01: Historical Operational Analytics Domain Models & DTOs
 * MOVA Architecture - Pure Additive Intelligence Layer
 * 
 * Strict Invariants:
 * 1. Historical Analytics observes persisted Stage 1-6 facts without altering operational state.
 * 2. Zero-Fake-Data: Nullable ratios, explicit reasons for unsupported/missing metrics.
 * 3. Authoritative Ordering: (rider_id ASC, captured_at ASC, created_at ASC, id ASC).
 * 4. Half-open temporal query boundaries: [start, end).
 */

// ============================================================================
// 1. Time & Temporal Primitives
// ============================================================================

export type AnalyticsGrain = "hour" | "day" | "week" | "month";

export interface AnalyticsTimeRange {
  rangeStart: string; // ISO 8601 string
  rangeEnd: string;   // ISO 8601 string
  timezone: string;   // e.g. "Asia/Jakarta"
}

export interface AnalyticsTimeContext extends AnalyticsTimeRange {
  grain: AnalyticsGrain;
  boundarySemantics: "[start, end)";
}

// ============================================================================
// 2. Filter Models
// ============================================================================

export type ComplianceStatusEnum = "COMPLIANT" | "DEVIATED" | "UNASSIGNED" | "OUTSIDE";

export type PresenceEventTypeEnum = "ENTER" | "EXIT" | "ON_SITE" | "OUTSIDE_ZONE" | "DEVIATED";

export interface HistoricalAnalyticsFilter {
  timeContext: AnalyticsTimeContext;
  riderId?: string;
  zoneId?: string;
  complianceStatus?: ComplianceStatusEnum;
}

export interface ZoneAnalyticsFilter {
  timeContext: AnalyticsTimeContext;
  zoneId?: string;
  minEvents?: number;
}

export interface RiderAnalyticsFilter {
  timeContext: AnalyticsTimeContext;
  riderId?: string;
  zoneId?: string;
}

export interface DeviationAnalyticsFilter {
  timeContext: AnalyticsTimeContext;
  riderId?: string;
  zoneId?: string;
  openOnly?: boolean;
}

// ============================================================================
// 3. Domain Metric Models
// ============================================================================

export interface ComplianceMetrics {
  compliant: number;
  deviated: number;
  outside: number;
  unassigned: number;
  eligibleEventsCount: number; // compliant + deviated + outside (valid denominator)
  totalEventsCount: number;    // compliant + deviated + outside + unassigned
  rate: number | null;         // (compliant / eligibleEventsCount) * 100, null if denominator === 0
}

export interface DeviationEpisode {
  id: string;                  // Deterministic composite: `ep_${tenantId}_${riderId}_${startEventId}`
  tenantId: string;
  riderId: string;
  riderName?: string;
  zoneId: string | null;
  zoneName?: string | null;
  assignedZoneId: string | null;
  assignedZoneName?: string | null;
  startedAt: string;           // ISO 8601
  endedAt: string | null;      // ISO 8601 or null if open
  durationSeconds: number | null; // Null if episode is incomplete / open
  open: boolean;               // True if deviation was ongoing at the end of the query window
  eventCount: number;
  startEventId: string;
  endEventId: string | null;
}

export interface DeviationMetrics {
  eventCount: number;
  episodeCount: number;
  affectedRidersCount: number;
  averageDurationSeconds: number | null;
  openEpisodesCount: number;
}

export interface ZoneHistoricalMetric {
  zoneId: string;
  zoneName: string;
  observedRiders: number;
  totalEvents: number;
  compliantEvents: number;
  deviationEvents: number;
  deviationEpisodes: number;
  openDeviationEpisodes: number;
  affectedRiders: number;
  outsideEvents: number;
  unassignedEvents: number;
  complianceRate: number | null;
  firstObservedAt: string | null;
  lastObservedAt: string | null;
}

export interface RiderHistoricalMetric {
  riderId: string;
  riderName: string;
  totalEvents: number;
  observedDays: number;
  compliantEvents: number;
  deviationEvents: number;
  deviationEpisodes: number;
  openDeviationEpisodes: number;
  outsideEvents: number;
  unassignedEvents: number;
  eligibleEventsCount: number;
  complianceRate: number | null;
  affectedZones: number;
  firstObservedAt: string | null;
  lastObservedAt: string | null;
}

// ============================================================================
// 4. Period Comparison & Trend Primitives
// ============================================================================

export type TrendDirection =
  | "UP"
  | "DOWN"
  | "UNCHANGED"
  | "UP_FROM_ZERO"
  | "DOWN_TO_ZERO"
  | "UNAVAILABLE";

export type PeriodDeltaDirection = TrendDirection;

export interface PeriodMetricComparison {
  current: number | null;
  previous: number | null;
  absoluteDelta: number | null;
  direction: PeriodDeltaDirection;
}

export interface AnalyticsPeriod {
  rangeStart: string;
  rangeEnd: string;
  timezone: string;
}

export interface PeriodComparisonContext {
  current: AnalyticsPeriod;
  previous: AnalyticsPeriod;
}

export interface PeriodComparisonResult {
  context: PeriodComparisonContext;
  metrics: {
    observedRiders: PeriodMetricComparison;
    totalEvents: PeriodMetricComparison;
    compliantEvents: PeriodMetricComparison;
    deviatedEvents: PeriodMetricComparison;
    outsideEvents: PeriodMetricComparison;
    unassignedEvents: PeriodMetricComparison;
    eligibleEvents: PeriodMetricComparison;
    complianceRate: PeriodMetricComparison;
    deviationEpisodes: PeriodMetricComparison;
    openDeviationEpisodes: PeriodMetricComparison;
  };
}

export interface ZonePeriodComparison {
  zoneId: string;
  zoneName: string;
  metrics: {
    observedRiders: PeriodMetricComparison;
    totalEvents: PeriodMetricComparison;
    complianceRate: PeriodMetricComparison;
    affectedRiders: PeriodMetricComparison;
    deviationEpisodes: PeriodMetricComparison;
    openDeviationEpisodes: PeriodMetricComparison;
  };
}

export interface RiderPeriodComparison {
  riderId: string;
  riderName: string | null;
  metrics: {
    totalEvents: PeriodMetricComparison;
    observedDays: PeriodMetricComparison;
    complianceRate: PeriodMetricComparison;
    deviationEvents: PeriodMetricComparison;
    deviationEpisodes: PeriodMetricComparison;
    openDeviationEpisodes: PeriodMetricComparison;
    affectedZones: PeriodMetricComparison;
  };
}

// ============================================================================
// 5. Analytics Capabilities Specification
// ============================================================================

export interface AnalyticsCapabilities {
  presenceHistory: boolean;        // true (backed by rider_presence_events)
  riderActivity: boolean;          // true (backed by rider_positions & events)
  zoneAnalytics: boolean;          // true (backed by zones & presence events)
  deviationEpisodes: boolean;      // true (deterministic state transition engine)
  fleetUtilizationHistory: boolean;// false (continuous fleet state duration not persisted)
  alertResponseHistory: boolean;   // false (no supervisor ACK audit log in DB)
  unsupportedReasons: {
    fleetUtilizationHistory?: string;
    alertResponseHistory?: string;
    riderPerformanceScore?: string;
  };
}

// ============================================================================
// 6. Data Transfer Objects (DTOs) for S7-03 Analytics Layer & OpenAPI v4.1.0
// ============================================================================

export interface PresenceComplianceDistribution {
  compliant: number;
  deviated: number;
  outside: number;
  unassigned: number;
}

export interface PresenceMetrics {
  observedRiders: number;
  totalEvents: number;
  presenceEvents: {
    ENTER: number;
    EXIT: number;
    ON_SITE: number;
    OUTSIDE_ZONE: number;
    DEVIATED: number;
  };
  complianceDistribution: PresenceComplianceDistribution;
  eligibleEventsCount: number;
  complianceRate: number | null;
}

export interface AnalyticsTimelinePoint {
  bucketStart: string;
  totalEvents: number;
  complianceDistribution: PresenceComplianceDistribution;
  eligibleEventsCount: number;
  complianceRate: number | null;
}

export interface AnalyticsTimeline {
  grain: AnalyticsGrain;
  timezone: string;
  points: AnalyticsTimelinePoint[];
}

export interface PresenceAnalyticsResult {
  timeContext: AnalyticsTimeContext;
  metrics: PresenceMetrics;
  timeline?: AnalyticsTimeline;
}

export interface ZoneAnalyticsMetrics {
  zoneId: string;
  zoneName: string;
  observedRiders: number;
  totalEvents: number;
  complianceDistribution: PresenceComplianceDistribution;
  eligibleEventsCount: number;
  complianceRate: number | null;
  affectedRiders: number;
  deviationEpisodes: number;
  openDeviationEpisodes: number;
}

export interface ZoneAnalyticsResult {
  timeContext: AnalyticsTimeContext;
  zones: ZoneAnalyticsMetrics[];
  timeline?: AnalyticsTimeline;
}

export interface RiderAnalyticsMetrics {
  riderId: string;
  riderName: string | null;
  totalEvents: number;
  observedDays: number;
  complianceDistribution: PresenceComplianceDistribution;
  eligibleEventsCount: number;
  complianceRate: number | null;
  deviationEvents: number;
  deviationEpisodes: number;
  openDeviationEpisodes: number;
  affectedZones: number;
}

export interface RiderAnalyticsResult {
  timeContext: AnalyticsTimeContext;
  riders: RiderAnalyticsMetrics[];
  timeline?: AnalyticsTimeline;
}

export interface HistoricalOperationalSummaryDTO {
  range: AnalyticsTimeRange;
  observedRiders: number;
  presenceEvents: number;
  compliance: ComplianceMetrics;
  deviations: DeviationMetrics;
  comparison?: {
    previousRange: AnalyticsTimeRange;
    observedRidersComparison: PeriodMetricComparison;
    presenceEventsComparison: PeriodMetricComparison;
    complianceRateComparison: PeriodMetricComparison;
    deviationsComparison: PeriodMetricComparison;
  };
  capabilities: AnalyticsCapabilities;
}

export interface HistoricalTimelinePointDTO {
  bucketStart: string; // ISO 8601 start of temporal bucket
  bucketEnd: string;   // ISO 8601 end of temporal bucket
  observedRiders: number;
  totalEvents: number;
  compliant: number;
  deviated: number;
  outside: number;
  unassigned: number;
  complianceRate: number | null;
  deviationEpisodesCount: number;
}

export interface HistoricalZoneSummaryDTO {
  range: AnalyticsTimeRange;
  totalZonesEvaluated: number;
  zones: ZoneHistoricalMetric[];
}

export interface HistoricalRiderSummaryDTO {
  range: AnalyticsTimeRange;
  totalRidersEvaluated: number;
  riders: RiderHistoricalMetric[];
}

export interface HistoricalDeviationSummaryDTO {
  range: AnalyticsTimeRange;
  metrics: DeviationMetrics;
  episodes: DeviationEpisode[];
}


