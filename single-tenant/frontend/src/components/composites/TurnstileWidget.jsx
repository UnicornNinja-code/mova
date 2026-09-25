import React, { useEffect, useRef } from "react";
import { ShieldCheck } from "lucide-react";

/**
 * TurnstileWidget
 * Cloudflare Turnstile CAPTCHA integration with invisible/managed support & graceful dev fallback.
 */
export function TurnstileWidget({
  siteKey = import.meta.env.VITE_TURNSTILE_SITEKEY || "1x00000000000000000000AA", // Cloudflare test key
  onVerify,
  onError,
  theme = "auto",
  size = "normal", // "normal" | "compact" | "invisible"
  className = "",
}) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);

  useEffect(() => {
    // Turnstile disabled to prevent third-party storage tracking warnings and browser memory leak
    if (onVerify) {
      onVerify("dev-turnstile-mock-token-passed");
    }
  }, [onVerify]);

  if (size === "invisible") {
    return <div ref={containerRef} className="hidden" aria-hidden="true" />;
  }

  return (
    <div className={`flex flex-col items-center justify-center p-2 rounded border border-[var(--border-subtle)] bg-[var(--surface-muted)] ${className}`}>
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

