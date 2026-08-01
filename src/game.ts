export type UpgradeId = 'location' | 'spaces' | 'lighting' | 'cleaning' | 'advertising' | 'payment' | 'shelter';
export type UpgradeCategory = 'Standort' | 'Kapazität' | 'Nachfrage' | 'Erlös';
export type IncidentId = 'surface' | 'payment' | 'cleaning' | 'lighting';

export interface GameState {
  cash: number;
  lifetimeRevenue: number;
  /** Capacity: how many cars can stand on the lot at the same time. */
  spaces: number;
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
  id: IncidentId;
  title: string;
  description: string;
  repairCost: number;
}

export interface Upgrade {
  id: UpgradeId;
  name: string;
  description: string;
  icon: string;
  category: UpgradeCategory;
  maxLevel: number | null;
  baseCost: number;
  costMultiplier: number;
  /** Named stages, index = level. Used by upgrades that replace themselves. */
  stages?: string[];
}

/**
 * The payment system decides how much of the parked time really reaches the
 * till – and what it costs per hour to run it. The honesty box is free but
 * leaky, a cashier collects far more but wants a salary.
 */
export const PAYMENT_STAGES = [
  { name: 'Kasse des Vertrauens', rate: 0.55, costPerHour: 0 },
  { name: 'Kassierer', rate: 0.78, costPerHour: 2.4 },
  { name: 'Kassenautomat', rate: 0.9, costPerHour: 0.5 },
  { name: 'Kennzeichenerkennung', rate: 0.99, costPerHour: 0.25 },
];

/**
 * The location sets the base demand: how many cars want to park here at all.
 * Better spots draw far more guests and carry a higher tariff, but the rent
 * has to be earned back every hour.
 */
export const LOCATIONS = [
  { name: 'Vorstadt', address: 'Sonnenallee 24', baseDemand: 1.8, rentPerHour: 0.25, willingnessFactor: 1 },
  { name: 'Einkaufsstraße', address: 'Marktplatz 8', baseDemand: 5.5, rentPerHour: 2.2, willingnessFactor: 1.4 },
  { name: 'Bahnhof', address: 'Bahnhofsplatz 1', baseDemand: 17, rentPerHour: 12, willingnessFactor: 1.9 },
  { name: 'Flughafen', address: 'Terminalring 3', baseDemand: 52, rentPerHour: 65, willingnessFactor: 3 },
];

export const upgrades: Upgrade[] = [
  { id: 'location', name: 'Standort verlegen', description: 'Ein besserer Standort bringt deutlich mehr Basis-Nachfrage – und mehr Miete', icon: '⚑', category: 'Standort', maxLevel: 3, baseCost: 120, costMultiplier: 8, stages: LOCATIONS.map((location) => location.name) },
  { id: 'spaces', name: 'Stellplatz bauen', description: '+1 Stellplatz – mehr Angebot für die Nachfrage', icon: 'P', category: 'Kapazität', maxLevel: null, baseCost: 10, costMultiplier: 1.12 },
  { id: 'lighting', name: 'LED-Beleuchtung', description: 'Sicheres Gefühl bei Nacht – mehr Nachfrage', icon: '✦', category: 'Nachfrage', maxLevel: 3, baseCost: 30, costMultiplier: 2.2 },
  { id: 'cleaning', name: 'Reinigungsdienst', description: 'Saubere Flächen und Toiletten – mehr Nachfrage', icon: '◆', category: 'Nachfrage', maxLevel: 3, baseCost: 45, costMultiplier: 2.2 },
  { id: 'advertising', name: 'Werbung', description: 'Mehr Menschen am Standort kennen deinen Parkplatz', icon: '▲', category: 'Nachfrage', maxLevel: 5, baseCost: 40, costMultiplier: 1.9 },
  { id: 'payment', name: 'Kassensystem', description: 'Weniger Gäste fahren ohne zu zahlen davon', icon: '€', category: 'Erlös', maxLevel: 3, baseCost: 55, costMultiplier: 2.8, stages: PAYMENT_STAGES.map((stage) => stage.name) },
  { id: 'shelter', name: 'Überdachung', description: 'Trockene Autos – Gäste akzeptieren höhere Tarife', icon: '⌂', category: 'Erlös', maxLevel: 3, baseCost: 90, costMultiplier: 2.5 },
];

export const INITIAL_STATE: GameState = {
  cash: 0,
  lifetimeRevenue: 0,
  spaces: 1,
  price: 2.5,
  reputation: 3.6,
  levels: { location: 0, spaces: 0, lighting: 0, cleaning: 0, advertising: 0, payment: 0, shelter: 0 },
  carsServed: 0,
  day: 1,
  minuteOfDay: 8 * 60 + 30,
  condition: 100,
  activeIncident: null,
  incidentCooldown: 80,
  lastSavedAt: Date.now(),
};

