import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Redis } from 'ioredis';
import { checkRateLimit, rateLimitMiddleware } from './rate-limit.js';

type SortedSetState = {
  values: Map<string, number>;
  expiresAtMs?: number;
};

class FakeRedis {
  private readonly store = new Map<string, SortedSetState>();

  private getState(key: string): SortedSetState {
    this.cleanupIfExpired(key);
    const current = this.store.get(key);
    if (current) return current;

    const created: SortedSetState = { values: new Map() };
    this.store.set(key, created);
    return created;
  }

  private cleanupIfExpired(key: string) {
    const state = this.store.get(key);
    if (!state?.expiresAtMs) return;
    if (Date.now() >= state.expiresAtMs) {
      this.store.delete(key);
    }
  }

  async zremrangebyscore(key: string, min: string | number, max: string | number): Promise<number> {
    const state = this.getState(key);
    const minNum = min === '-inf' ? Number.NEGATIVE_INFINITY : Number(min);
    const maxNum = max === '+inf' ? Number.POSITIVE_INFINITY : Number(max);
    let removed = 0;
    for (const [member, score] of state.values.entries()) {
      if (score >= minNum && score <= maxNum) {
        state.values.delete(member);
        removed += 1;
      }
    }
    return removed;
  }

  async zadd(key: string, score: number, member: string): Promise<number> {
    const state = this.getState(key);
    state.values.set(member, score);
    return 1;
  }

  async zcard(key: string): Promise<number> {
    const state = this.getState(key);
    return state.values.size;
  }

  async zrange(key: string, start: number, stop: number, withScores?: 'WITHSCORES'): Promise<string[]> {
    const state = this.getState(key);
    const sorted = [...state.values.entries()].sort((a, b) => a[1] - b[1]);
    const end = stop < 0 ? undefined : stop + 1;
    const slice = sorted.slice(start, end);
    if (withScores === 'WITHSCORES') {
      return slice.flatMap(([member, score]) => [member, String(score)]);
    }
    return slice.map(([member]) => member);
  }

  async expire(key: string, seconds: number): Promise<number> {
    const state = this.getState(key);
    state.expiresAtMs = Date.now() + (seconds * 1000);
    return 1;
  }
}

describe('checkRateLimit', () => {
  let redis: FakeRedis;

  beforeEach(() => {
    redis = new FakeRedis();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows first N requests and blocks N+1 with retry-after', async () => {
    expect(await checkRateLimit(redis as unknown as Redis, 'tenant-1:/auth/login', 2, 60)).toEqual({ allowed: true });
    expect(await checkRateLimit(redis as unknown as Redis, 'tenant-1:/auth/login', 2, 60)).toEqual({ allowed: true });

    const blocked = await checkRateLimit(redis as unknown as Redis, 'tenant-1:/auth/login', 2, 60);
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.retryAfterSec).toBe(60);
    }
  });

  it('allows requests again after the sliding window has passed', async () => {
    expect(await checkRateLimit(redis as unknown as Redis, 'tenant-1:/auth/login', 1, 60)).toEqual({ allowed: true });
    expect((await checkRateLimit(redis as unknown as Redis, 'tenant-1:/auth/login', 1, 60)).allowed).toBe(false);

    vi.advanceTimersByTime(61_000);

    expect(await checkRateLimit(redis as unknown as Redis, 'tenant-1:/auth/login', 1, 60)).toEqual({ allowed: true });
  });
});

describe('rateLimitMiddleware', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns 429 with Retry-After and isolates by tenant and route', async () => {
    const app = Fastify();
    const redis = new FakeRedis();

    app.decorateRequest('ctx', undefined);
    app.addHook('onRequest', async (request) => {
      request.ctx = {
        tenant_id: String(request.headers['x-tenant-id'] ?? 'tenant-1'),
        user_id: 'user-1',
        role: 'ADMIN',
        request_id: 'req-1',
      };
    });

    const limiter = rateLimitMiddleware(redis as unknown as Redis, { limit: 1, windowSec: 60 });
    app.get('/auth/login', { preHandler: limiter }, async () => ({ ok: true }));
    app.get('/auth/refresh', { preHandler: limiter }, async () => ({ ok: true }));

    const first = await app.inject({ method: 'GET', url: '/auth/login', headers: { 'x-tenant-id': 'tenant-1' } });
    expect(first.statusCode).toBe(200);

    const limited = await app.inject({ method: 'GET', url: '/auth/login', headers: { 'x-tenant-id': 'tenant-1' } });
    expect(limited.statusCode).toBe(429);
    expect(limited.headers['retry-after']).toBe('60');
    expect(JSON.parse(limited.body)).toEqual({ error: 'rate_limited', retry_after: 60 });

    const otherRoute = await app.inject({ method: 'GET', url: '/auth/refresh', headers: { 'x-tenant-id': 'tenant-1' } });
    expect(otherRoute.statusCode).toBe(200);

    const otherTenant = await app.inject({ method: 'GET', url: '/auth/login', headers: { 'x-tenant-id': 'tenant-2' } });
    expect(otherTenant.statusCode).toBe(200);

    await app.close();
  });

  it('skips rate limiting when request context is missing', async () => {
    const app = Fastify();
    const redis = new FakeRedis();

    app.decorateRequest('ctx', undefined);
    app.get('/public', { preHandler: rateLimitMiddleware(redis as unknown as Redis, { limit: 1, windowSec: 60 }) }, async () => ({ ok: true }));

    const first = await app.inject({ method: 'GET', url: '/public' });
    const second = await app.inject({ method: 'GET', url: '/public' });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);

    await app.close();
  });
});
