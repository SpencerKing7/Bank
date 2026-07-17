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
import { Connection } from '../hooks/useGame';
import {
  advanceRoundNow,
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
  connection: Connection;
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

// Fill the viewport exactly, never scroll. dvh tracks mobile browser chrome as
// it collapses; vh is the fallback for browsers without it.
const fullHeight = {
  height: '100vh',
  '@supports (height: 100dvh)': { height: '100dvh' },
} as const;

export default function Game({ code, game, players, uid, connection }: GameProps) {
  const isHost = uid === game.hostId;
  const me = players.find((p) => p.id === uid);
  const [standingsOpen, setStandingsOpen] = useState(false);
  const [toast, setToast] = useState<{ severity: AlertColor; text: string } | null>(null);
  const advancing = useRef(false);

  // Host detects "everyone banked" and advances the round. Duplicate fires are
  // harmless: the write echoes back locally before this can run again, and the
  // fresh roundNum makes allPlayersBanked false.
  //
  // Gated on a live connection: `players` can be a stale cache replay while
  // offline, and nothing re-checks allPlayersBanked server-side. Acting on stale
  // data would end the round on someone who never banked.
  useEffect(() => {
    if (!isHost || advancing.current || connection !== 'live') return;
    if (allPlayersBanked(game, players)) {
      advancing.current = true;
      advanceRoundNow(code, game)
        .catch(() => {})
        .finally(() => {
          advancing.current = false;
        });
    }
  }, [isHost, game, players, code, connection]);

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

  const handleRoll = (value: number) => recordRoll(code, game, value).catch(() => {});
  const handleDoubles = () => recordDoubles(code, game).catch(() => {});
  const handleUndo = () => undoLastRoll(code, game).catch(() => {});
  const canUndo = undoLast(game) !== null;

  return (
    <Container
      maxWidth="sm"
      sx={{
        ...fullHeight,
        px: 2,
        pt: 1.5,
        pb: 'calc(12px + env(safe-area-inset-bottom))',
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        overflow: 'hidden',
      }}
    >
      <RoundHeader
        game={game}
        bankedCount={bankedCount}
        playerCount={players.length}
        connection={connection}
        onOpenStandings={() => setStandingsOpen(true)}
      />

      {isHost ? (
        <>
          {/* Hero stays compact so the roll pad, which is what the host
              actually touches, gets the leftover height. */}
          <RoundTotal game={game} compact />
          <NumberGrid rollNum={game.rollNum} onRoll={handleRoll} onDoubles={handleDoubles} />
          <Button
            variant="text"
            size="small"
            startIcon={<UndoIcon />}
            disabled={!canUndo}
            onClick={handleUndo}
            sx={{
              color: 'text.secondary',
              alignSelf: 'center',
              flex: '0 0 auto',
              minHeight: 36,
              fontSize: '0.9375rem',
            }}
          >
            Undo last roll
          </Button>
        </>
      ) : bankState === 'banked' ? (
        // Banking locks you in at me.points, and from that moment the hero
        // number is somebody else's — it keeps climbing without you, which is
        // the opposite of what you want to read. Demote it to a bystander's
        // view (the bust flash still lands, and watching it bust after you're
        // safe is the best part) and spend the freed height on where that bank
        // actually left you.
        <Box sx={{ flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <RoundTotal game={game} compact />
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ textAlign: 'center', minHeight: 24 }}
          >
            {lastActionText(game)}
          </Typography>
          {/* The list scrolls inside its own box: a big party must never push
              the BANKED button off the bottom of the viewport. */}
          <Box sx={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', mt: 0.5 }}>
            <StandingsList players={players} uid={uid} game={game} />
          </Box>
        </Box>
      ) : (
        // The total and the caption describing it are one unit, centred
        // together in the slack rather than drifting to opposite ends.
        <Box
          sx={{
            flex: '1 1 auto',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <RoundTotal game={game} />
          <Typography
            variant="h6"
            color="text.secondary"
            sx={{ textAlign: 'center', minHeight: 32 }}
          >
            {lastActionText(game)}
          </Typography>
        </Box>
      )}

      <Box sx={{ flex: '0 0 auto' }}>
        <BankButton state={bankState} onBank={handleBank} />
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ textAlign: 'center', mt: 0.5 }}
        >
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
          {/* Destructive and rare — tucked in here rather than sitting next to
              BANK, where it cost a row of height and invited mis-taps. */}
          {isHost && (
            <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider', display: 'flex' }}>
              <EndGameButton code={code} />
            </Box>
          )}
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
