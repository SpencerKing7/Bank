import React, { useMemo } from 'react';
import { Box } from '@mui/material';

const NOTES = ['💵', '💰', '💸', '🤑'];

// The payoff animation for banking. Same shape as GameOver's Confetti — fixed
// overlay, locally-scoped keyframe, randomized per-piece timing — but shorter
// and sparser, because this fires every round rather than once at the end.
//
// The caller mounts and unmounts this; it has no timer of its own.
export default function MoneyRain() {
  const notes = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.35,
        duration: 1.1 + Math.random() * 0.5,
        size: 26 + Math.random() * 20,
        tilt: -30 + Math.random() * 60,
        glyph: NOTES[i % NOTES.length],
      })),
    []
  );
  return (
    <Box
      aria-hidden
      sx={{
        position: 'fixed',
        inset: 0,
        // Above the hero and the BANK button, but never in front of a toast or
        // the standings drawer.
        zIndex: 1200,
        pointerEvents: 'none',
        overflow: 'hidden',
        '@keyframes moneyFall': {
          from: { transform: 'translateY(-12vh) rotate(0deg)', opacity: 0 },
          '12%': { opacity: 1 },
          to: { transform: 'translateY(108vh) rotate(320deg)', opacity: 0.9 },
        },
      }}
    >
      {notes.map((note, i) => (
        <Box
          key={i}
          component="span"
          sx={{
            position: 'absolute',
            top: 0,
            left: `${note.left}%`,
            fontSize: note.size,
            lineHeight: 1,
            transform: `rotate(${note.tilt}deg)`,
            animation: `moneyFall ${note.duration}s ease-in ${note.delay}s forwards`,
          }}
        >
          {note.glyph}
        </Box>
      ))}
    </Box>
  );
}
