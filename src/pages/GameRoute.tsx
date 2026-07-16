import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  TextField,
  Typography,
} from '@mui/material';
import { useAnonymousAuth } from '../hooks/useAnonymousAuth';
import { useGame } from '../hooks/useGame';
import {
  clearActiveGameCode,
  getActiveGameCode,
  getSavedPlayerName,
  savePlayerName,
  setActiveGameCode,
} from '../hooks/useSession';
import { joinGame } from '../services/gameService';
import { GameDoc } from '../game/types';
import Lobby from './Lobby';
import Game from './Game';
import GameOver from './GameOver';

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <Container maxWidth="sm" sx={{ px: 2, pt: 12, textAlign: 'center' }}>
      {children}
    </Container>
  );
}

// Name-entry form for anyone who opens a game they haven't joined yet
// (shared link, typed URL, or joining late mid-game).
function JoinInline({ code, game }: { code: string; game: GameDoc }) {
  const [name, setName] = useState(getSavedPlayerName());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async () => {
    setBusy(true);
    setError(null);
    try {
      await joinGame(code, name.trim());
      savePlayerName(name.trim());
      setActiveGameCode(code);
      // No navigation needed — the players listener picks up the new doc.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not join the game');
      setBusy(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ px: 2, py: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="h4" sx={{ textAlign: 'center' }}>
        Join game {code}
      </Typography>
      {game.status === 'active' && (
        <Typography color="text.secondary" sx={{ textAlign: 'center' }}>
          The game is underway — you'll jump in this round with 0 points.
        </Typography>
      )}
      <Card>
        <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            inputProps={{ maxLength: 20 }}
            fullWidth
            autoFocus={!name}
          />
          <Button variant="contained" disabled={busy || !name.trim()} onClick={handleJoin}>
            {busy ? 'Joining…' : 'Join Game'}
          </Button>
          {error && <Alert severity="error">{error}</Alert>}
        </CardContent>
      </Card>
    </Container>
  );
}

export default function GameRoute() {
  const navigate = useNavigate();
  const { code: rawCode } = useParams();
  const code = rawCode?.toUpperCase();
  const { uid, ready, error: authError } = useAnonymousAuth();
  const { game, players, loading, notFound, ended } = useGame(
    ready && uid && code ? code : undefined
  );

  const me = players.find((p) => p.id === uid);

  // Keep the rejoin pointer fresh for anyone who is actually in this game.
  useEffect(() => {
    if (code && me && game && game.status !== 'finished') {
      setActiveGameCode(code);
    }
  }, [code, me, game]);

  if (!code) return null;

  if (authError) {
    return (
      <Centered>
        <Alert severity="error">Could not connect: {authError}</Alert>
      </Centered>
    );
  }

  // The doc was deleted out from under us — the host ended the game.
  if (ended) {
    if (getActiveGameCode() === code) clearActiveGameCode();
    return (
      <Centered>
        <Typography variant="h4" gutterBottom>
          Game ended
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          The host ended this game.
        </Typography>
        <Button variant="contained" onClick={() => navigate('/')}>
          Back to Home
        </Button>
      </Centered>
    );
  }

  if (notFound) {
    if (getActiveGameCode() === code) clearActiveGameCode();
    return (
      <Centered>
        <Typography variant="h4" gutterBottom>
          Game not found
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          There's no game with code {code}.
        </Typography>
        <Button variant="contained" onClick={() => navigate('/')}>
          Back to Home
        </Button>
      </Centered>
    );
  }

  if (loading || !game || !uid) {
    return (
      <Centered>
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <CircularProgress color="primary" />
        </Box>
      </Centered>
    );
  }

  if (game.status === 'finished') {
    return <GameOver code={code} game={game} players={players} uid={uid} />;
  }

  if (!me) {
    return <JoinInline code={code} game={game} />;
  }

  if (game.status === 'lobby') {
    return <Lobby code={code} game={game} players={players} uid={uid} />;
  }

  return <Game code={code} game={game} players={players} uid={uid} />;
}
