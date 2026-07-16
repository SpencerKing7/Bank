import React, { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Container, Typography } from '@mui/material';
import StandingsList from '../components/StandingsList';
import { standings } from '../game/logic';
import { GameDoc, PlayerDoc } from '../game/types';
import { clearActiveGameCode } from '../hooks/useSession';

interface GameOverProps {
  code: string;
  game: GameDoc;
  players: PlayerDoc[];
  uid: string;
}

const CONFETTI_COLORS = ['#2BE080', '#FFC94A', '#7DF0B8', '#FFD75E'];

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.8,
        duration: 2.2 + Math.random() * 1.6,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        tilt: Math.random() * 360,
      })),
    []
  );
  return (
    <Box
      aria-hidden
      sx={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        '@keyframes confettiFall': {
          to: { transform: 'translateY(110vh) rotate(720deg)', opacity: 0.85 },
        },
      }}
    >
      {pieces.map((piece, i) => (
        <Box
          key={i}
          sx={{
            position: 'absolute',
            top: -20,
            left: `${piece.left}%`,
            width: 10,
            height: 14,
            borderRadius: '2px',
            bgcolor: piece.color,
            transform: `rotate(${piece.tilt}deg)`,
            animation: `confettiFall ${piece.duration}s ease-in ${piece.delay}s forwards`,
          }}
        />
      ))}
    </Box>
  );
}

export default function GameOver({ game, players, uid }: GameOverProps) {
  const navigate = useNavigate();
  const ranked = standings(players);
  const topScore = ranked[0]?.points ?? 0;
  const winners = ranked.filter((p) => p.points === topScore);
  const winnerNames = winners.map((w) => w.name).join(' & ');

  // The game is done — stop offering a rejoin for it.
  useEffect(() => {
    clearActiveGameCode();
  }, []);

  return (
    <Container
      maxWidth="sm"
      sx={{ px: 2, py: 4, minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: 2 }}
    >
      <Confetti />
      <Box sx={{ textAlign: 'center', mt: 4 }}>
        <Typography variant="overline" color="text.secondary">
          {winners.length > 1 ? 'It’s a tie' : 'Winner'}
        </Typography>
        <Typography
          variant="h3"
          sx={{ color: 'secondary.light', animation: 'winnerGlow 2s ease-in-out infinite' }}
        >
          {winnerNames || 'Nobody?'}
        </Typography>
        <Typography variant="h1" sx={{ fontSize: 'clamp(3.5rem, 18vw, 6rem)' }}>
          {topScore}
        </Typography>
      </Box>

      <Box>
        <Typography variant="h6" gutterBottom>
          Final standings · {game.totalRounds} rounds
        </Typography>
        <StandingsList players={players} uid={uid} medals />
      </Box>

      <Box sx={{ flexGrow: 1 }} />

      <Button variant="contained" fullWidth onClick={() => navigate('/')} sx={{ mb: 2 }}>
        Play Again
      </Button>
    </Container>
  );
}
