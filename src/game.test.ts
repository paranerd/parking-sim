import { describe, expect, it, vi } from 'vitest';
import {
  adjustHourlyPrice,
  advanceTime,
  BASE_WILLINGNESS,
  buyUpgrade,
  calculateOfflineProgress,
  demand,
  earningPower,
  demandAt,
  GameState,
  currentLocation,
  fixedCostPerHour,
  INITIAL_STATE,
  LOCATIONS,
  maintenanceCost,
  marketPrice,
  MAX_DEMAND_FACTOR,
  MINUTES_PER_SECOND,
  paymentRate,
  paymentStage,
  possibleIncidents,
  performMaintenance,
  PRICE_STEP,
  repairIncident,
  profitPerHour,
  profitPerSecond,
  revenuePerHour,
  simulateAway,
  simulateTick,
  targetOccupancy,
  targetReputation,
  turnedAwayShare,
  UpgradeId,
  upgradeCost,
  upgrades,
  willingnessToPay,
} from './game';

const freshState = (): GameState => structuredClone(INITIAL_STATE);

/** State after `seconds` of continuous simulation, without random events. */
const run = (state: GameState, seconds: number, stepSize = 0.5): GameState => {
  let current = state;
  for (let elapsed = 0; elapsed < seconds; elapsed += stepSize) current = advanceTime(current, stepSize);
  return current;
};

const spaceUpgrade = upgrades.find((upgrade) => upgrade.id === 'spaces')!;

const withLevel = (state: GameState, id: UpgradeId, level: number): GameState =>
  ({ ...state, levels: { ...state.levels, [id]: level } });

describe('continuous operation', () => {
  it('earns without any discrete space being occupied', () => {
    const state = freshState();
    const next = advanceTime(state, 1);
    expect(next.cash).toBeGreaterThan(0);
    expect(next.minuteOfDay).toBe(state.minuteOfDay + MINUTES_PER_SECOND);
  });

  it('books revenue continuously for fractions of a second', () => {
    const state = freshState();
    const partial = advanceTime(state, 0.25);
    expect(partial.cash).toBeGreaterThan(0);
    expect(partial.cash).toBeLessThan(advanceTime(state, 1).cash);
    expect(advanceTime(state, 0)).toBe(state);
  });

  it('accrues about the same revenue in small slices as in one step', () => {
    const state = freshState();
    const single = advanceTime(state, 1);
    let sliced = state;
    for (let index = 0; index < 20; index += 1) sliced = advanceTime(sliced, 0.05);
    expect(sliced.cash).toBeCloseTo(single.cash, 3);
    expect(sliced.occupancy).toBeCloseTo(single.occupancy, 3);
  });

  it('lets occupancy glide towards its target instead of jumping', () => {
    const state = { ...freshState(), occupancy: 0.1 };
    const target = targetOccupancy(state);
    const short = advanceTime(state, 1);
    expect(short.occupancy).toBeGreaterThan(state.occupancy);
    expect(short.occupancy).toBeLessThan(target);
    expect(run(state, 60).occupancy).toBeCloseTo(target, 2);
  });

  it('moves to the next day after midnight', () => {
    const state = { ...freshState(), minuteOfDay: 1439 };
    const next = advanceTime(state, 1);
    expect(next.day).toBe(2);
    expect(next.minuteOfDay).toBe(1);
  });

  it('reports the profit of one real-time second', () => {
    const state = freshState();
    expect(profitPerSecond(state)).toBeCloseTo(profitPerHour(state) / 60 * MINUTES_PER_SECOND);
  });

  it('leaves the money untouched during an event tick', () => {
    const state = freshState();
    const next = simulateTick(state, () => 1);
    expect(next.cash).toBe(state.cash);
    expect(next.minuteOfDay).toBe(state.minuteOfDay);
    expect(next.occupancy).toBe(state.occupancy);
  });
});

