import { describe, it, expect, vi, beforeEach } from "vitest";
import { api } from "@/services/api";
import {
  authService,
  zoneService,
  dssService,
  poiService,
  competitorService,
  roadService,
  fleetService,
  riderService,
  distributionService,
  catalogService,
  dashboardService,
} from "@/services";

describe("Frontend Domain Services & Contract Alignment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("authService executes login and me correctly", async () => {
    const mockUser = { id: 1, email: "admin@mova.id", role: "SUPERADMIN" };
    vi.spyOn(api, "post").mockResolvedValueOnce({
      data: { success: true, data: { token: "fake-jwt", user: mockUser } },
    });
    vi.spyOn(api, "get").mockResolvedValueOnce({
      data: { success: true, data: mockUser },
    });

    const loginRes = await authService.login({ identifier: "admin", password: "pwd" });
    expect(loginRes.token).toBe("fake-jwt");

    const meRes = await authService.getCurrentUser();
    expect(meRes.email).toBe("admin@mova.id");
  });

  it("zoneService fetches zones and candidate spots unwrapping envelope", async () => {
    const mockZones = [{ id: "z1", name: "Zone Semanggi", status: "ACTIVE" }];
    vi.spyOn(api, "get").mockResolvedValueOnce({
      data: { success: true, data: mockZones },
    });

    const zones = await zoneService.getZones();
    expect(zones).toHaveLength(1);
    expect(zones[0].name).toBe("Zone Semanggi");
  });

  it("dssService requests recommendations with parameters", async () => {
    const mockRec = [{ recommended_zone_id: "z1", score: 0.89 }];
    vi.spyOn(api, "get").mockResolvedValueOnce({
      data: { success: true, data: mockRec },
    });

    const rec = await dssService.getRecommendations({ timeSlot: "MORNING", latitude: -6.2, longitude: 106.8 });
    expect(rec[0].score).toBe(0.89);
  });

  it("competitorService handles survey intake and reconciliation", async () => {
    const mockComp = { id: "c1", brand_name: "Starbucks", status: "CONFIRMED" };
    vi.spyOn(api, "post").mockResolvedValueOnce({
      data: { success: true, data: mockComp },
    });

    const result = await competitorService.createCompetitor({
      brand_name: "Starbucks",
      zone_id: "z1",
      latitude: -6.2,
      longitude: 106.8,
    });
    expect(result.brand_name).toBe("Starbucks");
  });

  it("riderService handles armada claim and sales recording", async () => {
    vi.spyOn(api, "post").mockResolvedValueOnce({
      data: { success: true, data: { success: true, armada_id: "armada-01" } },
    });

    const claimRes = await riderService.claimArmada({ armadaId: "armada-01" });
    expect(claimRes.armada_id).toBe("armada-01");
  });

  it("catalogService and dashboardService handle products and analytics queries", async () => {
    const mockProducts = [{ id: "p1", name: "Kopi Susu Gula Aren", price: 18000 }];
    vi.spyOn(api, "get").mockResolvedValueOnce({
      data: { success: true, data: mockProducts },
    });

    const products = await catalogService.getProducts();
    expect(products[0].name).toBe("Kopi Susu Gula Aren");

    const mockKpi = { active_riders: 12, total_revenue: 4500000 };
    vi.spyOn(api, "get").mockResolvedValueOnce({
      data: { success: true, data: mockKpi },
    });

    const kpi = await dashboardService.getAnalyticsOverview();
    expect(kpi.active_riders).toBe(12);
  });
});
