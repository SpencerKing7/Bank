import { getDoc, setDoc, writeBatch } from 'firebase/firestore';
import { generateGameCode } from '../game/codes';
import { createGame, GameNotFoundError, joinGame } from './gameService';

// Stand-ins for the Firestore SDK. These functions' whole job is deciding which
// network calls to make, so the assertions are about the calls themselves.
jest.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...path: string[]) => ({ path: path.join('/') }),
  getDoc: jest.fn(),
  setDoc: jest.fn(() => Promise.resolve()),
  writeBatch: jest.fn(),
  serverTimestamp: () => 'server-timestamp',
}));

jest.mock('../firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'me-uid' } },
}));

jest.mock('../game/codes', () => ({ generateGameCode: jest.fn() }));

const mockGetDoc = getDoc as jest.Mock;
const mockSetDoc = setDoc as jest.Mock;
const mockWriteBatch = writeBatch as jest.Mock;
const mockGenerateGameCode = generateGameCode as jest.Mock;

const GAME_PATH = 'games/ABCD';
const PLAYER_PATH = 'games/ABCD/players/me-uid';

const snap = (exists: boolean) => ({ exists: () => exists });

// Reads resolve by path, so a test only states what exists.
function existing(...paths: string[]) {
  mockGetDoc.mockImplementation((ref: { path: string }) =>
    Promise.resolve(snap(paths.includes(ref.path)))
  );
}

let batch: { set: jest.Mock; commit: jest.Mock };

beforeEach(() => {
  mockGetDoc.mockReset();
  mockSetDoc.mockReset().mockResolvedValue(undefined);
  mockGenerateGameCode.mockReset();
  batch = { set: jest.fn(), commit: jest.fn().mockResolvedValue(undefined) };
  mockWriteBatch.mockReset().mockReturnValue(batch);
});

describe('joinGame', () => {
  it('creates the player doc with no points when the game exists', async () => {
    existing(GAME_PATH);

    await joinGame('ABCD', 'Ana');

    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    expect(mockSetDoc.mock.calls[0][0]).toEqual({ path: PLAYER_PATH });
    expect(mockSetDoc.mock.calls[0][1]).toEqual({
      name: 'Ana',
      points: 0,
      bankedRound: 0,
      joinedAt: 'server-timestamp',
    });
  });

  // Firestore will create games/{code}/players/{uid} under a game doc that
  // isn't there, so this read is the only thing standing between a typo and a
  // player sitting alone in a game that does not exist.
  it('rejects a code with no game behind it and writes nothing', async () => {
    existing(PLAYER_PATH);

    await expect(joinGame('ABCD', 'Ana')).rejects.toThrow(GameNotFoundError);
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  // The rejoin path: writing would reset points to 0, and the rules would
  // reject it anyway. Staying quiet is what makes a refresh or a re-typed code
  // harmless.
  it('leaves an existing player alone rather than rewriting them to zero', async () => {
    existing(GAME_PATH, PLAYER_PATH);

    await expect(joinGame('ABCD', 'Ana')).resolves.toBeUndefined();
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  // The point of the refactor. Nothing orders these two reads, so they must go
  // out together and cost one round trip, not two. Awaiting them one after the
  // other would still pass every test above.
  it('puts both reads in flight without waiting for either', () => {
    let settleGameRead = () => {};
    mockGetDoc.mockImplementation((ref: { path: string }) =>
      ref.path === GAME_PATH
        ? new Promise((resolve) => {
            settleGameRead = () => resolve(snap(true));
          })
        : Promise.resolve(snap(false))
    );

    const joined = joinGame('ABCD', 'Ana');

    // The game read has not come back, yet the player read is already gone.
    expect(mockGetDoc).toHaveBeenCalledTimes(2);
    expect(mockGetDoc.mock.calls.map((call) => call[0].path)).toEqual([GAME_PATH, PLAYER_PATH]);

    settleGameRead();
    return joined;
  });
});

describe('createGame', () => {
  // Both writes have to land together: a game whose host is missing from the
  // players list would show its own host the join form.
  it('writes the game and the host into one batch', async () => {
    mockGenerateGameCode.mockReturnValue('ABCD');
    existing();

    await expect(createGame('Ana', 15)).resolves.toBe('ABCD');

    expect(batch.set).toHaveBeenCalledTimes(2);
    expect(batch.commit).toHaveBeenCalledTimes(1);
    expect(batch.set.mock.calls[0][0]).toEqual({ path: GAME_PATH });
    expect(batch.set.mock.calls[0][1]).toMatchObject({
      status: 'lobby',
      hostId: 'me-uid',
      totalRounds: 15,
      roundNum: 1,
    });
    expect(batch.set.mock.calls[1][0]).toEqual({ path: PLAYER_PATH });
    expect(batch.set.mock.calls[1][1]).toEqual({
      name: 'Ana',
      points: 0,
      bankedRound: 0,
      joinedAt: 'server-timestamp',
    });
  });

  // The read exists for this. It also covers the case the rules cannot: a code
  // matching a game this same host already owns would satisfy the update rule
  // and overwrite a live game.
  it('moves to another code rather than writing over a game that exists', async () => {
    mockGenerateGameCode.mockReturnValueOnce('ABCD').mockReturnValueOnce('WXYZ');
    existing(GAME_PATH);

    await expect(createGame('Ana', 20)).resolves.toBe('WXYZ');

    expect(batch.set.mock.calls[0][0]).toEqual({ path: 'games/WXYZ' });
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it('gives up rather than looping forever when every code is taken', async () => {
    mockGenerateGameCode.mockReturnValue('ABCD');
    existing(GAME_PATH);

    await expect(createGame('Ana', 20)).rejects.toThrow('Could not find a free game code');
    expect(batch.commit).not.toHaveBeenCalled();
    expect(mockGetDoc).toHaveBeenCalledTimes(5);
  });
});
