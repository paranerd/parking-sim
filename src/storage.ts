import { calculateOfflineProgress, GameState, INITIAL_STATE, Incident, IncidentId, UpgradeId } from './game';

const SAVE_KEY = 'parking-empire-save-v1';

/** Upgrade ids of older versions and their closest counterpart today. */
const LEGACY_UPGRADE_IDS: Record<string, UpgradeId> = {
  restroom: 'cleaning',
  automation: 'payment',
  gate: 'shelter',
};

const INCIDENT_IDS: IncidentId[] = ['payment', 'cleaning', 'lighting'];

const number = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

/**
 * Builds a valid state from whatever is in storage: unknown keys are dropped,
 * missing ones fall back to the initial state, and values of older versions –
 * discrete `occupied` spaces, renamed upgrades – are converted.
 */
const migrate = (raw: Record<string, unknown>): GameState => {
  const base = structuredClone(INITIAL_STATE);
  const spaces = Math.max(1, Math.round(number(raw.spaces, base.spaces)));

  const levels = { ...base.levels };
  const storedLevels = (raw.levels ?? {}) as Record<string, unknown>;
  for (const [key, value] of Object.entries(storedLevels)) {
    const id = (LEGACY_UPGRADE_IDS[key] ?? key) as UpgradeId;
    if (id in levels) levels[id] = Math.max(levels[id], Math.max(0, Math.round(number(value, 0))));
  }

  const storedIncident = raw.activeIncident as Incident | null | undefined;
  const activeIncident = storedIncident && INCIDENT_IDS.includes(storedIncident.id) ? storedIncident : null;

  return {
    cash: Math.max(0, number(raw.cash, base.cash)),
    lifetimeRevenue: Math.max(0, number(raw.lifetimeRevenue, base.lifetimeRevenue)),
    spaces,
    // Saves before the continuous model counted occupied spaces instead.
    occupancy: Math.min(1, Math.max(0, number(raw.occupancy, number(raw.occupied, base.occupancy * spaces) / spaces))),
    price: Math.max(0, number(raw.price, base.price)),
    reputation: Math.min(5, Math.max(1, number(raw.reputation, base.reputation))),
    levels,
    carsServed: Math.max(0, number(raw.carsServed, base.carsServed)),
    day: Math.max(1, Math.round(number(raw.day, base.day))),
    minuteOfDay: Math.min(1439, Math.max(0, number(raw.minuteOfDay, base.minuteOfDay))),
    condition: Math.min(100, Math.max(20, number(raw.condition, base.condition))),
    activeIncident,
    incidentCooldown: number(raw.incidentCooldown, base.incidentCooldown),
    lastSavedAt: number(raw.lastSavedAt, Date.now()),
  };
};

export const loadGame = (now = Date.now()): { state: GameState; offlineEarned: number; offlineMinutes: number } => {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return { state: structuredClone(INITIAL_STATE), offlineEarned: 0, offlineMinutes: 0 };

  try {
    const result = calculateOfflineProgress(migrate(JSON.parse(raw) as Record<string, unknown>), now);
    return { state: result.state, offlineEarned: result.earned, offlineMinutes: result.minutes };
  } catch {
    return { state: structuredClone(INITIAL_STATE), offlineEarned: 0, offlineMinutes: 0 };
  }
};

export const saveGame = (state: GameState): void => {
  localStorage.setItem(SAVE_KEY, JSON.stringify({ ...state, lastSavedAt: Date.now() }));
};

export const resetGame = (): void => localStorage.removeItem(SAVE_KEY);
