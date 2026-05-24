# [Epic-02] Tenant repository

**Labels**: `epic-02`, `good-first-issue`, `area-data`
**Estimate**: 1 jam
**Depends on**: #17 (db client)

## Context

CRUD dasar untuk `tenants` table. Tenant biasanya dibuat saat onboarding (admin manual atau signup endpoint).

## Acceptance Criteria

- [ ] `packages/api/src/repos/tenant.repo.ts` ekspor functions
- [ ] `createTenant({ slug, name })` returns Tenant
- [ ] `getTenantBySlug(slug)` returns Tenant | null
- [ ] `getTenantById(id)` returns Tenant | null
- [ ] Test integration dengan DB real

## Implementation Hints

```ts
import type { Db } from '@flowforge/shared';

export type Tenant = {
  id: string;
  slug: string;
  name: string;
  created_at: Date;
};

export async function createTenant(
  db: Db,
  input: { slug: string; name: string },
): Promise<Tenant> {
  const result = await db.query<Tenant>(
    'INSERT INTO tenants (slug, name) VALUES ($1, $2) RETURNING *',
    [input.slug, input.name],
  );
  return result.rows[0];
}

export async function getTenantBySlug(db: Db, slug: string): Promise<Tenant | null> {
  const result = await db.query<Tenant>(
    'SELECT * FROM tenants WHERE slug = $1',
    [slug],
  );
  return result.rows[0] ?? null;
}

export async function getTenantById(db: Db, id: string): Promise<Tenant | null> {
  const result = await db.query<Tenant>('SELECT * FROM tenants WHERE id = $1', [id]);
  return result.rows[0] ?? null;
}
```

Test:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createDbClient } from '@flowforge/shared';
import { createTenant, getTenantBySlug } from './tenant.repo.js';

describe('tenant.repo', () => {
  const db = createDbClient({ DATABASE_URL: process.env.DATABASE_URL! });

  beforeEach(async () => {
    await db.query('DELETE FROM tenants');
  });

  it('creates and retrieves tenant', async () => {
    const t = await createTenant(db, { slug: 'acme', name: 'Acme Corp' });
    expect(t.id).toBeDefined();
    const found = await getTenantBySlug(db, 'acme');
    expect(found?.name).toBe('Acme Corp');
  });

  it('returns null for missing slug', async () => {
    expect(await getTenantBySlug(db, 'missing')).toBeNull();
  });
});
```

## Files Involved

- `packages/api/src/repos/tenant.repo.ts`
- `packages/api/src/repos/tenant.repo.test.ts`

## How to Verify

```bash
pnpm migrate:up
pnpm -F @flowforge/api test repos/tenant
```
