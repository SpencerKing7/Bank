import { useEffect } from 'react';
import { disableNetwork, enableNetwork } from 'firebase/firestore';
import { db } from '../firebase';

// Force a fresh server sync whenever the tab returns to the foreground or the
// network comes back.
//
// A round of Bank! is minutes of watching a number climb, so phones lock and
// players tab away constantly. While the page is hidden the browser suspends
// the connection, and on return the SDK can serve its last cached snapshot for
// a beat before its own reconnect catches up — the player sees a stale total
// until they refresh. Toggling the network off and immediately back on drops
// the resumed listeners and re-fetches current state right away. With
// long-polling the polls are short-lived, so this catch-up is quick, and the
// blink of cache in between just lights the app's existing "reconnecting" dot.
//
// Best effort throughout: this only ever *accelerates* the recovery the SDK
// would eventually do on its own, so a failed or skipped toggle costs freshness
// for a moment, never correctness.
export function useForegroundSync(): void {
  useEffect(() => {
    let resyncing = false;

    const resync = async () => {
      // Skip while hidden (nothing on screen to freshen) and coalesce the
      // online+visible burst that fires when a phone wakes onto data again.
      if (resyncing || document.hidden) return;
      resyncing = true;
      try {
        await disableNetwork(db);
        await enableNetwork(db);
      } catch {
        // Leave the SDK's own reconnection to catch up on its usual schedule.
      } finally {
        resyncing = false;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') resync();
    };

    window.addEventListener('online', resync);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('online', resync);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);
}
