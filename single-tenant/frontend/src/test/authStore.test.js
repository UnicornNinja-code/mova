import { describe, it, expect, beforeEach, vi } from "vitest";
import { useAuthStore } from "@/stores/useAuthStore";
import axios from "axios";

vi.mock("axios");

describe("🔐 Zustand Auth Store Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
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
    expect(sessionStorage.getItem("mova_access_token")).toBe(mockToken);
  });

  it("clears auth state on logout", () => {
    useAuthStore.getState().setAuth("token-123", { role: "RIDER" });
    expect(useAuthStore.getState().isAuthenticated).toBe(true);

    useAuthStore.getState().clearAuth();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().token).toBeNull();
    expect(sessionStorage.getItem("mova_access_token")).toBeNull();
  });

  it("initializeAuth verifies token via /api/auth/me when token exists in storage", async () => {
    sessionStorage.setItem("mova_access_token", "valid-token-123");
    sessionStorage.setItem("mova_user_profile", JSON.stringify({ id: "usr-1", role: "SUPERADMIN" }));

    const mockFreshUser = { id: "usr-1", name: "Super Admin", role: "SUPERADMIN", username: "superadmin" };
    axios.get.mockResolvedValueOnce({
      data: { user: mockFreshUser },
    });

    const result = await useAuthStore.getState().initializeAuth();

    expect(result).toBe(true);
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.isInitialized).toBe(true);
    expect(state.user).toEqual(mockFreshUser);
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining("/api/auth/me"),
      expect.objectContaining({
        headers: { Authorization: "Bearer valid-token-123" },
      })
    );
  });

  it("initializeAuth falls back to silent refresh when /api/auth/me fails", async () => {
    sessionStorage.setItem("mova_access_token", "expired-token-456");

    axios.get.mockRejectedValueOnce({ response: { status: 401 } });
    axios.post.mockResolvedValueOnce({
      data: {
        token: "refreshed-jwt-token-999",
        user: { id: "usr-2", name: "Rider 1", role: "RIDER" },
      },
    });

    const result = await useAuthStore.getState().initializeAuth();

    expect(result).toBe(true);
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.isInitialized).toBe(true);
    expect(state.token).toBe("refreshed-jwt-token-999");
    expect(state.user.role).toBe("RIDER");
    expect(sessionStorage.getItem("mova_access_token")).toBe("refreshed-jwt-token-999");
  });

  it("initializeAuth clears auth state when both token and refresh fail", async () => {
    sessionStorage.setItem("mova_access_token", "bad-token");

    axios.get.mockRejectedValueOnce({ response: { status: 401 } });
    axios.post.mockRejectedValueOnce({ response: { status: 401 } });

    const result = await useAuthStore.getState().initializeAuth();

    expect(result).toBe(false);
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isInitialized).toBe(true);
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
  });
});

