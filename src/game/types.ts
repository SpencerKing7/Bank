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
  // Seat (PlayerDoc.order) of whoever physically rolls next. Advanced one
  // eligible seat per roll, and it keeps travelling round the table across
  // round boundaries rather than resetting. Stored rather than derived from
  // rollNum: the eligible set shrinks as people bank, so a recomputed pointer
  // would jump backwards mid-round.
  turnSeat?: number;
  createdAt?: unknown; // Firestore Timestamp; opaque to game logic
}

// Stored at games/{code}/players/{uid}. `id` is the doc id (the player's
// anonymous-auth uid), attached client-side on read.
export interface PlayerDoc {
  id: string;
  name: string;
  points: number;
  bankedRound: number; // round they last banked in; 0 = never
  // Seat index, 0-based and contiguous. Sets the physical roll order round the
  // table, so it is also what turnSeat indexes into. Assigned on join and
  // rewritten by the host dragging the lobby list. Optional so a player doc
  // written before this field existed still parses; readers fall back to
  // arrival order.
  order?: number;
  joinedAt?: unknown; // Firestore Timestamp; used only for query ordering
}
