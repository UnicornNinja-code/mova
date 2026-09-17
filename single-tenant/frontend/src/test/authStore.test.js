import { describe, it, expect, beforeEach } from "vitest";
import { useAuthStore } from "@/stores/useAuthStore";

describe("🔐 Zustand Auth Store Suite", () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth();
  });

  it("initializes with unauthenticated state", () => {
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
  });

  it("updates auth state when setAuth is called", () => {
    const mockUser = {
      id: "usr-1",
      name: "Supervisor Mova",
      role: "SUPERVISOR",
      username: "supervisor",
    };
    const mockToken = "jwt-mock-token-xyz";

    useAuthStore.getState().setAuth(mockToken, mockUser);

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.token).toBe(mockToken);
    expect(state.user).toEqual(mockUser);
  });

  it("clears auth state on logout", () => {
    useAuthStore.getState().setAuth("token-123", { role: "RIDER" });
    expect(useAuthStore.getState().isAuthenticated).toBe(true);

    useAuthStore.getState().clearAuth();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().token).toBeNull();
  });
});