/** Game minutes that pass during one real-time second. */
export const MINUTES_PER_SECOND = 2;
/** Step of a single price adjustment in euros. */
export const PRICE_STEP = 0.1;

/** Hourly tariff the very first guests consider fair. */
export const BASE_WILLINGNESS = 2.5;
/** Above 1 the market is elastic: demand reacts more than proportionally. */
export const PRICE_ELASTICITY = 1.7;
/** How long an average guest stays – turns occupancy into served cars. */
export const AVERAGE_STAY_HOURS = 1.5;

/** Share of extra demand each upgrade level attracts. */
const DEMAND_PER_LEVEL: Record<UpgradeId, number> = { location: 0, spaces: 0, lighting: 0.18, cleaning: 0.22, advertising: 0.3, payment: 0, shelter: 0.08 };
const REPUTATION_PER_LEVEL: Record<UpgradeId, number> = { location: 0, spaces: 0, lighting: 0.25, cleaning: 0.3, advertising: 0, payment: 0, shelter: 0.15 };
/** Running cost per level and hour – lighting burns power, cleaning needs staff. */
const RUNNING_COST_PER_LEVEL: Record<UpgradeId, number> = { location: 0, spaces: 0, lighting: 0.15, cleaning: 0.35, advertising: 0.5, payment: 0, shelter: 0.1 };
/** Upkeep of a single space per hour. */
export const COST_PER_SPACE = 0.06;
/** Reputation lost when the lot turns away every single guest. */
const CONGESTION_PENALTY = 2.2;

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export const upgradeCost = (upgrade: Upgrade, level: number): number => {
  const raw = upgrade.baseCost * upgrade.costMultiplier ** level;
  return raw < 100 ? Math.round(raw) : Math.round(raw / 10) * 10;
};

export const paymentStage = (state: GameState): typeof PAYMENT_STAGES[number] =>
  PAYMENT_STAGES[Math.min(state.levels.payment, PAYMENT_STAGES.length - 1)];

export const currentLocation = (state: GameState): typeof LOCATIONS[number] =>
  LOCATIONS[Math.min(state.levels.location, LOCATIONS.length - 1)];

/** Share of the parked time that actually ends up in the till. */
export const paymentRate = (state: GameState): number =>
  paymentStage(state).rate * (state.activeIncident?.id === 'payment' ? 0.6 : 1);

/** Hourly tariff guests accept without looking for another lot. */
export const willingnessToPay = (state: GameState): number =>
  BASE_WILLINGNESS * currentLocation(state).willingnessFactor * (1 + state.levels.shelter * 0.1 + state.levels.payment * 0.06);

/** Extra demand from equipment: lighting, cleaning, advertising, shelter. */
export const equipmentFactor = (state: GameState): number =>
  1 + (Object.keys(DEMAND_PER_LEVEL) as UpgradeId[]).reduce((total, id) => total + state.levels[id] * DEMAND_PER_LEVEL[id], 0);

/** Reviews pull guests in or push them away. */
export const reputationFactor = (state: GameState): number => Math.max(0.25, 0.6 + state.reputation * 0.11);

/**
 * How many cars want to park here before the price enters the picture:
 * the base demand of the location, shaped by reviews and equipment.
 */
export const attraction = (state: GameState): number => {
  const incidentPenalty = state.activeIncident && state.activeIncident.id !== 'payment' ? 0.8 : 1;
  return currentLocation(state).baseDemand * equipmentFactor(state) * incidentPenalty * reputationFactor(state);
};

/** Even a free lot only draws the guests that pass by – the catchment limit. */
export const MAX_DEMAND_FACTOR = 3;

/**
 * Cars that want to park right now at the given price. Every euro above the
 * willingness to pay costs demand progressively, every euro below wins guests.
 */
export const demandAt = (state: GameState, price: number): number => {
  const priceFactor = Math.min(MAX_DEMAND_FACTOR, (willingnessToPay(state) / Math.max(0.25, price)) ** PRICE_ELASTICITY);
  return attraction(state) * priceFactor;
};

export const demand = (state: GameState): number => demandAt(state, state.price);

/**
 * The price at which demand exactly meets the capacity – the market clears.
 * It follows supply and demand: more spaces push it down, more attraction or a
 * higher willingness to pay push it up. If even the catchment limit cannot fill
 * the lot, it returns the cheapest price that still adds guests.
 */
export const marketPrice = (state: GameState): number => {
  const required = Math.min(MAX_DEMAND_FACTOR, Math.max(1e-6, Math.max(1, state.spaces) / attraction(state)));
  return willingnessToPay(state) / required ** (1 / PRICE_ELASTICITY);
};

