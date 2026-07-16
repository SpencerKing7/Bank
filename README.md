# Bank!

A real-time multiplayer scorekeeper for the dice game **Bank**. The host creates a game and gets a 4-letter code; everyone else joins from their phone, watches the round total climb live, and races to **BANK** before a bad 7 wipes the pot.

## Rules

- Rounds 1–3 of rolling are safe: a **7 scores +70**.
- From roll 4 on, a **7 busts the round** — the un-banked total is gone and the next round starts.
- **Doubles** (×2) can be played from roll 4 on.
- Any player can **Bank** from roll 4 on (once per round) to add the current total to their score.
- The round ends on a bust or when **every player has banked**. Highest score after the final round wins.

## One-time Firebase setup

The app needs a (free) Firebase project:

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → **Add project** (e.g. `bank-game`); Analytics can be off.
2. Project settings → **Your apps** → **Add app** → Web (`</>`). Skip hosting. Copy the config values shown.
3. `cp .env.local.example .env.local` and fill in the four values from step 2.
4. Build → **Firestore Database** → Create database → **Production mode**, location `nam5` (or nearest).
5. Build → **Authentication** → Get started → Sign-in method → enable **Anonymous**.
6. Firestore Database → **Rules** → paste the contents of [firestore.rules](firestore.rules) → **Publish**.
7. Before deploying: Authentication → Settings → **Authorized domains** → add `spencerking7.github.io`.

The web config values are public by design — the Firestore rules are what protect the data. `.env.local` is gitignored simply to keep them out of the repo.

## Develop

```bash
npm install
npm start        # http://localhost:3000
npm test         # game-logic unit tests
```

To test multiplayer locally, open one normal window and one **incognito** window (two normal tabs share the same anonymous identity and would be the same player).

### Without a Firebase project (emulator)

```bash
npx firebase-tools@13 emulators:start --project demo-bank
```

and put `REACT_APP_USE_EMULATOR=true` in `.env.local` (instead of the real config). Requires Java.

## Deploy

```bash
npm run deploy   # builds and pushes to the gh-pages branch
```

Live at https://spencerking7.github.io/Bank (config from your local `.env.local` is baked in at build time).

## How it works

- **Firestore data**: one `games/{code}` doc (round state, written only by the host's client through transactions) plus a `games/{code}/players/{uid}` subcollection (each player writes only their own doc when banking).
- **Bank vs. bust race**: banking is a Firestore transaction that re-checks the round; if the host's 7 lands first, the bank cleanly fails with a "too late" message — never a double-count.
- **Identity**: Firebase Anonymous Auth; your uid is your player id, so a refresh rejoins automatically. The active game code is kept in localStorage for the Rejoin button.
- **Game logic** lives in pure, unit-tested functions in [src/game/logic.ts](src/game/logic.ts); Firestore I/O is isolated in [src/services/gameService.ts](src/services/gameService.ts).
