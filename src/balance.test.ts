import { describe, expect, it } from 'vitest';
import {
  advanceTime,
  buyUpgrade,
  GameState,
  INITIAL_STATE,
  incomePerSecond,
  marketPrice,
  setHourlyPrice,
  simulateTick,
  targetOccupancy,
  UpgradeId,
  upgradeCost,
  upgrades,
} from './game';

/** Income the state settles on once it is priced at the market and filled up. */
const settledIncome = (state: GameState): number => {
  const priced = setHourlyPrice(state, Math.max(0.1, marketPrice(state)));
  return incomePerSecond({ ...priced, occupancy: targetOccupancy(priced) });
};

/**
 * A patient player: prices at the market and saves up for the upgrade with the
 * best income per euro instead of buying the cheapest thing on the shelf.
 */
const playSecond = (state: GameState, second: number): GameState => {
  let next = simulateTick(advanceTime(state, 1), () => 1);
  if (second % 5 === 0) next = setHourlyPrice(next, Math.max(0.1, Math.round(marketPrice(next) * 10) / 10));

  for (;;) {
    const current = settledIncome(next);
    const best = upgrades
      .filter((upgrade) => upgrade.maxLevel === null || next.levels[upgrade.id] < upgrade.maxLevel)
      .map((upgrade) => {
        const cost = upgradeCost(upgrade, next.levels[upgrade.id]);
        const bought = buyUpgrade({ ...next, cash: cost }, upgrade.id as UpgradeId);
        return { id: upgrade.id as UpgradeId, cost, gain: (settledIncome(bought) - current) / cost };
      })
      .sort((a, b) => b.gain - a.gain)[0];
    if (!best || best.gain <= 0 || best.cost > next.cash) break;
    next = buyUpgrade(next, best.id);
  }
  return next;
};

const play = (minutes: number): GameState => {
  let state = structuredClone(INITIAL_STATE);
  for (let second = 1; second <= minutes * 60; second += 1) state = playSecond(state, second);
  return state;
};

describe('balance', () => {
  it('keeps a reasonable player growing for an hour', () => {
    const start = structuredClone(INITIAL_STATE);
    const after = play(60);

    expect(settledIncome(after)).toBeGreaterThan(settledIncome(start) * 4);
    expect(after.lifetimeRevenue).toBeGreaterThan(150);
    // Growth comes from all three levers, not from capacity alone.
    expect(after.spaces).toBeGreaterThan(5);
    expect(after.levels.advertising + after.levels.lighting + after.levels.cleaning).toBeGreaterThan(2);
    expect(after.levels.payment).toBeGreaterThan(0);
  });

  it('moves the optimal price as the lot grows', () => {
    const early = structuredClone(INITIAL_STATE);
    const late = play(30);
    expect(Math.abs(marketPrice(late) - marketPrice(early))).toBeGreaterThan(0.1);
  });
});
