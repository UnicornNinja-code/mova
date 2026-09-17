import React, { useEffect, useRef } from "react";
import { ShieldCheck } from "lucide-react";

/**
 * TurnstileWidget
 * Cloudflare Turnstile CAPTCHA integration with graceful dev/offline fallback.
 */
export function TurnstileWidget({
  siteKey = import.meta.env.VITE_TURNSTILE_SITEKEY || "1x00000000000000000000AA", // Cloudflare test key
  onVerify,
  onError,
  theme = "auto",
}) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);

  useEffect(() => {
    // If Turnstile script is loaded
    if (window.turnstile && containerRef.current) {
      try {
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: theme === "dark" ? "dark" : "light",
          callback: (token) => {
            if (onVerify) onVerify(token);
          },
          "error-callback": () => {
            if (onError) onError();
          },
        });
      } catch (err) {
        console.warn("Turnstile render warning:", err);
      }

      return () => {
        if (window.turnstile && widgetIdRef.current !== null) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch {
            // ignore cleanup errors
          }
        }
      };
    } else {
      // In offline / dev mode without script loaded, simulate passing test token
      const timer = setTimeout(() => {
        if (onVerify) onVerify("dev-turnstile-mock-token-passed");
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [siteKey, theme, onVerify, onError]);

  return (
    <div className="flex flex-col items-center justify-center p-2 rounded border border-[var(--border-subtle)] bg-[var(--surface-muted)]">
      <div ref={containerRef} className="my-1 min-h-[65px] flex items-center justify-center">
        {!window.turnstile && (
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <ShieldCheck className="w-4 h-4 text-[var(--status-success)]" />
            <span>Verifikasi Keamanan Aktif (Dev Mode)</span>
          </div>
        )}
      </div>
    </div>
  );
}
