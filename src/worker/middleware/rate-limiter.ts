import { Context, Next } from 'hono';
import { AppEnv, ApiErrorResponse } from '../types';

export type EndpointCategory = 'ASK_QUERY' | 'INIT_TRANSCRIPT' | 'VOICE_TRANSCRIBE' | 'WAY_QUESTIONS' | 'GENERAL';

export interface RateLimitRule {
  category: EndpointCategory;
  limit: number;
  windowSeconds: number;
}

const RULES: Record<EndpointCategory, { limit: number; windowSeconds: number }> = {
  ASK_QUERY: { limit: 15, windowSeconds: 60 }, // 15 queries / minute
  INIT_TRANSCRIPT: { limit: 2, windowSeconds: 600 }, // 2 inits / 10 minutes
  VOICE_TRANSCRIBE: { limit: 6, windowSeconds: 60 }, // 6 audio transcriptions / minute
  WAY_QUESTIONS: { limit: 30, windowSeconds: 60 }, // 30 way question requests / minute
  GENERAL: { limit: 60, windowSeconds: 60 }, // 60 general requests / minute
};

/**
 * Derives a deterministic, salted HMAC-SHA256 hash of the client IP.
 * Guarantees zero raw IP persistence in D1 / KV logs.
 */
export async function getHashedIp(c: Context<AppEnv>): Promise<string> {
  const rawIp =
    c.req.header('cf-connecting-ip') ||
    c.req.header('x-forwarded-for')?.split(',')[0].trim() ||
    '127.0.0.1';
  const salt = c.env.IP_HASH_SALT || 'conv-way-default-salt-2026';

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(salt),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(rawIp));
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

/**
 * Checks rate limits in Cloudflare D1. Falls back to pass-through if D1 is temporarily unreachable.
 */
export async function checkRateLimit(
  c: Context<AppEnv>,
  category: EndpointCategory,
  ipHash: string
): Promise<{ allowed: boolean; remaining: number; retryAfterSeconds: number }> {
  const rule = RULES[category] || RULES.GENERAL;
  const now = new Date();
  const windowStartMs = Math.floor(now.getTime() / (rule.windowSeconds * 1000)) * (rule.windowSeconds * 1000);
  const windowBucket = new Date(windowStartMs).toISOString();
  const expiresAt = new Date(windowStartMs + rule.windowSeconds * 1000).toISOString();

  if (!c.env.DB) {
    return { allowed: true, remaining: rule.limit, retryAfterSeconds: 0 };
  }

  try {
    // Upsert atomic counter in D1 rate_limit_counters
    const result = await c.env.DB.prepare(
      `INSERT INTO rate_limit_counters (ip_hash, window_bucket, endpoint_category, request_count, credits_used, expires_at)
       VALUES (?1, ?2, ?3, 1, 0, ?4)
       ON CONFLICT(ip_hash, window_bucket, endpoint_category)
       DO UPDATE SET request_count = request_count + 1
       RETURNING request_count`
    )
      .bind(ipHash, windowBucket, category, expiresAt)
      .first<{ request_count: number }>();

    const count = result?.request_count ?? 1;
    if (count > rule.limit) {
      const remainingSeconds = Math.max(
        1,
        Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000)
      );
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: remainingSeconds,
      };
    }

    return {
      allowed: true,
      remaining: Math.max(0, rule.limit - count),
      retryAfterSeconds: 0,
    };
  } catch (err) {
    // Never block legitimate viewers on transient D1 counter errors
    console.warn('[RateLimiter] D1 counter check error:', err);
    return { allowed: true, remaining: rule.limit, retryAfterSeconds: 0 };
  }
}

/**
 * Hono Middleware factory for endpoint-specific rate limiting
 */
export function rateLimiterMiddleware(category: EndpointCategory) {
  return async (c: Context<AppEnv>, next: Next) => {
    const ipHash = await getHashedIp(c);
    c.set('ipHash', ipHash);

    const check = await checkRateLimit(c, category, ipHash);
    c.header('X-RateLimit-Limit', String(RULES[category].limit));
    c.header('X-RateLimit-Remaining', String(check.remaining));

    if (!check.allowed) {
      c.header('Retry-After', String(check.retryAfterSeconds));
      const errorResponse: ApiErrorResponse = {
        ok: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Too many requests for ${category}. Please wait ${check.retryAfterSeconds} seconds before retrying.`,
          retryable: true,
          details: { retryAfterSeconds: check.retryAfterSeconds },
        },
      };
      return c.json(errorResponse, 429);
    }

    await next();
  };
}
