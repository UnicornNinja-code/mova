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
    let isMounted = true;

    const initTurnstile = () => {
      if (!isMounted || !containerRef.current) return;

      if (window.turnstile) {
        try {
          if (widgetIdRef.current !== null) {
            try {
              window.turnstile.remove(widgetIdRef.current);
            } catch {
              // ignore cleanup errors
            }
          }

          widgetIdRef.current = window.turnstile.render(containerRef.current, {
            sitekey: siteKey,
            theme: theme === "dark" ? "dark" : "light",
            size: size === "invisible" ? "invisible" : size,
            callback: (token) => {
              if (isMounted && onVerify) onVerify(token);
            },
            "error-callback": () => {
              if (isMounted && onError) onError();
            },
            "expired-callback": () => {
              if (isMounted && onError) onError();
            },
          });
        } catch (err) {
          console.warn("Turnstile render warning:", err);
        }
      } else {
        // Fallback for local development/offline testing
        const timer = setTimeout(() => {
          if (isMounted && onVerify) {
            onVerify("dev-turnstile-mock-token-passed");
          }
        }, 300);
        return () => clearTimeout(timer);
      }
    };

    // Auto-load script if not already on window and not in test
    if (!window.turnstile && !document.getElementById("cloudflare-turnstile-script")) {
      const script = document.createElement("script");
      script.id = "cloudflare-turnstile-script";
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.onload = () => {
        if (isMounted) initTurnstile();
      };
      script.onerror = () => {
        // Fallback on script load error (e.g. offline dev)
        if (isMounted && onVerify) onVerify("dev-turnstile-mock-token-passed");
      };
      document.head.appendChild(script);
    } else {
      initTurnstile();
    }

    return () => {
      isMounted = false;
      if (window.turnstile && widgetIdRef.current !== null) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // ignore
        }
      }
    };
  }, [siteKey, theme, size, onVerify, onError]);

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

