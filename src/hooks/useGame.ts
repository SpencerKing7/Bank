import { useEffect, useRef, useState } from 'react';
import { GameDoc, PlayerDoc } from '../game/types';
import { subscribeToGame, subscribeToPlayers } from '../services/gameService';

// 'live'         — snapshots are coming from the server; safe to act on.
// 'reconnecting' — Firestore is serving cached data, or a listener died and we
//                  are re-attaching. What's on screen may be stale.
export type Connection = 'live' | 'reconnecting';

export interface GameState {
  game: GameDoc | null;
  players: PlayerDoc[];
  loading: boolean; // true until BOTH the game doc and players have arrived
  notFound: boolean;
  // The game existed during this subscription and was then deleted — i.e. the
  // host ended it. Distinguishes "host ended the game" from a bad code.
  ended: boolean;
  connection: Connection;
}

// onSnapshot is terminal: a single error (an auth-token blip, a rules denial, a
// dropped stream the SDK won't retry) kills the listener for good and the
// screen silently freezes on stale data. Re-attach with backoff instead.
const RETRY_BASE_MS = 1000;
const RETRY_MAX_MS = 15000;

// Live game state via two Firestore listeners. Pass undefined to stay idle
// (e.g. until anonymous auth is ready — the rules require a signed-in user).
export function useGame(code: string | undefined): GameState {
  const [game, setGame] = useState<GameDoc | null>(null);
  const [players, setPlayers] = useState<PlayerDoc[]>([]);
  const [gameLoaded, setGameLoaded] = useState(false);
  const [playersLoaded, setPlayersLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [ended, setEnded] = useState(false);
  const [gameLive, setGameLive] = useState(false);
  const [playersLive, setPlayersLive] = useState(false);

  // Survives re-attach: once we've seen the game exist, a later "gone" always
  // means the host ended it, even if the listener restarted in between.
  const seenRef = useRef(false);

  useEffect(() => {
    if (!code) return;
    setGame(null);
    setPlayers([]);
    setGameLoaded(false);
    setPlayersLoaded(false);
    setNotFound(false);
    setEnded(false);
    setGameLive(false);
    setPlayersLive(false);
    seenRef.current = false;

    let cancelled = false;
    let unsubGame: (() => void) | null = null;
    let unsubPlayers: (() => void) | null = null;
    let gameRetry: ReturnType<typeof setTimeout> | null = null;
    let playersRetry: ReturnType<typeof setTimeout> | null = null;
    let gameAttempt = 0;
    let playersAttempt = 0;

    const backoff = (attempt: number) =>
      Math.min(RETRY_BASE_MS * 2 ** attempt, RETRY_MAX_MS);

    const attachGame = () => {
      if (cancelled) return;
      unsubGame = subscribeToGame(
        code,
        (nextGame, fromCache) => {
          if (cancelled) return;
          gameAttempt = 0;
          if (nextGame) seenRef.current = true;
          // A "gone" doc that is only a cache echo isn't proof of anything —
          // wait for the server to confirm before declaring the game over.
          else if (seenRef.current && !fromCache) setEnded(true);
          setGame(nextGame);
          // Never resolve to "no such game" from cache alone: an offline
          // client would show "Game not found" for a game that exists.
          setNotFound(nextGame === null && !fromCache && !seenRef.current);
          setGameLive(!fromCache);
          setGameLoaded(true);
        },
        () => {
          if (cancelled) return;
          setGameLive(false);
          unsubGame?.();
          unsubGame = null;
          gameRetry = setTimeout(attachGame, backoff(gameAttempt++));
        }
      );
    };

    const attachPlayers = () => {
      if (cancelled) return;
      unsubPlayers = subscribeToPlayers(
        code,
        (nextPlayers, fromCache) => {
          if (cancelled) return;
          playersAttempt = 0;
          setPlayers(nextPlayers);
          setPlayersLive(!fromCache);
          setPlayersLoaded(true);
        },
        () => {
          if (cancelled) return;
          setPlayersLive(false);
          unsubPlayers?.();
          unsubPlayers = null;
          playersRetry = setTimeout(attachPlayers, backoff(playersAttempt++));
        }
      );
    };

    attachGame();
    attachPlayers();

    return () => {
      cancelled = true;
      if (gameRetry) clearTimeout(gameRetry);
      if (playersRetry) clearTimeout(playersRetry);
      unsubGame?.();
      unsubPlayers?.();
    };
  }, [code]);

  // Waiting for players too prevents a one-tick flash of the join form for
  // players who already have a doc in this game.
  const loading = !code || !gameLoaded || (!notFound && !playersLoaded);
  const connection: Connection = gameLive && playersLive ? 'live' : 'reconnecting';
  return { game, players, loading, notFound, ended, connection };
}
