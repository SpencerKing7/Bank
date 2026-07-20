import React, { useEffect, useRef, useState } from 'react';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import { Box, IconButton, Typography } from '@mui/material';
import { GameDoc, PlayerDoc } from '../game/types';
import { Connection } from '../hooks/useGame';
import { DISPLAY_FONT } from '../theme';
import PlayerStrip from './PlayerStrip';

interface RoundHeaderProps {
  game: GameDoc;
  players: PlayerDoc[]; // seat order
  uid: string;
  bankedCount: number;
  turnPlayer: PlayerDoc | null;
  connection?: Connection;
  onOpenStandings: () => void;
}

const SWEEP_MS = 1200;

export default function RoundHeader({
  game,
  players,
  uid,
  bankedCount,
  turnPlayer,
  connection = 'live',
  onOpenStandings,
}: RoundHeaderProps) {
  const isFinalRound = game.roundNum === game.totalRounds;

  return (
    <Box sx={{ flex: '0 0 auto' }}>
      {isFinalRound && <FinalRoundSweep roundNum={game.roundNum} />}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
            <Typography
              component="div"
              noWrap
              sx={{
                fontFamily: DISPLAY_FONT,
                fontSize: 'clamp(1.5rem, 7vw, 2.125rem)',
                lineHeight: 1.1,
                letterSpacing: '0.03em',
                color: isFinalRound ? 'secondary.light' : 'text.primary',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              Round {game.roundNum}/{game.totalRounds}
            </Typography>
            <Typography variant="overline" color="text.secondary" component="div" noWrap>
              · Roll {game.rollNum}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {isFinalRound && <FinalRoundChip />}
            <Typography variant="body2" color="text.secondary" noWrap>
              {turnPlayer ? (
                <>
                  <Box component="span" sx={{ color: 'secondary.light', fontWeight: 700 }}>
                    {turnPlayer.id === uid ? 'Your roll' : `${turnPlayer.name}’s roll`}
                  </Box>
                  {` · ${bankedCount}/${players.length} banked`}
                </>
              ) : (
                `${bankedCount}/${players.length} banked`
              )}
            </Typography>
            {connection === 'reconnecting' && <LiveDot />}
          </Box>
        </Box>
        <IconButton
          aria-label="Standings"
          onClick={onOpenStandings}
          sx={{
            color: 'secondary.main',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: '14px',
            width: 44,
            height: 44,
            flexShrink: 0,
          }}
        >
          <LeaderboardIcon />
        </IconButton>
      </Box>
      <Box sx={{ mt: 0.75 }}>
        <PlayerStrip
          players={players}
          game={game}
          uid={uid}
          turnPlayerId={turnPlayer?.id ?? null}
        />
      </Box>
    </Box>
  );
}

function FinalRoundChip() {
  return (
    <Box
      sx={{
        px: 1.25,
        py: 0.25,
        borderRadius: '999px',
        border: '1px solid',
        borderColor: 'secondary.main',
        color: 'secondary.light',
        fontSize: '0.75rem',
        fontWeight: 800,
        letterSpacing: '0.12em',
        animation: 'finalRoundPulse 1.8s ease-in-out infinite',
      }}
    >
      FINAL ROUND
    </Box>
  );
}

// A single gold wash the moment the last round begins, then gone. Keyed on
// roundNum the same way RoundTotal keys its bust flash, so a re-render (or an
// undo back into the final round) can't re-fire it for a round already seen.
function FinalRoundSweep({ roundNum }: { roundNum: number }) {
  const [sweeping, setSweeping] = useState(false);
  const seenRound = useRef<number | null>(null);

  useEffect(() => {
    if (seenRound.current === roundNum) return;
    seenRound.current = roundNum;
    setSweeping(true);
    const timer = setTimeout(() => setSweeping(false), SWEEP_MS);
    return () => clearTimeout(timer);
  }, [roundNum]);

  if (!sweeping) return null;
  return (
    <Box
      aria-hidden
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        pointerEvents: 'none',
        background:
          'linear-gradient(180deg, rgba(255,201,74,0) 0%, rgba(255,201,74,0.28) 50%, rgba(255,201,74,0) 100%)',
        animation: `finalRoundSweep ${SWEEP_MS}ms ease-out forwards`,
      }}
    />
  );
}

// Everything on this screen is shared state, so when it stops being live the
// player needs to know the numbers may be stale rather than trust them.
function LiveDot() {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Box
        sx={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          bgcolor: 'warning.main',
          animation: 'totalPop 1.2s ease-in-out infinite',
        }}
      />
      <Typography variant="body2" sx={{ color: 'warning.main', fontWeight: 700 }}>
        Reconnecting…
      </Typography>
    </Box>
  );
}
