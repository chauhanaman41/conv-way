import { describe, it, expect } from 'vitest';
import { GovernorService } from '../../src/worker/services/governor';
import { Env } from '../../src/worker/types';

describe('GovernorService Unit Tests', () => {
  it('computes daily cap and normal stepDownLevel from pool config', async () => {
    const mockEnv: Env = {
      DB: undefined as any,
      KV: undefined as any,
      GNANI_TOTAL_CREDIT_BUDGET: '3000',
      GNANI_BUDGET_END_DATE: '2026-12-15T23:59:59.999Z',
      GNANI_RESERVE_RATIO: '0.10',
    };

    const gov = new GovernorService(mockEnv);
    const state = await gov.getState();

    expect(state.totalBudget).toBe(3000);
    expect(state.remainingPool).toBe(2700); // 3000 * 0.90
    expect(state.daysRemaining).toBeGreaterThan(0);
    expect(state.dailyCap).toBeGreaterThan(0);
    expect(state.stepDownLevel).toBe('NORMAL');
    expect(state.canCallEvon).toBe(true);
    expect(state.canCallPrisma).toBe(true);
    expect(state.canCallTimbre).toBe(true);
    expect(state.canCallWebSearchFallback).toBe(true);
  });
});
