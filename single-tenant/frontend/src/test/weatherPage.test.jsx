import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WeatherPage } from "@/pages/operations/WeatherPage";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe("Operational Weather Page & Spatial Risk Matrix", () => {
  it("renders page header, Central Hub weather overview, and operational timeline in unified panel", () => {
    render(<WeatherPage />, { wrapper: createWrapper() });

    expect(
      screen.getByText(/Pusat Cuaca & Matriks Risiko Armada/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Prakiraan Hari Ini/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Prakiraan Cuaca Per Jam Operasional/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Evaluasi Penalti Kriteria Cuaca/i)
    ).toBeInTheDocument();
  });

  it("handles date switching between Hari Ini and Besok and toggles timeline context", () => {
    render(<WeatherPage />, { wrapper: createWrapper() });

    const todayBtn = screen.getByText("Hari Ini");
    const tomorrowBtn = screen.getByText("Besok");

    expect(todayBtn).toBeInTheDocument();
    expect(tomorrowBtn).toBeInTheDocument();

    // Default today shows "Prakiraan Hari Ini"
    expect(screen.getByText(/Prakiraan Hari Ini/i)).toBeInTheDocument();

    fireEvent.click(tomorrowBtn);
    expect(tomorrowBtn.className).toContain("bg-[var(--surface)]");
    expect(screen.getByText(/Prakiraan Besok/i)).toBeInTheDocument();
  });

  it("renders sync button and zone selection dropdown", () => {
    render(<WeatherPage />, { wrapper: createWrapper() });

    expect(screen.getByText(/Sync|Sinkronisasi/i)).toBeInTheDocument();
    expect(screen.getByText("Semua Zona (Central Hub Sidoarjo)")).toBeInTheDocument();
  });

  it("renders hourly forecast legend and current time indicator when on today's view", () => {
    render(<WeatherPage />, { wrapper: createWrapper() });

    expect(screen.getAllByText(/Suhu \(°C\)/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Peluang Hujan \(%\)/i).length).toBeGreaterThanOrEqual(1);

    // Current hour in operational range (e.g. 14:00) should display "Saat Ini" indicator
    const currentHour = new Date().getHours();
    if (currentHour >= 6 && currentHour <= 21) {
      const saatIniBadges = screen.getAllByText(/Saat Ini/i);
      expect(saatIniBadges.length).toBeGreaterThanOrEqual(1);
    }
  });
});