/**
 * Share of the capacity that is taken – demand, capped at a full lot. It
 * follows the price without delay, so a new tariff shows in the profit at once.
 */
export const occupancy = (state: GameState): number => Math.min(1, demand(state) / Math.max(1, state.spaces));

/** Share of interested guests that finds no free space. */
export const turnedAwayShare = (state: GameState): number => {
  const wanted = demand(state);
  return wanted > state.spaces ? (wanted - state.spaces) / wanted : 0;
};

export const targetReputation = (state: GameState): number => {
  const upgradeBonus = (Object.keys(REPUTATION_PER_LEVEL) as UpgradeId[])
    .reduce((total, id) => total + state.levels[id] * REPUTATION_PER_LEVEL[id], 0);
  // A lot that is permanently full sends guests away, and they leave bad reviews.
  const congestion = CONGESTION_PENALTY * turnedAwayShare(state);
  return clamp(3.4 + upgradeBonus - congestion - (state.activeIncident ? 0.4 : 0), 1, 5);
};

/** Revenue per game hour: price × spaces × demand (max 100 %) × payment rate. */
export const revenuePerHour = (state: GameState): number =>
  state.price * state.spaces * occupancy(state) * paymentRate(state);

/** Rent, upkeep of the spaces and everything that runs on staff or power. */
export const fixedCostPerHour = (state: GameState): number => {
  const running = (Object.keys(RUNNING_COST_PER_LEVEL) as UpgradeId[])
    .reduce((total, id) => total + state.levels[id] * RUNNING_COST_PER_LEVEL[id], 0);
  return currentLocation(state).rentPerHour + state.spaces * COST_PER_SPACE + running + paymentStage(state).costPerHour;
};

/** Itemised fixed costs, in the order the explanation modal lists them. */
export const fixedCostItems = (state: GameState): { label: string; amount: number }[] => [
  { label: `Miete ${currentLocation(state).name}`, amount: currentLocation(state).rentPerHour },
  { label: `Fläche (${state.spaces} ${state.spaces === 1 ? 'Platz' : 'Plätze'})`, amount: state.spaces * COST_PER_SPACE },
  { label: paymentStage(state).name, amount: paymentStage(state).costPerHour },
  ...(Object.keys(RUNNING_COST_PER_LEVEL) as UpgradeId[])
    .filter((id) => state.levels[id] * RUNNING_COST_PER_LEVEL[id] > 0)
    .map((id) => ({
      label: upgrades.find((upgrade) => upgrade.id === id)?.name ?? id,
      amount: state.levels[id] * RUNNING_COST_PER_LEVEL[id],
    })),
].filter((item) => item.amount > 0);

/** What actually stays: revenue minus the fixed costs. Can be negative. */
export const profitPerHour = (state: GameState): number => revenuePerHour(state) - fixedCostPerHour(state);

export const profitPerMinute = (state: GameState): number => profitPerHour(state) / 60;

export const profitPerSecond = (state: GameState): number => profitPerMinute(state) * MINUTES_PER_SECOND;

/** Time constants in real-time seconds. */
const REPUTATION_TAU = 120;
const CONDITION_WEAR_PER_MINUTE = 0.0035;

/** Frame-rate independent share of the remaining distance to cover. */
const ease = (seconds: number, tau: number): number => 1 - Math.exp(-seconds / tau);

/**
 * All continuous dynamics for an arbitrary slice of real time: the clock, the
 * lot filling up or emptying, revenue, reviews and wear. Called every frame, so
 * cash and occupancy flow instead of jumping.
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

  // The fixed costs run whether or not a single car shows up, but the account
  // stops at zero – an empty till cannot go into debt.
  next.cash = Math.max(0, next.cash + profitPerMinute(next) * minutes);
  next.lifetimeRevenue += revenuePerHour(next) / 60 * minutes;
  next.carsServed += occupancy(next) * next.spaces * (minutes / 60) / AVERAGE_STAY_HOURS;

  next.reputation += (targetReputation(next) - next.reputation) * ease(seconds, REPUTATION_TAU);
  next.condition = Math.max(20, next.condition - CONDITION_WEAR_PER_MINUTE * minutes * (1 + next.spaces / 20));
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
 * Only things that exist can break. The surface is always there, everything
 * else needs the matching upgrade – no broken toilet without a cleaning crew.
 * `hours` is how many hours of takings the repair costs.
 */
const INCIDENT_KINDS: { id: IncidentId; title: string; description: string; requires?: UpgradeId; hours: number }[] = [
  { id: 'surface', title: 'Schlagloch in der Fahrbahn', description: 'Gäste meiden den Platz, bis es geflickt ist.', hours: 1.2 },
  { id: 'lighting', title: 'Beleuchtung defekt', description: 'Abends kommen weniger Gäste.', requires: 'lighting', hours: 1.5 },
  { id: 'cleaning', title: 'Toilette gesperrt', description: 'Gäste meiden den Parkplatz.', requires: 'cleaning', hours: 1.5 },
  { id: 'payment', title: 'Kasse gestört', description: 'Ein Teil der Einnahmen kommt nicht an.', requires: 'payment', hours: 2 },
];

