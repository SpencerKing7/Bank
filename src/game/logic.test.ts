import {
  advanceRound,
  allPlayersBanked,
  applyDoubles,
  applyRoll,
  canBank,
  currentSeat,
  currentTurnPlayer,
  initialGameDoc,
  leaderGap,
  nextSeat,
  prevSeat,
  recomputeRound,
  standings,
  Turn,
  turnContext,
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

describe('turn order', () => {
  // Ann, Bo, Cy, Dee in seats 0..3.
  const table = (bankedRounds: number[] = [0, 0, 0, 0]): PlayerDoc[] =>
    ['Ann', 'Bo', 'Cy', 'Dee'].map((name, seat) =>
      player({ id: name.toLowerCase(), name, order: seat, bankedRound: bankedRounds[seat] })
    );

  describe('nextSeat', () => {
    it('moves one seat along', () => {
      expect(nextSeat(0, [0, 1, 2, 3])).toBe(1);
    });

    it('wraps from the last seat back to the first', () => {
      expect(nextSeat(3, [0, 1, 2, 3])).toBe(0);
    });

    it('skips seats that are out of play', () => {
      expect(nextSeat(0, [0, 2, 3])).toBe(2); // seat 1 banked
      expect(nextSeat(3, [0, 2, 3])).toBe(0);
    });

    // The round is over in this case; standing still beats picking a seat that
    // no longer exists.
    it('stays put when nobody is left to roll', () => {
      expect(nextSeat(2, [])).toBe(2);
    });
  });

  describe('prevSeat', () => {
    it('inverts nextSeat, wrapping the other way', () => {
      expect(prevSeat(1, [0, 1, 2, 3])).toBe(0);
      expect(prevSeat(0, [0, 1, 2, 3])).toBe(3);
      expect(prevSeat(2, [0, 2, 3])).toBe(0); // seat 1 banked
    });
  });

  describe('currentSeat', () => {
    it('names the seat at the dice position when its player is in play', () => {
      expect(currentSeat(2, [0, 1, 2, 3])).toBe(2);
    });

    it('walks forward past a banked seat the dice is parked on', () => {
      expect(currentSeat(1, [0, 2, 3])).toBe(2); // seat 1 banked
    });

    it('wraps to the lowest in-play seat when the position is past the end', () => {
      expect(currentSeat(2, [0, 1])).toBe(0); // seats 2, 3 banked
    });

    it('holds on the sole survivor', () => {
      expect(currentSeat(0, [3])).toBe(3);
    });

    it('returns the position unchanged when nobody is in play', () => {
      expect(currentSeat(2, [])).toBe(2);
    });
  });

  const FULL: Turn = { seats: [0, 1, 2, 3], inPlay: [0, 1, 2, 3] };

  describe('turnContext', () => {
    it('reports the whole table and, separately, who is still owed a turn', () => {
      const game = activeGame({ roundNum: 3 });
      expect(turnContext(game, table([0, 3, 0, 3]))).toEqual({
        seats: [0, 1, 2, 3],
        inPlay: [0, 2],
      });
    });

    it('falls back to list position for a player with no seat', () => {
      const game = activeGame({ roundNum: 1 });
      const legacy = [player({ id: 'a' }), player({ id: 'b' })]; // no `order`
      expect(turnContext(game, legacy)).toEqual({ seats: [0, 1], inPlay: [0, 1] });
    });
  });

  describe('applyRoll', () => {
    it('passes the dice on with each roll and wraps round the table', () => {
      let g = activeGame({ turnSeat: 0 });
      g = applyRoll(g, 4, FULL);
      expect(g.turnSeat).toBe(1);
      g = applyRoll(g, 4, FULL);
      g = applyRoll(g, 4, FULL);
      expect(g.turnSeat).toBe(3);
      g = applyRoll(g, 4, FULL);
      expect(g.turnSeat).toBe(0);
    });

    it('counts a doubles call as that seat’s turn', () => {
      const g = applyDoubles(rollMany(activeGame(), [5, 6, 8]), FULL);
      expect(g.turnSeat).toBe(1);
    });

    // Regression: banking out of turn leaves the stored pointer parked on a
    // banked seat, behind whoever actually rolls. Advancing from the raw pointer
    // used to land straight back on the roller (they appear to roll twice); the
    // move now starts from the resolved roller instead.
    it('advances past the real roller when the pointer lags on a banked seat', () => {
      // Seats 0 and 1 have banked; the dice is parked on seat 0, seat 2 rolls.
      const turn: Turn = { seats: [0, 1, 2, 3], inPlay: [2, 3] };
      const g = applyRoll(activeGame({ turnSeat: 0, rollNum: 5 }), 4, turn);
      expect(g.turnSeat).toBe(3); // seat 2 rolled → dice to seat 3, not back to 2
    });

    // The same situation end to end, read through the player list: after Cy
    // rolls the dice must be on Dee, never on Cy again.
    it('passes to the next unbanked player after a roll, not the roller again', () => {
      const players = table([3, 3, 0, 0]); // Ann, Bo banked this round
      let g = activeGame({ roundNum: 3, turnSeat: 0, rollNum: 5 });
      const turn = turnContext(g, players); // seats 0-3, inPlay 2,3
      expect(currentTurnPlayer(g, players)?.name).toBe('Cy');
      g = applyRoll(g, 4, turn);
      expect(currentTurnPlayer(g, players)?.name).toBe('Dee');
    });
  });

  // A lone survivor is the case the old pointer got wrong on both exits: the
  // in-play ring is just their own seat, so nextSeat stuck the dice on them, and
  // neither busting nor banking then moved it off. It must hand on to the next
  // seat over the full table (everyone is back next round).
  describe('a lone survivor finishing the round', () => {
    // Ann, Bo, Cy banked; only Dee (seat 3) is still rolling.
    const survivors = () => table([3, 3, 3, 0]);

    it('keeps the dice on the survivor while they roll on alone', () => {
      let g = activeGame({ roundNum: 3, turnSeat: 0, rollNum: 6 });
      const turn = turnContext(g, survivors()); // inPlay [3]
      expect(currentTurnPlayer(g, survivors())?.name).toBe('Dee');
      g = applyRoll(g, 5, turn);
      expect(currentTurnPlayer(g, survivors())?.name).toBe('Dee');
      // The dice is already parked one seat past Dee, ready for the boundary.
      expect(g.turnSeat).toBe(0);
    });

    it('hands on to the next seat when the survivor banks (all-banked advance)', () => {
      let g = activeGame({ roundNum: 3, turnSeat: 0, rollNum: 6 });
      g = applyRoll(g, 5, turnContext(g, survivors())); // Dee rolls
      // Dee now banks too → every player banked → the host advances the round.
      g = advanceRound(g);
      expect(g.roundNum).toBe(4);
      expect(g.turnSeat).toBe(0);
      // Everyone is back next round; the opener is Ann, the seat after Dee.
      expect(currentTurnPlayer(g, table())?.name).toBe('Ann');
    });

    it('hands on to the next seat when the survivor busts', () => {
      let g = activeGame({ roundNum: 3, turnSeat: 0, rollNum: 6 });
      g = applyRoll(g, 7, turnContext(g, survivors())); // Dee busts
      expect(g.roundNum).toBe(4);
      expect(g.turnSeat).toBe(0);
      expect(currentTurnPlayer(g, table())?.name).toBe('Ann');
    });
  });

  // The dice keep travelling round the table between rounds rather than
  // snapping back to seat 0.
  describe('crossing into the next round', () => {
    it('hands on from whoever busted', () => {
      const g = applyRoll(activeGame({ turnSeat: 2, rollNum: 5 }), 7, FULL);
      expect(g.roundNum).toBe(2);
      expect(g.turnSeat).toBe(3); // seat 2 rolled the 7, so seat 3 opens
    });

    it('wraps when the last seat busts', () => {
      const g = applyRoll(activeGame({ turnSeat: 3, rollNum: 5 }), 7, FULL);
      expect(g.turnSeat).toBe(0);
    });

    // The buster hands on over the FULL table — a player who banked this round
    // is unbanked next round and must not be skipped.
    it('does not skip a seat that banked in the round just ended', () => {
      const g = applyRoll(
        activeGame({ turnSeat: 0, rollNum: 5 }),
        7,
        { seats: [0, 1, 2, 3], inPlay: [0, 2, 3] } // seat 1 banked
      );
      expect(g.turnSeat).toBe(1);
    });

    // Nobody rolled it away, so the seat that was up stays up.
    it('keeps the pointer where it was when everyone banks', () => {
      const g = advanceRound(activeGame({ turnSeat: 2, rollNum: 5 }));
      expect(g.roundNum).toBe(2);
      expect(g.turnSeat).toBe(2);
    });

    it('carries the pointer through undo of a bust', () => {
      const busted = applyRoll(activeGame({ turnSeat: 2, rollNum: 5, rolls: [] }), 7, FULL);
      expect(busted.turnSeat).toBe(3);
      const undone = undoLast(busted, FULL)!;
      expect(undone.roundNum).toBe(1);
      expect(undone.turnSeat).toBe(2); // back to whoever rolled the 7
    });
  });

  describe('currentTurnPlayer', () => {
    it('resolves the stored seat to a player', () => {
      const game = activeGame({ roundNum: 3, turnSeat: 2 });
      expect(currentTurnPlayer(game, table())?.name).toBe('Cy');
    });

    // The pointer cannot move itself here: bank() is a player-side transaction
    // and the rules forbid it writing the game doc.
    it('walks past a seat whose player has already banked', () => {
      const game = activeGame({ roundNum: 3, turnSeat: 1 });
      expect(currentTurnPlayer(game, table([0, 3, 0, 0]))?.name).toBe('Cy');
    });

    it('wraps while walking past banked seats', () => {
      const game = activeGame({ roundNum: 3, turnSeat: 2 });
      expect(currentTurnPlayer(game, table([0, 0, 3, 3]))?.name).toBe('Ann');
    });

    it('lands on the only player left', () => {
      const game = activeGame({ roundNum: 3, turnSeat: 0 });
      expect(currentTurnPlayer(game, table([3, 3, 0, 3]))?.name).toBe('Cy');
    });

    it('is null once everyone has banked', () => {
      const game = activeGame({ roundNum: 3, turnSeat: 0 });
      expect(currentTurnPlayer(game, table([3, 3, 3, 3]))).toBeNull();
    });

    it('is null outside an active game', () => {
      expect(currentTurnPlayer(activeGame({ status: 'lobby' }), table())).toBeNull();
    });
  });
});

describe('leaderGap', () => {
  const ann = player({ id: 'a', name: 'Ann', points: 100 });
  const bo = player({ id: 'b', name: 'Bo', points: 60 });

  it('measures the distance to the top', () => {
    expect(leaderGap([ann, bo], bo)).toEqual({ leader: ann, behind: 40 });
  });

  it('is null for the leader', () => {
    expect(leaderGap([ann, bo], ann)).toBeNull();
  });

  // "0 behind" reads like a deficit when it is actually a tie for first.
  it('is null when tied for the lead', () => {
    const cy = player({ id: 'c', name: 'Cy', points: 100 });
    expect(leaderGap([ann, cy], cy)).toBeNull();
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
