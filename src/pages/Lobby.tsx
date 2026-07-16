import React, { useState } from 'react';
import { Alert, Box, Button, Chip, Container, Typography } from '@mui/material';
import EndGameButton from '../components/EndGameButton';
import { GameDoc, PlayerDoc } from '../game/types';
import { startGame } from '../services/gameService';

interface LobbyProps {
  code: string;
  game: GameDoc;
  players: PlayerDoc[];
  uid: string;
}

export default function Lobby({ code, game, players, uid }: LobbyProps) {
  const isHost = uid === game.hostId;
  const host = players.find((p) => p.id === game.hostId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStart = async () => {
    setBusy(true);
    setError(null);
    try {
      await startGame(code);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the game');
      setBusy(false);
    }
  };

  return (
    <Container
      maxWidth="sm"
      sx={{ px: 2, py: 4, minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: 2 }}
    >
      <Box sx={{ textAlign: 'center', mt: 4 }}>
        <Typography variant="overline" color="text.secondary">
          Game code
        </Typography>
        <Typography variant="h2" sx={{ color: 'secondary.light' }}>
          {code}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Tell your friends to join with this code · {game.totalRounds} rounds
        </Typography>
      </Box>

      <Box sx={{ mt: 2 }}>
        <Typography variant="h6" gutterBottom>
          Players ({players.length})
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
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

      <Box sx={{ flexGrow: 1 }} />

      {error && <Alert severity="error">{error}</Alert>}

      {isHost ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
          <Button variant="contained" fullWidth disabled={busy} onClick={handleStart}>
            {busy ? 'Starting…' : 'Start Game'}
          </Button>
          <EndGameButton code={code} label="Cancel game" />
        </Box>
      ) : (
        <Typography color="text.secondary" sx={{ textAlign: 'center', mb: 2 }}>
          Waiting for {host?.name ?? 'the host'} to start…
        </Typography>
      )}
    </Container>
  );
}
