import React from 'react';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import { Box, Switch, Typography } from '@mui/material';
import { WakeLockState } from '../hooks/useWakeLock';

interface KeepAwakeToggleProps {
  wakeLock: WakeLockState;
}

// Renders nothing where the API doesn't exist (iOS < 16.4, Firefox) rather
// than showing a switch that can't do anything.
export default function KeepAwakeToggle({ wakeLock }: KeepAwakeToggleProps) {
  if (!wakeLock.supported) return null;
  return (
    <Box
      component="label"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        minHeight: 48,
        cursor: 'pointer',
      }}
    >
      <LightbulbIcon
        fontSize="small"
        sx={{ color: wakeLock.enabled ? 'secondary.main' : 'text.disabled' }}
      />
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700 }}>Keep screen on</Typography>
        <Typography
          variant="body2"
          color={wakeLock.blocked ? 'warning.main' : 'text.secondary'}
          noWrap
        >
          {wakeLock.blocked ? 'Your browser wouldn’t allow it' : 'Stops your phone locking'}
        </Typography>
      </Box>
      <Switch
        checked={wakeLock.enabled}
        onChange={wakeLock.toggle}
        inputProps={{ 'aria-label': 'Keep screen on' }}
      />
    </Box>
  );
}
