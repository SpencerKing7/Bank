import React from 'react';
import { Button } from '@mui/material';
import { DISPLAY_FONT } from '../theme';

export type BankState = 'locked' | 'active' | 'banked';

interface BankButtonProps {
  state: BankState;
  onBank: () => void;
}

const labels: Record<BankState, string> = {
  locked: 'BANK (unlocks after roll 3)',
  active: 'BANK',
  banked: 'BANKED ✓',
};

export default function BankButton({ state, onBank }: BankButtonProps) {
  return (
    <Button
      fullWidth
      variant="contained"
      color="primary"
      disabled={state !== 'active'}
      onClick={onBank}
      sx={{
        height: 'clamp(52px, 7.5dvh, 64px)',
        fontFamily: DISPLAY_FONT,
        fontSize: state === 'locked' ? '1.25rem' : '1.75rem',
        letterSpacing: '0.06em',
        boxShadow: state === 'active' ? '0 0 24px rgba(43, 224, 128, 0.35)' : 'none',
        ...(state === 'banked' && {
          '&.Mui-disabled': {
            bgcolor: 'rgba(37, 196, 111, 0.18)',
            color: 'success.light',
          },
        }),
      }}
    >
      {labels[state]}
    </Button>
  );
}
