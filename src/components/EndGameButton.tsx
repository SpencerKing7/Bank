import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import { clearActiveGameCode } from '../hooks/useSession';
import { endGame } from '../services/gameService';

interface EndGameButtonProps {
  code: string;
  label?: string;
}

// Host-only control. Deleting the game is what resets everyone else's screen —
// their game listener sees the doc vanish (useGame's `ended`).
export default function EndGameButton({ code, label = 'End game' }: EndGameButtonProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEnd = async () => {
    setBusy(true);
    setError(null);
    try {
      await endGame(code);
      clearActiveGameCode();
      navigate('/');
    } catch {
      setError('Could not end the game — try again');
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        variant="text"
        size="small"
        onClick={() => setOpen(true)}
        sx={{ color: 'error.main', alignSelf: 'center' }}
      >
        {label}
      </Button>
      <Dialog open={open} onClose={() => !busy && setOpen(false)}>
        <DialogTitle>End the game for everyone?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This deletes the game and all scores, and sends every player back to the home
            screen. It can’t be undone.
          </DialogContentText>
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={busy}>
            Keep Playing
          </Button>
          <Button color="error" variant="contained" onClick={handleEnd} disabled={busy}>
            {busy ? 'Ending…' : 'End Game'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
