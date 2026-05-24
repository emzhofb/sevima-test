# [Epic-02] User repository

**Labels**: `epic-02`, `good-first-issue`, `area-data`
**Estimate**: 1 jam
**Depends on**: #18 (tenant repo)

## Context

CRUD dasar untuk `users` table. Selalu scope ke `tenant_id`.

## Acceptance Criteria

- [ ] `packages/api/src/repos/user.repo.ts` ekspor functions
- [ ] `createUser({ tenant_id, email, password_hash, role })`
- [ ] `getUserByEmail(tenant_id, email)`
- [ ] `getUserById(tenant_id, id)`
- [ ] Semua function wajib argumen `tenant_id` (kecuali login flow yang harus join via email lookup)
- [ ] Integration test

## Implementation Hints

```ts
import type { Db } from '@flowforge/shared';

export type Role = 'ADMIN' | 'EDITOR' | 'VIEWER';

export type User = {
  id: string;
  tenant_id: string;
  email: string;
  password_hash: string;
  role: Role;
  created_at: Date;
};

export async function createUser(
  db: Db,
  input: Omit<User, 'id' | 'created_at'>,
): Promise<User> {
  const result = await db.query<User>(
    `INSERT INTO users (tenant_id, email, password_hash, role)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [input.tenant_id, input.email, input.password_hash, input.role],
  );
  return result.rows[0];
}

export async function getUserByEmail(
  db: Db,
  tenantId: string,
  email: string,
): Promise<User | null> {
  const result = await db.query<User>(
    'SELECT * FROM users WHERE tenant_id = $1 AND email = $2',
    [tenantId, email],
  );
  return result.rows[0] ?? null;
}

export async function getUserById(
  db: Db,
  tenantId: string,
  id: string,
): Promise<User | null> {
  const result = await db.query<User>(
    'SELECT * FROM users WHERE tenant_id = $1 AND id = $2',
    [tenantId, id],
  );
  return result.rows[0] ?? null;
}

// For login: lookup by tenant slug + email
export async function findUserForLogin(
  db: Db,
  tenantSlug: string,
  email: string,
): Promise<User | null> {
  const result = await db.query<User>(
    `SELECT u.* FROM users u
     JOIN tenants t ON t.id = u.tenant_id
     WHERE t.slug = $1 AND u.email = $2`,
    [tenantSlug, email],
  );
  return result.rows[0] ?? null;
}
```

## Files Involved

- `packages/api/src/repos/user.repo.ts`
- `packages/api/src/repos/user.repo.test.ts`

## How to Verify

```bash
pnpm -F @flowforge/api test repos/user
```
