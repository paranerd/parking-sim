export type UpgradeId = 'spaces' | 'gate' | 'lighting' | 'restroom' | 'automation';

export interface GameState {
  cash: number;
  lifetimeRevenue: number;
  spaces: number;
  occupied: number;
  price: number;
  reputation: number;
  levels: Record<UpgradeId, number>;
  carsServed: number;
  day: number;
  minuteOfDay: number;
  condition: number;
  activeIncident: Incident | null;
  incidentCooldown: number;
  lastSavedAt: number;
}

export interface Incident {
  id: 'gate' | 'restroom' | 'lighting';
  title: string;
  description: string;
  repairCost: number;
}

export interface Upgrade {
  id: UpgradeId;
  name: string;
  description: string;
  icon: string;
  category: 'Ausbau' | 'Service' | 'Automation';
  maxLevel: number | null;
  baseCost: number;
  costMultiplier: number;
}

export const upgrades: Upgrade[] = [
  { id: 'spaces', name: 'Stellplatz bauen', description: '+1 Parkplatz – beliebig oft ausbaubar', icon: 'P', category: 'Ausbau', maxLevel: null, baseCost: 10, costMultiplier: 1.16 },
  { id: 'gate', name: 'Schnellere Schranke', description: 'Fahrzeuge werden schneller bedient', icon: '↗', category: 'Ausbau', maxLevel: 6, baseCost: 160, costMultiplier: 1.8 },
  { id: 'lighting', name: 'LED-Beleuchtung', description: 'Mehr Sicherheit und besserer Ruf', icon: '✦', category: 'Service', maxLevel: 3, baseCost: 240, costMultiplier: 2.1 },
  { id: 'restroom', name: 'Saubere Toiletten', description: 'Zufriedene Gäste bleiben länger', icon: '◆', category: 'Service', maxLevel: 3, baseCost: 320, costMultiplier: 2.1 },
  { id: 'automation', name: 'Kennzeichenerkennung', description: 'Mehr Offline-Ertrag, weniger Staus', icon: '◎', category: 'Automation', maxLevel: 3, baseCost: 650, costMultiplier: 2.6 },
];

export const INITIAL_STATE: GameState = {
  cash: 0,
  lifetimeRevenue: 0,
  spaces: 1,
  occupied: 1,
  price: 2.5,
  reputation: 3.6,
  levels: { spaces: 0, gate: 0, lighting: 0, restroom: 0, automation: 0 },
  carsServed: 0,
  day: 1,
  minuteOfDay: 8 * 60 + 30,
  condition: 100,
  activeIncident: null,
  incidentCooldown: 80,
  lastSavedAt: Date.now(),
};

export const upgradeCost = (upgrade: Upgrade, level: number): number =>
  Math.round(upgrade.baseCost * upgrade.costMultiplier ** level / 10) * 10;

/** Neutral price: guests react to how far the tariff sits above or below it. */
export const REFERENCE_PRICE = 2.5;
/** How strongly demand reacts to the price. Above 1 the market is elastic. */
export const PRICE_ELASTICITY = 1.6;

/**
 * Every increase of the hourly price costs demand, and it does so
 * progressively: doubling the tariff roughly thirds the number of arrivals.
 * Cheap parking attracts more guests, but the bonus is capped.
 */
export const priceDemandFactor = (price: number): number =>
  Math.min(1.8, (REFERENCE_PRICE / Math.max(0.5, price)) ** PRICE_ELASTICITY);

const timeOfDayFactor = (minuteOfDay: number): number => {
  const hour = minuteOfDay / 60;
  return hour >= 7 && hour <= 10 ? 1.25 : hour >= 16 && hour <= 19 ? 1.35 : hour >= 22 || hour <= 5 ? 0.45 : 0.85;
};

export const demandFactor = (state: GameState): number =>
  timeOfDayFactor(state.minuteOfDay) * priceDemandFactor(state.price) * (0.72 + state.reputation * 0.08);

/** Demand of a normal daytime hour at the reference price – the 100 % mark. */
const BASELINE_DEMAND = timeOfDayFactor(12 * 60) * (0.72 + INITIAL_STATE.reputation * 0.08);

/** Current demand relative to that baseline, e.g. 0.6 for "40 % below normal". */
export const demandLevel = (state: GameState): number => demandFactor(state) / BASELINE_DEMAND;

export const DEPARTURE_CHANCE = 0.12;

/** Probability that a car arrives during one tick. */
export const arrivalChance = (state: GameState): number =>
  (0.13 + state.levels.gate * 0.045 + state.levels.automation * 0.07) * demandFactor(state);

/** Share of spaces that stays occupied once arrivals and departures balance out. */
export const expectedOccupancyRate = (state: GameState): number => {
  const arrivals = Math.min(1, arrivalChance(state));
  return arrivals / (arrivals + DEPARTURE_CHANCE);
};

export const incomePerMinute = (state: GameState): number => {
  const incidentPenalty = state.activeIncident?.id === 'gate' ? 0.55 : 1;
  const comfort = 1 + state.levels.restroom * 0.08;
  return state.occupied * (state.price / 60) * comfort * incidentPenalty;
};

/** Game minutes that pass during one real-time second. */
export const MINUTES_PER_SECOND = 2;

