import { Env } from '../types';

export type StepDownLevel = 'NORMAL' | 'CONSERVATIVE' | 'CRITICAL' | 'SHUTDOWN';

export interface GovernorState {
  stepDownLevel: StepDownLevel;
  totalBudget: number;
  totalCreditsUsed: number;
  remainingPool: number;
  daysRemaining: number;
  dailyCap: number;
  dailyCreditsUsed: number;
  dailyCapRemainingPct: number;
  canCallEvon: boolean;
  canCallPrisma: boolean;
  canCallTimbre: boolean;
  canCallWebSearchFallback: boolean;
}

export interface CreditLedgerEntry {
  service: 'GNANI_PRISMA' | 'GNANI_EVON' | 'GNANI_TIMBRE' | 'SUPADATA' | 'TRANSCRIPT_API' | 'YOUTUBE_DATA' | 'WEB_SEARCH';
  operation: string;
  unitsConsumed: number;
  estimatedCredits: number;
  httpStatus: number;
  latencyMs: number;
  ipHash?: string;
}

export class GovernorService {
  private env: Env;
  private totalBudget: number;
  private endDate: Date;
  private reserveRatio: number;

  constructor(env: Env) {
    this.env = env;
    this.totalBudget = parseFloat(env.GNANI_TOTAL_CREDIT_BUDGET || '3000');
    this.endDate = new Date(env.GNANI_BUDGET_END_DATE || '2026-12-15T23:59:59.999Z');
    this.reserveRatio = parseFloat(env.GNANI_RESERVE_RATIO || '0.10');
  }

  /**
   * Retrieves or computes the active Credit Governor state.
   */
  async getState(): Promise<GovernorState> {
    const todayUtc = new Date().toISOString().split('T')[0];
    const cacheKey = `governor:daily:${todayUtc}`;

    // Fast KV edge check (5 min TTL)
    if (this.env.KV) {
      try {
        const cached = await this.env.KV.get<GovernorState>(cacheKey, 'json');
        if (cached) return cached;
      } catch (e) {
        console.warn('[Governor] KV read error:', e);
      }
    }

    // Calculate pool days remaining
    const nowMs = Date.now();
    const endMs = this.endDate.getTime();
    const daysRemaining = Math.max(1, Math.ceil((endMs - nowMs) / (1000 * 60 * 60 * 24)));

    let totalCreditsUsed = 0;
    let dailyCreditsUsed = 0;

    if (this.env.DB) {
      try {
        const totalRow = await this.env.DB.prepare(
          `SELECT SUM(estimated_credits) as total FROM credit_ledger`
        ).first<{ total: number | null }>();
        totalCreditsUsed = totalRow?.total ?? 0;

        const dailyRow = await this.env.DB.prepare(
          `SELECT SUM(estimated_credits) as daily FROM credit_ledger WHERE date_utc = ?1`
        )
          .bind(todayUtc)
          .first<{ daily: number | null }>();
        dailyCreditsUsed = dailyRow?.daily ?? 0;
      } catch (e) {
        console.warn('[Governor] DB query error:', e);
      }
    }

    const workingPool = this.totalBudget * (1 - this.reserveRatio);
    const remainingPool = Math.max(0, workingPool - totalCreditsUsed);
    const dailyCap = Math.max(5, remainingPool / daysRemaining);

    const remainingToday = Math.max(0, dailyCap - dailyCreditsUsed);
    const dailyCapRemainingPct = Math.round((remainingToday / dailyCap) * 1000) / 10;

    let stepDownLevel: StepDownLevel = 'NORMAL';
    if (dailyCapRemainingPct < 5 || remainingToday <= 0) {
      stepDownLevel = 'SHUTDOWN';
    } else if (dailyCapRemainingPct < 20) {
      stepDownLevel = 'CRITICAL';
    } else if (dailyCapRemainingPct <= 40) {
      stepDownLevel = 'CONSERVATIVE';
    }

    const state: GovernorState = {
      stepDownLevel,
      totalBudget: this.totalBudget,
      totalCreditsUsed: Math.round(totalCreditsUsed * 100) / 100,
      remainingPool: Math.round(remainingPool * 100) / 100,
      daysRemaining,
      dailyCap: Math.round(dailyCap * 100) / 100,
      dailyCreditsUsed: Math.round(dailyCreditsUsed * 100) / 100,
      dailyCapRemainingPct,
      canCallEvon: stepDownLevel !== 'SHUTDOWN',
      canCallPrisma: stepDownLevel !== 'SHUTDOWN',
      canCallTimbre: stepDownLevel === 'NORMAL' || stepDownLevel === 'CONSERVATIVE',
      canCallWebSearchFallback: stepDownLevel === 'NORMAL' || stepDownLevel === 'CONSERVATIVE',
    };

    // Cache to KV for 300 seconds
    if (this.env.KV) {
      try {
        await this.env.KV.put(cacheKey, JSON.stringify(state), { expirationTtl: 300 });
      } catch (e) {
        console.warn('[Governor] KV write error:', e);
      }
    }

    return state;
  }

  /**
   * Checks if a specific client IP has exceeded its 10 credits/day cap
   */
  async checkIpDailyCap(ipHash: string): Promise<boolean> {
    if (!this.env.DB) return true;
    const todayUtc = new Date().toISOString().split('T')[0];
    try {
      const row = await this.env.DB.prepare(
        `SELECT SUM(estimated_credits) as ip_total FROM credit_ledger WHERE date_utc = ?1 AND ip_hash = ?2`
      )
        .bind(todayUtc, ipHash)
        .first<{ ip_total: number | null }>();
      const used = row?.ip_total ?? 0;
      return used < 10.0; // 10 credits max per IP per day
    } catch {
      return true;
    }
  }

  /**
   * Persists an operation record in D1 credit_ledger.
   */
  async recordUsage(entry: CreditLedgerEntry): Promise<void> {
    if (!this.env.DB) return;
    const todayUtc = new Date().toISOString().split('T')[0];
    try {
      await this.env.DB.prepare(
        `INSERT INTO credit_ledger (date_utc, service, operation, units_consumed, estimated_credits, http_status, latency_ms, ip_hash)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
      )
        .bind(
          todayUtc,
          entry.service,
          entry.operation,
          entry.unitsConsumed,
          entry.estimatedCredits,
          entry.httpStatus,
          entry.latencyMs,
          entry.ipHash || 'system'
        )
        .run();
    } catch (e) {
      console.warn('[Governor] Failed to log credit ledger entry:', e);
    }
  }
}
