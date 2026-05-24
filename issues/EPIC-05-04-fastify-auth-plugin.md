# [Epic-05] Fastify auth plugin/middleware

**Labels**: `epic-05`, `area-auth`
**Estimate**: 2 jam
**Depends on**: #40

## Context

Fastify plugin yang membaca header `Authorization: Bearer <token>`, verify, dan attach `RequestContext` ke `request.ctx`.

## Acceptance Criteria

- [ ] Plugin `authPlugin` registerable ke Fastify instance
- [ ] Decorator `request.ctx` berisi `RequestContext`
- [ ] Helper `requireAuth(roleMin?)` middleware function
- [ ] Return 401 kalau token absent/invalid/expired
- [ ] Test integration dengan Fastify

## Implementation Hints

```bash
pnpm add -F @flowforge/auth fastify fastify-plugin
```

```ts
// packages/auth/src/middleware.ts
import type { FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { randomUUID } from 'crypto';
import { verifyJwt } from './jwt.js';
import type { RequestContext, Role } from './types.js';

declare module 'fastify' {
  interface FastifyRequest {
    ctx?: RequestContext;
  }
}

const ROLE_HIERARCHY: Record<Role, number> = {
  VIEWER: 1,
  EDITOR: 2,
  ADMIN: 3,
};

const authPluginCallback: FastifyPluginCallback<{ jwtSecret: string }> = (
  fastify,
  opts,
  done,
) => {
  fastify.decorateRequest('ctx', null);

  fastify.addHook('onRequest', async (request, reply) => {
    // Skip pada route public (login, health)
    const url = request.url;
    if (url.startsWith('/health') || url.startsWith('/auth/login')) return;

    const auth = request.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'unauthorized', message: 'Missing or malformed Authorization header' });
    }

    const token = auth.slice('Bearer '.length);
    const claims = verifyJwt(token, opts.jwtSecret);
    if (!claims) {
      return reply.code(401).send({ error: 'unauthorized', message: 'Invalid or expired token' });
    }

    request.ctx = {
      tenant_id: claims.tenant_id,
      user_id: claims.user_id,
      role: claims.role,
      request_id: (request.headers['x-request-id'] as string) ?? randomUUID(),
    };
  });

  done();
};

export const authPlugin = fp(authPluginCallback, { name: 'auth' });

export function requireRole(minRole: Role) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.ctx) {
      return reply.code(401).send({ error: 'unauthorized' });
    }
    if (ROLE_HIERARCHY[request.ctx.role] < ROLE_HIERARCHY[minRole]) {
      return reply.code(403).send({ error: 'forbidden', message: 'Insufficient role' });
    }
  };
}
```

Test:

```ts
import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import { authPlugin, requireRole } from './middleware.js';
import { signJwt } from './jwt.js';

const SECRET = 'a'.repeat(40);

describe('authPlugin', () => {
  it('returns 401 on missing token', async () => {
    const app = Fastify();
    await app.register(authPlugin, { jwtSecret: SECRET });
    app.get('/protected', async (req) => ({ ctx: req.ctx }));

    const res = await app.inject({ method: 'GET', url: '/protected' });
    expect(res.statusCode).toBe(401);
  });

  it('returns ctx for valid token', async () => {
    const app = Fastify();
    await app.register(authPlugin, { jwtSecret: SECRET });
    app.get('/protected', async (req) => ({ tenant: req.ctx?.tenant_id }));

    const token = signJwt({ tenant_id: 't1', user_id: 'u1', role: 'EDITOR' }, SECRET);
    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().tenant).toBe('t1');
  });

  it('returns 403 for insufficient role', async () => {
    const app = Fastify();
    await app.register(authPlugin, { jwtSecret: SECRET });
    app.get('/admin', { preHandler: requireRole('ADMIN') }, async () => ({}));

    const token = signJwt({ tenant_id: 't1', user_id: 'u1', role: 'VIEWER' }, SECRET);
    const res = await app.inject({
      method: 'GET',
      url: '/admin',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });
});
```

## Files Involved

- `packages/auth/src/middleware.ts`
- `packages/auth/src/middleware.test.ts`

## How to Verify

```bash
pnpm -F @flowforge/auth test middleware
```
