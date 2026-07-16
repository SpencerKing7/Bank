import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  CardContent,
  Container,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { CODE_LENGTH, isValidGameCode } from '../game/codes';
import { useAnonymousAuth } from '../hooks/useAnonymousAuth';
import {
  clearActiveGameCode,
  getActiveGameCode,
  getSavedPlayerName,
  savePlayerName,
} from '../hooks/useSession';
import { createGame, GameNotFoundError, joinGame } from '../services/gameService';
import { DISPLAY_FONT } from '../theme';

type Mode = 'host' | 'join';

export default function Home() {
  const navigate = useNavigate();
  const { ready, error: authError } = useAnonymousAuth();
  const [mode, setMode] = useState<Mode | null>(null);
  const [name, setName] = useState(getSavedPlayerName());
  const [code, setCode] = useState('');
  const [rounds, setRounds] = useState(20);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeCode, setActiveCode] = useState<string | null>(getActiveGameCode());

  const nameReady = name.trim().length > 0;

  const handleHost = async () => {
    setBusy(true);
    setError(null);
    try {
      const newCode = await createGame(name.trim(), rounds);
      savePlayerName(name.trim());
      navigate(`/game/${newCode}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the game');
      setBusy(false);
    }
  };

  const handleJoin = async () => {
    setBusy(true);
    setError(null);
    try {
      await joinGame(code, name.trim());
      savePlayerName(name.trim());
      navigate(`/game/${code}`);
    } catch (e) {
      if (e instanceof GameNotFoundError) {
        setError(`No game found with code ${code}`);
      } else {
        setError(e instanceof Error ? e.message : 'Could not join the game');
      }
      setBusy(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ px: 2, py: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="h3" sx={{ textAlign: 'center', color: 'secondary.light', mt: 4 }}>
        Bank!
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', mb: 2 }}>
        Press your luck. Bank before the 7.
      </Typography>

      {authError && <Alert severity="error">Could not connect: {authError}</Alert>}

      {activeCode && (
        <Button
          variant="outlined"
          color="secondary"
          onClick={() => navigate(`/game/${activeCode}`)}
          sx={{ fontFamily: DISPLAY_FONT, fontSize: '1.25rem' }}
        >
          Rejoin game {activeCode}
        </Button>
      )}

      <Button
        variant={mode === 'host' ? 'contained' : 'outlined'}
        color="primary"
        fullWidth
        onClick={() => {
          setMode('host');
          setError(null);
        }}
      >
        Host Game
      </Button>
      <Button
        variant={mode === 'join' ? 'contained' : 'outlined'}
        color="primary"
        fullWidth
        onClick={() => {
          setMode('join');
          setError(null);
        }}
      >
        Join Game
      </Button>

      {mode && (
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

            {mode === 'host' && (
              <>
                <Typography variant="h6">Rounds</Typography>
                <ToggleButtonGroup
                  value={rounds}
                  exclusive
                  fullWidth
                  onChange={(_e, value) => value !== null && setRounds(value)}
                >
                  <ToggleButton value={10}>10</ToggleButton>
                  <ToggleButton value={15}>15</ToggleButton>
                  <ToggleButton value={20}>20</ToggleButton>
                </ToggleButtonGroup>
                <Button
                  variant="contained"
                  disabled={!ready || busy || !nameReady}
                  onClick={handleHost}
                >
                  {busy ? 'Creating…' : 'Create Game'}
                </Button>
              </>
            )}

            {mode === 'join' && (
              <>
                <TextField
                  label="Game code"
                  value={code}
                  onChange={(e) =>
                    setCode(
                      e.target.value
                        .toUpperCase()
                        .replace(/[^A-Z]/g, '')
                        .slice(0, CODE_LENGTH)
                    )
                  }
                  fullWidth
                  inputProps={{
                    maxLength: CODE_LENGTH,
                    autoCapitalize: 'characters',
                    autoCorrect: 'off',
                    spellCheck: false,
                    style: {
                      textTransform: 'uppercase',
                      letterSpacing: '0.3em',
                      textAlign: 'center',
                      fontFamily: DISPLAY_FONT,
                      fontSize: '1.75rem',
                    },
                  }}
                />
                <Button
                  variant="contained"
                  disabled={!ready || busy || !nameReady || !isValidGameCode(code)}
                  onClick={handleJoin}
                >
                  {busy ? 'Joining…' : 'Join Game'}
                </Button>
              </>
            )}

            {error && <Alert severity="error">{error}</Alert>}
          </CardContent>
        </Card>
      )}

      {activeCode && (
        <Button
          variant="text"
          size="small"
          sx={{ color: 'text.secondary', alignSelf: 'center' }}
          onClick={() => {
            clearActiveGameCode();
            setActiveCode(null);
          }}
        >
          Forget saved game
        </Button>
      )}
    </Container>
  );
}
