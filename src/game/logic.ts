import { GameDoc, LastAction, PlayerDoc, RollAction } from './types';

// Game rules:
// - Rolls 1-3: a 7 adds 70. Roll 4+: a 7 busts the round (total wiped, round advances).
// - Doubles (x2) is only playable from roll 4 on.
// - Banking is only allowed from roll 4 on (rollNum > 3), once per round.
// - The round also ends when every player has banked.
// - `rolls` never contains a bust 7 — a bust ends the round instead, with the
//   pre-bust log saved to bustSnapshot so the host can undo a mis-tap.

export function initialGameDoc(hostId: string, totalRounds: number): GameDoc {
  return {
    status: 'lobby',
    hostId,
    totalRounds,
    roundNum: 1,
    rollNum: 1,
    roundTotal: 0,
    rolls: [],
    bustSnapshot: null,
    lastAction: null,
    turnSeat: 0,
  };
}

// Everything the turn pointer needs, as plain seat numbers, so the rules stay
// free of the Firestore document shape. Two sets because the round boundary and
// the rolls within a round move the dice over different populations:
//   inPlay — skips anyone already banked, for passing the dice mid-round
//   seats  — the whole table, for crossing into a round where everyone is back
// Using inPlay at a boundary would skip whoever banked in the round just ended,
// costing them their turn in the next one.
export interface Turn {
  seats: number[];
  inPlay: number[];
}

const NO_TURN: Turn = { seats: [], inPlay: [] };

// The seat after `current` within `ring`. Wraps, and returns the current seat
// unchanged when the ring is empty — the round is over in that case anyway.
export function nextSeat(current: number, ring: number[]): number {
  if (ring.length === 0) return current;
  const ahead = ring.filter((seat) => seat > current);
  return ahead.length > 0 ? Math.min(...ahead) : Math.min(...ring);
}

// The inverse, for undo. Exact only while the ring is unchanged since the undone
// roll — someone banking in between shifts it — which is the same tolerance undo
// already has for the rest of the round state.
export function prevSeat(current: number, ring: number[]): number {
  if (ring.length === 0) return current;
  const behind = ring.filter((seat) => seat < current);
  return behind.length > 0 ? Math.max(...behind) : Math.max(...ring);
}

export function recomputeRound(rolls: RollAction[]): { roundTotal: number; rollNum: number } {
  let roundTotal = 0;
  let rollNum = 1;
  for (const action of rolls) {
    if (action.type === 'doubles') {
      roundTotal *= 2;
    } else if (action.value === 7 && rollNum <= 3) {
      roundTotal += 70;
    } else {
      roundTotal += action.value;
    }
    rollNum++;
  }
  return { roundTotal, rollNum };
}

// The dice keep going round the table across the round boundary — they do NOT
// come back to seat 0. `turnSeat` is whoever rolls next, so whether the boundary
// advances it depends on why the round ended:
//   bust      — the seat it names just rolled the 7, so hand on to the next one
//   all banked — nobody rolled, so that seat is still owed its turn; leave it
function endRound(
  game: GameDoc,
  lastAction: LastAction,
  bustSnapshot: GameDoc['bustSnapshot'],
  turnSeat: number
): GameDoc {
  if (game.roundNum >= game.totalRounds) {
    return {
      ...game,
      status: 'finished',
      roundTotal: 0,
      rollNum: 1,
      rolls: [],
      bustSnapshot: null,
      lastAction,
      turnSeat,
    };
  }
  return {
    ...game,
    roundNum: game.roundNum + 1,
    roundTotal: 0,
    rollNum: 1,
    rolls: [],
    bustSnapshot,
    lastAction,
    turnSeat,
  };
}

// A doubles call counts as that seat's turn too.
export function applyRoll(game: GameDoc, value: number, turn: Turn = NO_TURN): GameDoc {
  if (game.status !== 'active') return game;
  const seat = game.turnSeat ?? 0;
  if (value === 7 && game.rollNum > 3) {
    // Whoever busted has had their go; the next round opens on the seat after
    // them, over the full table since everyone is unbanked again.
    return endRound(
      game,
      { type: 'bust', value: 7 },
      { rolls: game.rolls },
      nextSeat(seat, turn.seats)
    );
  }
  const rolls: RollAction[] = [...game.rolls, { type: 'roll', value }];
  return {
    ...game,
    rolls,
    ...recomputeRound(rolls),
    lastAction: { type: 'roll', value },
    turnSeat: nextSeat(seat, turn.inPlay),
  };
}

export function applyDoubles(game: GameDoc, turn: Turn = NO_TURN): GameDoc {
  if (game.status !== 'active' || game.rollNum <= 3) return game;
  const rolls: RollAction[] = [...game.rolls, { type: 'doubles' }];
  return {
    ...game,
    rolls,
    ...recomputeRound(rolls),
    lastAction: { type: 'doubles' },
    turnSeat: nextSeat(game.turnSeat ?? 0, turn.inPlay),
  };
}

