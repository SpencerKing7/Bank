import React from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { Container, Typography } from '@mui/material';
import { isFirebaseConfigured } from './firebase';
import Home from './pages/Home';
import GameRoute from './pages/GameRoute';

function SetupNeeded() {
  return (
    <Container maxWidth="sm" sx={{ pt: 8, textAlign: 'center' }}>
      <Typography variant="h4" gutterBottom>
        Bank! needs Firebase
      </Typography>
      <Typography color="text.secondary">
        No Firebase config found. Copy your web app config into{' '}
        <code>.env.local</code> (see README) and restart the dev server.
      </Typography>
    </Container>
  );
}

export default function App() {
  if (!isFirebaseConfigured) return <SetupNeeded />;
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/game/:code" element={<GameRoute />} />
      </Routes>
    </HashRouter>
  );
}
