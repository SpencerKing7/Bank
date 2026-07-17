import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Unsubscribe,
  updateDoc,
  writeBatch,
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

export async function startGame(code: string, game: GameDoc): Promise<void> {
  const uid = requireUid();
  if (game.hostId !== uid || game.status !== 'lobby') return;
  await updateDoc(gameRef(code), { status: 'active', lastAction: { type: 'roundStart' } });
}

// Every host action below is a plain write against the caller's in-memory game,
// not a read-modify-write transaction. Two reasons that is both safe and much
// faster:
//
// Safe — the game doc has exactly one writer, the host's client (the rules
// enforce it), and Firestore applies one client's writes in the order they were
// issued. So the host's listener copy, which already includes its own unacked
// writes, IS the authoritative state. The old tx.get() fetched that same state
// from the server to hand it to a client-side pure function: a full round-trip
// that could not learn anything the host did not already know.
//
// Fast — plain writes are latency-compensated: the host's own snapshot fires
// before the commit leaves the device, and players see the roll one server hop
// later. runTransaction opts out of that entirely (its reads are remote lookups
// and its commit skips the local mutation queue), so a tap used to cost a read
// round-trip, then a commit, then a watch push, before even the host's own
// screen moved.
//
// bank() stays a transaction — see the note there.
async function hostWrite(
  code: string,
  game: GameDoc,
  mutate: (game: GameDoc) => GameDoc | null
): Promise<void> {
  const next = mutate(game);
  if (next === null || next === game) return;
  await updateDoc(gameRef(code), gameUpdateFields(next));
}

export function recordRoll(code: string, game: GameDoc, value: number): Promise<void> {
  return hostWrite(code, game, (g) => applyRoll(g, value));
}

export function recordDoubles(code: string, game: GameDoc): Promise<void> {
  return hostWrite(code, game, applyDoubles);
}

export function undoLastRoll(code: string, game: GameDoc): Promise<void> {
  return hostWrite(code, game, undoLast);
}

// No roundNum precondition needed any more. The caller's effect can fire twice
// for one round, but the second pass reads a `game` that already carries the
// local echo of the first write — new roundNum, rollNum back to 1 — so
// allPlayersBanked is false and it never calls through.
export function advanceRoundNow(code: string, game: GameDoc): Promise<void> {
  return hostWrite(code, game, advanceRound);
}

// The one action that genuinely needs the server round-trip, so it keeps its
// transaction: a player cannot trust its own copy of the game the way the host
// can, because the host is writing it concurrently. Reading the game inside the
// transaction makes its version a commit precondition, so the bank-vs-bust-7
// race resolves one way or the other, never both. That still holds now the host
// rolls with plain writes — those bump the game doc's update time just the
// same, forcing a racing bank to retry, re-read the bust, and reject.
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

// Host-only (enforced by rules): deletes the game and every player doc in one
// atomic batch. Everyone's game listener sees the doc vanish and resets to the
// "host ended the game" screen. Player docs must go too — game codes get
// reused, and orphaned players would leak into a future game with this code.
export async function endGame(code: string): Promise<void> {
  requireUid();
  const playersSnap = await getDocs(collection(db, 'games', code, 'players'));
  const batch = writeBatch(db);
  playersSnap.forEach((snap) => batch.delete(snap.ref));
  batch.delete(gameRef(code));
  await batch.commit();
}

// `fromCache` is what tells live data apart from a stale local replay: while
// the network is down Firestore keeps serving the last known snapshot, which
// otherwise looks identical to a fresh one. Callers use it to show a
// reconnecting state and to refuse to act on data that may be out of date.
export function subscribeToGame(
  code: string,
  onGame: (game: GameDoc | null, fromCache: boolean) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    gameRef(code),
    { includeMetadataChanges: true },
    (snap) => onGame(snap.exists() ? (snap.data() as GameDoc) : null, snap.metadata.fromCache),
    onError
  );
}

export function subscribeToPlayers(
  code: string,
  onPlayers: (players: PlayerDoc[], fromCache: boolean) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const playersQuery = query(collection(db, 'games', code, 'players'), orderBy('joinedAt'));
  return onSnapshot(
    playersQuery,
    { includeMetadataChanges: true },
    (snap) =>
      onPlayers(
        snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PlayerDoc),
        snap.metadata.fromCache
      ),
    onError
  );
}
