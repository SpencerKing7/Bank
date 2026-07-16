import { useEffect, useState } from 'react';
import { GameDoc, PlayerDoc } from '../game/types';
import { subscribeToGame, subscribeToPlayers } from '../services/gameService';

export interface GameState {
  game: GameDoc | null;
  players: PlayerDoc[];
  loading: boolean; // true until BOTH the game doc and players have arrived
  notFound: boolean;
  // The game existed during this subscription and was then deleted — i.e. the
  // host ended it. Distinguishes "host ended the game" from a bad code.
  ended: boolean;
}

// Live game state via two Firestore listeners. Pass undefined to stay idle
// (e.g. until anonymous auth is ready — the rules require a signed-in user).
export function useGame(code: string | undefined): GameState {
  const [game, setGame] = useState<GameDoc | null>(null);
  const [players, setPlayers] = useState<PlayerDoc[]>([]);
  const [gameLoaded, setGameLoaded] = useState(false);
  const [playersLoaded, setPlayersLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [ended, setEnded] = useState(false);

  useEffect(() => {
    if (!code) return;
    setGame(null);
    setPlayers([]);
    setGameLoaded(false);
    setPlayersLoaded(false);
    setNotFound(false);
    setEnded(false);

    let seen = false;
    const unsubGame = subscribeToGame(
      code,
      (nextGame) => {
        if (nextGame) {
          seen = true;
        } else if (seen) {
          setEnded(true);
        }
        setGame(nextGame);
        setNotFound(nextGame === null);
        setGameLoaded(true);
      },
      () => {
        setNotFound(true);
        setGameLoaded(true);
      }
    );
    const unsubPlayers = subscribeToPlayers(
      code,
      (nextPlayers) => {
        setPlayers(nextPlayers);
        setPlayersLoaded(true);
      },
      () => setPlayersLoaded(true)
    );

    return () => {
      unsubGame();
      unsubPlayers();
    };
  }, [code]);

  // Waiting for players too prevents a one-tick flash of the join form for
  // players who already have a doc in this game.
  const loading = !code || !gameLoaded || (!notFound && !playersLoaded);
  return { game, players, loading, notFound, ended };
}
