import {
  advanceRound,
  allPlayersBanked,
  applyDoubles,
  applyRoll,
  canBank,
  initialGameDoc,
  recomputeRound,
  standings,
  undoLast,
} from './logic';
import { generateGameCode, isValidGameCode } from './codes';
import { GameDoc, PlayerDoc } from './types';

function activeGame(overrides: Partial<GameDoc> = {}): GameDoc {
  return { ...initialGameDoc('host-uid', 20), status: 'active', ...overrides };
}

function rollMany(game: GameDoc, values: number[]): GameDoc {
  return values.reduce((g, v) => applyRoll(g, v), game);
}

function player(overrides: Partial<PlayerDoc> = {}): PlayerDoc {
  return { id: 'p1', name: 'Player', points: 0, bankedRound: 0, ...overrides };
}

describe('applyRoll', () => {
  it('adds the value and advances rollNum', () => {
    const g = applyRoll(activeGame(), 6);
    expect(g.roundTotal).toBe(6);
    expect(g.rollNum).toBe(2);
    expect(g.lastAction).toEqual({ type: 'roll', value: 6 });
  });

  it('scores a 7 as 70 during rolls 1-3', () => {
    let g = rollMany(activeGame(), [7, 7, 7]);
    expect(g.roundTotal).toBe(210);
    expect(g.rollNum).toBe(4);
    expect(g.roundNum).toBe(1);
  });

  it('busts on a 7 from roll 4 on: wipes total, advances round, snapshots rolls', () => {
    const before = rollMany(activeGame(), [5, 6, 8, 10]); // total 29, rollNum 5
    const g = applyRoll(before, 7);
    expect(g.roundTotal).toBe(0);
    expect(g.rollNum).toBe(1);
    expect(g.roundNum).toBe(2);
    expect(g.rolls).toEqual([]);
    expect(g.lastAction).toEqual({ type: 'bust', value: 7 });
    expect(g.bustSnapshot).toEqual({ rolls: before.rolls });
  });

  it('finishes the game when a bust hits on the final round', () => {
    let g = rollMany(activeGame({ roundNum: 20 }), [5, 6, 8, 10]);
    g = applyRoll(g, 7);
    expect(g.status).toBe('finished');
    expect(g.roundNum).toBe(20);
    expect(g.bustSnapshot).toBeNull();
  });

  it('ignores rolls when the game is not active', () => {
    const g = initialGameDoc('host-uid', 20);
    expect(applyRoll(g, 5)).toEqual(g);
  });
});

describe('applyDoubles', () => {
  it('is a no-op during rolls 1-3', () => {
    const g = rollMany(activeGame(), [5, 6]);
    expect(applyDoubles(g)).toEqual(g);
  });

  it('doubles the total from roll 4 on', () => {
    const g = applyDoubles(rollMany(activeGame(), [5, 6, 8])); // total 19
    expect(g.roundTotal).toBe(38);
    expect(g.rollNum).toBe(5);
    expect(g.lastAction).toEqual({ type: 'doubles' });
  });
});

describe('recomputeRound', () => {
  it('round-trips with applyRoll/applyDoubles', () => {
    const g = applyDoubles(rollMany(activeGame(), [7, 2, 12, 11]));
    expect(recomputeRound(g.rolls)).toEqual({ roundTotal: g.roundTotal, rollNum: g.rollNum });
    expect(g.roundTotal).toBe((70 + 2 + 12 + 11) * 2);
  });
});