/** Step of a single price adjustment in euros. */
export const PRICE_STEP = 0.1;

export const incomePerSecond = (state: GameState): number => incomePerMinute(state) * MINUTES_PER_SECOND;

/**
 * Advances the clock and books revenue for an arbitrary slice of real time so
 * cash grows continuously instead of jumping once per tick.
 */
export const advanceTime = (state: GameState, seconds: number): GameState => {
  if (!Number.isFinite(seconds) || seconds <= 0) return state;
  const next = structuredClone(state);
  const minutes = seconds * MINUTES_PER_SECOND;
  next.minuteOfDay += minutes;
  while (next.minuteOfDay >= 1440) {
    next.minuteOfDay -= 1440;
    next.day += 1;
  }

  const earned = incomePerMinute(next) * minutes;
  next.cash += earned;
  next.lifetimeRevenue += earned;
  return next;
};

export const setHourlyPrice = (state: GameState, price: number): GameState => {
  if (!Number.isFinite(price) || price < 0) return state;
  const rounded = Math.round(price * 100) / 100;
  if (rounded === state.price) return state;

  const next = structuredClone(state);
  next.price = rounded;
  return next;
};

/** Raises or lowers the hourly price by whole `PRICE_STEP` steps, never below zero. */
export const adjustHourlyPrice = (state: GameState, steps: number): GameState =>
  setHourlyPrice(state, Math.max(0, state.price + steps * PRICE_STEP));

/**
 * Discrete events of one real-time second: arrivals, departures, wear and
 * incidents. Revenue and the clock are handled by `advanceTime`.
 */
export const simulateTick = (state: GameState, random = Math.random): GameState => {
  const next: GameState = structuredClone(state);

  if (next.occupied < next.spaces && random() < arrivalChance(next)) next.occupied += 1;
  if (next.occupied > 0 && random() < DEPARTURE_CHANCE) {
    next.occupied -= 1;
    next.carsServed += 1;
  }

  const targetReputation = 3.4 + next.levels.lighting * 0.25 + next.levels.restroom * 0.3 - (next.activeIncident ? 0.35 : 0);
  next.reputation += (Math.min(5, targetReputation) - next.reputation) * 0.008;
  next.condition = Math.max(20, next.condition - 0.007 * (1 + next.spaces / 20));
  next.incidentCooldown -= 1;

  if (!next.activeIncident && next.incidentCooldown <= 0 && next.condition < 92 && random() < 0.018) {
    const incidents: Incident[] = [
      { id: 'gate', title: 'Schranke blockiert', description: 'Der Durchsatz ist reduziert.', repairCost: 90 },
      { id: 'restroom', title: 'Toilette gesperrt', description: 'Dein Ruf sinkt langsam.', repairCost: 70 },
      { id: 'lighting', title: 'Beleuchtung defekt', description: 'Gäste fühlen sich weniger sicher.', repairCost: 55 },
    ];
    const incident = incidents[Math.floor(random() * incidents.length)] ?? incidents[0];
    next.activeIncident = incident;
  }

  return next;
};

export const buyUpgrade = (state: GameState, id: UpgradeId): GameState => {
  const upgrade = upgrades.find((item) => item.id === id);
  if (!upgrade) return state;
  const level = state.levels[id];
  const cost = upgradeCost(upgrade, level);
  if ((upgrade.maxLevel !== null && level >= upgrade.maxLevel) || state.cash < cost) return state;

  const next = structuredClone(state);
  next.cash -= cost;
  next.levels[id] += 1;
  if (id === 'spaces') {
    next.spaces += 1;
    next.condition = Math.min(100, next.condition + 4);
  }
  return next;
};

export const repairIncident = (state: GameState): GameState => {
  if (!state.activeIncident || state.cash < state.activeIncident.repairCost) return state;
  const incident = state.activeIncident;
  const next = structuredClone(state);
  next.cash -= incident.repairCost;
  next.activeIncident = null;
  next.condition = Math.min(100, next.condition + 22);
  next.incidentCooldown = 100;
  return next;
};

export const performMaintenance = (state: GameState): GameState => {
  const cost = maintenanceCost(state);
  if (state.cash < cost || state.condition >= 99) return state;
  const next = structuredClone(state);
  next.cash -= cost;
  next.condition = 100;
  next.incidentCooldown = Math.max(100, next.incidentCooldown);
  return next;
};

export const maintenanceCost = (state: GameState): number => Math.round(35 + state.spaces * 2.5);

export const calculateOfflineProgress = (state: GameState, now: number): { state: GameState; earned: number; minutes: number } => {
  const elapsedMinutes = Math.max(0, Math.min(8 * 60, (now - state.lastSavedAt) / 60_000));
  const automationFactor = 0.45 + state.levels.automation * 0.15;
  // Offline demand follows the price just like the live simulation does.
  const averageOccupancy = state.spaces * expectedOccupancyRate(state);
  const earned = averageOccupancy * (state.price / 60) * elapsedMinutes * automationFactor;
  const next = structuredClone(state);
  next.cash += earned;
  next.lifetimeRevenue += earned;
  next.lastSavedAt = now;
  return { state: next, earned, minutes: elapsedMinutes };
};
