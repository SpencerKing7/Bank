import React from 'react';
import { Box, Chip, Typography } from '@mui/material';
import { hasBankedThisRound, standings } from '../game/logic';
import { GameDoc, PlayerDoc } from '../game/types';
import { DISPLAY_FONT } from '../theme';

interface StandingsListProps {
  players: PlayerDoc[];
  uid: string;
  game?: GameDoc; // when present (mid-game), shows banked-this-round chips
  medals?: boolean; // game-over mode: gold/silver/bronze rank colors
}

const medalColors = ['#FFC94A', '#B9C4BE', '#D9915B'];

export default function StandingsList({ players, uid, game, medals = false }: StandingsListProps) {
  const ranked = standings(players);
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      {ranked.map((player, index) => {
        const isMe = player.id === uid;
        const rankColor = medals
          ? medalColors[index] ?? 'text.secondary'
          : index === 0
            ? 'secondary.main'
            : 'text.secondary';
        return (
          <Box
            key={player.id}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              px: 2,
              py: 1.5,
              borderRadius: '14px',
              ...(isMe && {
                bgcolor: 'rgba(43, 224, 128, 0.12)',
                borderLeft: '3px solid',
                borderColor: 'primary.main',
              }),
            }}
          >
            <Typography sx={{ fontFamily: DISPLAY_FONT, fontSize: '1.5rem', color: rankColor, minWidth: 28 }}>
              {index + 1}
            </Typography>
            <Typography sx={{ fontWeight: 700, flexGrow: 1 }} noWrap>
              {player.name}
              {isMe ? ' (you)' : ''}
            </Typography>
            {game && hasBankedThisRound(game, player) && (
              <Chip size="small" color="success" label="Banked" />
            )}
            <Typography sx={{ fontFamily: DISPLAY_FONT, fontSize: '1.5rem', fontVariantNumeric: 'tabular-nums' }}>
              {player.points}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}