describe('undoLast', () => {
  it('pops the last roll and recomputes', () => {
    const g = undoLast(rollMany(activeGame(), [5, 6, 8]))!;
    expect(g.roundTotal).toBe(11);
    expect(g.rollNum).toBe(3);
    expect(g.lastAction).toEqual({ type: 'roll', value: 6 });
  });

  it('pops a doubles', () => {
    const g = undoLast(applyDoubles(rollMany(activeGame(), [5, 6, 8])))!;
    expect(g.roundTotal).toBe(19);
    expect(g.rollNum).toBe(4);
  });

  it('restores a busted round from the snapshot', () => {
    const before = rollMany(activeGame(), [5, 6, 8, 10]);
    const busted = applyRoll(before, 7);
    const g = undoLast(busted)!;
    expect(g.roundNum).toBe(1);
    expect(g.roundTotal).toBe(29);
    expect(g.rollNum).toBe(5);
    expect(g.rolls).toEqual(before.rolls);
    expect(g.bustSnapshot).toBeNull();
  });

  it('no-ops on a fresh round with nothing to undo', () => {
    expect(undoLast(activeGame())).toBeNull();
    const advanced = advanceRound(rollMany(activeGame(), [5, 6, 8, 10]));
    expect(undoLast(advanced)).toBeNull(); // all-banked advance is not undoable
  });

  it('no-ops once the game is finished', () => {
    let g = rollMany(activeGame({ roundNum: 20 }), [5, 6, 8, 10]);
    g = applyRoll(g, 7);
    expect(undoLast(g)).toBeNull();
  });

  it('undoing to an empty round resets lastAction to roundStart', () => {
    const g = undoLast(rollMany(activeGame(), [5]))!;
    expect(g.roundTotal).toBe(0);
    expect(g.rollNum).toBe(1);
    expect(g.lastAction).toEqual({ type: 'roundStart' });
  });
});

describe('advanceRound', () => {
  it('advances and clears the round state', () => {
    const g = advanceRound(rollMany(activeGame(), [5, 6, 8, 10]));
    expect(g.roundNum).toBe(2);
    expect(g.roundTotal).toBe(0);
    expect(g.rollNum).toBe(1);
    expect(g.rolls).toEqual([]);
    expect(g.bustSnapshot).toBeNull();
    expect(g.lastAction).toEqual({ type: 'roundStart' });
  });

  it('finishes the game after the final round', () => {
    const g = advanceRound(rollMany(activeGame({ roundNum: 20 }), [5, 6, 8, 10]));
    expect(g.status).toBe('finished');
  });
});

describe('canBank', () => {
  it('is locked during rolls 1-3', () => {
    const g = rollMany(activeGame(), [5, 6]);
    expect(canBank(g, player())).toBe(false);
  });

  it('opens from roll 4 on, once per round', () => {
    const g = rollMany(activeGame(), [5, 6, 8]);
    expect(canBank(g, player())).toBe(true);
    expect(canBank(g, player({ bankedRound: 1 }))).toBe(false);
    expect(canBank(g, player({ bankedRound: 1 }))).toBe(false);
    expect(canBank({ ...g, roundNum: 2, rollNum: 4 }, player({ bankedRound: 1 }))).toBe(true);
  });

  it('is closed when the game is not active', () => {
    expect(canBank(initialGameDoc('h', 20), player())).toBe(false);
  });
});

describe('allPlayersBanked', () => {
  it('requires at least one player, roll 4+, and everyone banked', () => {
    const g = rollMany(activeGame(), [5, 6, 8]);
    const banked = player({ bankedRound: 1 });
    const notBanked = player({ id: 'p2', bankedRound: 0 });
    expect(allPlayersBanked(g, [])).toBe(false);
    expect(allPlayersBanked(g, [banked, notBanked])).toBe(false);
    expect(allPlayersBanked(g, [banked, { ...notBanked, bankedRound: 1 }])).toBe(true);
    expect(allPlayersBanked(rollMany(activeGame(), [5, 6]), [banked])).toBe(false);
  });
});

describe('standings', () => {
  it('sorts by points descending, stable on ties', () => {
    const players = [
      player({ id: 'a', name: 'Ann', points: 10 }),
      player({ id: 'b', name: 'Bo', points: 30 }),
      player({ id: 'c', name: 'Cy', points: 10 }),
    ];
    expect(standings(players).map((p) => p.id)).toEqual(['b', 'a', 'c']);
  });
});

describe('game codes', () => {
  it('generates 4 uppercase letters without I or O', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateGameCode();
      expect(code).toMatch(/^[A-HJ-NP-Z]{4}$/);
      expect(isValidGameCode(code)).toBe(true);
    }
    expect(isValidGameCode('ABIO')).toBe(false);
    expect(isValidGameCode('abcd')).toBe(false);
    expect(isValidGameCode('ABCDE')).toBe(false);
  });
});
