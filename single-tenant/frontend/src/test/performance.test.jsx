import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, renderHook, act } from "@testing-library/react";
import { MetricCard } from "@/components/composites/MetricCard";
import { DataTable } from "@/components/composites/DataTable";
import { useAuthStore } from "@/stores/useAuthStore";

describe("Web Performance Optimization & React Best Practices Suite", () => {
  it("renders MetricCard with fixed minimum dimensions to prevent layout shifts", () => {
    const { container } = render(
      <MetricCard
        title="Aktifitas Rider"
        value="48 / 52"
        subtitle="92% kepatuhan zona"
      />
    );

    const panelEl = container.firstChild;
    expect(panelEl.className).toContain("min-h-[110px]");
    expect(screen.getByText("Aktifitas Rider")).toBeInTheDocument();
    expect(screen.getByText("48 / 52")).toBeInTheDocument();
  });

  it("renders DataTable with content-visibility optimization", () => {
    const columns = [
      { key: "name", header: "Nama Zona" },
      { key: "code", header: "Kode" },
    ];
    const data = [
      { id: "1", name: "Zona A", code: "Z-A" },
      { id: "2", name: "Zona B", code: "Z-B" },
    ];

    const { container } = render(
      <DataTable columns={columns} data={data} />
    );

    const tbody = container.querySelector("tbody");
    expect(tbody.className).toContain("content-visibility-auto");
    expect(screen.getByText("Zona A")).toBeInTheDocument();
  });

  it("supports atomic Zustand selector subscriptions to eliminate global re-renders", () => {
    const { result } = renderHook(() => useAuthStore((s) => s.user));

    expect(result.current).toBeNull();

    act(() => {
      useAuthStore.getState().setAuth("dummy-token", {
        id: 1,
        name: "Supervisor MOVA",
        role: "SUPERVISOR",
      });
    });

    expect(result.current?.name).toBe("Supervisor MOVA");
    expect(result.current?.role).toBe("SUPERVISOR");
  });
});
