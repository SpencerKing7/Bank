import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';

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

export const db = getFirestore(app);
export const auth = getAuth(app);

if (useEmulator) {
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
}