describe('supply, demand and price', () => {
  it('follows the agreed formula: price x spaces x demand x payment rate', () => {
    const state = { ...freshState(), occupancy: 0.7, spaces: 1, price: 2.5 };
    // Szenario 1 of the spec: (2,50 x 1 x 0,7 x 0,55) - 0 = 0,963 EUR/h
    const free = { ...state, levels: { ...state.levels, spaces: 0 } };
    expect(revenuePerHour(free)).toBeCloseTo(0.9625, 4);
    expect(revenuePerHour(free) - fixedCostPerHour(free)).toBeCloseTo(profitPerHour(free), 6);

    // Szenario 2: the same at two spaces is exactly twice as much revenue.
    expect(revenuePerHour({ ...free, spaces: 2 })).toBeCloseTo(1.925, 4);
  });

  it('subtracts the fixed costs from the revenue', () => {
    const state = freshState();
    expect(fixedCostPerHour(state)).toBeCloseTo(currentLocation(state).rentPerHour + state.spaces * 0.06, 6);
    expect(profitPerHour(state)).toBeCloseTo(revenuePerHour(state) - fixedCostPerHour(state), 6);
    // Fixed costs grow with spaces, running upgrades and the rent of the location.
    expect(fixedCostPerHour({ ...state, spaces: 20 })).toBeGreaterThan(fixedCostPerHour(state));
    expect(fixedCostPerHour(withLevel(state, 'cleaning', 3))).toBeGreaterThan(fixedCostPerHour(state));
    expect(fixedCostPerHour(withLevel(state, 'location', 3))).toBeGreaterThan(fixedCostPerHour(state) * 10);
  });

  it('lets a cashier cost more than he collects on a tiny lot', () => {
    const tiny = { ...freshState(), occupancy: 1 };
    const withCashier = withLevel(tiny, 'payment', 1);
    expect(revenuePerHour(withCashier)).toBeGreaterThan(revenuePerHour(tiny));
    expect(profitPerHour(withCashier)).toBeLessThan(profitPerHour(tiny));

    // On a big lot the same salary pays for itself many times over.
    const big = { ...tiny, spaces: 40 };
    expect(profitPerHour(withLevel(big, 'payment', 1))).toBeGreaterThan(profitPerHour(big));
  });

  it('lowers demand for every price increase and raises it for every cut', () => {
    const state = freshState();
    expect(demandAt(state, 5)).toBeLessThan(demandAt(state, 2.5));
    expect(demandAt(state, 10)).toBeLessThan(demandAt(state, 5));
    expect(demandAt(state, 1.5)).toBeGreaterThan(demandAt(state, 2.5));
  });

  it('reacts progressively: doubling the price costs more than half the demand', () => {
    const state = freshState();
    expect(demandAt(state, BASE_WILLINGNESS * 2)).toBeLessThan(demandAt(state, BASE_WILLINGNESS) * 0.5);
  });

  it('turns capacity into supply that caps the occupancy', () => {
    const crowded = { ...freshState(), spaces: 1 };
    expect(demand(crowded)).toBeGreaterThan(crowded.spaces);
    expect(targetOccupancy(crowded)).toBe(1);
    expect(turnedAwayShare(crowded)).toBeGreaterThan(0);

    const roomy = { ...crowded, spaces: 12 };
    expect(targetOccupancy(roomy)).toBeLessThan(1);
    expect(turnedAwayShare(roomy)).toBe(0);
  });

  it('derives the optimal price from supply and demand instead of a fixed value', () => {
    const state = freshState();
    const base = marketPrice(state);

    // More supply at the same demand clears at a lower price …
    expect(marketPrice({ ...state, spaces: 8 })).toBeLessThan(base);
    // … more demand or a higher willingness to pay at a higher one.
    expect(marketPrice(withLevel(state, 'advertising', 3))).toBeGreaterThan(base);
    expect(marketPrice(withLevel(state, 'shelter', 3))).toBeGreaterThan(base);
  });

  it('clears the market exactly at the market price', () => {
    const state = { ...freshState(), spaces: 3 };
    const clearing = marketPrice(state);
    expect(demandAt(state, clearing)).toBeCloseTo(state.spaces, 6);
    expect(demandAt(state, clearing * 1.2)).toBeLessThan(state.spaces);
    expect(demandAt(state, clearing * 0.8)).toBeGreaterThan(state.spaces);
  });

  it('caps demand at the catchment area, so huge lots stay half empty', () => {
    const oversized = { ...freshState(), spaces: 40 };
    const floorPrice = marketPrice(oversized);
    expect(demandAt(oversized, floorPrice)).toBeLessThan(oversized.spaces);
    // Below that price the guests do not multiply any further – only the takings shrink.
    expect(demandAt(oversized, floorPrice / 4)).toBeCloseTo(demandAt(oversized, floorPrice), 6);
    expect(demandAt(oversized, 0)).toBeCloseTo(demandAt(oversized, floorPrice), 6);
    expect(demandAt(oversized, floorPrice)).toBeCloseTo(demandAt(oversized, BASE_WILLINGNESS) * MAX_DEMAND_FACTOR, 6);
  });

  it('makes the revenue optimum follow the market price, not a fixed tariff', () => {
    const revenueAt = (state: GameState, price: number): number =>
      Math.min(1, demandAt(state, price) / state.spaces) * state.spaces * price;
    const bestPrice = (state: GameState): number => {
      let best = 0.5;
      for (let price = 0.5; price < 40; price += 0.05) if (revenueAt(state, price) > revenueAt(state, best)) best = price;
      return best;
    };

    const small = { ...freshState(), spaces: 2 };
    const large = { ...small, spaces: 20 };
    expect(bestPrice(small)).toBeCloseTo(marketPrice(small), 1);
    expect(bestPrice(large)).toBeCloseTo(marketPrice(large), 1);
    expect(bestPrice(large)).toBeLessThan(bestPrice(small));
  });
});

