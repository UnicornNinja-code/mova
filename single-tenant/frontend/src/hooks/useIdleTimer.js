import { useEffect, useRef } from "react";
import { useAuthStore } from "@/stores/useAuthStore";

/**
 * useIdleTimer
 * Monitors user interaction and triggers session logout when idle timeout is exceeded.
 * @param {object} options
 * @param {number} options.timeoutMs - Inactivity timeout in milliseconds (default: 15 mins)
 * @param {Function} options.onIdle - Optional custom callback on idle
 */
export function useIdleTimer({ timeoutMs = 15 * 60 * 1000, onIdle } = {}) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const touchActivity = useAuthStore((state) => state.touchActivity);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    const handleUserActivity = () => {
      touchActivity();
      resetTimer();
    };

    const handleSessionTimeout = () => {
      if (typeof onIdle === "function") {
        onIdle();
      } else {
        clearAuth();
        if (typeof window !== "undefined" && window.location.pathname !== "/login") {
          window.location.href = "/login?reason=idle_timeout";
        }
      }
    };

    const resetTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(handleSessionTimeout, timeoutMs);
    };

    // Activity listeners
    const events = ["mousedown", "keydown", "scroll", "touchstart", "click"];
    events.forEach((event) => {
      window.addEventListener(event, handleUserActivity, { passive: true });
    });

    resetTimer();

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      events.forEach((event) => {
        window.removeEventListener(event, handleUserActivity);
      });
    };
  }, [isAuthenticated, timeoutMs, onIdle, touchActivity, clearAuth]);
}
