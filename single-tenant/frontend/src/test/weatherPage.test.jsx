import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("Operational Weather Page & Spatial Risk Matrix", () => {
  it("renders page header, Central Hub weather overview, and operational timeline", () => {
    render(<WeatherPage />, { wrapper: createWrapper() });

    expect(
      screen.getByText("Prediksi Cuaca & Matriks Risiko Spasial")
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Central Hub Weather Overview/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Hourly Operational Timeline/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/4-Slot C4 Weather Risk Penalty/i)
    ).toBeInTheDocument();
  });

  it("handles date switching between Hari Ini and Besok", () => {
    render(<WeatherPage />, { wrapper: createWrapper() });

    const todayBtn = screen.getByText("Hari Ini");
    const tomorrowBtn = screen.getByText("Besok");

    expect(todayBtn).toBeInTheDocument();
    expect(tomorrowBtn).toBeInTheDocument();

    fireEvent.click(tomorrowBtn);
    expect(tomorrowBtn.className).toContain("bg-[var(--surface)]");
  });

  it("renders sync button and zone selection dropdown", () => {
    render(<WeatherPage />, { wrapper: createWrapper() });

    expect(screen.getByText("Sync Open-Meteo")).toBeInTheDocument();
    expect(screen.getByText("Semua Zona Operasional")).toBeInTheDocument();
  });
});