describe('upgrades', () => {
  it('buys a space and dilutes the occupied share', () => {
    const state = { ...freshState(), cash: 50, occupancy: 1 };
    const next = buyUpgrade(state, 'spaces');
    expect(next.spaces).toBe(2);
    expect(next.occupancy).toBeCloseTo(0.5);
    expect(next.cash).toBe(state.cash - upgradeCost(spaceUpgrade, 0));
  });

  it('moves up the location chain and raises the base demand', () => {
    const state = { ...freshState(), cash: 100_000 };
    expect(currentLocation(state).name).toBe('Vorstadt');
    const moved = buyUpgrade(state, 'location');
    expect(currentLocation(moved).name).toBe(LOCATIONS[1].name);
    expect(demand(moved)).toBeGreaterThan(demand(state) * 2);
    // The better spot also carries a higher tariff and a higher rent.
    expect(willingnessToPay(moved)).toBeGreaterThan(willingnessToPay(state));
    expect(fixedCostPerHour(moved)).toBeGreaterThan(fixedCostPerHour(state));

    const airport = LOCATIONS.reduce((current) => buyUpgrade(current, 'location'), state);
    expect(currentLocation(airport).name).toBe('Flughafen');
    expect(buyUpgrade(airport, 'location').levels.location).toBe(3);
  });

  it('allows unlimited space upgrades', () => {
    const state = { ...freshState(), cash: Number.MAX_SAFE_INTEGER };
    expect(buyUpgrade(withLevel(state, 'spaces', 100), 'spaces').spaces).toBe(2);
  });

  it('lets demand upgrades attract more guests', () => {
    const state = freshState();
    for (const id of ['lighting', 'cleaning', 'advertising'] as UpgradeId[]) {
      expect(demand(withLevel(state, id, 2))).toBeGreaterThan(demand(state));
    }
  });

  it('starts with the honesty box and improves the payment rate step by step', () => {
    const state = freshState();
    expect(paymentStage(state).name).toBe('Kasse des Vertrauens');
    expect(paymentRate(state)).toBeLessThan(0.6);

    const rates = [0, 1, 2, 3].map((level) => paymentRate(withLevel(state, 'payment', level)));
    expect(rates).toEqual([...rates].sort((a, b) => a - b));
    expect(paymentStage(withLevel(state, 'payment', 3)).name).toBe('Kennzeichenerkennung');
    expect(paymentRate(withLevel(state, 'payment', 3))).toBeGreaterThan(0.95);
  });

  it('lets payment and shelter upgrades raise the willingness to pay', () => {
    const state = freshState();
    expect(willingnessToPay(state)).toBe(BASE_WILLINGNESS);
    expect(willingnessToPay(withLevel(state, 'shelter', 3))).toBeGreaterThan(BASE_WILLINGNESS);
    expect(willingnessToPay(withLevel(state, 'payment', 3))).toBeGreaterThan(BASE_WILLINGNESS);
  });

  it('does not upgrade an unaffordable state', () => {
    const state = { ...freshState(), cash: 0 };
    expect(buyUpgrade(state, 'advertising')).toBe(state);
  });

  it('rounds small costs to euros and large ones to tens', () => {
    expect(upgradeCost(spaceUpgrade, 0)).toBe(10);
    expect(upgradeCost(spaceUpgrade, 1)).toBe(11);
    expect(upgradeCost(spaceUpgrade, 30) % 10).toBe(0);
  });
});

