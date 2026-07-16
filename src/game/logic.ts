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
  };
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

function endRound(game: GameDoc, lastAction: LastAction, bustSnapshot: GameDoc['bustSnapshot']): GameDoc {
  if (game.roundNum >= game.totalRounds) {
    return {
      ...game,
      status: 'finished',
      roundTotal: 0,
      rollNum: 1,
      rolls: [],
      bustSnapshot: null,
      lastAction,
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
  };
}

export function applyRoll(game: GameDoc, value: number): GameDoc {
  if (game.status !== 'active') return game;
  if (value === 7 && game.rollNum > 3) {
    return endRound(game, { type: 'bust', value: 7 }, { rolls: game.rolls });
  }
  const rolls: RollAction[] = [...game.rolls, { type: 'roll', value }];
  return {
    ...game,
    rolls,
    ...recomputeRound(rolls),
    lastAction: { type: 'roll', value },
  };
}

export function applyDoubles(game: GameDoc): GameDoc {
  if (game.status !== 'active' || game.rollNum <= 3) return game;
  const rolls: RollAction[] = [...game.rolls, { type: 'doubles' }];
  return {
    ...game,
    rolls,
    ...recomputeRound(rolls),
    lastAction: { type: 'doubles' },
  };
}

// Round end triggered by every player having banked. Clears bustSnapshot:
// undoing across an all-banked round end would just re-trigger the advance.
export function advanceRound(game: GameDoc): GameDoc {
  if (game.status !== 'active') return game;
  return endRound(game, { type: 'roundStart' }, null);
}

function lastActionFor(rolls: RollAction[]): LastAction {
  if (rolls.length === 0) return { type: 'roundStart' };
  const last = rolls[rolls.length - 1];
  return last.type === 'doubles' ? { type: 'doubles' } : { type: 'roll', value: last.value };
}

// Returns the game with the most recent host action reversed, or null when
// there is nothing to undo. A bust can be undone only until the next roll is
// entered (bustSnapshot survives, but the restored log would be stale).
export function undoLast(game: GameDoc): GameDoc | null {
  if (game.status !== 'active') return null;
  if (game.rolls.length > 0) {
    const rolls = game.rolls.slice(0, -1);
    return {
      ...game,
      rolls,
      ...recomputeRound(rolls),
      lastAction: lastActionFor(rolls),
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
