import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  MapContainer,
  MapToolbar,
  MapLayerControl,
  MapLegend,
  MapPanel,
  createPulsingRiderIcon,
  createSpotIcon,
  createCompetitorIcon,
} from "@/components/mapops";

describe("Leaflet MapOps Spatial Workspace & Controls", () => {
  it("generates custom Leaflet DivIcons with correct classes and markup", () => {
    const riderIcon = createPulsingRiderIcon("COMPLIANT");
    expect(riderIcon.options.className).toBe("mova-rider-marker");
    expect(riderIcon.options.html).toContain("#10B981");

    const spotIcon = createSpotIcon(1, 0.95);
    expect(spotIcon.options.className).toBe("mova-spot-marker");
    expect(spotIcon.options.html).toContain("#1");
    expect(spotIcon.options.html).toContain("0.95");

    const compIcon = createCompetitorIcon("Janji Jiwa");
    expect(compIcon.options.className).toBe("mova-competitor-marker");
    expect(compIcon.options.html).toContain("Janji Jiwa");
  });

  it("renders MapToolbar with zoom, hub focus, and fit bounds buttons", () => {
    const mockFit = vi.fn();
    const mockRefresh = vi.fn();
    render(<MapToolbar onFitAllZones={mockFit} onRefresh={mockRefresh} />);

    expect(screen.getByLabelText("Zoom In")).toBeInTheDocument();
    expect(screen.getByLabelText("Zoom Out")).toBeInTheDocument();
    expect(screen.getByLabelText("Pusatkan ke Sidoarjo Hub")).toBeInTheDocument();
    expect(screen.getByLabelText("Fokus Seluruh Zona")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Fokus Seluruh Zona"));
    expect(mockFit).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByLabelText("Segarkan Data Spasial"));
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it("renders MapLayerControl and toggles spatial layers", () => {
    const mockToggle = vi.fn();
    const layers = {
      zones: true,
      spots: true,
      roads: false,
      competitors: true,
      riders: true,
    };
    const counts = { zones: 5, riders: 12 };

    render(
      <MapLayerControl layers={layers} counts={counts} onToggleLayer={mockToggle} />
    );

    expect(screen.getByText("Zona Operasional")).toBeInTheDocument();
    expect(screen.getByText("Rider Live Telemetry")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument(); // count badge
    expect(screen.getByText("12")).toBeInTheDocument();

    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);
    expect(mockToggle).toHaveBeenCalledWith("zones");
  });

  it("renders MapLegend with spatial categories", () => {
    render(<MapLegend />);
    expect(screen.getByText("Legenda Spasial MapOps")).toBeInTheDocument();
    expect(screen.getByText("Zona Operasional")).toBeInTheDocument();
    expect(screen.getByText("Rider Compliant (Dalam Zona)")).toBeInTheDocument();
  });

  it("renders MapPanel with rich zone and rider inspection details", () => {
    const mockZone = {
      id: "zone-1",
      name: "Zona Semanggi",
      code: "Z-SMG",
      status: "ACTIVE",
      target_riders: 4,
      revenue_target: 750000,
    };

    render(
      <MapPanel
        open={true}
        onOpenChange={vi.fn()}
        entityType="zone"
        selectedEntity={mockZone}
      />
    );

    expect(screen.getByText("Zona: Zona Semanggi")).toBeInTheDocument();
    expect(screen.getByText("Z-SMG")).toBeInTheDocument();
    expect(screen.getByText("4 Rider")).toBeInTheDocument();
    expect(screen.getByText("Evaluasi DSS TOPSIS Zona Ini")).toBeInTheDocument();
  });
});
