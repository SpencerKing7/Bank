import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { GameDoc } from '../game/types';

interface RoundTotalProps {
  game: GameDoc;
}

const BUST_MS = 1400;

// The hero number everyone stares at. Pops on each roll, shakes and shows
// BUST in red for a beat when a bad 7 lands.
export default function RoundTotal({ game }: RoundTotalProps) {
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
        py: 2,
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
        }}
      >
        {busting ? 'BUST' : game.roundTotal}
      </Typography>
    </Box>
  );
}