describe('reviews', () => {
  it('punishes a permanently full lot with worse reviews', () => {
    const overfull = { ...freshState(), spaces: 1, price: 1 };
    expect(turnedAwayShare(overfull)).toBeGreaterThan(0.3);
    expect(targetReputation(overfull)).toBeLessThan(overfull.reputation);

    const balanced = { ...overfull, price: marketPrice(overfull) };
    expect(turnedAwayShare(balanced)).toBeCloseTo(0, 6);
    expect(targetReputation(balanced)).toBeGreaterThan(targetReputation(overfull));
  });

  it('feeds bad reviews back into weaker demand', () => {
    const overfull = { ...freshState(), spaces: 1, price: 1 };
    const later = run(overfull, 300);
    expect(later.reputation).toBeLessThan(overfull.reputation);
    expect(demandAt(later, 2.5)).toBeLessThan(demandAt(overfull, 2.5));
  });

  it('recovers reputation once the price balances supply and demand', () => {
    const strained = { ...freshState(), spaces: 1, price: 1, reputation: 2 };
    const priced = { ...strained, price: marketPrice(strained) * 1.1 };
    expect(run(priced, 300).reputation).toBeGreaterThan(strained.reputation);
  });
});

describe('price control', () => {
  it('sets any non-negative hourly price without charging cash', () => {
    const state = freshState();
    expect(adjustHourlyPrice(state, 1).price).toBe(2.6);
    expect(adjustHourlyPrice(state, 1).cash).toBe(state.cash);
    expect(adjustHourlyPrice(adjustHourlyPrice(adjustHourlyPrice(state, 1), 1), 1).price).toBe(2.8);
  });

  it('steps down to zero and stops there', () => {
    let lowered = freshState();
    for (let index = 0; index < 100; index += 1) lowered = adjustHourlyPrice(lowered, -1);
    expect(lowered.price).toBe(0);
    expect(adjustHourlyPrice(lowered, -1)).toBe(lowered);
    expect(PRICE_STEP).toBe(0.1);
  });
});

describe('maintenance and incidents', () => {
  it('repairs an incident and improves condition', () => {
    const state = { ...freshState(), cash: 350, condition: 50, activeIncident: { id: 'payment' as const, title: 'Defekt', description: 'Test', repairCost: 90 } };
    const next = repairIncident(state);
    expect(next.activeIncident).toBeNull();
    expect(next.condition).toBe(72);
    expect(next.cash).toBe(260);
  });

  it('performs preventive maintenance', () => {
    const state = { ...freshState(), cash: 350, condition: 60 };
    const next = performMaintenance(state);
    expect(next.condition).toBe(100);
    expect(next.cash).toBe(state.cash - maintenanceCost(state));
  });

  it('can trigger a bounded incident after the cooldown', () => {
    const state = { ...freshState(), condition: 70, incidentCooldown: 0 };
    const next = simulateTick(state, vi.fn().mockReturnValue(0));
    expect(next.activeIncident).not.toBeNull();
    expect(next.activeIncident?.repairCost).toBeGreaterThan(0);
  });

  it('lets a broken till cut the collected share', () => {
    const state = freshState();
    const broken = { ...state, activeIncident: { id: 'payment' as const, title: 'Kasse gestört', description: 'Test', repairCost: 90 } };
    expect(paymentRate(broken)).toBeLessThan(paymentRate(state));
  });

  it('lets a service incident cut the demand', () => {
    const state = freshState();
    const broken = { ...state, activeIncident: { id: 'lighting' as const, title: 'Beleuchtung defekt', description: 'Test', repairCost: 55 } };
    expect(demand(broken)).toBeLessThan(demand(state));
  });
});

