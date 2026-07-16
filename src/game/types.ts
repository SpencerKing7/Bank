export type GameStatus = 'lobby' | 'active' | 'finished';

export type RollAction =
  | { type: 'roll'; value: number }
  | { type: 'doubles' };

export type LastAction = {
  type: 'roll' | 'doubles' | 'bust' | 'roundStart';
  value?: number;
} | null;

// Stored at games/{code}. The doc id is the 4-letter game code.
// roundTotal and rollNum are always derived from `rolls` via recomputeRound —
// stored redundantly so guests render without recomputing.
export interface GameDoc {
  status: GameStatus;
  hostId: string;
  totalRounds: number;
  roundNum: number;
  rollNum: number;
  roundTotal: number;
  rolls: RollAction[];
  // Pre-bust roll log; lets the host undo an accidental bust 7.
  bustSnapshot: { rolls: RollAction[] } | null;
  lastAction: LastAction;
  createdAt?: unknown; // Firestore Timestamp; opaque to game logic
}

// Stored at games/{code}/players/{uid}. `id` is the doc id (the player's
// anonymous-auth uid), attached client-side on read.
export interface PlayerDoc {
  id: string;
  name: string;
  points: number;
  bankedRound: number; // round they last banked in; 0 = never
  joinedAt?: unknown; // Firestore Timestamp; used only for query ordering
}
