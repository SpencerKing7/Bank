import { useEffect, useState } from 'react';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../firebase';

// Signs in anonymously on first load; the uid persists across refreshes and is
// the player's identity (games/{code}/players/{uid}).
export function useAnonymousAuth(): { uid: string | null; ready: boolean; error: string | null } {
  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setReady(true);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUid(user.uid);
        setReady(true);
      } else {
        signInAnonymously(auth).catch((e) => {
          setError(e instanceof Error ? e.message : 'Sign-in failed');
          setReady(true);
        });
      }
    });
    return unsubscribe;
  }, []);

  return { uid, ready, error };
}
