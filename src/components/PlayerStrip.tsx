import React from 'react';
import CasinoIcon from '@mui/icons-material/Casino';
import { Box, Typography } from '@mui/material';
import { hasBankedThisRound } from '../game/logic';
import { GameDoc, PlayerDoc } from '../game/types';

interface PlayerStripProps {
  players: PlayerDoc[]; // seat order
  game: GameDoc;
  uid: string;
  turnPlayerId: string | null;
}

// Long names would wrap the strip to three rows and eat the roll pad's height.
// First name, plus a surname initial only when it's needed to tell two apart.
function shortName(player: PlayerDoc, players: PlayerDoc[]): string {
  const [first, ...rest] = player.name.trim().split(/\s+/);
  if (!first) return player.name;
  const ambiguous = players.some(
    (other) => other.id !== player.id && other.name.trim().split(/\s+/)[0] === first
  );
  if (!ambiguous || rest.length === 0) return first;
  return `${first} ${rest[rest.length - 1][0]}.`;
}

// Who's in, who's out, and who's holding the dice — the thing the plain
// "3/5 banked" count never told you.
export default function PlayerStrip({ players, game, uid, turnPlayerId }: PlayerStripProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 0.75,
        flex: '0 0 auto',
        // A big party wraps and scrolls within its own budget rather than
        // pushing the BANK button off the bottom of a fixed-height screen.
        maxHeight: 68,
        overflowY: 'auto',
      }}
    >
      {players.map((player) => {
        const banked = hasBankedThisRound(game, player);
        const isTurn = player.id === turnPlayerId;
        const isMe = player.id === uid;
        return (
          <Box
            key={player.id}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1,
              height: 28,
              borderRadius: '999px',
              border: '1px solid',
              fontSize: '0.8125rem',
              fontWeight: 700,
              maxWidth: 140,
              ...(banked
                ? {
                    bgcolor: 'success.main',
                    borderColor: 'success.main',
                    color: 'success.contrastText',
                  }
                : isTurn
                  ? {
                      // Same glow idiom BankButton uses for its live state.
                      bgcolor: 'rgba(255, 201, 74, 0.16)',
                      borderColor: 'secondary.main',
                      color: 'secondary.light',
                      boxShadow: '0 0 14px rgba(255, 201, 74, 0.35)',
                    }
                  : {
                      bgcolor: isMe ? 'rgba(43, 224, 128, 0.12)' : 'transparent',
                      borderColor: isMe ? 'primary.main' : 'divider',
                      color: 'text.secondary',
                    }),
            }}
          >
            {isTurn && !banked && <CasinoIcon sx={{ fontSize: 15 }} />}
            <Typography component="span" noWrap sx={{ fontSize: 'inherit', fontWeight: 'inherit' }}>
              {shortName(player, players)}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}
