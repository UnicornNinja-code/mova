import { analyticsRepository } from "../../repositories/analyticsRepository.js";
import { formatMetric, POPULATION_SCOPES } from "./AnalyticsContract.js";

export class OperationalAnalyticsService {
  static instance = null;

  constructor(repo = analyticsRepository) {
    if (OperationalAnalyticsService.instance && repo === analyticsRepository) {
      return OperationalAnalyticsService.instance;
    }
    this.repo = repo;
    if (repo === analyticsRepository) {
      OperationalAnalyticsService.instance = this;
    }
  }

  static getInstance(repo = analyticsRepository) {
    if (!OperationalAnalyticsService.instance) {
      OperationalAnalyticsService.instance = new OperationalAnalyticsService(repo);
    }
    return OperationalAnalyticsService.instance;
  }

  async getOperationalSummary({ startDate, endDate, date, zoneId = null } = {}) {
    const targetStartDate = startDate || date || new Date().toISOString().split("T")[0];
    const targetEndDate = endDate || date || targetStartDate;

    const [lifecycle, fleet] = await Promise.all([
      this.repo.getOperationalLifecycleMetrics({
        startDate: targetStartDate,
        endDate: targetEndDate,
        zoneId,
      }),
      this.repo.getFleetUtilizationMetrics(),
    ]);

    const assigned = lifecycle.total_assigned_sessions || 0;
    const checkedIn = lifecycle.total_checked_in_sessions || 0;
    const completed = lifecycle.total_completed_sessions || 0;
    const avgDuration = parseFloat(lifecycle.avg_operating_duration_minutes) || 0;

    const overallCheckoutRate = assigned > 0 ? (completed / assigned) * 100 : 0;
    const checkedInCheckoutRate = checkedIn > 0 ? (completed / checkedIn) * 100 : 0;
    const checkInRate = assigned > 0 ? (checkedIn / assigned) * 100 : 0;

    return {
      time_window: {
        start_date: targetStartDate,
        end_date: targetEndDate,
      },
      population: {
        total_assigned_riders: lifecycle.total_assigned_riders || 0,
        total_assigned_sessions: assigned,
        total_checked_in_sessions: checkedIn,
        currently_operating_sessions: lifecycle.currently_operating_sessions || 0,
        total_completed_sessions: completed,
      },
      kpis: {
        check_in_rate: {
          ...formatMetric(checkInRate, assigned, "%"),
          denominator_scope: POPULATION_SCOPES.ALL_ASSIGNED,
          formula: "checked_in_sessions / total_assigned_sessions * 100",
        },
        overall_checkout_rate: {
          ...formatMetric(overallCheckoutRate, assigned, "%"),
          denominator_scope: POPULATION_SCOPES.ALL_ASSIGNED,
          formula: "completed_sessions / total_assigned_sessions * 100",
        },
        checked_in_checkout_rate: {
          ...formatMetric(checkedInCheckoutRate, checkedIn, "%"),
          denominator_scope: POPULATION_SCOPES.CHECKED_IN,
          formula: "completed_sessions / checked_in_sessions * 100",
        },
        avg_operating_duration: {
          ...formatMetric(avgDuration, checkedIn, "min"),
          min_minutes: parseFloat(lifecycle.min_operating_duration_minutes) || 0,
          max_minutes: parseFloat(lifecycle.max_operating_duration_minutes) || 0,
        },
      },
      fleet_overview: fleet,
    };
  }

  async getFleetUtilization() {
    return await this.repo.getFleetUtilizationMetrics();
  }
}

export const operationalAnalyticsService = OperationalAnalyticsService.getInstance();
