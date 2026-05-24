# [Epic-05] Token-bucket rate limiter (Redis)

**Labels**: `epic-05`, `area-auth`
**Estimate**: 2 jam
**Depends on**: #41 (auth middleware)

## Context

Rate limit per `tenant_id` per `route` di Redis. Pakai sliding window (lebih simpel daripada token bucket murni).

## Acceptance Criteria

- [ ] Function `checkRateLimit(redis, key, limit, windowSec): Promise<{ allowed: boolean, retryAfterSec?: number }>`
- [ ] Default 600 req per 60 detik per `(tenant, route)`
- [ ] Fastify plugin/preHandler `rateLimitMiddleware` yang return 429 dengan header `Retry-After`

## Implementation Hints

Pakai `ioredis`:

```bash
pnpm add -F @flowforge/auth ioredis
```

```ts
// packages/auth/src/rate-limit.ts
import type { Redis } from 'ioredis';

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSec: number };

export async function checkRateLimit(
  redis: Redis,
  key: string,
  limit: number,
  windowSec: number,
): Promise<RateLimitResult> {
  const now = Math.floor(Date.now() / 1000);
  const windowKey = `rl:${key}:${Math.floor(now / windowSec)}`;

  const count = await redis.incr(windowKey);
  if (count === 1) {
    await redis.expire(windowKey, windowSec + 1);
  }

  if (count > limit) {
    const ttl = await redis.ttl(windowKey);
    return { allowed: false, retryAfterSec: Math.max(1, ttl) };
  }

  return { allowed: true };
}

import type { FastifyRequest, FastifyReply } from 'fastify';

export function createRateLimitMiddleware(
  redis: Redis,
  opts: { limit: number; windowSec: number } = { limit: 600, windowSec: 60 },
) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.ctx) return; // skip kalau belum auth (atau auth public)

    const key = `${request.ctx.tenant_id}:${request.routeOptions.url ?? request.url}`;
    const result = await checkRateLimit(redis, key, opts.limit, opts.windowSec);

    if (!result.allowed) {
      reply.header('Retry-After', String(result.retryAfterSec));
      return reply.code(429).send({ error: 'rate_limited', retry_after: result.retryAfterSec });
    }
  };
}
```

Test:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import Redis from 'ioredis';
import { checkRateLimit } from './rate-limit.js';

describe('checkRateLimit', () => {
  const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');

  beforeEach(async () => {
    await redis.flushdb();
  });

  it('allows first N requests, blocks N+1', async () => {
    for (let i = 0; i < 5; i++) {
      const r = await checkRateLimit(redis, 'test', 5, 60);
      expect(r.allowed).toBe(true);
    }
    const blocked = await checkRateLimit(redis, 'test', 5, 60);
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });
});
```

## Files Involved

- `packages/auth/src/rate-limit.ts`
- `packages/auth/src/rate-limit.test.ts`

## How to Verify

```bash
docker compose up -d redis
pnpm -F @flowforge/auth test rate-limit
```
