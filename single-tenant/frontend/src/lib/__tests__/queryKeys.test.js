import { describe, it, expect } from "vitest";
import { queryKeys } from "../queryKeys.js";

describe("QueryKey Factory SSOT", () => {
  it("generates structured keys for auth and session", () => {
    expect(queryKeys.auth.me()).toEqual(["auth", "me"]);
    expect(queryKeys.auth.session()).toEqual(["auth", "session"]);
  });

  it("generates structured keys for spatial zones", () => {
    expect(queryKeys.zones.list({ status: "active" })).toEqual(["zones", "list", { status: "active" }]);
    expect(queryKeys.zones.detail("zone-123")).toEqual(["zones", "detail", "zone-123"]);
  });

  it("generates structured keys for weather and operational timeline", () => {
    expect(queryKeys.weather.current()).toEqual(["weather", "current"]);
    expect(queryKeys.weather.timeline("zone-1", "today", "all")).toEqual(["weather", "timeline", "zone-1", "today", "all"]);
    expect(queryKeys.weather.c4("zone-1", "sore")).toEqual(["weather", "c4", "zone-1", "sore"]);
  });

  it("generates structured keys for DSS evaluations and history", () => {
    expect(queryKeys.dss.configs()).toEqual(["dss", "configs"]);
    expect(queryKeys.dss.history({ limit: 10 })).toEqual(["dss", "history", { limit: 10 }]);
  });

  it("generates structured keys for rider mobile operations", () => {
    expect(queryKeys.riderOps.activeSession()).toEqual(["rider-ops", "active-session"]);
    expect(queryKeys.riderOps.availableArmada()).toEqual(["rider-ops", "available-armada"]);
  });

  it("generates structured keys for distribution queue", () => {
    expect(queryKeys.distribution.queue("2026-09-16")).toEqual(["distribution", "queue", "2026-09-16"]);
  });
});
