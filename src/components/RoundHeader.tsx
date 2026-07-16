import React from 'react';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import { Box, IconButton, Typography } from '@mui/material';
import { GameDoc } from '../game/types';

interface RoundHeaderProps {
  game: GameDoc;
  bankedCount: number;
  playerCount: number;
  onOpenStandings: () => void;
}

export default function RoundHeader({ game, bankedCount, playerCount, onOpenStandings }: RoundHeaderProps) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <Box>
        <Typography variant="overline" color="text.secondary" component="div">
          Round {game.roundNum}/{game.totalRounds} · Roll {game.rollNum}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {bankedCount}/{playerCount} banked
        </Typography>
      </Box>
      <IconButton
        aria-label="Standings"
        onClick={onOpenStandings}
        sx={{ color: 'secondary.main', border: '1px solid', borderColor: 'divider', borderRadius: '14px', width: 48, height: 48 }}
      >
        <LeaderboardIcon />
      </IconButton>
    </Box>
  );
}
