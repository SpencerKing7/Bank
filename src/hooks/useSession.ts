const ACTIVE_GAME_KEY = 'bank:activeGame';
const PLAYER_NAME_KEY = 'bank:playerName';

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
