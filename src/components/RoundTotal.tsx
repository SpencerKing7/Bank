import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { GameDoc } from '../game/types';

interface RoundTotalProps {
  game: GameDoc;
  // The host's screen also carries the roll pad, so the hero gets a smaller
  // share of the height there than on a player's screen.
  compact?: boolean;
}

const BUST_MS = 1400;

// The hero number everyone stares at. Pops on each roll, shakes and shows
// BUST in red for a beat when a bad 7 lands.
export default function RoundTotal({ game, compact = false }: RoundTotalProps) {
  const [busting, setBusting] = useState(false);
  // One flash per bust: round advances on bust, so roundNum identifies it.
  const bustKey = game.lastAction?.type === 'bust' ? `bust:${game.roundNum}` : null;
  const seenBustKey = useRef<string | null>(null);

  useEffect(() => {
    if (!bustKey || seenBustKey.current === bustKey) return;
    seenBustKey.current = bustKey;
    setBusting(true);
    if (typeof navigator !== 'undefined') navigator.vibrate?.(200);
    const timer = setTimeout(() => setBusting(false), BUST_MS);
    return () => clearTimeout(timer);
  }, [bustKey]);

  return (
    <Box
      sx={{
        textAlign: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: '0 0 auto',
        minHeight: 0,
        py: compact ? 0.5 : 1,
        animation: busting ? 'bustShake 500ms ease, bustFlash 900ms ease-out' : undefined,
      }}
    >
      <Typography
        variant="h1"
        // Remount per action so the pop animation re-fires on every roll.
        key={`${game.roundNum}:${game.rolls.length}:${busting}`}
        sx={{
          color: busting ? 'error.light' : 'text.primary',
          animation: busting ? undefined : 'totalPop 180ms ease',
          // Height-aware so a short screen shrinks the hero instead of
          // shoving the BANK button below the fold.
          fontSize: compact
            ? 'clamp(2.75rem, 11dvh, 5.5rem)'
            : 'clamp(4rem, min(28vw, 22dvh), 10rem)',
        }}
      >
        {busting ? 'BUST' : game.roundTotal}
      </Typography>
    </Box>
  );
}
