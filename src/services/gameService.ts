import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Unsubscribe,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { generateGameCode } from '../game/codes';
import {
  advanceRound,
  applyDoubles,
  applyRoll,
  initialGameDoc,
  undoLast,
} from '../game/logic';
import { GameDoc, PlayerDoc } from '../game/types';

export class GameNotFoundError extends Error {
  constructor() {
    super('Game not found');
  }
}

export class BankTooLateError extends Error {
  constructor() {
    super('Too late to bank — the round is over');
  }
}

export class AlreadyBankedError extends Error {
  constructor() {
    super('Already banked this round');
  }
}

class CodeCollisionError extends Error {}

function gameRef(code: string) {
  return doc(db, 'games', code);
}

function playerRef(code: string, uid: string) {
  return doc(db, 'games', code, 'players', uid);
}

function requireUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in yet — try again in a moment');
  return uid;
}

// Only the fields the host mutates during play; hostId/totalRounds/createdAt
// stay untouched (rules also forbid reassigning hostId).
function gameUpdateFields(game: GameDoc) {
  return {
    status: game.status,
    roundNum: game.roundNum,
    rollNum: game.rollNum,
    roundTotal: game.roundTotal,
    rolls: game.rolls,
    bustSnapshot: game.bustSnapshot,
    lastAction: game.lastAction,
  };
}

export async function createGame(hostName: string, totalRounds: number): Promise<string> {
  const uid = requireUid();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateGameCode();
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(gameRef(code));
        if (snap.exists()) throw new CodeCollisionError();
        tx.set(gameRef(code), {
          ...initialGameDoc(uid, totalRounds),
          createdAt: serverTimestamp(),
        });
        tx.set(playerRef(code, uid), {
          name: hostName,
          points: 0,
          bankedRound: 0,
          joinedAt: serverTimestamp(),
        });
      });
      return code;
    } catch (e) {
      if (e instanceof CodeCollisionError) continue;
      throw e;
    }
  }
  throw new Error('Could not find a free game code — try again');
}

// Creates the caller's player doc. Rejoining (doc already exists) is a no-op
// so points survive a refresh or a re-typed code.
export async function joinGame(code: string, name: string): Promise<void> {
  const uid = requireUid();
  await runTransaction(db, async (tx) => {
    const gameSnap = await tx.get(gameRef(code));
    if (!gameSnap.exists()) throw new GameNotFoundError();
    const playerSnap = await tx.get(playerRef(code, uid));
    if (playerSnap.exists()) return;
    tx.set(playerRef(code, uid), {
      name,
      points: 0,
      bankedRound: 0,
      joinedAt: serverTimestamp(),
    });
  });
}

export async function startGame(code: string): Promise<void> {
  const uid = requireUid();
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(gameRef(code));
    if (!snap.exists()) throw new GameNotFoundError();
    const game = snap.data() as GameDoc;
    if (game.hostId !== uid || game.status !== 'lobby') return;
    tx.update(gameRef(code), { status: 'active', lastAction: { type: 'roundStart' } });
  });
}

async function hostGameTransaction(code: string, mutate: (game: GameDoc) => GameDoc | null) {
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(gameRef(code));
    if (!snap.exists()) throw new GameNotFoundError();
    const game = snap.data() as GameDoc;
    const next = mutate(game);
    if (next === null || next === game) return;
    tx.update(gameRef(code), gameUpdateFields(next));
  });
}

export async function recordRoll(code: string, value: number): Promise<void> {
  await hostGameTransaction(code, (game) => applyRoll(game, value));
}

export async function recordDoubles(code: string): Promise<void> {
  await hostGameTransaction(code, (game) => applyDoubles(game));
}

export async function undoLastRoll(code: string): Promise<void> {
  await hostGameTransaction(code, (game) => undoLast(game));
}

// Preconditioned on roundNum so a double-fired effect advances only once.
export async function advanceRoundTx(code: string, expectedRoundNum: number): Promise<void> {
  await hostGameTransaction(code, (game) =>
    game.roundNum === expectedRoundNum ? advanceRound(game) : null
  );
}

// Cross-doc transaction: serializable against the host's roll writes, so the
// bank-vs-bust-7 race always resolves one way or the other, never both.
export async function bank(code: string, expectedRoundNum: number): Promise<void> {
  const uid = requireUid();
  await runTransaction(db, async (tx) => {
    const gameSnap = await tx.get(gameRef(code));
    if (!gameSnap.exists()) throw new GameNotFoundError();
    const game = gameSnap.data() as GameDoc;
    if (game.status !== 'active' || game.rollNum <= 3 || game.roundNum !== expectedRoundNum) {
      throw new BankTooLateError();
    }
    const playerSnap = await tx.get(playerRef(code, uid));
    if (!playerSnap.exists()) throw new GameNotFoundError();
    const player = playerSnap.data() as Omit<PlayerDoc, 'id'>;
    if (player.bankedRound === game.roundNum) throw new AlreadyBankedError();
    tx.update(playerRef(code, uid), {
      points: player.points + game.roundTotal,
      bankedRound: game.roundNum,
    });
  });
}

export function subscribeToGame(
  code: string,
  onGame: (game: GameDoc | null) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    gameRef(code),
    (snap) => onGame(snap.exists() ? (snap.data() as GameDoc) : null),
    onError
  );
}

export function subscribeToPlayers(
  code: string,
  onPlayers: (players: PlayerDoc[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const playersQuery = query(collection(db, 'games', code, 'players'), orderBy('joinedAt'));
  return onSnapshot(
    playersQuery,
    (snap) => onPlayers(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PlayerDoc)),
    onError
  );
}
