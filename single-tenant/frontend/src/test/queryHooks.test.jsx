import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useZonesList, useCreateZoneMutation } from "@/hooks/queries/useZones";
import { zoneService } from "@/services/zoneService";

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

describe("TanStack Query Custom Hooks & Cache Management", () => {
  it("useZonesList fetches zones correctly and populates query cache", async () => {
    const mockZones = [{ id: "z1", name: "Zone Kuningan" }];
    vi.spyOn(zoneService, "getZones").mockResolvedValueOnce(mockZones);

    const { result } = renderHook(() => useZonesList(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockZones);
  });

  it("useCreateZoneMutation invalidates zone queries on success", async () => {
    const newZone = { id: "z2", name: "Zone Sudirman" };
    vi.spyOn(zoneService, "createZone").mockResolvedValueOnce(newZone);

    const { result } = renderHook(() => useCreateZoneMutation(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ name: "Zone Sudirman" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(newZone);
  });
});