// Round end triggered by every player having banked. Clears bustSnapshot:
// undoing across an all-banked round end would just re-trigger the advance.
//
// turnSeat is carried over untouched: nobody rolled it away, so the seat it
// names opens the next round still owed the turn it never got.
export function advanceRound(game: GameDoc): GameDoc {
  if (game.status !== 'active') return game;
  return endRound(game, { type: 'roundStart' }, null, game.turnSeat ?? 0);
}

function lastActionFor(rolls: RollAction[]): LastAction {
  if (rolls.length === 0) return { type: 'roundStart' };
  const last = rolls[rolls.length - 1];
  return last.type === 'doubles' ? { type: 'doubles' } : { type: 'roll', value: last.value };
}

// Returns the game with the most recent host action reversed, or null when
// there is nothing to undo. A bust can be undone only until the next roll is
// entered (bustSnapshot survives, but the restored log would be stale).
export function undoLast(game: GameDoc, turn: Turn = NO_TURN): GameDoc | null {
  if (game.status !== 'active') return null;
  if (game.rolls.length > 0) {
    const rolls = game.rolls.slice(0, -1);
    return {
      ...game,
      rolls,
      ...recomputeRound(rolls),
      lastAction: lastActionFor(rolls),
      turnSeat: prevSeat(game.turnSeat ?? 0, turn.inPlay),
    };
  }
  if (game.lastAction?.type === 'bust' && game.bustSnapshot && game.roundNum > 1) {
    const rolls = game.bustSnapshot.rolls;
    return {
      ...game,
      roundNum: game.roundNum - 1,
      rolls,
      ...recomputeRound(rolls),
      bustSnapshot: null,
      lastAction: lastActionFor(rolls),
      // Exact inverse of the bust boundary, which advanced one seat over the
      // full table: step back to whoever rolled the 7 being undone.
      turnSeat: prevSeat(game.turnSeat ?? 0, turn.seats),
    };
  }
  return null;
}

export function hasBankedThisRound(game: GameDoc, player: PlayerDoc): boolean {
  return player.bankedRound === game.roundNum;
}

export function canBank(game: GameDoc, player: PlayerDoc): boolean {
  return game.status === 'active' && game.rollNum > 3 && !hasBankedThisRound(game, player);
}

// Both seat rings for the current round, ascending.
export function turnContext(game: GameDoc, orderedPlayers: PlayerDoc[]): Turn {
  const seated = orderedPlayers
    .map((player, index) => ({ player, seat: player.order ?? index }))
    .sort((a, b) => a.seat - b.seat);
  return {
    seats: seated.map(({ seat }) => seat),
    inPlay: seated
      .filter(({ player }) => !hasBankedThisRound(game, player))
      .map(({ seat }) => seat),
  };
}

// Who physically rolls next. Starts at the stored pointer and walks forward
// past anyone banked, which is what covers the case the pointer cannot: a
// player banking on their own turn. bank() is a player-side transaction and the
// rules forbid it writing the game doc, so the pointer simply cannot move
// there — resolving it at render time instead costs nothing and needs no
// permission. Null once everyone has banked.
export function currentTurnPlayer(
  game: GameDoc,
  orderedPlayers: PlayerDoc[]
): PlayerDoc | null {
  if (game.status !== 'active' || orderedPlayers.length === 0) return null;
  const seated = orderedPlayers.map((player, index) => ({
    player,
    seat: player.order ?? index,
  }));
  const from = game.turnSeat ?? 0;
  // Ordered so the walk starts at `from` and wraps exactly once.
  const ring = [...seated].sort((a, b) => a.seat - b.seat);
  const startIndex = ring.findIndex((entry) => entry.seat >= from);
  const offset = startIndex === -1 ? 0 : startIndex;
  for (let i = 0; i < ring.length; i++) {
    const entry = ring[(offset + i) % ring.length];
    if (!hasBankedThisRound(game, entry.player)) return entry.player;
  }
  return null;
}

export function allPlayersBanked(game: GameDoc, players: PlayerDoc[]): boolean {
  return (
    game.status === 'active' &&
    game.rollNum > 3 &&
    players.length >= 1 &&
    players.every((p) => hasBankedThisRound(game, p))
  );
}

// Points descending; stable, so the incoming (joinedAt) order breaks ties.
export function standings(players: PlayerDoc[]): PlayerDoc[] {
  return [...players].sort((a, b) => b.points - a.points);
}

// How far `me` is off the lead, or null when `me` is at the top (including a
// tie for it — "0 behind" reads like a deficit when it isn't one). The leader
// returned is whoever standings() ranks first, so ties resolve the same way the
// standings list displays them.
export function leaderGap(
  players: PlayerDoc[],
  me: PlayerDoc
): { leader: PlayerDoc; behind: number } | null {
  const leader = standings(players)[0];
  if (!leader || leader.points <= me.points) return null;
  return { leader, behind: leader.points - me.points };
}
