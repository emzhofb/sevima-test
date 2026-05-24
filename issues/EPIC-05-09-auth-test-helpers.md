# [Epic-05] Test helpers for auth

**Labels**: `epic-05`, `good-first-issue`, `area-testing`
**Estimate**: 1 jam
**Depends on**: #43

## Context

Banyak test akan butuh setup user + JWT. Bikin helper untuk konsistensi.

## Acceptance Criteria

- [ ] `packages/api/src/test/auth-helpers.ts` ekspor `createTestUser`, `getAuthToken`
- [ ] Helper buat tenant + user + token JWT dalam satu call
- [ ] Re-usable di semua test file

## Implementation Hints

```ts
// packages/api/src/test/auth-helpers.ts
import { signJwt, hashPassword } from '@flowforge/auth';
import { createTenant } from '../repos/tenant.repo.js';
import { createUser } from '../repos/user.repo.js';
import type { Db } from '@flowforge/shared';

export async function createTestTenantAndUser(
  db: Db,
  options: { slug?: string; role?: 'ADMIN' | 'EDITOR' | 'VIEWER' } = {},
) {
  const slug = options.slug ?? `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tenant = await createTenant(db, { slug, name: `Test ${slug}` });
  const passwordHash = await hashPassword('password123');
  const user = await createUser(db, {
    tenant_id: tenant.id,
    email: `${slug}@test.com`,
    password_hash: passwordHash,
    role: options.role ?? 'EDITOR',
  });
  return { tenant, user };
}

export function buildAuthToken(
  tenantId: string,
  userId: string,
  role: 'ADMIN' | 'EDITOR' | 'VIEWER',
  jwtSecret: string,
): string {
  return signJwt({ tenant_id: tenantId, user_id: userId, role }, jwtSecret);
}
```

Penggunaan:

```ts
const { tenant, user } = await createTestTenantAndUser(db, { role: 'EDITOR' });
const token = buildAuthToken(tenant.id, user.id, user.role, JWT_SECRET);
```

## Files Involved

- `packages/api/src/test/auth-helpers.ts`

## How to Verify

Pakai di test file → test pass.
