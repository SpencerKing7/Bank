/// <reference types="react-scripts" />

// Screen Wake Lock API. Shipped everywhere we care about (Safari 16.4+,
// Chrome 84+) but not yet in TypeScript 4.9's lib.dom, so declare the slice
// useWakeLock actually uses. Drop this when the TS upgrade lands.
interface WakeLockSentinel extends EventTarget {
  readonly released: boolean;
  readonly type: 'screen';
  release(): Promise<void>;
}

interface WakeLock {
  request(type: 'screen'): Promise<WakeLockSentinel>;
}

interface Navigator {
  readonly wakeLock: WakeLock;
}
