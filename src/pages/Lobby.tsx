import React, { useState } from 'react';
import { Alert, Box, Button, Chip, Container, Typography } from '@mui/material';
import EndGameButton from '../components/EndGameButton';
import { GameDoc, PlayerDoc } from '../game/types';
import { Connection } from '../hooks/useGame';
import { startGame } from '../services/gameService';

interface LobbyProps {
  code: string;
  game: GameDoc;
  players: PlayerDoc[];
  uid: string;
  connection?: Connection;
}

const fullHeight = {
  height: '100vh',
  '@supports (height: 100dvh)': { height: '100dvh' },
} as const;

export default function Lobby({ code, game, players, uid, connection = 'live' }: LobbyProps) {
  const isHost = uid === game.hostId;
  const host = players.find((p) => p.id === game.hostId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStart = async () => {
    setBusy(true);
    setError(null);
    try {
      await startGame(code, game);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the game');
      setBusy(false);
    }
  };

  return (
    <Container
      maxWidth="sm"
      sx={{
        ...fullHeight,
        px: 2,
        pt: 2,
        pb: 'calc(16px + env(safe-area-inset-bottom))',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        overflow: 'hidden',
      }}
    >
      <Box sx={{ textAlign: 'center', flex: '0 0 auto' }}>
        <Typography variant="overline" color="text.secondary">
          Game code
        </Typography>
        <Typography
          variant="h2"
          sx={{ color: 'secondary.light', fontSize: 'clamp(3rem, min(22vw, 14dvh), 8rem)' }}
        >
          {code}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Tell your friends to join with this code · {game.totalRounds} rounds
        </Typography>
      </Box>

      {/* The one growable region: a big party scrolls this list, not the page,
          so Start Game never leaves the screen. */}
      <Box sx={{ flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flex: '0 0 auto' }}>
          <Typography variant="h6">Players ({players.length})</Typography>
          {connection === 'reconnecting' && (
            <Typography variant="body2" sx={{ color: 'warning.main', fontWeight: 700 }}>
              · Reconnecting…
            </Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, overflowY: 'auto', minHeight: 0 }}>
          {players.map((player) => (
            <Chip
              key={player.id}
              label={player.id === game.hostId ? `${player.name} · host` : player.name}
              color={player.id === uid ? 'primary' : 'default'}
              variant={player.id === uid ? 'filled' : 'outlined'}
              sx={{ fontSize: '1rem', height: 40 }}
            />
          ))}
        </Box>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      {isHost ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, flex: '0 0 auto' }}>
          <Button variant="contained" fullWidth disabled={busy} onClick={handleStart}>
            {busy ? 'Starting…' : 'Start Game'}
          </Button>
          <EndGameButton code={code} label="Cancel game" />
        </Box>
      ) : (
        <Typography color="text.secondary" sx={{ textAlign: 'center', flex: '0 0 auto' }}>
          Waiting for {host?.name ?? 'the host'} to start…
        </Typography>
      )}
    </Container>
  );
}
