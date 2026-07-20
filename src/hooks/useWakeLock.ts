import { useCallback, useEffect, useRef, useState } from 'react';
import { getKeepAwake, saveKeepAwake } from './useSession';

// Screen Wake Lock. A round of Bank! is minutes of staring at a number nobody
// is touching, so the phone dims and locks right as the total gets interesting.
//
// The lock is not a set-and-forget flag: the browser releases it whenever the
// page stops being visible (tab switch, app switch, screen lock) and does NOT
// restore it on return. Re-requesting on visibilitychange is the whole trick —
// without it the toggle appears to work and then quietly stops after the first
// time the player checks a text message.
export interface WakeLockState {
  supported: boolean;
  enabled: boolean; // what the user asked for
  // The browser has the API but refused the lock (battery saver, an embedded
  // web view, an enterprise policy). Distinguishing this from plain `enabled`
  // is what stops the switch sitting there claiming to work when it doesn't.
  blocked: boolean;
  toggle: () => void;
}

export function useWakeLock(): WakeLockState {
  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;
  // Restore the user's choice, but never claim to be on where it can't be.
  const [enabled, setEnabled] = useState(() => supported && getKeepAwake());
  const [blocked, setBlocked] = useState(false);
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!supported) return;

    let cancelled = false;

    const acquire = async () => {
      // document.hidden requests are rejected outright — wait for the
      // visibilitychange that follows instead of burning a failed request.
      if (cancelled || !enabled || document.hidden || sentinelRef.current) return;
      try {
        const sentinel = await navigator.wakeLock.request('screen');
        if (cancelled || !enabled) {
          sentinel.release().catch(() => {});
          return;
        }
        sentinelRef.current = sentinel;
        setBlocked(false);
        // Fires on both our own release and the browser's. Clearing the ref is
        // what lets the next visibilitychange re-acquire.
        sentinel.addEventListener('release', () => {
          if (sentinelRef.current === sentinel) sentinelRef.current = null;
        });
      } catch {
        // Leave `enabled` alone so a later visibility change retries — a
        // refusal here is often temporary — but say so, rather than leaving a
        // switch that reads as on while the screen keeps dimming.
        if (!cancelled) setBlocked(true);
      }
    };

    const release = () => {
      const sentinel = sentinelRef.current;
      sentinelRef.current = null;
      sentinel?.release().catch(() => {});
    };

    if (enabled) acquire();
    else release();

    const onVisibility = () => {
      if (document.visibilityState === 'visible') acquire();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      release();
    };
  }, [enabled, supported]);

  const toggle = useCallback(() => {
    setBlocked(false); // a fresh ask deserves a fresh verdict
    setEnabled((on) => {
      saveKeepAwake(!on);
      return !on;
    });
  }, []);

  return { supported, enabled, blocked, toggle };
}
