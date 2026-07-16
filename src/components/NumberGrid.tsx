import React from 'react';
import { Box, ButtonBase, Typography } from '@mui/material';
import numbers from '../numbers.json';
import { DISPLAY_FONT, tiles } from '../theme';

interface NumberGridProps {
  rollNum: number;
  onRoll: (value: number) => void;
  onDoubles: () => void;
}

const tileBase = {
  height: 76,
  borderRadius: '14px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: DISPLAY_FONT,
  fontSize: '2rem',
  lineHeight: 1,
  transition: 'transform 120ms, background-color 120ms',
} as const;

const sublabelSx = { fontSize: '0.75rem', fontWeight: 700, fontFamily: 'inherit', lineHeight: 1.4 };

// The host's roll pad: 2-12 plus Doubles, 3-wide. The 7 tile flips from
// "safe" (+70 during rolls 1-3) to "danger" (busts from roll 4) — color and
// word change together.
export default function NumberGrid({ rollNum, onRoll, onDoubles }: NumberGridProps) {
  const sevenIsSafe = rollNum <= 3;
  const doublesLocked = rollNum <= 3;

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5 }}>
      {numbers.dice.map(({ value }) => {
        const isSeven = value === 7;
        const seven = sevenIsSafe ? tiles.sevenSafe : tiles.sevenDanger;
        return (
          <ButtonBase
            key={value}
            onClick={() => onRoll(value)}
            sx={{
              ...tileBase,
              bgcolor: isSeven ? seven.bg : tiles.bg,
              border: isSeven ? `2px solid ${seven.border}` : `1px solid ${tiles.border}`,
              color: isSeven ? seven.text : tiles.text,
              '&:active': {
                bgcolor: isSeven ? seven.bg : tiles.bgPressed,
                transform: 'scale(0.96)',
              },
            }}
          >
            {value}
            {isSeven && (
              <Typography component="span" sx={sublabelSx}>
                {sevenIsSafe ? '+70' : 'BUST'}
              </Typography>
            )}
          </ButtonBase>
        );
      })}
      <ButtonBase
        onClick={onDoubles}
        disabled={doublesLocked}
        sx={{
          ...tileBase,
          fontSize: '1.4rem',
          bgcolor: doublesLocked ? tiles.disabled.bg : tiles.bg,
          border: doublesLocked ? 'none' : `1px solid ${tiles.border}`,
          color: doublesLocked ? tiles.disabled.text : tiles.text,
          '&:active': { bgcolor: tiles.bgPressed, transform: 'scale(0.96)' },
        }}
      >
        DOUBLES
        <Typography component="span" sx={sublabelSx}>
          {doublesLocked ? 'after roll 3' : '×2'}
        </Typography>
      </ButtonBase>
    </Box>
  );
}
