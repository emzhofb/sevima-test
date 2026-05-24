# [Epic-06] Apply rate limit to workflow routes

**Labels**: `epic-06`, `good-first-issue`, `area-api`
**Estimate**: 0.5 jam
**Depends on**: #42 (rate limiter), #50

## Context

Wire rate limit middleware ke workflow routes.

## Acceptance Criteria

- [ ] All `/workflows*` routes punya rate limit 600 req/60s per tenant
- [ ] Test: 601 request dalam 60s → 429

## Implementation Hints

```ts
// packages/api/src/app.ts (update)
import Redis from 'ioredis';
import { createRateLimitMiddleware } from '@flowforge/auth';

const redis = new Redis(config.REDIS_URL);
app.decorate('redis', redis);

const rateLimitGuard = createRateLimitMiddleware(redis, { limit: 600, windowSec: 60 });
app.addHook('preHandler', async (request, reply) => {
  if (request.url.startsWith('/health') || request.url.startsWith('/auth/login')) return;
  return rateLimitGuard(request, reply);
});
```

Test (use lower limit for speed):

```ts
it('returns 429 when rate limited', async () => {
  // Override config to 5 req/min for test
  // Make 6 requests
  for (let i = 0; i < 5; i++) {
    const r = await app.inject({ method: 'GET', url: '/workflows', headers });
    expect(r.statusCode).toBe(200);
  }
  const r = await app.inject({ method: 'GET', url: '/workflows', headers });
  expect(r.statusCode).toBe(429);
  expect(r.headers['retry-after']).toBeDefined();
});
```

## Files Involved

- Update `packages/api/src/app.ts`

## How to Verify

```bash
pnpm -F @flowforge/api test rate-limit
```
