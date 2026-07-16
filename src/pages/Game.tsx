import React, { useEffect, useRef, useState } from 'react';
import UndoIcon from '@mui/icons-material/Undo';
import {
  Alert,
  AlertColor,
  Box,
  Button,
  Container,
  Snackbar,
  SwipeableDrawer,
  Typography,
} from '@mui/material';
import BankButton, { BankState } from '../components/BankButton';
import EndGameButton from '../components/EndGameButton';
import NumberGrid from '../components/NumberGrid';
import RoundHeader from '../components/RoundHeader';
import RoundTotal from '../components/RoundTotal';
import StandingsList from '../components/StandingsList';
import {
  allPlayersBanked,
  canBank,
  hasBankedThisRound,
  undoLast,
} from '../game/logic';
import { GameDoc, PlayerDoc } from '../game/types';
import {
  advanceRoundTx,
  AlreadyBankedError,
  bank,
  BankTooLateError,
  recordDoubles,
  recordRoll,
  undoLastRoll,
} from '../services/gameService';

interface GameProps {
  code: string;
  game: GameDoc;
  players: PlayerDoc[];
  uid: string;
}

function lastActionText(game: GameDoc): string {
  const action = game.lastAction;
  if (!action) return 'Waiting for the first roll…';
  switch (action.type) {
    case 'roll':
      return action.value === 7 && game.rollNum <= 4
        ? 'Rolled 7 — that’s +70!'
        : `Rolled ${action.value}`;
    case 'doubles':
      return 'DOUBLES — total ×2!';
    case 'bust':
      return 'BUST! The round is over.';
    case 'roundStart':
      return game.rolls.length === 0 ? 'New round — place your trust in the dice' : '';
    default:
      return '';
  }
}

export default function Game({ code, game, players, uid }: GameProps) {
  const isHost = uid === game.hostId;
  const me = players.find((p) => p.id === uid);
  const [standingsOpen, setStandingsOpen] = useState(false);
  const [toast, setToast] = useState<{ severity: AlertColor; text: string } | null>(null);
  const advancing = useRef(false);

  // Host detects "everyone banked" and advances the round. The transaction is
  // preconditioned on roundNum, so duplicate fires are harmless.
  useEffect(() => {
    if (!isHost || advancing.current) return;
    if (allPlayersBanked(game, players)) {
      advancing.current = true;
      advanceRoundTx(code, game.roundNum)
        .catch(() => {})
        .finally(() => {
          advancing.current = false;
        });
    }
  }, [isHost, game, players, code]);

  if (!me) return null;

  const bankedCount = players.filter((p) => hasBankedThisRound(game, p)).length;
  const bankState: BankState = hasBankedThisRound(game, me)
    ? 'banked'
    : canBank(game, me)
      ? 'active'
      : 'locked';

  const handleBank = async () => {
    const captured = game.roundTotal;
    try {
      await bank(code, game.roundNum);
      setToast({ severity: 'success', text: `Banked +${captured}!` });
      if (typeof navigator !== 'undefined') navigator.vibrate?.(80);
    } catch (e) {
      if (e instanceof BankTooLateError) {
        setToast({ severity: 'error', text: 'Too late — the round ended!' });
      } else if (e instanceof AlreadyBankedError) {
        setToast({ severity: 'info', text: 'Already banked this round' });
      } else {
        setToast({ severity: 'error', text: 'Bank failed — try again' });
      }
    }
  };

  const handleRoll = (value: number) => recordRoll(code, value).catch(() => {});
  const handleDoubles = () => recordDoubles(code).catch(() => {});
  const handleUndo = () => undoLastRoll(code).catch(() => {});
  const canUndo = undoLast(game) !== null;

  return (
    <Container
      maxWidth="sm"
      sx={{ px: 2, py: 2, minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: 2 }}
    >
      <RoundHeader
        game={game}
        bankedCount={bankedCount}
        playerCount={players.length}
        onOpenStandings={() => setStandingsOpen(true)}
      />

      <RoundTotal game={game} />

      {isHost ? (
        <>
          <NumberGrid rollNum={game.rollNum} onRoll={handleRoll} onDoubles={handleDoubles} />
          <Button
            variant="text"
            startIcon={<UndoIcon />}
            disabled={!canUndo}
            onClick={handleUndo}
            sx={{ color: 'text.secondary', alignSelf: 'center' }}
          >
            Undo last roll
          </Button>
          <EndGameButton code={code} />
        </>
      ) : (
        <Typography
          variant="h6"
          color="text.secondary"
          sx={{ textAlign: 'center', minHeight: 56, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {lastActionText(game)}
        </Typography>
      )}

      <Box sx={{ flexGrow: 1 }} />

      <Box sx={{ pb: 'env(safe-area-inset-bottom)', mb: 1 }}>
        <BankButton state={bankState} onBank={handleBank} />
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 1 }}>
          Your score: <strong>{me.points}</strong>
        </Typography>
      </Box>

      <SwipeableDrawer
        anchor="bottom"
        open={standingsOpen}
        onClose={() => setStandingsOpen(false)}
        onOpen={() => setStandingsOpen(true)}
        disableSwipeToOpen
      >
        <Box sx={{ width: 36, height: 4, bgcolor: 'divider', borderRadius: 2, mx: 'auto', mt: 1.5 }} />
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Standings
          </Typography>
          <StandingsList players={players} uid={uid} game={game} />
        </Box>
      </SwipeableDrawer>

      <Snackbar
        open={toast !== null}
        autoHideDuration={2500}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          severity={toast?.severity ?? 'info'}
          variant="filled"
          onClose={() => setToast(null)}
          sx={{ width: '100%' }}
        >
          {toast?.text}
        </Alert>
      </Snackbar>
    </Container>
  );
}
