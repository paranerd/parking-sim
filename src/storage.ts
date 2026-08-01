import { calculateOfflineProgress, GameState, INITIAL_STATE } from './game';

const SAVE_KEY = 'parking-empire-save-v1';

export const loadGame = (now = Date.now()): { state: GameState; offlineEarned: number; offlineMinutes: number } => {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return { state: structuredClone(INITIAL_STATE), offlineEarned: 0, offlineMinutes: 0 };

  try {
    // `log` belonged to the removed chronicle and is dropped from old saves.
    const { log: _legacyLog, ...stored } = JSON.parse(raw) as GameState & { log?: unknown };
    const merged: GameState = {
      ...structuredClone(INITIAL_STATE),
      ...stored,
      levels: { ...INITIAL_STATE.levels, ...stored.levels },
    };
    const result = calculateOfflineProgress(merged, now);
    return { state: result.state, offlineEarned: result.earned, offlineMinutes: result.minutes };
  } catch {
    return { state: structuredClone(INITIAL_STATE), offlineEarned: 0, offlineMinutes: 0 };
  }
};

export const saveGame = (state: GameState): void => {
  localStorage.setItem(SAVE_KEY, JSON.stringify({ ...state, lastSavedAt: Date.now() }));
};

export const resetGame = (): void => localStorage.removeItem(SAVE_KEY);
