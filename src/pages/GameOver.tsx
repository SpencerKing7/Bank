import React, { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Container, Typography } from '@mui/material';
import KeepAwakeToggle from '../components/KeepAwakeToggle';
import StandingsList from '../components/StandingsList';
import { standings } from '../game/logic';
import { GameDoc, PlayerDoc } from '../game/types';
import { clearActiveGameCode } from '../hooks/useSession';
import { useWakeLock } from '../hooks/useWakeLock';

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
  const wakeLock = useWakeLock();
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
      sx={{
        height: '100vh',
        '@supports (height: 100dvh)': { height: '100dvh' },
        px: 2,
        pt: 2,
        pb: 'calc(16px + env(safe-area-inset-bottom))',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        overflow: 'hidden',
      }}
    >
      <Confetti />
      <Box sx={{ textAlign: 'center', flex: '0 0 auto' }}>
        <Typography variant="overline" color="text.secondary">
          {winners.length > 1 ? 'It’s a tie' : 'Winner'}
        </Typography>
        <Typography
          variant="h3"
          sx={{
            color: 'secondary.light',
            animation: 'winnerGlow 2s ease-in-out infinite',
            fontSize: 'clamp(2rem, min(14vw, 9dvh), 4.5rem)',
          }}
        >
          {winnerNames || 'Nobody?'}
        </Typography>
        <Typography variant="h1" sx={{ fontSize: 'clamp(2.75rem, min(18vw, 13dvh), 6rem)' }}>
          {topScore}
        </Typography>
      </Box>

      {/* Scrolls internally on a big roster so Play Again stays put. */}
      <Box sx={{ flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <Typography variant="h6" gutterBottom sx={{ flex: '0 0 auto' }}>
          Final standings · {game.totalRounds} rounds
        </Typography>
        <Box sx={{ overflowY: 'auto', minHeight: 0 }}>
          <StandingsList players={players} uid={uid} medals />
        </Box>
      </Box>

      <Box sx={{ flex: '0 0 auto' }}>
        <KeepAwakeToggle wakeLock={wakeLock} />
      </Box>

      <Button variant="contained" fullWidth onClick={() => navigate('/')} sx={{ flex: '0 0 auto' }}>
        Play Again
      </Button>
    </Container>
  );
}
