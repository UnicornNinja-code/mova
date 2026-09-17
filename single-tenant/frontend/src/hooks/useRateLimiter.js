import { useState, useEffect, useRef, useCallback } from "react";

/**
 * useRateLimiter
 * Client-side rate-limiting and brute force cooldown mechanism.
 */
export function useRateLimiter({
  maxAttempts = 3,
  baseCooldownSeconds = 15,
  storageKey = "mova_rate_limiter_auth",
} = {}) {
  const [failedAttempts, setFailedAttempts] = useState(() => {
    try {
      const stored = sessionStorage.getItem(storageKey);
      return stored ? JSON.parse(stored).attempts || 0 : 0;
    } catch {
      return 0;
    }
  });

  const [lockoutExpiry, setLockoutExpiry] = useState(() => {
    try {
      const stored = sessionStorage.getItem(storageKey);
      return stored ? JSON.parse(stored).expiry || null : null;
    } catch {
      return null;
    }
  });

  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const timerRef = useRef(null);

  const calculateCooldown = useCallback(
    (attempts) => {
      const multiplier = Math.max(1, attempts - maxAttempts + 1);
      return baseCooldownSeconds * multiplier;
    },
    [baseCooldownSeconds, maxAttempts]
  );

  const updateStorage = (attempts, expiry) => {
    try {
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({ attempts, expiry })
      );
    } catch (err) {
      console.warn("Rate limiter storage error:", err);
    }
  };

  const recordFailure = useCallback(() => {
    setFailedAttempts((prev) => {
      const nextAttempts = prev + 1;
      if (nextAttempts >= maxAttempts) {
        const cooldownSec = calculateCooldown(nextAttempts);
        const expiryTime = Date.now() + cooldownSec * 1000;
        setLockoutExpiry(expiryTime);
        setRemainingSeconds(cooldownSec);
        updateStorage(nextAttempts, expiryTime);
      } else {
        updateStorage(nextAttempts, null);
      }
      return nextAttempts;
    });
  }, [maxAttempts, calculateCooldown]);

  const resetRateLimit = useCallback(() => {
    setFailedAttempts(0);
    setLockoutExpiry(null);
    setRemainingSeconds(0);
    try {
      sessionStorage.removeItem(storageKey);
    } catch (err) {
      console.warn("Rate limiter storage error:", err);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!lockoutExpiry) {
      setRemainingSeconds(0);
      return;
    }

    const checkLock = () => {
      const now = Date.now();
      const diffSec = Math.ceil((lockoutExpiry - now) / 1000);

      if (diffSec <= 0) {
        setRemainingSeconds(0);
        setLockoutExpiry(null);
        updateStorage(failedAttempts, null);
        if (timerRef.current) clearInterval(timerRef.current);
      } else {
        setRemainingSeconds(diffSec);
      }
    };

    checkLock();
    timerRef.current = setInterval(checkLock, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [lockoutExpiry, failedAttempts]);

  const isLocked = remainingSeconds > 0;

  return {
    isLocked,
    remainingSeconds,
    failedAttempts,
    recordFailure,
    resetRateLimit,
  };
}
