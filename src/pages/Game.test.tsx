import React from 'react';
import { render, within } from '@testing-library/react';
import Game from './Game';
import { GameDoc, PlayerDoc } from '../game/types';

// Host-only, and it drags in react-router-dom, which is ESM and unresolvable
// by CRA's Jest. These tests render as a guest, so it never shows anyway.
jest.mock('../components/EndGameButton', () => ({
  __esModule: true,
  default: () => null,
}));

// Game is presentational — it takes game/players as props — so the service
// layer only needs to exist, not work.
jest.mock('../services/gameService', () => ({
  advanceRoundNow: jest.fn(() => Promise.resolve()),
  bank: jest.fn(() => Promise.resolve()),
  recordRoll: jest.fn(() => Promise.resolve()),
  recordDoubles: jest.fn(() => Promise.resolve()),
  undoLastRoll: jest.fn(() => Promise.resolve()),
  endGame: jest.fn(() => Promise.resolve()),
  AlreadyBankedError: class AlreadyBankedError extends Error {},
  BankTooLateError: class BankTooLateError extends Error {},
}));

const HOST = 'host-uid';
const ME = 'me-uid';

const activeGame: GameDoc = {
  status: 'active',
  hostId: HOST,
  totalRounds: 20,
  roundNum: 3,
  rollNum: 6,
  roundTotal: 60,
  rolls: [],
  bustSnapshot: null,
  lastAction: { type: 'roll', value: 5 },
  turnSeat: 0,
};

const playersWith = (myBankedRound: number): PlayerDoc[] => [
  { id: HOST, name: 'Hosty', points: 120, bankedRound: 0, order: 0 },
  { id: ME, name: 'Guesty', points: 140, bankedRound: myBankedRound, order: 1 },
];

// The standings drawer is always mounted but portals to document.body, so
// scoping to the render container is what isolates the on-screen content.
const renderAsPlayer = (myBankedRound: number) => {
  const { container } = render(
    <Game
      code="ABCD"
      game={activeGame}
      players={playersWith(myBankedRound)}
      uid={ME}
      connection="live"
    />
  );
  return within(container);
};

describe('player screen after banking', () => {
  it('shows the round total hero and no standings before banking', () => {
    const view = renderAsPlayer(0); // has not banked this round
    expect(view.getByText('60')).toBeInTheDocument(); // the hero round total
    expect(view.queryByText('Guesty (you)')).not.toBeInTheDocument();
    expect(view.getByRole('button', { name: 'BANK' })).toBeEnabled();
  });

  it('replaces the hero with standings and every total once banked', () => {
    const view = renderAsPlayer(3); // banked in the current round
    // Standings are on screen now, not hidden behind the drawer.
    expect(view.getByText('Guesty (you)')).toBeInTheDocument();
    // Twice: the player strip in the header and the standings row below it.
    expect(view.getAllByText('Hosty')).toHaveLength(2);
    // Twice on purpose: the standings row and the "Your score" line under the
    // button. Everyone else's total appears once.
    expect(view.getAllByText('140')).toHaveLength(2); // my new total
    expect(view.getByText('120')).toBeInTheDocument(); // their total
    // The round total stays visible (compact) so the bust still lands.
    expect(view.getByText('60')).toBeInTheDocument();
    expect(view.getByRole('button', { name: 'BANKED ✓' })).toBeDisabled();
  });

  it('returns to the hero when the next round starts', () => {
    // bankedRound 2 is last round's bank, so this round is unbanked again.
    const view = renderAsPlayer(2);
    expect(view.queryByText('Guesty (you)')).not.toBeInTheDocument();
    expect(view.getByRole('button', { name: 'BANK' })).toBeEnabled();
  });
});

describe('turn and standing readouts', () => {
  it('names whoever holds the dice', () => {
    const view = renderAsPlayer(0); // turnSeat 0 is the host, and nobody banked
    expect(view.getByText('Hosty’s roll')).toBeInTheDocument();
  });

  // The case the stored pointer cannot cover on its own: banking is a
  // player-side transaction that may not write the game doc, so turnSeat still
  // points at the seat that just banked and the walk-forward has to move it.
  it('moves the dice past a player who banks on their own turn', () => {
    const view = within(
      render(
        <Game
          code="ABCD"
          game={activeGame} // turnSeat 0
          players={[
            { id: HOST, name: 'Hosty', points: 120, bankedRound: 3, order: 0 },
            { id: ME, name: 'Guesty', points: 140, bankedRound: 0, order: 1 },
          ]}
          uid={ME}
          connection="live"
        />
      ).container
    );
    expect(view.queryByText('Hosty’s roll')).not.toBeInTheDocument();
    expect(view.getByText('Your roll')).toBeInTheDocument();
  });

  it('shows the gap to the leader, and says so when you are the leader', () => {
    // Guesty leads on 140 to 120.
    expect(within(
      render(
        <Game code="ABCD" game={activeGame} players={playersWith(0)} uid={ME} connection="live" />
      ).container
    ).getByText('you’re leading')).toBeInTheDocument();

    // Same table seen from the host's side — 20 behind.
    expect(within(
      render(
        <Game code="ABCD" game={activeGame} players={playersWith(0)} uid={HOST} connection="live" />
      ).container
    ).getByText('20 behind Guesty')).toBeInTheDocument();
  });
});