/** What can break on this lot right now. */
export const possibleIncidents = (state: GameState): IncidentId[] =>
  INCIDENT_KINDS.filter((kind) => !kind.requires || state.levels[kind.requires] > 0).map((kind) => kind.id);

/**
 * What the lot could take in per hour if it were priced at the market and
 * filled up. Repairs and maintenance are measured against this, so they never
 * cost more than a small parking lot can possibly earn.
 */
export const earningPower = (state: GameState): number => {
  const price = marketPrice(state);
  const priced = { ...state, price };
  return revenuePerHour(priced);
};

/** A repair costs a couple of hours of takings – never a fixed sum. */
export const repairPrice = (state: GameState, hours: number): number =>
  Math.max(3, Math.round(earningPower(state) * hours));

/** The one discrete event per real-time second: something breaks, or it doesn't. */
export const simulateTick = (state: GameState, random = Math.random): GameState => {
  const next: GameState = structuredClone(state);
  next.incidentCooldown -= 1;

  if (!next.activeIncident && next.incidentCooldown <= 0 && next.condition < 92 && random() < 0.018) {
    const candidates = INCIDENT_KINDS.filter((kind) => !kind.requires || next.levels[kind.requires] > 0);
    const kind = candidates[Math.floor(random() * candidates.length)] ?? candidates[0];
    if (kind) {
      next.activeIncident = { id: kind.id, title: kind.title, description: kind.description, repairCost: repairPrice(next, kind.hours) };
    }
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

/** How the fixed costs per hour change when this upgrade is bought. */
export const runningCostChange = (state: GameState, id: UpgradeId): number =>
  fixedCostPerHour(buyUpgrade({ ...state, cash: Number.MAX_SAFE_INTEGER }, id)) - fixedCostPerHour(state);

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

/** Preventive maintenance costs about an hour of takings. */
export const maintenanceCost = (state: GameState): number => repairPrice(state, 1);

/** At most this much real time is credited after an absence. */
export const AWAY_CAP_MINUTES = 8 * 60;

export interface AwayReport {
  state: GameState;
  /** Real minutes actually credited. */
  minutes: number;
  /** Real minutes the player was gone, before the cap. */
  awayMinutes: number;
  capped: boolean;
  gameHours: number;
  gameDays: number;
  revenue: number;
  costs: number;
  earned: number;
  cars: number;
  occupancy: number;
  attendedShare: number;
}

/**
 * Books an absence – tab in the background or browser closed. Real time counts
 * exactly as it does during play (one real second is `MINUTES_PER_SECOND` game
 * minutes); only a share of the takings arrives without anybody watching,
 * while rent and running costs are due in full.
 */
export const simulateAway = (state: GameState, realMinutes: number): AwayReport => {
  const awayMinutes = Math.max(0, realMinutes);
  const minutes = Math.min(AWAY_CAP_MINUTES, awayMinutes);
  const gameHours = minutes * 60 * MINUTES_PER_SECOND / 60;
  const attendedShare = Math.min(1, 0.4 + state.levels.payment * 0.1);

  const filled = occupancy(state);
  const revenue = revenuePerHour(state) * gameHours * attendedShare;
  const costs = fixedCostPerHour(state) * gameHours;
  const earned = revenue - costs;

  const next = structuredClone(state);
  next.cash = Math.max(0, next.cash + earned);
  next.lifetimeRevenue += revenue;
  next.carsServed += filled * next.spaces * gameHours / AVERAGE_STAY_HOURS;

  const totalMinutes = next.minuteOfDay + gameHours * 60;
  next.minuteOfDay = totalMinutes % 1440;
  const gameDays = Math.floor(totalMinutes / 1440);
  next.day += gameDays;
  // Nobody maintains the lot while you are gone.
  next.condition = Math.max(20, next.condition - CONDITION_WEAR_PER_MINUTE * gameHours * 60 * (1 + next.spaces / 20));

  return {
    state: next,
    minutes,
    awayMinutes,
    capped: awayMinutes > AWAY_CAP_MINUTES,
    gameHours,
    gameDays,
    revenue,
    costs,
    earned,
    cars: filled * next.spaces * gameHours / AVERAGE_STAY_HOURS,
    occupancy: filled,
    attendedShare,
  };
};

export const calculateOfflineProgress = (state: GameState, now: number): AwayReport => {
  const report = simulateAway(state, (now - state.lastSavedAt) / 60_000);
  report.state.lastSavedAt = now;
  return report;
};
