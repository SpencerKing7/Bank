import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Typography,
} from '@mui/material';
import EndGameButton from '../components/EndGameButton';
import KeepAwakeToggle from '../components/KeepAwakeToggle';
import PlayerOrderList from '../components/PlayerOrderList';
import { GameDoc, PlayerDoc } from '../game/types';
import { Connection } from '../hooks/useGame';
import { useWakeLock } from '../hooks/useWakeLock';
import { removePlayer, reorderPlayers, startGame } from '../services/gameService';

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
  const [pendingRemoval, setPendingRemoval] = useState<PlayerDoc | null>(null);
  const wakeLock = useWakeLock();

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

  const handleReorder = (orderedIds: string[]) => {
    // A player who joined mid-drag isn't in the dragged order. Append them so
    // the batch still renumbers every seat and nobody is left sharing one.
    const missing = players.map((p) => p.id).filter((id) => !orderedIds.includes(id));
    reorderPlayers(code, [...orderedIds, ...missing]).catch(() =>
      setError('Could not save the order — try again')
    );
  };

  const handleRemove = async (player: PlayerDoc) => {
    setPendingRemoval(null);
    const remaining = players.filter((p) => p.id !== player.id).map((p) => p.id);
    try {
      await removePlayer(code, player.id, remaining);
    } catch {
      setError(`Could not remove ${player.name} — try again`);
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
        {/* Seat order is roll order once the game starts, so it's worth saying
            so — otherwise dragging looks purely cosmetic. */}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1, flex: '0 0 auto' }}>
          {isHost ? 'Drag to set who rolls in what order' : 'Rolling order'}
        </Typography>
        <Box sx={{ overflowY: 'auto', minHeight: 0 }}>
          <PlayerOrderList
            players={players}
            uid={uid}
            hostId={game.hostId}
            canManage={isHost}
            onReorder={handleReorder}
            onRemove={setPendingRemoval}
          />
        </Box>
      </Box>

      {/* The lobby is where you've got a spare moment to set this — mid-game
          it's buried in the standings drawer. */}
      <Box sx={{ flex: '0 0 auto' }}>
        <KeepAwakeToggle wakeLock={wakeLock} />
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

      <Dialog open={pendingRemoval !== null} onClose={() => setPendingRemoval(null)}>
        <DialogTitle>Remove {pendingRemoval?.name}?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            They’ll be sent back to the join screen. They can rejoin with the game code if
            it was a mistake.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingRemoval(null)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => pendingRemoval && handleRemove(pendingRemoval)}
          >
            Remove
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
