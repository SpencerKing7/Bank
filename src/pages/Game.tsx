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
import KeepAwakeToggle from '../components/KeepAwakeToggle';
import MoneyRain from '../components/MoneyRain';
import NumberGrid from '../components/NumberGrid';
import RoundHeader from '../components/RoundHeader';
import RoundTotal from '../components/RoundTotal';
import StandingsList from '../components/StandingsList';
import {
  allPlayersBanked,
  canBank,
  currentTurnPlayer,
  hasBankedThisRound,
  leaderGap,
  turnContext,
  undoLast,
} from '../game/logic';
import { GameDoc, PlayerDoc } from '../game/types';
import { Connection } from '../hooks/useGame';
import { useWakeLock } from '../hooks/useWakeLock';
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

export default function Game({ code, game, players: rawPlayers, uid, connection }: GameProps) {
  const isHost = uid === game.hostId;
  const [standingsOpen, setStandingsOpen] = useState(false);
  const [toast, setToast] = useState<{ severity: AlertColor; text: string } | null>(null);
  const advancing = useRef(false);

  // bank() is a transaction, whose write never lands in the local cache, so the
  // caller's own players listener won't reflect their bank until a server echo
  // arrives (if at all). That leaves the host — who must both see their own bank
  // land and detect all-banked to advance — stuck: the button wouldn't flip and
  // the round wouldn't end when the host banks last. Optimistically mark our own
  // bank for the current round; the server echo (matching bankedRound) supersedes
  // it, and a new roundNum makes it stale on its own.
  const [optimisticBankRound, setOptimisticBankRound] = useState<number | null>(null);
  // The round whose bank is currently raining money. Keyed on round rather than
  // a bare boolean so a re-render can't restart the animation mid-fall.
  const [rainRound, setRainRound] = useState<number | null>(null);
  const wakeLock = useWakeLock();
  const players =
    optimisticBankRound === game.roundNum
      ? rawPlayers.map((p) =>
          p.id === uid ? { ...p, bankedRound: optimisticBankRound } : p
        )
      : rawPlayers;
  const me = players.find((p) => p.id === uid);

  // Host detects "everyone banked" and advances the round. `players` carries the
  // host's own optimistic bank, so this fires even when the host banks last (a
  // transaction write never reaches the host's own listener from cache).
  // Duplicate fires are harmless: the advance echoes back locally before this can
  // run again, and the fresh roundNum makes allPlayersBanked false.
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

  // Money rain is purely decorative, so it cleans itself up on a timer rather
  // than waiting on anything from Firestore.
  useEffect(() => {
    if (rainRound === null) return;
    const timer = setTimeout(() => setRainRound(null), 1600);
    return () => clearTimeout(timer);
  }, [rainRound]);

  if (!me) return null;

  const bankedCount = players.filter((p) => hasBankedThisRound(game, p)).length;
  // Before anyone has scored, everybody is "leading" — which is noise, not
  // information. Hold the whole readout back until there's a real lead.
  const scoringStarted = players.some((p) => p.points > 0);
  const gap = leaderGap(players, me);
  const turnPlayer = currentTurnPlayer(game, players);
  const bankState: BankState = hasBankedThisRound(game, me)
    ? 'banked'
    : canBank(game, me)
      ? 'active'
      : 'locked';

  const handleBank = async () => {
    const captured = game.roundTotal;
    try {
      await bank(code, game.roundNum);
      setOptimisticBankRound(game.roundNum);
      setToast({ severity: 'success', text: `Banked +${captured}!` });
      setRainRound(game.roundNum);
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

  const turn = turnContext(game, players);
  const handleRoll = (value: number) => recordRoll(code, game, value, turn).catch(() => {});
  const handleDoubles = () => recordDoubles(code, game, turn).catch(() => {});
  const handleUndo = () => undoLastRoll(code, game, turn).catch(() => {});
  const canUndo = undoLast(game, turn) !== null;

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
        players={players}
        uid={uid}
        bankedCount={bankedCount}
        turnPlayer={turnPlayer}
        connection={connection}
        onOpenStandings={() => setStandingsOpen(true)}
      />

      {isHost ? (
        <>
          {/* Hero stays compact so the roll pad, which is what the host
              actually touches, gets the leftover height. */}
          <RoundTotal game={game} compact />
          {/* The host taps the pad and then looks up — without this they have
              no read-back of what they actually entered. */}
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ textAlign: 'center', minHeight: 24, flex: '0 0 auto' }}
          >
            {lastActionText(game)}
          </Typography>
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
            <StandingsList players={players} uid={uid} game={game} turnPlayerId={turnPlayer?.id ?? null} />
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
          {scoringStarted && ' · '}
          {scoringStarted &&
            (gap ? (
              <Box component="span" sx={{ color: 'warning.main', fontWeight: 700 }}>
                {gap.behind} behind {gap.leader.name}
              </Box>
            ) : (
              <Box component="span" sx={{ color: 'secondary.main', fontWeight: 700 }}>
                you’re leading
              </Box>
            ))}
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
          <StandingsList players={players} uid={uid} game={game} turnPlayerId={turnPlayer?.id ?? null} />
          <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
            <KeepAwakeToggle wakeLock={wakeLock} />
          </Box>
          {/* Destructive and rare — tucked in here rather than sitting next to
              BANK, where it cost a row of height and invited mis-taps. */}
          {isHost && (
            <Box sx={{ mt: 1, pt: 2, borderTop: '1px solid', borderColor: 'divider', display: 'flex' }}>
              <EndGameButton code={code} />
            </Box>
          )}
        </Box>
      </SwipeableDrawer>

      {rainRound !== null && <MoneyRain />}

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
