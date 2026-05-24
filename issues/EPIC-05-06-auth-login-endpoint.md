# [Epic-05] POST /auth/login endpoint

**Labels**: `epic-05`, `area-api`
**Estimate**: 1.5 jam
**Depends on**: #19 (user repo), #41 (auth middleware)

## Context

Endpoint login: terima `tenant_slug + email + password`, verify, kembalikan JWT.

## Acceptance Criteria

- [ ] `POST /auth/login` route di `packages/api`
- [ ] Body: `{ tenant_slug, email, password }`
- [ ] Verify via repository `findUserForLogin`
- [ ] Return `{ token, expires_in }` kalau valid, 401 kalau invalid
- [ ] Validation pakai zod
- [ ] Rate limit di route ini (lebih ketat: 10 req/menit per IP)

## Implementation Hints

```ts
// packages/api/src/routes/auth.ts
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { signJwt, verifyPassword } from '@flowforge/auth';
import { findUserForLogin } from '../repos/user.repo.js';

const LoginBodySchema = z.object({
  tenant_slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}$/),
  email: z.string().email(),
  password: z.string().min(1),
});

export const authRoutes: FastifyPluginAsync<{ jwtSecret: string }> = async (fastify, opts) => {
  fastify.post('/auth/login', async (request, reply) => {
    const parsed = LoginBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_input', issues: parsed.error.flatten() });
    }

    const { tenant_slug, email, password } = parsed.data;
    const db = fastify.db;
    const user = await findUserForLogin(db, tenant_slug, email);

    // Constant-time check: hash even on missing user
    const dummyHash = '$argon2id$v=19$m=65536,t=3,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const isValid = user
      ? await verifyPassword(password, user.password_hash)
      : await verifyPassword(password, dummyHash).then(() => false);

    if (!user || !isValid) {
      return reply.code(401).send({ error: 'invalid_credentials' });
    }

    const expiresInSec = 900; // 15 min
    const token = signJwt(
      { tenant_id: user.tenant_id, user_id: user.id, role: user.role },
      opts.jwtSecret,
      expiresInSec,
    );

    return { token, expires_in: expiresInSec };
  });
};
```

Test:

```ts
it('returns token on valid credentials', async () => {
  const tenant = await createTenant(db, { slug: 'acme', name: 'Acme' });
  const hash = await hashPassword('correct-pass');
  await createUser(db, { tenant_id: tenant.id, email: 'a@a.com', password_hash: hash, role: 'EDITOR' });

  const res = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { tenant_slug: 'acme', email: 'a@a.com', password: 'correct-pass' },
  });
  expect(res.statusCode).toBe(200);
  expect(res.json().token).toBeDefined();
});

it('returns 401 on wrong password', async () => {
  // ... setup user
  const res = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { tenant_slug: 'acme', email: 'a@a.com', password: 'wrong' },
  });
  expect(res.statusCode).toBe(401);
});
```

## Files Involved

- `packages/api/src/routes/auth.ts`
- `packages/api/src/routes/auth.test.ts`

## How to Verify

```bash
pnpm -F @flowforge/api test routes/auth
```
