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

// The seat physically rolling now: the first still-in-play seat at or after the
// dice position, wrapping. turnSeat is only *where the dice sits* — it can name
// a seat whose player has banked, and the dice passes straight on through them —
// so the ring of seats still in play is what turns that position into a roller.
// Returns the position unchanged when nobody is in play (the round is over
// anyway). This is the seat-level twin of currentTurnPlayer, so the pointer the
// rules advance and the roller the screen shows can never drift apart.
export function currentSeat(position: number, inPlay: number[]): number {
  if (inPlay.length === 0) return position;
  const atOrAfter = inPlay.filter((seat) => seat >= position);
  return atOrAfter.length > 0 ? Math.min(...atOrAfter) : Math.min(...inPlay);
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
// come back to seat 0. The caller passes the already-advanced dice position, so
// endRound just records it; how that position was reached differs by why the
// round ended:
//   bust       — the buster's roll pushed the dice one seat over the full table
//   all banked — no new roll, so the dice stays parked one seat past the last
//                roller, which is exactly where the next round should open
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
  // Advance from whoever actually rolls — the stored pointer may be parked on a
  // banked seat, so resolve the real roller first — and move the dice one seat
  // over the FULL table. Counting banked seats as positions the dice travels
  // through is what makes the pointer land correctly for both the next roller
  // this round and the opener of the next one; advancing over only the in-play
  // ring would stick on a lone survivor and skip players who banked early.
  const roller = currentSeat(game.turnSeat ?? 0, turn.inPlay);
  const dice = nextSeat(roller, turn.seats);
  if (value === 7 && game.rollNum > 3) {
    // Whoever busted has had their go; the next round opens on the seat after
    // them, over the full table since everyone is unbanked again.
    return endRound(game, { type: 'bust', value: 7 }, { rolls: game.rolls }, dice);
  }
  const rolls: RollAction[] = [...game.rolls, { type: 'roll', value }];
  return {
    ...game,
    rolls,
    ...recomputeRound(rolls),
    lastAction: { type: 'roll', value },
    turnSeat: dice,
  };
}

export function applyDoubles(game: GameDoc, turn: Turn = NO_TURN): GameDoc {
  if (game.status !== 'active' || game.rollNum <= 3) return game;
  const roller = currentSeat(game.turnSeat ?? 0, turn.inPlay);
  const rolls: RollAction[] = [...game.rolls, { type: 'doubles' }];
  return {
    ...game,
    rolls,
    ...recomputeRound(rolls),
    lastAction: { type: 'doubles' },
    turnSeat: nextSeat(roller, turn.seats),
  };
}

// Round end triggered by every player having banked. Clears bustSnapshot:
// undoing across an all-banked round end would just re-trigger the advance.
//
// The dice position is carried over untouched. No one rolled to end this round,
// so the dice is still parked one seat past the last roller — a roll always
// pushes it over the full table, even when a lone survivor is rolling on their
// own — which is exactly the seat that should open the next round.
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
      // The forward move parked the dice one seat past the roller over the full
      // table; step back over the same ring to put that roller up again.
      turnSeat: prevSeat(game.turnSeat ?? 0, turn.seats),
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

// Who physically rolls next. Resolves the dice position (which may sit on a
// banked seat) to the first still-in-play seat at or after it — the same
// walk-forward currentSeat does, over players. This is what covers the case the
// stored pointer cannot: a player banking on their own turn. bank() is a
// player-side transaction and the rules forbid it writing the game doc, so the
// pointer cannot move there — resolving it at render time instead costs nothing
// and needs no permission. Null once everyone has banked.
export function currentTurnPlayer(
  game: GameDoc,
  orderedPlayers: PlayerDoc[]
): PlayerDoc | null {
  if (game.status !== 'active' || orderedPlayers.length === 0) return null;
  const seated = orderedPlayers.map((player, index) => ({
    player,
    seat: player.order ?? index,
  }));
  const inPlay = seated
    .filter(({ player }) => !hasBankedThisRound(game, player))
    .map(({ seat }) => seat);
  if (inPlay.length === 0) return null;
  const seat = currentSeat(game.turnSeat ?? 0, inPlay);
  return seated.find((entry) => entry.seat === seat)?.player ?? null;
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