describe('incidents only hit what exists', () => {
  const breakSomething = (state: GameState): GameState =>
    simulateTick({ ...state, condition: 70, incidentCooldown: 0 }, vi.fn().mockReturnValue(0));

  it('never breaks a toilet that was never built', () => {
    const bare = freshState();
    expect(possibleIncidents(bare)).toEqual(['surface']);
    expect(breakSomething(bare).activeIncident?.id).toBe('surface');

    const equipped = withLevel(withLevel(bare, 'cleaning', 1), 'payment', 1);
    expect(possibleIncidents(equipped)).toContain('cleaning');
    expect(possibleIncidents(equipped)).toContain('payment');
  });

  it('prices a repair in hours of takings, not in a fixed sum', () => {
    const small = breakSomething(freshState());
    expect(small.activeIncident!.repairCost).toBeLessThan(5);
    expect(small.activeIncident!.repairCost).toBeGreaterThan(0);

    const big = breakSomething({ ...freshState(), spaces: 30, levels: { ...INITIAL_STATE.levels, location: 2, spaces: 29 } });
    expect(big.activeIncident!.repairCost).toBeGreaterThan(small.activeIncident!.repairCost * 20);
    // Still affordable: about an hour or two of what the lot can take in.
    expect(big.activeIncident!.repairCost).toBeLessThan(earningPower(big) * 3);
  });

  it('scales maintenance with the lot instead of a flat fee', () => {
    const small = freshState();
    expect(maintenanceCost(small)).toBeLessThan(5);
    expect(maintenanceCost({ ...small, spaces: 30 })).toBeGreaterThan(maintenanceCost(small));
  });
});

describe('away progress', () => {
  it('counts absence on the same clock as playing', () => {
    const state = { ...freshState(), spaces: 4, occupancy: 1 };
    // One real minute is MINUTES_PER_SECOND * 60 game minutes.
    const report = simulateAway(state, 1);
    expect(report.gameHours).toBeCloseTo(2, 6);
    expect(report.revenue).toBeGreaterThan(0);
    expect(report.state.day).toBe(state.day);
    expect(report.state.minuteOfDay).toBeCloseTo(state.minuteOfDay + 120, 6);
  });

  it('earns roughly what an attended hour of play earns, minus the missing supervision', () => {
    const state = { ...freshState(), spaces: 4, occupancy: 1, price: 3 };
    const played = profitPerSecond({ ...state, occupancy: targetOccupancy(state) }) * 600;
    const away = simulateAway(state, 10).earned;
    expect(away).toBeGreaterThan(played * 0.2);
    expect(away).toBeLessThan(played);
  });

  it('caps at eight hours and rewards the payment system', () => {
    const state = { ...freshState(), lastSavedAt: 1_000 };
    const base = calculateOfflineProgress(state, 1_000 + 24 * 60 * 60_000);
    const automated = calculateOfflineProgress(withLevel(state, 'payment', 3), 1_000 + 24 * 60 * 60_000);
    expect(base.minutes).toBe(480);
    expect(base.capped).toBe(true);
    expect(base.awayMinutes).toBe(24 * 60);
    expect(automated.earned).toBeGreaterThan(base.earned);
  });

  it('keeps the account from going into debt while away', () => {
    const bleeding = { ...freshState(), cash: 2, spaces: 30, price: 0.2, levels: { ...INITIAL_STATE.levels, location: 3, spaces: 29 } };
    const report = simulateAway(bleeding, 120);
    expect(report.earned).toBeLessThan(0);
    expect(report.state.cash).toBe(0);
  });

  it('lets the price throttle away income as well', () => {
    const state = { ...freshState(), spaces: 6, lastSavedAt: 0 };
    const normal = calculateOfflineProgress(state, 60 * 60_000);
    const dearer = calculateOfflineProgress({ ...state, price: 30 }, 60 * 60_000);
    expect(dearer.earned).toBeLessThan(normal.earned);
  });
});
