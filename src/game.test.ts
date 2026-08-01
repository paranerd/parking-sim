import { describe, expect, it, vi } from 'vitest';
import {
  buyUpgrade,
  calculateOfflineProgress,
  incomePerMinute,
  incomePerSecond,
  INITIAL_STATE,
  maintenanceCost,
  performMaintenance,
  repairIncident,
  setHourlyPrice,
  simulateTick,
  upgradeCost,
  upgrades,
} from './game';

const freshState = () => structuredClone(INITIAL_STATE);

describe('parking simulation', () => {
  it('earns passive income and advances time', () => {
    const state = freshState();
    const next = simulateTick(state, () => 1);
    expect(next.cash).toBeGreaterThan(state.cash);
    expect(next.minuteOfDay).toBe(state.minuteOfDay + 2);
    expect(next.occupied).toBe(state.occupied);
  });

  it('starts with one occupied space and no capital', () => {
    expect(INITIAL_STATE.cash).toBe(0);
    expect(INITIAL_STATE.spaces).toBe(1);
    expect(INITIAL_STATE.occupied).toBe(1);
  });

  it('moves to the next day after midnight', () => {
    const state = freshState();
    state.minuteOfDay = 1439;
    const next = simulateTick(state, () => 1);
    expect(next.day).toBe(2);
    expect(next.minuteOfDay).toBe(1);
  });

  it('buys a space upgrade when affordable', () => {
    const state = freshState();
    const upgrade = upgrades.find((item) => item.id === 'spaces');
    expect(upgrade).toBeDefined();
    const cost = upgradeCost(upgrade!, 0);
    state.cash = cost;
    const next = buyUpgrade(state, 'spaces');
    expect(next.cash).toBe(0);
    expect(next.spaces).toBe(2);
    expect(next.levels.spaces).toBe(1);
  });

  it('allows unlimited space upgrades', () => {
    const state = freshState();
    state.cash = Number.MAX_SAFE_INTEGER;
    state.levels.spaces = 100;
    const next = buyUpgrade(state, 'spaces');
    expect(next.spaces).toBe(2);
    expect(next.levels.spaces).toBe(101);
  });

  it('sets any non-negative hourly price without charging cash', () => {
    const state = freshState();
    const next = setHourlyPrice(state, 7.349);
    expect(next.price).toBe(7.35);
    expect(next.cash).toBe(state.cash);
    expect(setHourlyPrice(state, -1)).toBe(state);
  });

  it('reports the revenue earned by one real-time tick as profit per second', () => {
    const state = freshState();
    expect(incomePerSecond(state)).toBeCloseTo(incomePerMinute(state) * 2);
  });

  it('does not mutate or upgrade an unaffordable state', () => {
    const state = freshState();
    state.cash = 0;
    expect(buyUpgrade(state, 'automation')).toBe(state);
    expect(state.levels.automation).toBe(0);
  });

  it('repairs an incident and improves condition', () => {
    const state = freshState();
    state.cash = 350;
    state.condition = 50;
    state.activeIncident = { id: 'gate', title: 'Defekt', description: 'Test', repairCost: 90 };
    const next = repairIncident(state);
    expect(next.activeIncident).toBeNull();
    expect(next.condition).toBe(72);
    expect(next.cash).toBe(260);
  });

  it('performs preventive maintenance', () => {
    const state = freshState();
    state.cash = 350;
    state.condition = 60;
    const next = performMaintenance(state);
    expect(next.condition).toBe(100);
    expect(next.cash).toBe(state.cash - maintenanceCost(state));
  });

  it('caps offline progress at eight hours and rewards automation', () => {
    const state = freshState();
    state.lastSavedAt = 1_000;
    const base = calculateOfflineProgress(state, 1_000 + 24 * 60 * 60_000);
    state.levels.automation = 2;
    const automated = calculateOfflineProgress(state, 1_000 + 24 * 60 * 60_000);
    expect(base.minutes).toBe(480);
    expect(automated.earned).toBeGreaterThan(base.earned);
  });

  it('applies an active gate penalty to revenue', () => {
    const state = freshState();
    const normal = incomePerMinute(state);
    state.activeIncident = { id: 'gate', title: 'Defekt', description: 'Test', repairCost: 90 };
    expect(incomePerMinute(state)).toBeCloseTo(normal * 0.55);
  });

  it('can trigger a bounded incident after the cooldown', () => {
    const state = freshState();
    state.condition = 70;
    state.incidentCooldown = 0;
    const random = vi.fn().mockReturnValue(0);
    const next = simulateTick(state, random);
    expect(next.activeIncident).not.toBeNull();
    expect(next.log[0]).toContain('kümmere dich');
  });
});
