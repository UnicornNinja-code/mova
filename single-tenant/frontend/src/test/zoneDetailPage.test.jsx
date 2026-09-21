import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ZoneDetailPage } from "@/pages/operations/ZoneDetailPage";
import * as useZonesHooks from "@/hooks/queries/useZones";

function renderWithRouter(initialEntry = "/operations/zones/1") {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/operations/zones/:id" element={<ZoneDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("Operational ZoneDetailPage Suite", () => {
  it("renders zone detail with centralized data from database", () => {
    vi.spyOn(useZonesHooks, "useZoneDetail").mockReturnValue({
      data: {
        id: 1,
        name: "Zona GOR Delta Sidoarjo",
        description: "Area sentral stadion dan pusat olahraga publik.",
        max_capacity: 12,
        status: "ACTIVE",
        created_at: "2026-01-15T08:00:00Z",
        updated_at: "2026-03-10T12:00:00Z",
        polygon: {
          type: "Polygon",
          coordinates: [
            [
              [112.71, -7.45],
              [112.72, -7.45],
              [112.72, -7.46],
              [112.71, -7.46],
              [112.71, -7.45],
            ],
          ],
        },
      },
      isLoading: false,
      isError: false,
    });

    vi.spyOn(useZonesHooks, "useCandidateSpots").mockReturnValue({
      data: [
        {
          id: 101,
          name: "Pintu Timur GOR",
          latitude: -7.4523,
          longitude: 112.7155,
          radius_meters: 60,
          category: "Sport Center",
          potential_score: 0.88,
          is_active: true,
        },
      ],
      isLoading: false,
    });

    renderWithRouter("/operations/zones/1");

    expect(screen.getByText("Zona GOR Delta Sidoarjo")).toBeInTheDocument();
    expect(screen.getByText(/Kapasitas Maksimum Armada/i)).toBeInTheDocument();
    expect(screen.getByText("Pintu Timur GOR")).toBeInTheDocument();
    expect(screen.getByText("Sport Center")).toBeInTheDocument();
    expect(screen.getByText("0.88")).toBeInTheDocument();
    expect(screen.getByText(/Status: Aktif/i)).toBeInTheDocument();
  });

  it("renders empty state when zone is not found", () => {
    vi.spyOn(useZonesHooks, "useZoneDetail").mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      error: { message: "Zona tidak ditemukan." },
    });

    vi.spyOn(useZonesHooks, "useCandidateSpots").mockReturnValue({
      data: [],
      isLoading: false,
    });

    renderWithRouter("/operations/zones/999");

    expect(screen.getByRole("heading", { name: /Zona Tidak Ditemukan/i })).toBeInTheDocument();
  });
});
