import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { PublicRoute } from "@/routes/PublicRoute";
import { useAuthStore } from "@/stores/useAuthStore";

describe("🛡️ PublicRoute Component Suite", () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth();
  });

  it("renders spinner when not initialized", () => {
    useAuthStore.setState({ isInitialized: false });

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route
            path="/login"
            element={
              <PublicRoute>
                <div>Login Form Content</div>
              </PublicRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getAllByText("Memverifikasi Sesi...")[0]).toBeInTheDocument();
    expect(screen.queryByText("Login Form Content")).not.toBeInTheDocument();
  });

  it("renders children when unauthenticated and initialized", () => {
    useAuthStore.setState({ isInitialized: true, isAuthenticated: false });

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route
            path="/login"
            element={
              <PublicRoute>
                <div>Login Form Content</div>
              </PublicRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Login Form Content")).toBeInTheDocument();
  });

  it("redirects authenticated desktop users to /overview", () => {
    useAuthStore.setState({
      isInitialized: true,
      isAuthenticated: true,
      user: { role: "SUPERVISOR", first_login: false },
    });

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route
            path="/login"
            element={
              <PublicRoute>
                <div>Login Form Content</div>
              </PublicRoute>
            }
          />
          <Route path="/overview" element={<div>Overview Dashboard Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Overview Dashboard Page")).toBeInTheDocument();
    expect(screen.queryByText("Login Form Content")).not.toBeInTheDocument();
  });

  it("redirects authenticated rider users to /rider", () => {
    useAuthStore.setState({
      isInitialized: true,
      isAuthenticated: true,
      user: { role: "RIDER", first_login: false },
    });

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route
            path="/login"
            element={
              <PublicRoute>
                <div>Login Form Content</div>
              </PublicRoute>
            }
          />
          <Route path="/rider" element={<div>Rider Mobile Workspace</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Rider Mobile Workspace")).toBeInTheDocument();
    expect(screen.queryByText("Login Form Content")).not.toBeInTheDocument();
  });

  it("redirects first-login users to /first-login", () => {
    useAuthStore.setState({
      isInitialized: true,
      isAuthenticated: true,
      user: { role: "SUPERVISOR", first_login: true },
    });

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route
            path="/login"
            element={
              <PublicRoute>
                <div>Login Form Content</div>
              </PublicRoute>
            }
          />
          <Route path="/first-login" element={<div>First Login Password Setup</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("First Login Password Setup")).toBeInTheDocument();
  });
});
