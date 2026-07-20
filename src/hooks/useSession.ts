const ACTIVE_GAME_KEY = 'bank:activeGame';
const PLAYER_NAME_KEY = 'bank:playerName';
const KEEP_AWAKE_KEY = 'bank:keepAwake';

export function getActiveGameCode(): string | null {
  try {
    return localStorage.getItem(ACTIVE_GAME_KEY);
  } catch {
    return null;
  }
}

export function setActiveGameCode(code: string): void {
  try {
    localStorage.setItem(ACTIVE_GAME_KEY, code);
  } catch {}
}

export function clearActiveGameCode(): void {
  try {
    localStorage.removeItem(ACTIVE_GAME_KEY);
  } catch {}
}

export function getSavedPlayerName(): string {
  try {
    return localStorage.getItem(PLAYER_NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

export function savePlayerName(name: string): void {
  try {
    localStorage.setItem(PLAYER_NAME_KEY, name);
  } catch {}
}

// On by default — a phone locking mid-round is the problem, so the fix should
// not need finding first. Only an explicit '0' turns it off, and that choice is
// sticky across games; an unset key (and a storage failure) means on.
export function getKeepAwake(): boolean {
  try {
    return localStorage.getItem(KEEP_AWAKE_KEY) !== '0';
  } catch {
    return true;
  }
}

export function saveKeepAwake(on: boolean): void {
  try {
    localStorage.setItem(KEEP_AWAKE_KEY, on ? '1' : '0');
  } catch {}
}
