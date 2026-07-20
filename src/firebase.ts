import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, initializeFirestore } from 'firebase/firestore';

// Firebase web config is public by design — Firestore security rules do the
// protecting. .env.local (gitignored) just keeps the values out of the repo.
const config = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

// Local dev without a Firebase project: set REACT_APP_USE_EMULATOR=true in
// .env.local and run `npx firebase-tools emulators:start --project demo-bank`.
const useEmulator = process.env.REACT_APP_USE_EMULATOR === 'true';

export const isFirebaseConfigured =
  useEmulator || Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);

// Placeholders keep initializeApp from throwing when config is absent; the app
// gates every Firebase call behind isFirebaseConfigured and shows a setup
// screen instead.
const app = initializeApp(
  useEmulator
    ? { apiKey: 'demo', authDomain: 'localhost', projectId: 'demo-bank', appId: 'demo' }
    : isFirebaseConfigured
      ? config
      : { apiKey: 'missing', authDomain: 'missing', projectId: 'missing', appId: 'missing' }
);

// Force the realtime listeners onto discrete long-polling instead of the
// default streaming transport (WebChannel).
//
// The default transport is one long-lived streaming response that the server
// writes each change onto as a chunk. Plenty of network paths — mobile-carrier
// proxies, restrictive Wi-Fi/corporate firewalls, some VPNs and antivirus —
// BUFFER that stream: they hold a chunk and only flush it to the device when
// the *next* chunk arrives. The device then renders update N while the server
// has already sent N+1, so it sits exactly one roll / one bank behind until
// something forces a fresh fetch. A page refresh re-issues a complete,
// non-streamed document read, which is why refreshing "catches up" for a moment
// and then falls one behind again. It is per-network, so one player's phone
// lags while everyone else is smooth.
//
// The SDK already defaults experimentalAutoDetectLongPolling to true, but that
// is a connect-time heuristic: a path that streams cleanly at handshake and
// only buffers afterward slips right past it. Forcing long-polling removes the
// guesswork — every poll is a complete request/response, so there is no open
// stream for an intermediary to sit on, and the one-behind failure mode simply
// cannot occur on any network. Delivery stays effectively instant: a poll is
// held open and returns the moment a change lands; timeoutSeconds only bounds
// how long an *idle* poll waits before returning "no change" and re-polling.
// We set it below 30s so each poll completes inside the ~30s cutoff common
// proxies/gateways enforce, which otherwise severs the poll and stalls the
// listener.
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  experimentalLongPollingOptions: { timeoutSeconds: 25 },
});
export const auth = getAuth(app);

if (useEmulator) {
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
}
