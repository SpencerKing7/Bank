import React from 'react';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import { Box, IconButton, Typography } from '@mui/material';
import { GameDoc } from '../game/types';
import { Connection } from '../hooks/useGame';

interface RoundHeaderProps {
  game: GameDoc;
  bankedCount: number;
  playerCount: number;
  connection?: Connection;
  onOpenStandings: () => void;
}

export default function RoundHeader({
  game,
  bankedCount,
  playerCount,
  connection = 'live',
  onOpenStandings,
}: RoundHeaderProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flex: '0 0 auto',
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="overline" color="text.secondary" component="div" noWrap>
          Round {game.roundNum}/{game.totalRounds} · Roll {game.rollNum}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {bankedCount}/{playerCount} banked
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
